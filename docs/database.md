# PEN501 local database

## Version 1

The browser database is named `PEN501_DB`, currently at IndexedDB version `1`. The version-1 migration creates each object store and its indexes without deleting or replacing existing data. Future schema changes must increment `DATABASE_VERSION` and add a forward migration; do not delete the database to make an upgrade work.

| Store | Key | Useful indexes | Purpose |
|---|---|---|---|
| `vocabulary` | `id` | `word`, `partOfSpeech`, `updatedAt`, multi-entry `tags` | Personal vocabulary records |
| `flashcardSets` | `id` | `name`, `updatedAt` | Named review collections |
| `flashcards` | `id` | `setId`, `vocabularyId`, `nextReview`, `lastReviewed` | Card content and review schedule |
| `writingTopics` | `id` | `category`, `difficulty`, `isFavorite`, `isBuiltIn`, `updatedAt` | Built-in and personal prompts |
| `writingTasks` | `id` | `topicId`, `category`, `writingType`, `createdAt` | Individual writing sessions |
| `writingSubmissions` | `id` | `taskId`, `status`, `createdAt`, `updatedAt`, `submittedAt` | Drafts and completed writing |
| `writingEvaluations` | `id` | `submissionId`, `evaluationType`, `createdAt` | Rubrics and feedback history |
| `documents` | `id` | `fileType`, `createdAt`, `updatedAt` | Document metadata and binary `Blob` data |
| `annotations` | `id` | `documentId`, `type`, `pageNumber`, `createdAt` | Notes and marks attached to documents |
| `appProgress` | `id` | `activityType`, `activityDate` | Learning activity records |
| `settings` | `key` | `updatedAt` | Small application settings stored in IndexedDB |

Theme remains a small LocalStorage preference. Learning records are kept in IndexedDB and are not automatically synchronized to another device.

## Storage Service

Modules should use `js/database/storage.js`; they should not create database connections or transactions. The service exposes generic `get`, `list`, `listByIndex`, `save`, `saveMany`, `update`, `delete`, and `deleteMany` operations, plus named helpers for the current vocabulary, flashcard-set, writing-topic, writing-submission, document, annotation, and settings use cases.

Every write resolves only after the IndexedDB transaction completes. A failed request aborts the transaction and returns a `StorageError` with a stable error code. The connection is shared while the page is open; a version change closes the old connection so a later open can use the upgraded schema. A blocked upgrade tells the user to close other PEN501 tabs. Since IndexedDB has no foreign-key constraint, saves and updates check references inside their transaction, and restores validate them before replacing any data.

### Reference deletion policy

- Deleting a vocabulary item keeps its flashcards and unlinks `vocabularyId`; card text remains intact.
- Deleting a writing topic unlinks its writing tasks.
- Deleting a writing task unlinks its submissions.
- Deleting a flashcard set removes its cards.
- Deleting a writing submission removes its evaluation records.
- Deleting a document removes its annotations.

Each cleanup and parent deletion shares one read-write transaction. A failed cleanup cancels the parent deletion as well.

## Backup and restore

The Phase 1 backup is a versioned JSON file. It includes every object store, validates the format, duplicate keys, required fields, Blob entries, and supported references before writing. A restore clears and replaces all PEN501 stores in one read-write transaction; if any write fails, IndexedDB rolls the transaction back. The Settings screen asks for confirmation before replacement.

Document Blobs are encoded as base64 in this JSON foundation. This increases file size and memory use, so very large document collections may be slow to export or restore. Backups from a different database version are rejected in Phase 1 rather than guessed or silently migrated. The user should keep backup files somewhere safe; PEN501 does not upload them.

Storage usage and quota are read from the optional browser `StorageManager.estimate()` API and describe the whole site origin, not PEN501 alone. The app does not request persistent-storage permission. Private browsing, quota limits, and browser storage eviction remain browser-managed risks.
