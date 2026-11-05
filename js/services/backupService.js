import { APP_CONFIG } from "../config.js";
import { StorageError } from "../database/errors.js";
import { DATABASE_VERSION, STORE_NAMES } from "../database/migrations.js";
import { storage } from "../database/storage.js";

const BACKUP_FORMAT = "PEN501_BACKUP";
const BACKUP_FORMAT_VERSION = 1;
const BLOB_MARKER = "__pen501_backup_blob_v1__";

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encodeBackupValue(value, ancestors = new Set()) {
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    return {
      [BLOB_MARKER]: true,
      mimeType: value.type,
      data: bytesToBase64(bytes),
    };
  }
  if (value instanceof ArrayBuffer) {
    return {
      [BLOB_MARKER]: true,
      arrayBuffer: true,
      data: bytesToBase64(new Uint8Array(value)),
    };
  }
  if (ArrayBuffer.isView(value)) {
    return {
      [BLOB_MARKER]: true,
      viewType: value.constructor.name,
      data: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
    };
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new StorageError("Backup contains a circular data reference.", { code: "BACKUP_SERIALIZATION_FAILED" });
    const nestedAncestors = new Set(ancestors).add(value);
    return Promise.all(value.map((item) => encodeBackupValue(item, nestedAncestors)));
  }
  if (value && typeof value === "object") {
    if (ancestors.has(value)) throw new StorageError("Backup contains a circular data reference.", { code: "BACKUP_SERIALIZATION_FAILED" });
    const nestedAncestors = new Set(ancestors).add(value);
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await encodeBackupValue(item, nestedAncestors)]));
    return Object.fromEntries(entries);
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new StorageError("Backup contains a value that cannot be represented in JSON.", { code: "BACKUP_SERIALIZATION_FAILED" });
  }
  return value;
}

function decodeBackupValue(value) {
  if (Array.isArray(value)) return value.map(decodeBackupValue);
  if (value && typeof value === "object") {
    if (value[BLOB_MARKER] === true) {
      if (typeof value.data !== "string") {
        throw new StorageError("Backup contains an invalid binary file entry.", { code: "INVALID_BACKUP" });
      }
      const bytes = base64ToBytes(value.data);
      if (value.arrayBuffer === true) return bytes.buffer;
      if (typeof value.viewType === "string" && value.viewType !== "Uint8Array") {
        const Constructor = globalThis[value.viewType];
        if (typeof Constructor === "function" && Constructor.BYTES_PER_ELEMENT) {
          return new Constructor(bytes.buffer);
        }
      }
      return new Blob([bytes], { type: typeof value.mimeType === "string" ? value.mimeType : "" });
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeBackupValue(item)]));
  }
  return value;
}

function validateBackupEnvelope(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    throw new StorageError("This file is not a PEN501 backup.", { code: "INVALID_BACKUP" });
  }
  if (backup.format !== BACKUP_FORMAT || backup.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new StorageError("This backup format is not supported by this PEN501 version.", { code: "INVALID_BACKUP_VERSION" });
  }
  if (backup.databaseVersion !== DATABASE_VERSION) {
    throw new StorageError("This backup uses a different database version and cannot be restored by this build.", { code: "INVALID_BACKUP_VERSION" });
  }
  if (!backup.stores || typeof backup.stores !== "object" || Array.isArray(backup.stores)) {
    throw new StorageError("The PEN501 backup is missing its data stores.", { code: "INVALID_BACKUP" });
  }
  for (const storeName of STORE_NAMES) {
    if (!Array.isArray(backup.stores[storeName])) {
      throw new StorageError(`The PEN501 backup is missing ${storeName} data.`, { code: "INVALID_BACKUP" });
    }
  }
}

export async function createBackupBlob() {
  const records = await storage.readAllData();
  const stores = await encodeBackupValue(records);
  const envelope = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: APP_CONFIG.version,
    databaseVersion: DATABASE_VERSION,
    createdAt: new Date().toISOString(),
    stores,
  };
  return new Blob([JSON.stringify(envelope)], { type: "application/json" });
}

export function downloadBackup(blob) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PEN501-backup-${date}.json`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function readBackupFile(file) {
  if (!file || typeof file.text !== "function") {
    throw new StorageError("Choose a PEN501 JSON backup file first.", { code: "BACKUP_FILE_REQUIRED" });
  }
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (error) {
    throw new StorageError("The selected file is not valid JSON.", { code: "INVALID_BACKUP", cause: error });
  }
  validateBackupEnvelope(parsed);
  let stores;
  try {
    stores = decodeBackupValue(parsed.stores);
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError("Backup contains invalid encoded data.", { code: "INVALID_BACKUP", cause: error });
  }
  const counts = await storage.replaceAllData(stores);
  return counts;
}
