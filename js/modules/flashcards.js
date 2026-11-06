import { getFlashcardSets, getStudyCards, reviewFlashcard } from "../services/flashcardService.js";
import { makePartOfSpeechChip } from "./vocabularyView.js";
import { speakVocabularyWord } from "../services/pronunciationService.js";

export function createFlashcardController({ root, onRefresh, onStatus }) {
  let session = null;
  let mounted = true;
  let reviewInProgress = false;
  let speechRecognition = null;
  const byId = (id) => root.querySelector(`#${id}`);

  function renderCard() {
    const card = session?.cards[session.position];
    const stage = byId("flashcard-stage");
    const message = byId("study-message");
    const controls = root.querySelectorAll("#study-pronounce, #study-pronunciation-check, #study-previous, #study-next, #study-shuffle, #study-restart, #study-done, #flashcard-flip");
    if (!card) {
      stage.hidden = true;
      for (const control of controls) control.disabled = true;
      byId("study-progress").textContent = `${session?.reviewed ?? 0} card${session?.reviewed === 1 ? "" : "s"} completed. This session is complete.`;
      message.textContent = "Your completed cards have been scheduled for review.";
      return;
    }
    stage.hidden = false;
    for (const control of controls) control.disabled = false;
    if (speechRecognition) byId("study-pronunciation-check").disabled = true;
    const direction = card.direction || (card.front === card.vocabularyWord
      ? "english-to-vietnamese"
      : "vietnamese-to-english");
    const englishSide = !session.flipped;
    const vocabularyWord = card.vocabularyWord || (direction === "english-to-vietnamese" ? card.front : card.back);
    const meaning = card.meaning || (direction === "english-to-vietnamese" ? card.back : card.front);
    const mainContent = englishSide ? vocabularyWord : meaning;
    const partOfSpeech = byId("flashcard-face-pos");
    const chip = makePartOfSpeechChip(card.partOfSpeech);
    partOfSpeech.replaceWith(chip);
    chip.id = "flashcard-face-pos";
    chip.classList.add("flashcard-face__pos");
    chip.hidden = !englishSide || !card.partOfSpeech;
    byId("flashcard-face-main").textContent = mainContent || "—";
    const phonetic = byId("flashcard-face-pronunciation");
    phonetic.textContent = card.pronunciation || "";
    phonetic.hidden = !englishSide || !card.pronunciation;
    byId("flashcard-face-example").textContent = card.example || "";
    byId("flashcard-face-example").hidden = !session.flipped || !card.example;
    byId("flashcard-face-label").textContent = session.flipped ? "Answer" : "Front";
    byId("flashcard-face-hint").textContent = session.flipped ? "SPACE TO RETURN" : "SPACE TO FLIP · ENTER FOR NEXT";
    byId("flashcard-flip").setAttribute("aria-label", session.flipped ? "Show front of card" : "Show answer");
    byId("study-progress").textContent = `${session.setName} · ${session.cards.length} remaining · ${session.reviewed} completed this session`;
    byId("study-pronunciation-feedback").textContent = "";
    byId("study-previous").disabled = session.position === 0;
    byId("study-next").disabled = session.position >= session.cards.length - 1;
    byId("study-shuffle").disabled = session.cards.length < 2;
    message.textContent = session.lastMessage;
  }

  function compareSpelling(expectedValue, spokenValue) {
    const expected = String(expectedValue ?? "").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
    const spoken = String(spokenValue ?? "").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
    const rows = Array.from({ length: expected.length + 1 }, () => Array(spoken.length + 1).fill(0));
    for (let i = 0; i <= expected.length; i += 1) rows[i][0] = i;
    for (let j = 0; j <= spoken.length; j += 1) rows[0][j] = j;
    for (let i = 1; i <= expected.length; i += 1) {
      for (let j = 1; j <= spoken.length; j += 1) {
        const cost = expected[i - 1] === spoken[j - 1] ? 0 : 1;
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      }
    }
    const distance = rows[expected.length][spoken.length];
    const score = expected.length ? Math.max(0, Math.round((1 - distance / Math.max(expected.length, spoken.length, 1)) * 100)) : 0;
    const edits = [];
    let i = expected.length;
    let j = spoken.length;
    while (i || j) {
      if (i && j && expected[i - 1] === spoken[j - 1] && rows[i][j] === rows[i - 1][j - 1]) {
        i -= 1;
        j -= 1;
      } else if (i && j && rows[i][j] === rows[i - 1][j - 1] + 1) {
        edits.push({ expected: expected[i - 1], spoken: spoken[j - 1] });
        i -= 1;
        j -= 1;
      } else if (i && rows[i][j] === rows[i - 1][j] + 1) {
        edits.push({ expected: expected[i - 1], spoken: "" });
        i -= 1;
      } else {
        edits.push({ expected: "", spoken: spoken[j - 1] || "" });
        j -= 1;
      }
    }
    edits.reverse();
    const differences = edits.slice(0, 4).map(({ expected: expectedLetter, spoken: spokenLetter }) => {
      if (!spokenLetter) return `expected “${expectedLetter}”`;
      if (!expectedLetter) return `extra “${spokenLetter}”`;
      return `expected “${expectedLetter}”, heard “${spokenLetter}”`;
    });
    return { score, differences };
  }

  function checkPronunciation() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const feedback = byId("study-pronunciation-feedback");
    const button = byId("study-pronunciation-check");
    const card = session?.cards[session.position];
    if (!card) return;
    if (!Recognition) {
      feedback.textContent = "Speech recognition is not available here. Try a current version of Chrome or Edge.";
      return;
    }
    if (speechRecognition) return;
    const recognition = new Recognition();
    speechRecognition = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    button.disabled = true;
    feedback.textContent = `Listening for “${card.vocabularyWord}”… Speak clearly in English.`;
    recognition.onresult = (event) => {
      if (!mounted) return;
      const spoken = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (!spoken) {
        feedback.textContent = "No speech was recognized. Try again in a quiet place.";
        return;
      }
      const { score, differences } = compareSpelling(card.vocabularyWord, spoken);
      const comparison = score === 100
        ? "The browser heard the target word exactly."
        : differences.length ? `Letter comparison: ${differences.join("; ")}.` : "Try speaking the ending more clearly.";
      feedback.textContent = `Approximate transcript match: ${score}%. Heard “${spoken}”. ${comparison} This compares recognized text; it is not phoneme-level AI scoring.`;
    };
    recognition.onerror = (event) => {
      if (!mounted) return;
      const messages = {
        "not-allowed": "Microphone permission was denied. Allow microphone access in the browser and try again.",
        "service-not-allowed": "The browser speech recognition service is unavailable.",
        "no-speech": "No speech was recognized. Try again and speak clearly.",
        "network": "The browser speech recognition service needs a network connection.",
      };
      feedback.textContent = messages[event.error] || `Speech recognition stopped (${event.error || "unknown error"}).`;
    };
    recognition.onend = () => {
      if (speechRecognition === recognition) speechRecognition = null;
      if (mounted) button.disabled = false;
    };
    try {
      recognition.start();
    } catch {
      speechRecognition = null;
      button.disabled = false;
      feedback.textContent = "Microphone could not start. Try again.";
    }
  }

  function stopPronunciationCheck() {
    if (!speechRecognition) return;
    try { speechRecognition.stop(); } catch { /* The browser may have ended recognition already. */ }
    speechRecognition = null;
    if (mounted && byId("study-pronunciation-check")) byId("study-pronunciation-check").disabled = false;
  }

  async function startStudy(setId = null, { dueOnly = true } = {}) {
    stopPronunciationCheck();
    try {
      const sets = await getFlashcardSets();
      const selectedSet = setId ? sets.find((set) => set.id === setId) : null;
      const deck = setId
        ? await getStudyCards(setId, { dueOnly })
        : (await Promise.all(sets.filter((set) => set.dueCount > 0).map((set) => getStudyCards(set.id)))).flat();
      if (!mounted) return;
      if (deck.length === 0) {
        onStatus("There are no flashcards due for review.");
        return;
      }
      session = {
        setId,
        dueOnly,
        setName: selectedSet?.name ?? "All due cards",
        cards: deck,
        position: 0,
        reviewed: 0,
        flipped: false,
        lastMessage: "",
      };
      byId("vocabulary-page").hidden = true;
      byId("flashcard-study").hidden = false;
      renderCard();
      byId("study-heading").focus();
    } catch (error) {
      if (mounted) onStatus(`Could not start review: ${error.message || "database error"}`);
    }
  }

  function flipCard() {
    if (!session?.cards.length) return;
    stopPronunciationCheck();
    session.flipped = !session.flipped;
    renderCard();
  }

  async function markCardDone() {
    if (reviewInProgress || !session?.cards[session.position]) return;
    stopPronunciationCheck();
    reviewInProgress = true;
    const card = session.cards[session.position];
    byId("study-done").disabled = true;
    byId("study-close").disabled = true;
    try {
      const result = await reviewFlashcard(card, true);
      if (!mounted) return;
      session.cards.splice(session.position, 1);
      session.reviewed += 1;
      if (session.position >= session.cards.length) session.position = 0;
      session.flipped = false;
      session.lastMessage = result.activitySaved ? "Marked as completed and scheduled for review." : "Card was scheduled, but its activity record could not be saved.";
      renderCard();
      try {
        await onRefresh();
      } catch {
        session.lastMessage = "Review was saved, but the flashcard set counts could not be refreshed.";
        renderCard();
      }
    } catch (error) {
      if (!mounted) return;
      session.lastMessage = `Card could not be marked complete: ${error.message || "database error"}`;
      renderCard();
    } finally {
      reviewInProgress = false;
      if (mounted) byId("study-close").disabled = false;
    }
  }

  function shuffleCards() {
    if (!session) return;
    stopPronunciationCheck();
    for (let index = session.cards.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [session.cards[index], session.cards[swap]] = [session.cards[swap], session.cards[index]];
    }
    session.position = 0;
    session.flipped = false;
    renderCard();
  }

  async function restartStudy() {
    if (!session) return;
    stopPronunciationCheck();
    const setId = session.setId;
    const dueOnly = session.dueOnly;
    const setName = session.setName;
    try {
      const fresh = setId
        ? await getStudyCards(setId, { dueOnly })
        : (await Promise.all((await getFlashcardSets()).filter((set) => set.dueCount > 0).map((set) => getStudyCards(set.id)))).flat();
      if (!mounted) return;
      session = { setId, dueOnly, setName, cards: fresh, position: 0, reviewed: 0, flipped: false, lastMessage: "Remaining cards reloaded." };
      renderCard();
    } catch (error) {
      if (!mounted) return;
      session.lastMessage = `Could not reload the deck: ${error.message || "database error"}`;
      renderCard();
    }
  }

  function nextCard() {
    if (!session) return;
    if (session.position >= session.cards.length - 1) {
      session.lastMessage = "This is the last card. Mark it done or go to a previous card.";
      renderCard();
      return;
    }
    stopPronunciationCheck();
    session.position += 1;
    session.flipped = false;
    renderCard();
  }

  function handleKeydown(event) {
    if (!session || event.altKey || event.ctrlKey || event.metaKey || event.target.closest("input, textarea, select, dialog")) return;
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      flipCard();
      return;
    }
    if (event.key === "Enter" && (event.target.id === "flashcard-flip" || event.target.id === "study-heading" || !event.target.closest("button"))) {
      event.preventDefault();
      nextCard();
    }
  }

  async function handleClick(button) {
    if (button.id === "study-due-all") await startStudy();
    else if (button.dataset.action === "study-set-due") await startStudy(button.dataset.id);
    else if (button.dataset.action === "study-set-all") await startStudy(button.dataset.id, { dueOnly: false });
    else if (button.id === "study-close") {
      stopPronunciationCheck();
      session = null;
      byId("flashcard-study").hidden = true;
      byId("vocabulary-page").hidden = false;
      try { await onRefresh(); }
      catch (error) { onStatus(`Vocabulary view could not refresh: ${error.message || "database error"}`); }
    } else if (button.id === "flashcard-flip") flipCard();
    else if (button.id === "study-pronounce") {
      const card = session?.cards[session.position];
      if (card && !speakVocabularyWord(card.vocabularyWord)) {
        session.lastMessage = "Speech is not available in this browser.";
        renderCard();
      }
    }
    else if (button.id === "study-pronunciation-check") checkPronunciation();
    else if (button.id === "study-previous" && session?.position > 0) { stopPronunciationCheck(); session.position -= 1; session.flipped = false; renderCard(); }
    else if (button.id === "study-next") nextCard();
    else if (button.id === "study-shuffle") shuffleCards();
    else if (button.id === "study-restart") await restartStudy();
    else if (button.id === "study-done") await markCardDone();
    else return false;
    return true;
  }

  return {
    handleClick,
    handleKeydown,
    cleanup() {
      stopPronunciationCheck();
      mounted = false;
    },
  };
}
