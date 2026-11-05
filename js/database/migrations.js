export const DATABASE_NAME = "PEN501_DB";
export const DATABASE_VERSION = 1;

export const STORE_DEFINITIONS = Object.freeze({
  vocabulary: {
    keyPath: "id",
    indexes: [
      ["word", "word", { unique: false }],
      ["partOfSpeech", "partOfSpeech", { unique: false }],
      ["updatedAt", "updatedAt", { unique: false }],
      ["tags", "tags", { unique: false, multiEntry: true }],
    ],
  },
  flashcardSets: {
    keyPath: "id",
    indexes: [["name", "name", { unique: false }], ["updatedAt", "updatedAt", { unique: false }]],
  },
  flashcards: {
    keyPath: "id",
    indexes: [
      ["setId", "setId", { unique: false }],
      ["vocabularyId", "vocabularyId", { unique: false }],
      ["nextReview", "nextReview", { unique: false }],
      ["lastReviewed", "lastReviewed", { unique: false }],
    ],
  },
  writingTopics: {
    keyPath: "id",
    indexes: [
      ["category", "category", { unique: false }],
      ["difficulty", "difficulty", { unique: false }],
      ["isFavorite", "isFavorite", { unique: false }],
      ["isBuiltIn", "isBuiltIn", { unique: false }],
      ["updatedAt", "updatedAt", { unique: false }],
    ],
  },
  writingTasks: {
    keyPath: "id",
    indexes: [
      ["topicId", "topicId", { unique: false }],
      ["category", "category", { unique: false }],
      ["writingType", "writingType", { unique: false }],
      ["createdAt", "createdAt", { unique: false }],
    ],
  },
  writingSubmissions: {
    keyPath: "id",
    indexes: [
      ["taskId", "taskId", { unique: false }],
      ["status", "status", { unique: false }],
      ["createdAt", "createdAt", { unique: false }],
      ["updatedAt", "updatedAt", { unique: false }],
      ["submittedAt", "submittedAt", { unique: false }],
    ],
  },
  writingEvaluations: {
    keyPath: "id",
    indexes: [
      ["submissionId", "submissionId", { unique: false }],
      ["evaluationType", "evaluationType", { unique: false }],
      ["createdAt", "createdAt", { unique: false }],
    ],
  },
  documents: {
    keyPath: "id",
    indexes: [
      ["fileType", "fileType", { unique: false }],
      ["createdAt", "createdAt", { unique: false }],
      ["updatedAt", "updatedAt", { unique: false }],
    ],
  },
  annotations: {
    keyPath: "id",
    indexes: [
      ["documentId", "documentId", { unique: false }],
      ["type", "type", { unique: false }],
      ["pageNumber", "pageNumber", { unique: false }],
      ["createdAt", "createdAt", { unique: false }],
    ],
  },
  appProgress: {
    keyPath: "id",
    indexes: [
      ["activityType", "activityType", { unique: false }],
      ["activityDate", "activityDate", { unique: false }],
    ],
  },
  settings: {
    keyPath: "key",
    indexes: [["updatedAt", "updatedAt", { unique: false }]],
  },
});

export const STORE_NAMES = Object.freeze(Object.keys(STORE_DEFINITIONS));

function createStore(db, name, definition) {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, { keyPath: definition.keyPath });
  for (const [indexName, keyPath, options] of definition.indexes) {
    store.createIndex(indexName, keyPath, options);
  }
}

const migrations = [
  {
    version: 1,
    upgrade(db) {
      for (const [name, definition] of Object.entries(STORE_DEFINITIONS)) {
        createStore(db, name, definition);
      }
    },
  },
];

export function applyMigrations(db, transaction, oldVersion, newVersion) {
  if (newVersion == null || newVersion > DATABASE_VERSION) {
    throw new Error("No migration is registered for the requested database version.");
  }
  for (const migration of migrations) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      migration.upgrade(db, transaction);
    }
  }
}
