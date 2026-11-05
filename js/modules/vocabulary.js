import {
  buildVocabularyCsv,
  deleteVocabularyEntries,
  deleteVocabularyEntry,
  getVocabulary,
  importVocabularyCsv,
  saveVocabularyEntry,
} from "../services/vocabularyService.js";
import {
  createFlashcardSet,
  deleteFlashcardSet,
  getFlashcardSets,
} from "../services/flashcardService.js";
import { createFlashcardController } from "./flashcards.js";
import { makeButton, renderWordCard, renderWordRow } from "./vocabularyView.js";

export function mountVocabulary(root) {
  const events = new AbortController();
  const { signal } = events;
  const words = [];
  const selectedIds = new Set();
  let sets = [];
  let mounted = true;
  let autosaveTimer = null;
  let draftVersion = 0;
  let saveQueue = Promise.resolve();

  const byId = (id) => root.querySelector(`#${id}`);
  const status = byId("vocabulary-status");
  const wordDialog = byId("vocabulary-dialog");
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

  async function closeWordDialog(saveDraft = true) {
    window.clearTimeout(autosaveTimer);
    const version = draftVersion;
    if (saveDraft) {
      try {
        await flushCurrentDraft();
      } catch (error) {
        if (mounted && version === draftVersion) setAutosaveMessage(error.message || "Could not save this word. Keep the dialog open and try again.", "error");
        return;
      }
    }
    if (!mounted || version !== draftVersion) return;
    draftVersion += 1;
    if (wordDialog.open) wordDialog.close();
  }

  function openWordDialog(word = null) {
    window.clearTimeout(autosaveTimer);
    draftVersion += 1;
    wordForm.reset();
    wordForm.elements.id.value = word?.id ?? "";
    wordForm.elements.word.value = word?.word ?? "";
    wordForm.elements.partOfSpeech.value = word?.partOfSpeech ?? "";
    wordForm.elements.meaning.value = word?.meaning ?? "";
    wordForm.elements.example.value = word?.example ?? "";
    wordForm.elements.tags.value = (word?.tags ?? []).join(", ");
    byId("vocabulary-dialog-title").textContent = word ? "Edit a word" : "Add a word";
    setAutosaveMessage("Enter a word, part of speech, and meaning to enable autosave.");
    wordDialog.showModal();
    byId("vocabulary-word").focus();
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

  function updateSelectionControls(visible) {
    const selectedVisible = visible.filter((word) => selectedIds.has(word.id)).length;
    byId("selection-count").textContent = `${selectedIds.size} selected`;
    byId("create-flashcard-set").disabled = selectedIds.size === 0;
    byId("delete-selected").disabled = selectedIds.size === 0;
    byId("select-all-visible").checked = visible.length > 0 && selectedVisible === visible.length;
    byId("select-all-visible").indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
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
      cell.colSpan = 6;
      cell.className = "table-empty-state";
      cell.textContent = words.length === 0 ? "No vocabulary yet. Add a word or import a CSV to begin." : "No words match this search or filter.";
      row.append(cell);
      body.append(row);
      const empty = document.createElement("p");
      empty.className = "vocabulary-empty";
      empty.textContent = cell.textContent;
      mobile.append(empty);
    } else {
      for (const word of visible) {
        const selected = selectedIds.has(word.id);
        body.append(renderWordRow(word, selected));
        mobile.append(renderWordCard(word, selected));
      }
    }
    byId("export-vocabulary").disabled = words.length === 0;
    updateSelectionControls(visible);
    return visible;
  }

  function renderSetList() {
    const list = byId("flashcard-set-list");
    list.replaceChildren();
    const dueTotal = sets.reduce((sum, set) => sum + set.dueCount, 0);
    byId("study-due-all").disabled = dueTotal === 0;
    byId("study-due-all").textContent = dueTotal ? `Study due (${dueTotal})` : "Study due (0)";
    if (sets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "vocabulary-empty";
      empty.textContent = "No flashcard sets yet. Select words above and choose Create flashcard set.";
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
      actions.append(studyDue, makeButton("Delete set", "delete-set", set.id, "destructive"));
      row.append(details, actions);
      list.append(row);
    }
  }

  async function refreshData() {
    if (!mounted) return;
    status.textContent = "Loading vocabulary from this browser…";
    const [nextWords, nextSets] = await Promise.all([
      getVocabulary(),
      getFlashcardSets(),
    ]);
    if (!mounted) return;
    words.splice(0, words.length, ...nextWords);
    sets = nextSets;
    for (const id of [...selectedIds]) if (!words.some((word) => word.id === id)) selectedIds.delete(id);
    status.textContent = `${words.length} word${words.length === 1 ? "" : "s"} saved in this browser.`;
    renderVocabularyRows();
    renderSetList();
  }

  async function refreshAfterAction(message) {
    try { await refreshData(); }
    catch (error) {
      if (mounted) status.textContent = `${message} The list could not refresh: ${error.message || "database error"}`;
    }
  }

  const flashcardController = createFlashcardController({
    root,
    onRefresh: refreshData,
    onStatus: (message) => { if (mounted) status.textContent = message; },
  });

  function showWord(id) {
    return words.find((word) => word.id === id);
  }

  async function handleCsvImport(file) {
    if (!file) return;
    status.textContent = "Reading CSV…";
    try {
      const result = await importVocabularyCsv(await file.text());
      if (!mounted) return;
      const rejectedSummary = result.rejected.length ? ` ${result.rejected.length} invalid row${result.rejected.length === 1 ? "" : "s"} skipped.` : "";
      const activitySummary = result.activitySaved ? "" : " Activity progress could not be recorded.";
      status.textContent = `${result.imported} imported, ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped.${rejectedSummary}${activitySummary}`;
      if (result.rejected.length) status.textContent += ` First issue: row ${result.rejected[0].row}, ${result.rejected[0].message}`;
      await refreshAfterAction("CSV data was imported.");
    } catch (error) {
      status.textContent = `CSV import failed: ${error.message || "invalid file"}`;
    } finally {
      if (mounted) byId("import-vocabulary").value = "";
    }
  }

  async function handleClick(event) {
    const button = event.target.closest("button");
    if (!button || !root.contains(button)) return;
    if (await flashcardController.handleClick(button)) return;
    if (button.id === "vocabulary-add") openWordDialog();
    else if (button.id === "vocabulary-cancel") closeWordDialog();
    else if (button.id === "create-flashcard-set") {
      const selectedWords = words.filter((word) => selectedIds.has(word.id));
      if (!selectedWords.length) return;
      byId("flashcard-set-selection").textContent = `${selectedWords.length} selected word${selectedWords.length === 1 ? "" : "s"} will become cards.`;
      byId("flashcard-set-name").value = `Vocabulary set ${new Date().toLocaleDateString()}`;
      setDialog.showModal();
      byId("flashcard-set-name").focus();
    } else if (button.id === "flashcard-set-cancel") setDialog.close();
    else if (button.id === "delete-selected") {
      const ids = [...selectedIds];
      if (window.confirm(`Delete ${ids.length} selected vocabulary item${ids.length === 1 ? "" : "s"}? Related flashcards will be kept and unlinked.`)) {
        try {
          await deleteVocabularyEntries(ids);
          selectedIds.clear();
          status.textContent = `${ids.length} item${ids.length === 1 ? "" : "s"} deleted.`;
        } catch (error) { status.textContent = `Delete failed: ${error.message || "database error"}`; return; }
        await refreshAfterAction("Vocabulary items were deleted.");
      }
    } else if (button.id === "export-vocabulary") {
      try {
        const blob = new Blob([buildVocabularyCsv(words)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `PEN501-vocabulary-${new Date().toISOString().slice(0, 10)}.csv`;
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        status.textContent = `${words.length} vocabulary item${words.length === 1 ? "" : "s"} exported.`;
      } catch (error) { status.textContent = `CSV export failed: ${error.message || "browser error"}`; }
    } else if (button.dataset.action === "edit-word") openWordDialog(showWord(button.dataset.id));
    else if (button.dataset.action === "delete-word") {
      const word = showWord(button.dataset.id);
      if (!word || !window.confirm(`Delete “${word.word}”? Related flashcards will be kept and unlinked.`)) return;
      try {
        await deleteVocabularyEntry(word.id);
        selectedIds.delete(word.id);
        status.textContent = `“${word.word}” deleted.`;
      } catch (error) { status.textContent = `Delete failed: ${error.message || "database error"}`; return; }
      await refreshAfterAction(`“${word.word}” was deleted.`);
    } else if (button.dataset.action === "delete-set") {
      const set = sets.find((item) => item.id === button.dataset.id);
      if (!set || !window.confirm(`Delete “${set.name}” and its ${set.cardCount} flashcard${set.cardCount === 1 ? "" : "s"}?`)) return;
      try {
        await deleteFlashcardSet(set.id);
        status.textContent = `Flashcard set “${set.name}” deleted.`;
      } catch (error) { status.textContent = `Delete failed: ${error.message || "database error"}`; return; }
      await refreshAfterAction(`Flashcard set “${set.name}” was deleted.`);
    }
  }

  async function handleSubmit(event) {
    if (event.target === wordForm) {
      event.preventDefault();
      window.clearTimeout(autosaveTimer);
      const version = draftVersion;
      setAutosaveMessage("Saving…", "saving");
      await saveQueue;
      if (!mounted || version !== draftVersion) return;
      try {
        const result = await saveVocabularyEntry(currentFormData());
        if (!mounted || version !== draftVersion) return;
        await closeWordDialog(false);
        status.textContent = result.activitySaved ? "Vocabulary saved." : "Vocabulary saved; its activity record could not be saved.";
        await refreshAfterAction("Vocabulary was saved.");
      } catch (error) {
        if (version === draftVersion) setAutosaveMessage(error.message || "Could not save this word.", "error");
      }
    } else if (event.target.id === "flashcard-set-form") {
      event.preventDefault();
      const selectedWords = words.filter((word) => selectedIds.has(word.id));
      const submitButton = event.target.querySelector('[type="submit"]');
      submitButton.disabled = true;
      try {
        const result = await createFlashcardSet(byId("flashcard-set-name").value, byId("flashcard-direction").value, selectedWords);
        if (!mounted) return;
        setDialog.close();
        selectedIds.clear();
        status.textContent = `Created “${result.set.name}” with ${result.cards.length} cards.`;
        await refreshAfterAction(`Flashcard set “${result.set.name}” was created.`);
      } catch (error) {
        if (!mounted) return;
        byId("flashcard-set-selection").textContent = error.message || "The set could not be created.";
      } finally { submitButton.disabled = false; }
    }
  }

  root.addEventListener("click", handleClick, { signal });
  root.addEventListener("submit", handleSubmit, { signal });
  root.addEventListener("input", (event) => {
    if (event.target.id === "vocabulary-search") renderVocabularyRows();
    if (wordForm.contains(event.target)) scheduleAutosave();
  }, { signal });
  root.addEventListener("change", (event) => {
    if (event.target.id === "vocabulary-filter-pos" || event.target.id === "vocabulary-sort") renderVocabularyRows();
    if (event.target.id === "select-all-visible") {
      for (const word of sortedVisibleWords()) {
        if (event.target.checked) selectedIds.add(word.id);
        else selectedIds.delete(word.id);
      }
      renderVocabularyRows();
    }
    if (event.target.dataset.selectId) {
      if (event.target.checked) selectedIds.add(event.target.dataset.selectId);
      else selectedIds.delete(event.target.dataset.selectId);
      renderVocabularyRows();
    }
    if (event.target.id === "import-vocabulary") void handleCsvImport(event.target.files?.[0]);
    if (wordForm.contains(event.target)) scheduleAutosave();
  }, { signal });
  wordDialog.addEventListener("close", () => {
    window.clearTimeout(autosaveTimer);
    draftVersion += 1;
  }, { signal });
  wordDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    void closeWordDialog();
  }, { signal });

  refreshData().catch((error) => {
    if (!mounted) return;
    status.textContent = `Could not load vocabulary: ${error.message || "database error"}`;
    byId("flashcard-set-list").textContent = "Flashcard sets could not be loaded.";
  });

  return () => {
    mounted = false;
    flashcardController.cleanup();
    window.clearTimeout(autosaveTimer);
    draftVersion += 1;
    events.abort();
  };
}

