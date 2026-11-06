import {
  deleteVocabularyEntry,
  getVocabulary,
  recordVocabularyQuizResult,
  saveVocabularyEntry,
  suggestPartOfSpeech,
} from "../services/vocabularyService.js";
import {
  createFlashcardSet,
  deleteFlashcardSet,
  getFlashcardSets,
} from "../services/flashcardService.js";
import { createFlashcardController } from "./flashcards.js";
import { makeButton, makePartOfSpeechChip, renderWordCard, renderWordRow } from "./vocabularyView.js";
import { speakVocabularyWord } from "../services/pronunciationService.js";

export function mountVocabulary(root) {
  const events = new AbortController();
  const { signal } = events;
  const words = [];
  const createSelectedIds = new Set();
  let sets = [];
  let mounted = true;
  let activePanel = "study-list";
  let autosaveTimer = null;
  let draftVersion = 0;
  let saveQueue = Promise.resolve();
  let partOfSpeechManuallyChanged = false;
  let quizQuestions = [];
  let quizPosition = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let quizFinished = false;

  const byId = (id) => root.querySelector(`#${id}`);
  const status = byId("vocabulary-status");
  const studyPanel = byId("study-list-panel");
  const addPanel = byId("add-word-panel");
  const flashcardPanel = byId("flashcard-panel");
  const quizPanel = byId("quiz-panel");
  const flashcardStatus = byId("flashcard-status");
  const wordForm = byId("vocabulary-form");
  const autoStatus = byId("vocabulary-autosave-status");
  const setDialog = byId("flashcard-set-dialog");

  function currentFormData() {
    const form = new FormData(wordForm);
    return {
      id: form.get("id") || undefined,
      word: form.get("word"),
      partOfSpeech: form.get("partOfSpeech"),
      meaning: form.get("meaning"),
      example: form.get("example"),
      tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    };
  }

  function setAutosaveMessage(message, state = "default") {
    autoStatus.textContent = message;
    autoStatus.dataset.state = state;
  }

  function setActivePanel(panel, { focus = false } = {}) {
    activePanel = panel;
    studyPanel.hidden = panel !== "study-list";
    addPanel.hidden = panel !== "add-word";
    flashcardPanel.hidden = panel !== "flashcards";
    quizPanel.hidden = panel !== "quiz";
    for (const tab of root.querySelectorAll("[data-vocabulary-panel]")) {
      const selected = tab.dataset.vocabularyPanel === panel;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (focus) {
      if (panel === "add-word") byId("vocabulary-word").focus();
      else byId(`vocabulary-tab-${panel === "study-list" ? "study" : panel}`).focus();
    }
  }

  async function persistForm(snapshot, version) {
    if (version !== draftVersion) return;
    setAutosaveMessage("Saving…", "saving");
    const result = await saveVocabularyEntry(snapshot);
    if (version !== draftVersion) return;
    if (!snapshot.id) wordForm.elements.id.value = result.record.id;
    const activityNote = result.activitySaved ? "" : " The word was saved, but its activity entry could not be recorded.";
    setAutosaveMessage(`Saved to this browser.${activityNote}`, result.activitySaved ? "success" : "error");
    await refreshAfterAction("The word was saved.");
  }

  function scheduleAutosave() {
    window.clearTimeout(autosaveTimer);
    const snapshot = currentFormData();
    if (!snapshot.word.trim() || !snapshot.partOfSpeech || !snapshot.meaning.trim()) {
      setAutosaveMessage("Fill in word, part of speech, and meaning. The last complete version remains saved.");
      return;
    }
    const version = draftVersion;
    setAutosaveMessage("Changes will save automatically…");
    autosaveTimer = window.setTimeout(() => {
      saveQueue = saveQueue.then(() => persistForm(currentFormData(), version)).catch((error) => {
        if (version === draftVersion) setAutosaveMessage(error.message || "Could not save this word.", "error");
      });
    }, 650);
  }

  async function flushCurrentDraft() {
    window.clearTimeout(autosaveTimer);
    const version = draftVersion;
    await saveQueue;
    if (!mounted || version !== draftVersion) return;
    const snapshot = currentFormData();
    if (!snapshot.word.trim() || !snapshot.partOfSpeech || !snapshot.meaning.trim()) return;
    await persistForm(snapshot, version);
  }

  async function showPanel(panel, { focus = false } = {}) {
    if (activePanel === "add-word" && panel !== "add-word") {
      try {
        await flushCurrentDraft();
      } catch (error) {
        setAutosaveMessage(error.message || "Could not save this word. Keep editing and try again.", "error");
        return;
      }
    }
    setActivePanel(panel, { focus });
  }

  function openWordForm(word = null) {
    window.clearTimeout(autosaveTimer);
    draftVersion += 1;
    wordForm.reset();
    wordForm.elements.id.value = word?.id ?? "";
    wordForm.elements.word.value = word?.word ?? "";
    wordForm.elements.partOfSpeech.value = word?.partOfSpeech ?? "";
    wordForm.elements.meaning.value = word?.meaning ?? "";
    wordForm.elements.example.value = word?.example ?? "";
    wordForm.elements.tags.value = (word?.tags ?? []).join(", ");
    byId("vocabulary-form-title").textContent = word ? "Edit a word" : "Add a word";
    byId("vocabulary-save").textContent = word ? "Save changes" : "Save word";
    partOfSpeechManuallyChanged = Boolean(word);
    byId("part-of-speech-suggestion").textContent = word
      ? "Part of speech saved with this word. Change it if needed."
      : "We'll suggest a part of speech as you type. You can change it at any time.";
    setAutosaveMessage("Enter a word, part of speech, and meaning to enable autosave.");
    setActivePanel("add-word", { focus: true });
  }

  function sortedVisibleWords() {
    const query = byId("vocabulary-search").value.trim().toLocaleLowerCase();
    const partOfSpeech = byId("vocabulary-filter-pos").value;
    const sort = byId("vocabulary-sort").value;
    const visible = words.filter((word) => {
      if (partOfSpeech && word.partOfSpeech !== partOfSpeech) return false;
      if (!query) return true;
      return [word.word, word.meaning, word.example, ...(word.tags ?? [])]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
    });
    visible.sort((a, b) => {
      if (sort === "word-desc") return b.word.localeCompare(a.word, undefined, { sensitivity: "base" });
      if (sort === "newest") return Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "");
      if (sort === "oldest") return Date.parse(a.createdAt || "") - Date.parse(b.createdAt || "");
      return a.word.localeCompare(b.word, undefined, { sensitivity: "base" });
    });
    return visible;
  }

  function updateVocabularySummary(visible) {
    byId("vocabulary-total-count").textContent = String(words.length);
    const query = byId("vocabulary-search").value.trim();
    const searchTrigger = byId("open-vocabulary-search");
    searchTrigger.dataset.active = String(Boolean(query));
    searchTrigger.title = query ? `Search your words · ${query}` : "Search your words";
    byId("search-result-count").textContent = query
      ? `${visible.length} matching word${visible.length === 1 ? "" : "s"}`
      : `${visible.length} word${visible.length === 1 ? "" : "s"} in your study list`;
  }

  function renderVocabularyRows() {
    const visible = sortedVisibleWords();
    const body = byId("vocabulary-rows");
    const mobile = byId("vocabulary-mobile-list");
    body.replaceChildren();
    mobile.replaceChildren();
    if (visible.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "table-empty-state";
      cell.textContent = words.length === 0 ? "No vocabulary yet. Add a word to begin." : "No words match this search or filter.";
      row.append(cell);
      body.append(row);
      const empty = document.createElement("div");
      empty.className = "vocabulary-empty-state";
      const message = document.createElement("p");
      message.textContent = cell.textContent;
      empty.append(message);
      if (words.length === 0) {
        const add = makeButton("Add your first word", "add-first-word", "", "primary");
        empty.append(add);
      }
      mobile.append(empty);
    } else {
      for (const word of visible) {
        body.append(renderWordRow(word));
        mobile.append(renderWordCard(word));
      }
    }
    updateVocabularySummary(visible);
    return visible;
  }

  function renderSetList() {
    const list = byId("flashcard-set-list");
    list.replaceChildren();
    const dueTotal = sets.reduce((sum, set) => sum + set.dueCount, 0);
    const reviewTotal = sets.reduce((sum, set) => sum + (set.reviewedCount || 0), 0);
    byId("study-due-all").disabled = dueTotal === 0;
    byId("study-due-all").textContent = `Study due (${dueTotal})`;
    byId("vocabulary-due-count").textContent = String(dueTotal);
    byId("vocabulary-set-count").textContent = String(sets.length);
    byId("flashcard-set-count").textContent = String(sets.length);
    byId("flashcard-due-count").textContent = String(dueTotal);
    byId("flashcard-review-count").textContent = String(reviewTotal);
    if (sets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "vocabulary-empty";
      empty.textContent = words.length
        ? "No flashcard sets yet. Use the + button to choose words from your Study list."
        : "Add words to your Study list first, then use + to create your first set.";
      list.append(empty);
      return;
    }
    for (const set of sets) {
      const row = document.createElement("article");
      row.className = "flashcard-set-row";
      const details = document.createElement("div");
      details.className = "flashcard-set-row__details";
      const title = document.createElement("h4");
      title.textContent = set.name;
      const summary = document.createElement("p");
      summary.textContent = `${set.cardCount} card${set.cardCount === 1 ? "" : "s"} · ${set.dueCount} due`;
      details.append(title, summary);
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const studyDue = makeButton("Study due", "study-set-due", set.id, "primary");
      studyDue.disabled = set.dueCount === 0;
      const studyAll = makeButton("Study all", "study-set-all", set.id);
      actions.append(studyDue, studyAll, makeButton("Delete set", "delete-set", set.id, "destructive"));
      row.append(details, actions);
      list.append(row);
    }
  }

  function updateFlashcardSelectionCount() {
    const count = createSelectedIds.size;
    byId("flashcard-selection-count").textContent = `${count} selected`;
    byId("flashcard-set-selection").textContent = count
      ? `${count} word${count === 1 ? "" : "s"} selected for this set.`
      : "Select at least one word.";
    byId("flashcard-set-submit").disabled = count === 0;
  }

  function renderCreateWordList() {
    const list = byId("flashcard-create-word-list");
    const query = byId("flashcard-word-search").value.trim().toLocaleLowerCase();
    list.replaceChildren();
    const visibleWords = words.filter((word) => !query || [word.word, word.meaning, word.example, ...(word.tags ?? [])]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
    if (visibleWords.length === 0) {
      const empty = document.createElement("p");
      empty.className = "vocabulary-empty";
      empty.textContent = words.length ? "No words match this search." : "Your Study list is empty. Add a word before creating a set.";
      list.append(empty);
      updateFlashcardSelectionCount();
      return;
    }

    for (const word of visibleWords) {
      const label = document.createElement("label");
      label.className = "flashcard-word-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.flashcardSelectId = word.id;
      input.checked = createSelectedIds.has(word.id);
      input.setAttribute("aria-label", `Add ${word.word} to this flashcard set`);
      const details = document.createElement("span");
      details.className = "flashcard-word-option__details";
      const title = document.createElement("strong");
      title.textContent = word.word;
      const meaning = document.createElement("span");
      meaning.textContent = word.meaning;
      details.append(title, meaning);
      label.append(input, details, makePartOfSpeechChip(word.partOfSpeech));
      list.append(label);
    }
    updateFlashcardSelectionCount();
  }

  function openCreateSetDialog() {
    createSelectedIds.clear();
    byId("flashcard-word-search").value = "";
    byId("flashcard-set-name").value = `Vocabulary set ${new Date().toLocaleDateString()}`;
    renderCreateWordList();
    setDialog.showModal();
    byId("flashcard-set-name").focus();
  }

  function startQuiz() {
    const uniqueMeanings = new Set(words.map((word) => word.meaning));
    if (words.length < 2 || uniqueMeanings.size < 2) {
      byId("quiz-empty").textContent = "Add at least two words with different meanings to start a quiz.";
      byId("quiz-empty").hidden = false;
      byId("quiz-stage").hidden = true;
      return;
    }
    quizQuestions = [...words].sort(() => Math.random() - 0.5).slice(0, Math.min(10, words.length));
    quizPosition = 0;
    quizScore = 0;
    quizAnswered = false;
    quizFinished = false;
    byId("quiz-empty").hidden = true;
    byId("quiz-stage").hidden = false;
    root.querySelector(".quiz-question").hidden = false;
    byId("quiz-choices").hidden = false;
    byId("quiz-start").hidden = true;
    byId("quiz-next").hidden = false;
    byId("quiz-progress").textContent = `Question 1 of ${quizQuestions.length}`;
    byId("quiz-score").textContent = `0 / ${quizQuestions.length}`;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const current = quizQuestions[quizPosition];
    if (!current) return;
    byId("quiz-word").textContent = current.word;
    const pos = byId("quiz-part-of-speech");
    pos.replaceChildren(makePartOfSpeechChip(current.partOfSpeech));
    const distractors = words.filter((word) => word.id !== current.id && word.meaning !== current.meaning);
    const choices = [current, ...distractors.sort(() => Math.random() - 0.5).slice(0, 3)]
      .sort(() => Math.random() - 0.5);
    const container = byId("quiz-choices");
    container.replaceChildren();
    for (const choice of choices) {
      const button = makeButton(choice.meaning, "quiz-choice", choice.id);
      button.classList.add("quiz-choice");
      button.dataset.quizChoice = choice.id;
      container.append(button);
    }
    quizAnswered = false;
    byId("quiz-feedback").textContent = "";
    byId("quiz-next").disabled = true;
    byId("quiz-next").textContent = quizPosition === quizQuestions.length - 1 ? "Finish quiz" : "Next question";
  }

  async function answerQuiz(choiceId) {
    if (quizAnswered || quizFinished) return;
    quizAnswered = true;
    const current = quizQuestions[quizPosition];
    const correct = choiceId === current.id;
    if (correct) quizScore += 1;
    for (const button of byId("quiz-choices").querySelectorAll("[data-quiz-choice]")) {
      button.disabled = true;
      if (button.dataset.quizChoice === current.id) button.classList.add("quiz-choice--correct");
      else if (button.dataset.quizChoice === choiceId) button.classList.add("quiz-choice--wrong");
    }
    byId("quiz-score").textContent = `${quizScore} / ${quizQuestions.length}`;
    byId("quiz-feedback").textContent = correct ? "Correct." : `Not quite. The meaning is: ${current.meaning}`;
    byId("quiz-next").disabled = false;
  }

  async function nextQuizQuestion() {
    if (!quizAnswered || quizFinished) return;
    if (quizPosition < quizQuestions.length - 1) {
      quizPosition += 1;
      byId("quiz-progress").textContent = `Question ${quizPosition + 1} of ${quizQuestions.length}`;
      renderQuizQuestion();
      byId("quiz-choices").querySelector("button")?.focus();
      return;
    }
    quizFinished = true;
    root.querySelector(".quiz-question").hidden = true;
    byId("quiz-choices").hidden = true;
    byId("quiz-start").hidden = false;
    byId("quiz-start").textContent = "Try again";
    byId("quiz-next").hidden = true;
    byId("quiz-progress").textContent = "Quiz complete";
    const saved = await recordVocabularyQuizResult(quizScore, quizQuestions.length);
    if (!mounted) return;
    byId("quiz-feedback").textContent = `${quizScore} / ${quizQuestions.length} correct${saved ? ". Result saved." : ". Result could not be saved to activity history."}`;
  }

  async function refreshData() {
    if (!mounted) return;
    status.textContent = "Loading vocabulary from this browser…";
    const [nextWords, nextSets] = await Promise.all([getVocabulary(), getFlashcardSets()]);
    if (!mounted) return;
    words.splice(0, words.length, ...nextWords);
    sets = nextSets;
    status.textContent = `${words.length} word${words.length === 1 ? "" : "s"} saved in this browser.`;
    renderVocabularyRows();
    renderSetList();
    if (setDialog.open) renderCreateWordList();
  }

  async function refreshAfterAction(message) {
    try { await refreshData(); }
    catch (error) {
      if (mounted) {
        const target = activePanel === "flashcards" ? flashcardStatus : status;
        target.textContent = `${message} The list could not refresh: ${error.message || "database error"}`;
      }
    }
  }

  const flashcardController = createFlashcardController({
    root,
    onRefresh: refreshData,
    onStatus: (message) => { if (mounted) (activePanel === "flashcards" ? flashcardStatus : status).textContent = message; },
  });

  function showWord(id) {
    return words.find((word) => word.id === id);
  }

  async function handleClick(event) {
    const button = event.target.closest("button");
    if (!button || !root.contains(button)) return;
    if (await flashcardController.handleClick(button)) return;
    if (button.dataset.vocabularyPanel) void showPanel(button.dataset.vocabularyPanel, { focus: true });
    else if (button.id === "toggle-vocabulary-filters") {
      const filters = byId("vocabulary-filter-panel");
      filters.hidden = !filters.hidden;
      button.setAttribute("aria-expanded", String(!filters.hidden));
      button.setAttribute("aria-label", filters.hidden ? "Show filters and sorting" : "Hide filters and sorting");
      if (!filters.hidden) byId("vocabulary-filter-pos").focus();
    } else if (button.id === "add-word-from-list" || button.dataset.action === "add-first-word") openWordForm();
    else if (button.id === "pronunciation-preview") {
      const word = wordForm.elements.word.value;
      if (!speakVocabularyWord(word)) setAutosaveMessage(word.trim() ? "Speech is not available in this browser." : "Enter a word to hear it spoken.", "error");
    } else if (button.dataset.action === "pronounce-word") {
      const word = showWord(button.dataset.id);
      if (word && !speakVocabularyWord(word.word)) status.textContent = "Speech is not available in this browser.";
    } else if (button.id === "quiz-start") startQuiz();
    else if (button.id === "quiz-next") await nextQuizQuestion();
    else if (button.dataset.action === "quiz-choice") await answerQuiz(button.dataset.id);
    else if (button.id === "open-vocabulary-search") {
      const dialog = byId("vocabulary-search-dialog");
      dialog.showModal();
      byId("vocabulary-search").focus();
    } else if (button.id === "close-vocabulary-search") byId("vocabulary-search-dialog").close();
    else if (button.id === "clear-vocabulary-search") {
      byId("vocabulary-search").value = "";
      renderVocabularyRows();
      byId("vocabulary-search").focus();
    } else if (button.id === "vocabulary-cancel") void showPanel("study-list", { focus: true });
    else if (button.id === "open-create-flashcard-set") openCreateSetDialog();
    else if (button.id === "flashcard-set-cancel" || button.id === "flashcard-set-cancel-icon") setDialog.close();
    else if (button.dataset.action === "edit-word") openWordForm(showWord(button.dataset.id));
    else if (button.dataset.action === "delete-word") {
      const word = showWord(button.dataset.id);
      if (!word || !window.confirm(`Delete “${word.word}”? Related flashcards will be kept and unlinked.`)) return;
      try {
        await deleteVocabularyEntry(word.id);
        status.textContent = `“${word.word}” deleted.`;
      } catch (error) { status.textContent = `Delete failed: ${error.message || "database error"}`; return; }
      await refreshAfterAction(`“${word.word}” was deleted.`);
    } else if (button.dataset.action === "delete-set") {
      const set = sets.find((item) => item.id === button.dataset.id);
      if (!set || !window.confirm(`Delete “${set.name}” and its ${set.cardCount} flashcard${set.cardCount === 1 ? "" : "s"}?`)) return;
      try {
        await deleteFlashcardSet(set.id);
        flashcardStatus.textContent = `Flashcard set “${set.name}” deleted.`;
      } catch (error) { flashcardStatus.textContent = `Delete failed: ${error.message || "database error"}`; return; }
      await refreshAfterAction(`Flashcard set “${set.name}” was deleted.`);
    }
  }

  async function handleSubmit(event) {
    if (event.target === wordForm) {
      event.preventDefault();
      window.clearTimeout(autosaveTimer);
      const version = draftVersion;
      setAutosaveMessage("Saving…", "saving");
      const submitButton = byId("vocabulary-save");
      submitButton.disabled = true;
      await saveQueue;
      if (!mounted || version !== draftVersion) { submitButton.disabled = false; return; }
      try {
        const result = await saveVocabularyEntry(currentFormData());
        if (!mounted || version !== draftVersion) return;
        status.textContent = result.activitySaved ? "Vocabulary saved." : "Vocabulary saved; its activity record could not be saved.";
        window.clearTimeout(autosaveTimer);
        draftVersion += 1;
        wordForm.reset();
        wordForm.elements.id.value = "";
        byId("vocabulary-form-title").textContent = "Add a word";
        submitButton.textContent = "Save word";
        partOfSpeechManuallyChanged = false;
        byId("part-of-speech-suggestion").textContent = "We'll suggest a part of speech as you type. You can change it at any time.";
        setAutosaveMessage("Enter a word, part of speech, and meaning to enable autosave.");
        setActivePanel("study-list", { focus: true });
        await refreshAfterAction("Vocabulary was saved.");
      } catch (error) {
        setAutosaveMessage(error.message || "Could not save this word.", "error");
      } finally { submitButton.disabled = false; }
    } else if (event.target.id === "flashcard-set-form") {
      event.preventDefault();
      const selectedWords = words.filter((word) => createSelectedIds.has(word.id));
      const submitButton = event.target.querySelector('[type="submit"]');
      submitButton.disabled = true;
      try {
        const result = await createFlashcardSet(byId("flashcard-set-name").value, "english-to-vietnamese", selectedWords);
        if (!mounted) return;
        setDialog.close();
        createSelectedIds.clear();
        flashcardStatus.textContent = `Created “${result.set.name}” with ${result.cards.length} cards.`;
        await refreshAfterAction(`Flashcard set “${result.set.name}” was created.`);
      } catch (error) {
        if (!mounted) return;
        byId("flashcard-set-selection").textContent = error.message || "The set could not be created.";
      } finally { submitButton.disabled = false; }
    }
  }

  function handleKeydown(event) {
    flashcardController.handleKeydown(event);
    if (!event.target.matches("[data-vocabulary-panel]") || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const panels = ["study-list", "add-word", "flashcards", "quiz"];
    const currentIndex = panels.indexOf(event.target.dataset.vocabularyPanel);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const panel = panels[(currentIndex + offset + panels.length) % panels.length];
    void showPanel(panel, { focus: true });
  }

  root.addEventListener("click", handleClick, { signal });
  root.addEventListener("submit", handleSubmit, { signal });
  root.addEventListener("keydown", handleKeydown, { signal });
  root.addEventListener("input", (event) => {
    if (event.target.id === "vocabulary-search") renderVocabularyRows();
    if (event.target.id === "flashcard-word-search") renderCreateWordList();
    if (event.target.id === "vocabulary-word" && !partOfSpeechManuallyChanged) {
      const suggestion = suggestPartOfSpeech(event.target.value);
      wordForm.elements.partOfSpeech.value = suggestion;
      byId("part-of-speech-suggestion").textContent = suggestion
        ? `Suggested: ${suggestion}. You can change it if it doesn't fit.`
        : "We'll suggest a part of speech as you type. You can change it at any time.";
    }
    if (wordForm.contains(event.target)) scheduleAutosave();
  }, { signal });
  root.addEventListener("change", (event) => {
    if (event.target.id === "vocabulary-filter-pos" || event.target.id === "vocabulary-sort") renderVocabularyRows();
    if (event.target.dataset.flashcardSelectId) {
      if (event.target.checked) createSelectedIds.add(event.target.dataset.flashcardSelectId);
      else createSelectedIds.delete(event.target.dataset.flashcardSelectId);
      updateFlashcardSelectionCount();
    }
    if (event.target.id === "vocabulary-part-of-speech") {
      partOfSpeechManuallyChanged = true;
      byId("part-of-speech-suggestion").textContent = `Selected: ${event.target.value}. You can change it again.`;
    }
    if (wordForm.contains(event.target)) scheduleAutosave();
  }, { signal });

  const ready = refreshData().catch((error) => {
    if (!mounted) return;
    status.textContent = `Could not load vocabulary: ${error.message || "database error"}`;
    byId("flashcard-set-list").textContent = "Flashcard sets could not be loaded.";
  });

  const cleanup = () => {
    mounted = false;
    flashcardController.cleanup();
    window.clearTimeout(autosaveTimer);
    draftVersion += 1;
    events.abort();
  };
  cleanup.ready = ready;
  return cleanup;
}
