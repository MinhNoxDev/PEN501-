import { StorageError, asStorageError } from "./errors.js";
import { applyMigrations, DATABASE_NAME, DATABASE_VERSION } from "./migrations.js";

let connectionPromise = null;

export function isIndexedDBAvailable() {
  return typeof globalThis.indexedDB !== "undefined";
}

export function requestToPromise(request, operation = "IndexedDB request failed.") {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(asStorageError(
      request.error,
      operation,
      "REQUEST_FAILED",
    ));
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(asStorageError(
      transaction.error,
      "The database transaction was canceled.",
      "TRANSACTION_ABORTED",
    ));
    transaction.onerror = () => {
      // The abort event carries the final transaction error.
    };
  });
}

export function openDatabase() {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new StorageError(
      "This browser does not provide IndexedDB. Use a current browser over HTTP or HTTPS.",
      { code: "INDEXEDDB_UNAVAILABLE" },
    ));
  }
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve, reject) => {
    let settled = false;
    let request;
    try {
      request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      settled = true;
      reject(asStorageError(error, "PEN501 could not open its local database.", "DATABASE_OPEN_FAILED"));
      return;
    }

    request.onupgradeneeded = (event) => {
      try {
        applyMigrations(request.result, request.transaction, event.oldVersion, event.newVersion);
      } catch (error) {
        try { request.transaction.abort(); } catch { /* the transaction may already be inactive */ }
        if (!settled) {
          settled = true;
          reject(asStorageError(error, "PEN501 could not prepare the database upgrade.", "MIGRATION_FAILED"));
        }
      }
    };

    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new StorageError(
        "Close other PEN501 tabs to let the database finish opening or upgrading.",
        { code: "DATABASE_BLOCKED" },
      ));
    };

    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(asStorageError(request.error, "PEN501 could not open its local database.", "DATABASE_OPEN_FAILED"));
    };

    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      db.onversionchange = () => {
        db.close();
        connectionPromise = null;
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new CustomEvent("pen501:database-versionchange"));
        }
      };
      resolve(db);
    };
  }).catch((error) => {
    connectionPromise = null;
    throw error;
  });

  return connectionPromise;
}

export async function runTransaction(storeNames, mode, operation) {
  const db = await openDatabase();
  let transaction;
  try {
    transaction = db.transaction(storeNames, mode);
  } catch (error) {
    throw asStorageError(error, "PEN501 could not start a database transaction.", "TRANSACTION_FAILED");
  }

  const completed = transactionToPromise(transaction);
  try {
    const work = Promise.resolve(operation(transaction));
    const first = await Promise.race([
      work.then((value) => ({ kind: "work", value })),
      completed.then(() => ({ kind: "completed" })),
    ]);
    const result = first.kind === "work" ? first.value : await work;
    await completed;
    return result;
  } catch (error) {
    try { transaction.abort(); } catch { /* an inactive transaction cannot be aborted */ }
    await completed.catch(() => {});
    throw asStorageError(error, "PEN501 could not complete the database transaction.", "TRANSACTION_FAILED");
  }
}

export async function closeDatabase() {
  if (!connectionPromise) return;
  try {
    const db = await connectionPromise;
    db.close();
  } catch {
    // Nothing to close when opening failed.
  } finally {
    connectionPromise = null;
  }
}
