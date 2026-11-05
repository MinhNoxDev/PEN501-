import { StorageError } from "../database/errors.js";
import { storage } from "../database/storage.js";

export const PARTS_OF_SPEECH = Object.freeze([
  "Noun",
  "Verb",
  "Adjective",
  "Adverb",
  "Pronoun",
  "Preposition",
  "Conjunction",
  "Interjection",
  "Other",
]);

export function validateVocabularyInput(input) {
  const rawPartOfSpeech = typeof input.partOfSpeech === "string" ? input.partOfSpeech.trim() : "";
  const partOfSpeech = PARTS_OF_SPEECH.find((value) => value.toLowerCase() === rawPartOfSpeech.toLowerCase()) ?? "";
  const record = {
    ...input,
    word: typeof input.word === "string" ? input.word.trim() : "",
    partOfSpeech,
    meaning: typeof input.meaning === "string" ? input.meaning.trim() : "",
    example: typeof input.example === "string" ? input.example.trim() : "",
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => String(tag).trim()).filter(Boolean))]
      : [],
  };

  if (!record.word) throw new StorageError("Enter a word before saving.", { code: "VALIDATION_FAILED" });
  if (!PARTS_OF_SPEECH.includes(record.partOfSpeech)) {
    throw new StorageError("Choose a valid part of speech.", { code: "VALIDATION_FAILED" });
  }
  if (!record.meaning) throw new StorageError("Enter a meaning before saving.", { code: "VALIDATION_FAILED" });
  return record;
}

export async function getVocabulary() {
  const words = await storage.getVocabulary();
  return words.sort((a, b) => a.word.localeCompare(b.word, undefined, { sensitivity: "base" }));
}

async function recordActivity(activityType, activityData) {
  try {
    await storage.save("appProgress", {
      activityType,
      activityDate: new Date().toISOString(),
      activityData,
    });
    return true;
  } catch {
    return false;
  }
}

export async function saveVocabularyEntry(input) {
  const record = validateVocabularyInput(input);
  if (record.id) {
    const updated = await storage.updateVocabulary(record.id, record);
    if (!updated) throw new StorageError("This vocabulary entry no longer exists. Refresh the list and try again.", { code: "NOT_FOUND" });
    return { record: updated, activitySaved: true };
  }
  const saved = await storage.saveVocabulary(record);
  const activitySaved = await recordActivity("vocabulary_added", { word: saved.word, vocabularyId: saved.id });
  return { record: saved, activitySaved };
}

export function deleteVocabularyEntry(id) {
  return storage.deleteVocabulary(id);
}

export function deleteVocabularyEntries(ids) {
  return storage.deleteMany("vocabulary", ids);
}

export function normalizeCsvHeader(value) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, "");
}

export function parseCsv(text) {
  if (typeof text !== "string") throw new StorageError("CSV content must be text.", { code: "CSV_INVALID" });
  const source = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      if (char === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += char;
    }
  }

  if (quoted) throw new StorageError("CSV has an unfinished quoted field.", { code: "CSV_INVALID" });
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseVocabularyCsv(text, existingWords = []) {
  const matrix = parseCsv(text);
  if (matrix.length < 2) throw new StorageError("CSV needs a header row and at least one vocabulary row.", { code: "CSV_EMPTY" });
  const headers = matrix[0].map(normalizeCsvHeader);
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const wordColumn = column.word;
  const posColumn = column.partofspeech ?? column.pos;
  const meaningColumn = column.meaning;
  if ([wordColumn, posColumn, meaningColumn].some((index) => index === undefined)) {
    throw new StorageError("CSV must include word, partOfSpeech, and meaning columns.", { code: "CSV_HEADERS_MISSING" });
  }

  const existing = new Set(existingWords.map((word) => word.word.trim().toLocaleLowerCase()));
  const importedWords = new Set();
  const accepted = [];
  const rejected = [];
  const duplicates = [];

  matrix.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const raw = {
      word: cells[wordColumn] ?? "",
      partOfSpeech: cells[posColumn] ?? "",
      meaning: cells[meaningColumn] ?? "",
      example: column.example === undefined ? "" : cells[column.example] ?? "",
      tags: column.tags === undefined ? [] : (cells[column.tags] ?? "").split("|").map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      const record = validateVocabularyInput(raw);
      const normalizedWord = record.word.toLocaleLowerCase();
      if (existing.has(normalizedWord) || importedWords.has(normalizedWord)) {
        duplicates.push(rowNumber);
        return;
      }
      importedWords.add(normalizedWord);
      accepted.push(record);
    } catch (error) {
      rejected.push({ row: rowNumber, message: error.message });
    }
  });
  return { accepted, rejected, duplicates };
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildVocabularyCsv(words) {
  const rows = [["word", "partOfSpeech", "meaning", "example", "tags"]];
  for (const word of words) {
    rows.push([word.word, word.partOfSpeech, word.meaning, word.example, (word.tags ?? []).join("|")]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export async function importVocabularyCsv(text) {
  const current = await getVocabulary();
  const result = parseVocabularyCsv(text, current);
  const saved = result.accepted.length ? await storage.saveMany("vocabulary", result.accepted) : [];
  const activitySaved = saved.length ? await recordActivity("vocabulary_imported", { count: saved.length }) : true;
  return { imported: saved.length, duplicates: result.duplicates.length, rejected: result.rejected, activitySaved };
}
