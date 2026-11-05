export class StorageError extends Error {
  constructor(message, { code = "STORAGE_ERROR", cause } = {}) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export function asStorageError(error, message, code = "STORAGE_ERROR") {
  if (error instanceof StorageError) return error;
  return new StorageError(message, { code, cause: error });
}
