import { StorageError } from "./errors.js";
import { isIndexedDBAvailable, openDatabase, requestToPromise, runTransaction } from "./db.js";
import { STORE_DEFINITIONS, STORE_NAMES } from "./migrations.js";

const REQUIRED_FIELDS = Object.freeze({
  vocabulary: ["word"],
  flashcardSets: ["name"],
  flashcards: ["setId", "front", "back"],
  writingTopics: ["title"],
  writingTasks: ["title"],
  writingSubmissions: ["essayContent"],
  writingEvaluations: ["submissionId", "evaluationType"],
  documents: ["fileName", "fileType", "fileData"],
  annotations: ["documentId", "type"],
  appProgress: ["activityType", "activityDate"],
  settings: ["key"],
});

const REFERENCE_FIELDS = Object.freeze({
  flashcards: [
    { field: "setId", store: "flashcardSets", nullable: false },
    { field: "vocabularyId", store: "vocabulary", nullable: true },
  ],
  writingTasks: [{ field: "topicId", store: "writingTopics", nullable: true }],
  writingSubmissions: [{ field: "taskId", store: "writingTasks", nullable: true }],
  writingEvaluations: [{ field: "submissionId", store: "writingSubmissions", nullable: false }],
  annotations: [{ field: "documentId", store: "documents", nullable: false }],
});

const DELETE_POLICIES = Object.freeze({
  flashcardSets: [{ store: "flashcards", index: "setId", action: "delete" }],
  vocabulary: [{ store: "flashcards", index: "vocabularyId", action: "unlink", field: "vocabularyId" }],
  writingTopics: [{ store: "writingTasks", index: "topicId", action: "unlink", field: "topicId" }],
  writingTasks: [{ store: "writingSubmissions", index: "taskId", action: "unlink", field: "taskId" }],
  writingSubmissions: [{ store: "writingEvaluations", index: "submissionId", action: "delete" }],
  documents: [{ store: "annotations", index: "documentId", action: "delete" }],
});

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `pen501-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function assertStore(storeName) {
  if (!Object.hasOwn(STORE_DEFINITIONS, storeName)) {
    throw new StorageError(`Unknown PEN501 data store: ${storeName}.`, { code: "UNKNOWN_STORE" });
  }
}

function validateRecord(storeName, record, { backup = false } = {}) {
  assertStore(storeName);
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    throw new StorageError("A saved record must be an object.", { code: "INVALID_RECORD" });
  }
  const keyPath = STORE_DEFINITIONS[storeName].keyPath;
  if (record[keyPath] === undefined || record[keyPath] === null || record[keyPath] === "") {
    throw new StorageError(`A ${storeName} record needs a ${keyPath}.`, { code: "INVALID_RECORD" });
  }
  for (const field of REQUIRED_FIELDS[storeName]) {
    if (record[field] === undefined || record[field] === null) {
      throw new StorageError(`A ${storeName} record is missing ${field}.`, { code: "INVALID_RECORD" });
    }
  }
  for (const field of ["id", "key", "word", "name", "setId", "title", "submissionId", "documentId", "fileName", "fileType", "activityType", "activityDate", "type", "evaluationType"]) {
    if (record[field] !== undefined && typeof record[field] === "string" && record[field].trim() === "") {
      throw new StorageError(`${field} cannot be blank.`, { code: "INVALID_RECORD" });
    }
  }
  if (storeName === "documents" && typeof Blob !== "undefined" && !(record.fileData instanceof Blob) && !(record.fileData instanceof ArrayBuffer)) {
    throw new StorageError("A document file must be stored as a Blob or ArrayBuffer.", { code: "INVALID_RECORD" });
  }
  if (backup && (!record.createdAt || !record.updatedAt) && storeName !== "settings") {
    throw new StorageError(`A ${storeName} backup record is missing timestamps.`, { code: "INVALID_BACKUP" });
  }
  return record;
}

function prepareRecord(storeName, input, existing = null) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new StorageError("A saved record must be an object.", { code: "INVALID_RECORD" });
  }
  const now = new Date().toISOString();
  const keyPath = STORE_DEFINITIONS[storeName].keyPath;
  const primaryKey = input[keyPath] ?? existing?.[keyPath] ?? (keyPath === "id" ? makeId() : undefined);
  const record = {
    ...existing,
    ...input,
    [keyPath]: primaryKey,
  };
  if (storeName !== "settings") {
    record.createdAt = existing?.createdAt ?? input.createdAt ?? now;
    record.updatedAt = now;
  } else {
    record.updatedAt = now;
  }
  if (storeName === "vocabulary" && !Array.isArray(record.tags)) record.tags = [];
  if (storeName === "writingTopics") {
    if (typeof record.isFavorite !== "boolean") record.isFavorite = false;
    if (typeof record.isBuiltIn !== "boolean") record.isBuiltIn = false;
  }
  for (const reference of REFERENCE_FIELDS[storeName] ?? []) {
    if (reference.nullable && (record[reference.field] === undefined || record[reference.field] === "")) {
      record[reference.field] = null;
    }
  }
  validateRecord(storeName, record);
  return record;
}

function storesForWrite(storeName) {
  return [storeName, ...(REFERENCE_FIELDS[storeName] ?? []).map((reference) => reference.store)];
}

function putWithValidatedReferences(transaction, storeName, record) {
  const references = (REFERENCE_FIELDS[storeName] ?? []).filter((reference) => {
    const value = record[reference.field];
    return !(reference.nullable && (value === null || value === undefined || value === ""));
  });
  const write = () => requestToPromise(
    transaction.objectStore(storeName).put(record),
    `PEN501 could not save ${storeName}.`,
  );
  if (references.length === 0) return write();

  return new Promise((resolve, reject) => {
    let remaining = references.length;
    for (const reference of references) {
      const request = transaction.objectStore(reference.store).get(record[reference.field]);
      request.onerror = () => reject(new StorageError(
        `PEN501 could not verify the ${reference.store} reference.`,
        { code: "REQUEST_FAILED", cause: request.error },
      ));
      request.onsuccess = () => {
        if (!request.result) {
          reject(new StorageError(
            `This ${storeName} record refers to a ${reference.store} item that no longer exists.`,
            { code: "MISSING_REFERENCE" },
          ));
          return;
        }
        remaining -= 1;
        if (remaining === 0) write().then(resolve, reject);
      };
    }
  });
}

export async function getRecord(storeName, id) {
  assertStore(storeName);
  return runTransaction(storeName, "readonly", (transaction) => requestToPromise(
    transaction.objectStore(storeName).get(id),
    `PEN501 could not read ${storeName}.`,
  ));
}

export async function listRecords(storeName) {
  assertStore(storeName);
  return runTransaction(storeName, "readonly", (transaction) => requestToPromise(
    transaction.objectStore(storeName).getAll(),
    `PEN501 could not list ${storeName}.`,
  ));
}

export async function listRecordsByIndex(storeName, indexName, value) {
  assertStore(storeName);
  if (!STORE_DEFINITIONS[storeName].indexes.some(([name]) => name === indexName)) {
    throw new StorageError(`Unknown index ${indexName} on ${storeName}.`, { code: "UNKNOWN_INDEX" });
  }
  return runTransaction(storeName, "readonly", (transaction) => requestToPromise(
    transaction.objectStore(storeName).index(indexName).getAll(globalThis.IDBKeyRange.only(value)),
    `PEN501 could not query ${storeName}.`,
  ));
}

export async function saveRecord(storeName, input) {
  assertStore(storeName);
  const record = prepareRecord(storeName, input);
  return runTransaction(storesForWrite(storeName), "readwrite", (transaction) => putWithValidatedReferences(
    transaction,
    storeName,
    record,
  ).then(() => record));
}

export async function updateRecord(storeName, id, changes) {
  assertStore(storeName);
  if (changes === null || typeof changes !== "object" || Array.isArray(changes)) {
    throw new StorageError("Updates must be provided as an object.", { code: "INVALID_RECORD" });
  }
  return runTransaction(storesForWrite(storeName), "readwrite", (transaction) => new Promise((resolve, reject) => {
    const objectStore = transaction.objectStore(storeName);
    const read = objectStore.get(id);
    read.onerror = () => reject(new StorageError(`PEN501 could not read ${storeName} for update.`, { code: "REQUEST_FAILED", cause: read.error }));
    read.onsuccess = () => {
      if (!read.result) {
        resolve(null);
        return;
      }
      try {
        const record = prepareRecord(storeName, { ...changes, [STORE_DEFINITIONS[storeName].keyPath]: id }, read.result);
        putWithValidatedReferences(transaction, storeName, record).then(() => resolve(record), reject);
      } catch (error) {
        reject(error);
      }
    };
  }));
}

async function removeRecordWithPolicy(storeName, id) {
  assertStore(storeName);
  const policies = DELETE_POLICIES[storeName] ?? [];
  const transactionStores = [storeName, ...policies.map((policy) => policy.store)];
  return runTransaction(transactionStores, "readwrite", (transaction) => new Promise((resolve, reject) => {
    const targetStore = transaction.objectStore(storeName);
    const read = targetStore.get(id);
    read.onerror = () => reject(new StorageError(`PEN501 could not read ${storeName} before deleting it.`, { code: "REQUEST_FAILED", cause: read.error }));
    read.onsuccess = () => {
      if (!read.result) {
        resolve(false);
        return;
      }

      const finishDelete = () => {
        const deletion = targetStore.delete(id);
        deletion.onerror = () => reject(new StorageError(`PEN501 could not delete ${storeName}.`, { code: "REQUEST_FAILED", cause: deletion.error }));
        deletion.onsuccess = () => resolve(true);
      };

      if (policies.length === 0) {
        finishDelete();
        return;
      }

      let completedPolicies = 0;
      for (const policy of policies) {
        const relatedStore = transaction.objectStore(policy.store);
        const readRelated = relatedStore.index(policy.index).getAll(globalThis.IDBKeyRange.only(id));
        readRelated.onerror = () => reject(new StorageError("PEN501 could not read related records before deleting this item.", { code: "REQUEST_FAILED", cause: readRelated.error }));
        readRelated.onsuccess = () => {
          for (const related of readRelated.result) {
            if (policy.action === "unlink") {
              relatedStore.put({ ...related, [policy.field]: null, updatedAt: new Date().toISOString() });
            } else {
              relatedStore.delete(related[STORE_DEFINITIONS[policy.store].keyPath]);
            }
          }
          completedPolicies += 1;
          if (completedPolicies === policies.length) finishDelete();
        };
      }
    };
  }));
}

export async function saveRecords(storeName, records) {
  assertStore(storeName);
  if (!Array.isArray(records)) throw new StorageError("Bulk save expects a list of records.", { code: "INVALID_RECORD" });
  const prepared = records.map((record) => prepareRecord(storeName, record));
  await runTransaction([...new Set(prepared.flatMap(() => storesForWrite(storeName)))], "readwrite", (transaction) => Promise.all(
    prepared.map((record) => putWithValidatedReferences(transaction, storeName, record)),
  ));
  return prepared;
}

export async function deleteRecords(storeName, ids) {
  assertStore(storeName);
  if (!Array.isArray(ids)) throw new StorageError("Bulk delete expects a list of record IDs.", { code: "INVALID_RECORD" });
  let deleted = 0;
  for (const id of ids) {
    if (await removeRecordWithPolicy(storeName, id)) deleted += 1;
  }
  return deleted;
}

export async function readAllData() {
  const data = Object.fromEntries(STORE_NAMES.map((name) => [name, []]));
  return runTransaction(STORE_NAMES, "readonly", (transaction) => Promise.all(
    STORE_NAMES.map((storeName) => requestToPromise(
      transaction.objectStore(storeName).getAll(),
      `PEN501 could not prepare a backup of ${storeName}.`,
    ).then((records) => { data[storeName] = records; }),
  )).then(() => data));
}

function validateRelationships(data) {
  const ids = Object.fromEntries(STORE_NAMES.map((storeName) => [
    storeName,
    new Set(data[storeName].map((record) => record[STORE_DEFINITIONS[storeName].keyPath])),
  ]));
  const relations = [
    ["flashcards", "setId", "flashcardSets", false],
    ["flashcards", "vocabularyId", "vocabulary", true],
    ["writingTasks", "topicId", "writingTopics", true],
    ["writingSubmissions", "taskId", "writingTasks", true],
    ["writingEvaluations", "submissionId", "writingSubmissions", false],
    ["annotations", "documentId", "documents", false],
  ];
  for (const [storeName, field, targetStore, nullable] of relations) {
    for (const record of data[storeName]) {
      const targetId = record[field];
      if (nullable && (targetId === null || targetId === undefined || targetId === "")) continue;
      if (!ids[targetStore].has(targetId)) {
        throw new StorageError(`Backup has a ${storeName} record with a missing ${targetStore} reference.`, { code: "INVALID_BACKUP" });
      }
    }
  }
}

export async function replaceAllData(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new StorageError("Backup data must contain a list for each PEN501 data store.", { code: "INVALID_BACKUP" });
  }
  const prepared = {};
  for (const storeName of STORE_NAMES) {
    if (!Array.isArray(data[storeName])) {
      throw new StorageError(`Backup is missing the ${storeName} data list.`, { code: "INVALID_BACKUP" });
    }
    prepared[storeName] = data[storeName].map((record) => ({ ...validateRecord(storeName, record, { backup: true }) }));
    const keyPath = STORE_DEFINITIONS[storeName].keyPath;
    const keys = prepared[storeName].map((record) => record[keyPath]);
    if (new Set(keys).size !== keys.length) {
      throw new StorageError(`Backup contains duplicate IDs in ${storeName}.`, { code: "INVALID_BACKUP" });
    }
  }
  validateRelationships(prepared);

  await runTransaction(STORE_NAMES, "readwrite", (transaction) => {
    const requests = [];
    for (const storeName of STORE_NAMES) {
      const objectStore = transaction.objectStore(storeName);
      requests.push(requestToPromise(objectStore.clear(), `PEN501 could not replace ${storeName}.`));
      for (const record of prepared[storeName]) {
        requests.push(requestToPromise(objectStore.put(record), `PEN501 could not restore ${storeName}.`));
      }
    }
    return Promise.all(requests);
  });
  return Object.fromEntries(STORE_NAMES.map((name) => [name, prepared[name].length]));
}

export async function getStorageStatus() {
  if (!isIndexedDBAvailable()) {
    return { supported: false, connected: false, usage: null, quota: null, persistent: null, error: "IndexedDB is unavailable in this browser context." };
  }
  try {
    await openDatabase();
    let usage = null;
    let quota = null;
    let persistent = null;
    if (globalThis.navigator?.storage) {
      try {
        const estimate = await globalThis.navigator.storage.estimate();
        usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
        quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
      } catch { /* quota estimates are optional browser metadata */ }
      try {
        persistent = await globalThis.navigator.storage.persisted();
      } catch { /* persistence status is not available in every browser */ }
    }
    return { supported: true, connected: true, usage, quota, persistent, error: null };
  } catch (error) {
    return { supported: true, connected: false, usage: null, quota: null, persistent: null, error: error.message };
  }
}

export const storage = Object.freeze({
  get: getRecord,
  list: listRecords,
  listByIndex: listRecordsByIndex,
  save: saveRecord,
  saveMany: saveRecords,
  update: updateRecord,
  delete: removeRecordWithPolicy,
  deleteMany: deleteRecords,
  readAllData,
  replaceAllData,
  getStorageStatus,
  saveVocabulary: (data) => saveRecord("vocabulary", data),
  getVocabulary: () => listRecords("vocabulary"),
  getVocabularyById: (id) => getRecord("vocabulary", id),
  updateVocabulary: (id, data) => updateRecord("vocabulary", id, data),
  deleteVocabulary: (id) => removeRecordWithPolicy("vocabulary", id),
  saveFlashcardSet: (data) => saveRecord("flashcardSets", data),
  getFlashcardSets: () => listRecords("flashcardSets"),
  saveWritingTopic: (data) => saveRecord("writingTopics", data),
  getWritingTopics: () => listRecords("writingTopics"),
  saveWritingSubmission: (data) => saveRecord("writingSubmissions", data),
  getWritingHistory: () => listRecords("writingSubmissions"),
  saveDocument: (data) => saveRecord("documents", data),
  getDocuments: () => listRecords("documents"),
  saveAnnotation: (data) => saveRecord("annotations", data),
  getAnnotations: (documentId) => listRecordsByIndex("annotations", "documentId", documentId),
  saveSetting: (key, value) => saveRecord("settings", { key, value }),
  getSetting: (key) => getRecord("settings", key),
  deleteSetting: (key) => removeRecordWithPolicy("settings", key),
});
