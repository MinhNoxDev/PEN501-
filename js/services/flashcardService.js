import { StorageError } from "../database/errors.js";
import { storage } from "../database/storage.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFlashcardDue(card, now = Date.now()) {
  if (card.nextReview === undefined || card.nextReview === null || card.nextReview === "") return true;
  const dueAt = typeof card.nextReview === "number" ? card.nextReview : Date.parse(card.nextReview);
  return Number.isNaN(dueAt) || dueAt <= now;
}

export function calculateNextReview(card, knowsAnswer, now = Date.now()) {
  const grade = knowsAnswer ? 4 : 1;
  const repetitions = Math.max(0, Number(card.repetitions) || 0);
  const easeFactor = Math.max(1.3, Number(card.easeFactor) || 2.5);
  const updatedEase = Math.max(1.3, easeFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  let interval;
  let nextRepetitions;

  if (grade < 3) {
    interval = 1;
    nextRepetitions = 0;
  } else {
    interval = repetitions === 0
      ? 1
      : repetitions === 1
        ? 6
        : Math.max(1, Math.round((Number(card.interval) || 1) * updatedEase));
    nextRepetitions = repetitions + 1;
  }

  return {
    repetitions: nextRepetitions,
    easeFactor: Number(updatedEase.toFixed(2)),
    interval,
    lastReviewed: new Date(now).toISOString(),
    nextReview: new Date(now + interval * DAY_MS).toISOString(),
    reviewCount: (Number(card.reviewCount) || 0) + 1,
  };
}

export async function createFlashcardSet(name, direction, vocabulary) {
  const setName = typeof name === "string" ? name.trim() : "";
  if (!setName) throw new StorageError("Enter a name for this flashcard set.", { code: "VALIDATION_FAILED" });
  if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
    throw new StorageError("Select at least one vocabulary item to make a flashcard set.", { code: "VALIDATION_FAILED" });
  }
  if (!["english-to-vietnamese", "vietnamese-to-english"].includes(direction)) {
    throw new StorageError("Choose a supported flashcard direction.", { code: "VALIDATION_FAILED" });
  }

  const set = await storage.saveFlashcardSet({
    name: setName,
    description: direction === "english-to-vietnamese" ? "English to Vietnamese" : "Vietnamese to English",
    direction,
  });
  const cards = vocabulary.map((word) => {
    const example = word.example ? `Example: ${word.example}` : "";
    const back = direction === "english-to-vietnamese"
      ? [word.meaning, example].filter(Boolean).join("\n\n")
      : [word.word, word.partOfSpeech, example].filter(Boolean).join("\n\n");
    return {
      setId: set.id,
      vocabularyId: word.id,
      front: direction === "english-to-vietnamese" ? word.word : word.meaning,
      back,
      repetitions: 0,
      easeFactor: 2.5,
      interval: 0,
      lastReviewed: null,
      nextReview: new Date().toISOString(),
      reviewCount: 0,
    };
  });

  try {
    const savedCards = await storage.saveMany("flashcards", cards);
    return { set, cards: savedCards };
  } catch (error) {
    await storage.delete("flashcardSets", set.id).catch(() => {});
    throw error;
  }
}

export async function getFlashcardSets() {
  const [sets, cards] = await Promise.all([
    storage.getFlashcardSets(),
    storage.list("flashcards"),
  ]);
  const now = Date.now();
  return sets.map((set) => {
    const setCards = cards.filter((card) => card.setId === set.id);
    return {
      ...set,
      cardCount: setCards.length,
      dueCount: setCards.filter((card) => isFlashcardDue(card, now)).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function getStudyCards(setId, { dueOnly = true } = {}) {
  const cards = await storage.listByIndex("flashcards", "setId", setId);
  const toTime = (value) => typeof value === "number" ? value : Date.parse(value || "") || 0;
  return cards.filter((card) => !dueOnly || isFlashcardDue(card)).sort((a, b) => {
    return toTime(a.nextReview) - toTime(b.nextReview);
  });
}

export async function reviewFlashcard(card, knowsAnswer) {
  const schedule = calculateNextReview(card, knowsAnswer);
  const updated = await storage.update("flashcards", card.id, schedule);
  if (!updated) throw new StorageError("This flashcard no longer exists. Reload the set and try again.", { code: "NOT_FOUND" });

  let activitySaved = true;
  try {
    await storage.save("appProgress", {
      activityType: "flashcard_reviewed",
      activityDate: new Date().toISOString(),
      activityData: { flashcardId: card.id, knowsAnswer },
    });
  } catch {
    activitySaved = false;
  }
  return { card: updated, activitySaved };
}

export async function deleteFlashcardSet(setId) {
  return storage.delete("flashcardSets", setId);
}
