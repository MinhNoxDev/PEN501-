const PART_OF_SPEECH_MAP = Object.freeze({
  noun: "Noun",
  verb: "Verb",
  adjective: "Adjective",
  adverb: "Adverb",
  pronoun: "Pronoun",
  preposition: "Preposition",
  conjunction: "Conjunction",
  interjection: "Interjection",
  exclamation: "Interjection",
});

/** Fetch public English dictionary metadata for a single word. */
export async function lookupEnglishWord(value, { signal } = {}) {
  const word = String(value ?? "").trim();
  if (!/^[\p{L}'-]{2,60}$/u.test(word)) return null;

  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal, headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const entries = Array.isArray(data) ? data : [];
  if (!entries.length) return null;

  const phonetic = entries.map((entry) => entry.phonetic).find(Boolean)
    || entries.flatMap((entry) => entry.phonetics || []).map((item) => item.text).find(Boolean)
    || "";
  const definitions = entries.flatMap((entry) => entry.meanings || []);
  const example = definitions.flatMap((meaning) => meaning.definitions || [])
    .map((definition) => definition.example).find(Boolean) || "";
  const partOfSpeech = definitions.map((meaning) => PART_OF_SPEECH_MAP[String(meaning.partOfSpeech || "").toLowerCase()])
    .find(Boolean) || "";

  return { phonetic, example, partOfSpeech };
}
