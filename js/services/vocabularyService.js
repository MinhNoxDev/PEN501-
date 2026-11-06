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

const POS_HINTS = Object.freeze({
  Pronoun: new Set("i me my mine myself we us our ours you your yours he him his she her hers it its they them their theirs who whom whose which that this these those someone anyone everyone nobody something anything everything nothing each either neither all both few many some several one another".split(" ")),
  Preposition: new Set("about above across after against along among around as at before behind below beneath beside between beyond but by despite down during except for from in inside into like near of off on onto opposite out outside over past per since through throughout till to toward under underneath until up upon via with within without".split(" ")),
  Conjunction: new Set("and but or nor for yet so although because unless while whereas if when whenever where wherever once until than whether".split(" ")),
  Interjection: new Set("ah aha alas bravo eek hey hi hooray oh oops ouch uh wow yay yes no".split(" ")),
  Verb: new Set("be am is are was were been being have has had do does did go goes went gone get got make made take took come came see saw know knew think thought say said tell told give gave find found feel felt leave left put keep let begin began become became bring brought write wrote read speak spoke run ran walk work study learn teach play use want need try call ask seem help show turn start move live believe hold happen provide sit stand lose pay meet include continue set change lead understand watch follow stop create open close build break choose speak".split(" ")),
  Adjective: new Set("good bad great big small little long short new old young happy sad easy hard high low right wrong important different early late sure able possible open-minded beautiful useful careful quick slow fast kind friendly likely lovely simple strong weak full empty ready busy".split(" ")),
  Noun: new Set("time person year way day thing man woman child world life hand part eye place work week case point government company number group problem fact home school house family student country question word idea story money water food book language name room friend city area business service power hour game line end member law car community country".split(" ")),
});

export function suggestPartOfSpeech(value) {
  const word = String(value ?? "").trim().toLocaleLowerCase("en-US").replace(/^[^\p{L}]+|[^\p{L}'-]+$/gu, "");
  if (!word) return "";
  for (const part of ["Pronoun", "Preposition", "Conjunction", "Interjection", "Verb", "Adjective", "Noun"]) {
    if (POS_HINTS[part].has(word)) return part;
  }
  if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ist|er|or)$/.test(word)) return "Noun";
  if (/(ize|ise|ify|ate)$/.test(word)) return "Verb";
  if (/(ous|ful|less|able|ible|ive|al|ic|ish|ary|ent|ant|ed|ing)$/.test(word)) return "Adjective";
  if (/ly$/.test(word)) return "Adverb";
  return "Other";
}

function uppercaseVocabularyText(value) {
  return typeof value === "string" ? value.trim().toLocaleUpperCase("vi-VN") : "";
}

export function validateVocabularyInput(input) {
  const rawPartOfSpeech = typeof input.partOfSpeech === "string" ? input.partOfSpeech.trim() : "";
  const partOfSpeech = PARTS_OF_SPEECH.find((value) => value.toLowerCase() === rawPartOfSpeech.toLowerCase()) ?? "";
  const record = {
    ...input,
    word: uppercaseVocabularyText(input.word),
    partOfSpeech,
    meaning: uppercaseVocabularyText(input.meaning),
    example: uppercaseVocabularyText(input.example),
    pronunciation: typeof input.pronunciation === "string" ? input.pronunciation.trim() : "",
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => uppercaseVocabularyText(String(tag))).filter(Boolean))]
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

export function recordVocabularyQuizResult(score, total) {
  return recordActivity("vocabulary_quiz_completed", { score, total });
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

export async function importVocabularyCsv(text) {
  const current = await getVocabulary();
  const result = parseVocabularyCsv(text, current);
  const saved = result.accepted.length ? await storage.saveMany("vocabulary", result.accepted) : [];
  const activitySaved = saved.length ? await recordActivity("vocabulary_imported", { count: saved.length }) : true;
  return { imported: saved.length, duplicates: result.duplicates.length, rejected: result.rejected, activitySaved };
}
