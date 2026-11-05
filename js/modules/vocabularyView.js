import { PARTS_OF_SPEECH } from "../services/vocabularyService.js";

export function renderVocabulary() {
  const partOptions = PARTS_OF_SPEECH.map((part) => `<option value="${part}">${part}</option>`).join("");
  return `
    <section class="vocabulary-page" id="vocabulary-page" aria-labelledby="vocabulary-heading">
      <header class="module-header vocabulary-header">
        <div>
          <p class="eyebrow">Vocabulary / Build your word bank</p>
          <h2 id="vocabulary-heading">Words worth keeping.</h2>
        </div>
      </header>

      <nav class="vocabulary-nav" role="tablist" aria-label="Vocabulary workspace">
        <button class="vocabulary-nav__tab" id="vocabulary-tab-study" type="button" role="tab" aria-selected="true" aria-controls="study-list-panel" data-vocabulary-panel="study-list">Study list</button>
        <button class="vocabulary-nav__tab" id="vocabulary-tab-add" type="button" role="tab" aria-selected="false" aria-controls="add-word-panel" data-vocabulary-panel="add-word" tabindex="-1">Add word</button>
      </nav>

      <section class="vocabulary-panel" id="study-list-panel" role="tabpanel" aria-labelledby="vocabulary-tab-study">
        <div class="vocabulary-stats" aria-label="Vocabulary study summary">
          <article class="vocabulary-stat"><span>Words saved</span><strong id="vocabulary-total-count">0</strong></article>
          <article class="vocabulary-stat"><span>Cards due</span><strong id="vocabulary-due-count">0</strong></article>
          <article class="vocabulary-stat"><span>Study sets</span><strong id="vocabulary-set-count">0</strong></article>
        </div>
        <div class="vocabulary-study-cta">
          <p>Review cards that are ready today.</p>
          <button class="button button--primary" id="study-due-all" type="button" disabled>Study due (0)</button>
        </div>

        <section class="panel vocabulary-tools" aria-label="Search and filter vocabulary">
          <div class="vocabulary-tools__search">
            <label for="vocabulary-search">Search your words</label>
            <input id="vocabulary-search" class="field-control" type="search" placeholder="Word, meaning, example, or tag" autocomplete="off">
          </div>
          <div class="vocabulary-tools__select">
            <label for="vocabulary-filter-pos">Part of speech</label>
            <select id="vocabulary-filter-pos" class="field-control">
              <option value="">All parts of speech</option>${partOptions}
            </select>
          </div>
          <div class="vocabulary-tools__select">
            <label for="vocabulary-sort">Sort by</label>
            <select id="vocabulary-sort" class="field-control">
              <option value="word-asc">Word A–Z</option>
              <option value="word-desc">Word Z–A</option>
              <option value="newest">Recently added</option>
              <option value="oldest">Oldest added</option>
            </select>
          </div>
        </section>

        <div class="vocabulary-toolbar">
          <div class="vocabulary-toolbar__selection">
            <label class="select-all-control"><input id="select-all-visible" type="checkbox"><span>Select all shown</span></label>
            <span id="visible-word-count">0 words</span>
            <span id="selection-count">0 selected</span>
          </div>
          <div class="vocabulary-toolbar__actions">
            <button class="button button--secondary" id="create-flashcard-set" type="button" disabled>Create set</button>
            <button class="button button--destructive" id="delete-selected" type="button" disabled>Delete selected</button>
            <input id="import-vocabulary" class="csv-file-input" type="file" accept=".csv,text/csv" aria-label="Choose a vocabulary CSV file">
            <label class="csv-file-label" for="import-vocabulary">Import CSV</label>
          </div>
        </div>

        <p class="vocabulary-status" id="vocabulary-status" role="status" aria-live="polite">Loading vocabulary from this browser…</p>
        <div class="vocabulary-table-wrap">
          <table class="vocabulary-table">
            <thead>
              <tr><th scope="col" class="vocabulary-table__check">Select</th><th scope="col">Word</th><th scope="col">Part of speech</th><th scope="col">Meaning</th><th scope="col">Example</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody id="vocabulary-rows"></tbody>
          </table>
        </div>
        <div class="vocabulary-mobile-list" id="vocabulary-mobile-list"></div>

        <details class="flashcard-sets-section" id="flashcard-sets-details">
          <summary>Flashcard sets <span class="flashcard-sets-count" id="flashcard-sets-count">0</span></summary>
          <div class="flashcard-set-list" id="flashcard-set-list" aria-live="polite">
            <p class="vocabulary-empty">Loading flashcard sets…</p>
          </div>
        </details>
      </section>

      <section class="vocabulary-panel vocabulary-add-panel" id="add-word-panel" role="tabpanel" aria-labelledby="vocabulary-tab-add" hidden>
        <header class="vocabulary-add-heading">
          <p class="eyebrow">Vocabulary record</p>
          <h3 id="vocabulary-form-title">Add a word</h3>
          <p>Add the meaning and part of speech. Complete words save automatically in this browser.</p>
        </header>
        <form id="vocabulary-form" class="vocabulary-form" novalidate>
          <input type="hidden" name="id">
          <div class="vocabulary-form-grid">
            <div class="form-field">
              <label for="vocabulary-word">Word *</label>
              <input class="field-control" id="vocabulary-word" name="word" type="text" maxlength="160" required autocomplete="off">
            </div>
            <div class="form-field">
              <label for="vocabulary-part-of-speech">Part of speech *</label>
              <select class="field-control" id="vocabulary-part-of-speech" name="partOfSpeech" required><option value="">Choose one</option>${partOptions}</select>
            </div>
            <div class="form-field form-field--wide">
              <label for="vocabulary-meaning">Meaning *</label>
              <textarea class="field-control" id="vocabulary-meaning" name="meaning" rows="3" maxlength="2000" required></textarea>
            </div>
            <div class="form-field form-field--wide">
              <label for="vocabulary-example">Example <span class="label-hint">Optional</span></label>
              <textarea class="field-control" id="vocabulary-example" name="example" rows="3" maxlength="3000"></textarea>
            </div>
            <div class="form-field form-field--wide">
              <label for="vocabulary-tags">Tags <span class="label-hint">Separate with commas</span></label>
              <input class="field-control" id="vocabulary-tags" name="tags" type="text" maxlength="500" autocomplete="off">
            </div>
          </div>
          <p class="autosave-status" id="vocabulary-autosave-status" role="status" aria-live="polite">Enter a word, part of speech, and meaning to enable autosave.</p>
          <div class="vocabulary-form-actions">
            <button class="button button--secondary" id="vocabulary-cancel" type="button">Back to study list</button>
            <button class="button button--primary" id="vocabulary-save" type="submit">Save word</button>
          </div>
        </form>
      </section>
    </section>

    <section class="flashcard-study" id="flashcard-study" hidden aria-labelledby="study-heading">
      <header class="module-header flashcard-study__header">
        <div>
          <p class="eyebrow">Flashcard review</p>
          <h2 id="study-heading" tabindex="-1">Study session</h2>
        </div>
        <button class="button button--secondary" id="study-close" type="button">Back to vocabulary</button>
      </header>
      <p class="study-progress" id="study-progress" role="status" aria-live="polite"></p>
      <div class="flashcard-stage" id="flashcard-stage">
        <button class="flashcard-face" id="flashcard-flip" type="button" aria-label="Show answer">
          <span class="flashcard-face__label" id="flashcard-face-label">Front</span>
          <span class="flashcard-face__content">
            <span class="flashcard-face__main" id="flashcard-face-main"></span>
            <span class="part-of-speech-chip flashcard-face__pos" id="flashcard-face-pos" hidden></span>
            <span class="flashcard-face__example" id="flashcard-face-example" hidden></span>
          </span>
          <span class="flashcard-face__hint" id="flashcard-face-hint">SELECT TO FLIP</span>
        </button>
      </div>
      <div class="flashcard-controls">
        <button class="button button--secondary" id="study-previous" type="button">Previous</button>
        <button class="button button--secondary" id="study-next" type="button">Next</button>
        <button class="button button--secondary" id="study-shuffle" type="button">Shuffle</button>
        <button class="button button--secondary" id="study-restart" type="button">Restart remaining</button>
        <button class="button button--primary" id="study-show-answer" type="button">Show answer</button>
      </div>
      <div class="flashcard-rating">
        <button class="button button--secondary" id="study-dont-know" type="button">Don't know · Review tomorrow</button>
        <button class="button button--primary" id="study-know" type="button">Know · Schedule next review</button>
      </div>
      <p class="study-message" id="study-message" role="status" aria-live="polite"></p>
    </section>

    <dialog class="raw-dialog" id="flashcard-set-dialog" aria-labelledby="flashcard-set-dialog-title">
      <form id="flashcard-set-form" novalidate>
        <p class="eyebrow">Selected vocabulary</p>
        <h2 id="flashcard-set-dialog-title">Create a set</h2>
        <div class="form-field">
          <label for="flashcard-set-name">Set name *</label>
          <input class="field-control" id="flashcard-set-name" name="name" type="text" maxlength="120" required autocomplete="off">
        </div>
        <div class="form-field">
          <label for="flashcard-direction">Card direction</label>
          <select class="field-control" id="flashcard-direction" name="direction">
            <option value="english-to-vietnamese">English → Vietnamese</option>
            <option value="vietnamese-to-english">Vietnamese → English</option>
          </select>
        </div>
        <p class="flashcard-set-selection" id="flashcard-set-selection"></p>
        <div class="dialog-actions">
          <button class="button button--secondary" id="flashcard-set-cancel" type="button">Cancel</button>
          <button class="button button--primary" type="submit">Create set</button>
        </div>
      </form>
    </dialog>
  `;
}

export function makeButton(label, action, id, variant = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button button--${variant} button--small`;
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;
  return button;
}

export function makePartOfSpeechChip(partOfSpeech) {
  const chip = document.createElement("span");
  const canonical = PARTS_OF_SPEECH.includes(partOfSpeech) ? partOfSpeech : "Other";
  chip.className = "part-of-speech-chip";
  chip.dataset.pos = canonical.toLowerCase();
  chip.textContent = canonical;
  return chip;
}

function addCell(row, text, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text || "—";
  row.append(cell);
  return cell;
}

function makeSelectionControl(word, checked, className = "") {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = className;
  input.dataset.selectId = word.id;
  input.checked = checked;
  input.setAttribute("aria-label", `Select ${word.word}`);
  return input;
}

function makeWordActions(word) {
  const wrapper = document.createElement("div");
  wrapper.className = "row-actions";
  wrapper.append(
    makeButton("Edit", "edit-word", word.id),
    makeButton("Delete", "delete-word", word.id, "destructive"),
  );
  return wrapper;
}

export function renderWordRow(word, selected) {
  const row = document.createElement("tr");
  const checkCell = document.createElement("td");
  checkCell.className = "vocabulary-table__check";
  checkCell.append(makeSelectionControl(word, selected));
  row.append(checkCell);
  const wordCell = addCell(row, word.word, "vocabulary-word-cell");
  if (word.tags?.length) {
    const tags = document.createElement("small");
    tags.className = "vocabulary-tags";
    tags.textContent = word.tags.join(" · ");
    wordCell.append(tags);
  }
  const posCell = addCell(row, "", "vocabulary-pos-cell");
  posCell.append(makePartOfSpeechChip(word.partOfSpeech));
  addCell(row, word.meaning);
  addCell(row, word.example || "—");
  const actions = document.createElement("td");
  actions.append(makeWordActions(word));
  row.append(actions);
  return row;
}

export function renderWordCard(word, selected) {
  const card = document.createElement("article");
  card.className = "vocabulary-card";
  const header = document.createElement("header");
  const select = makeSelectionControl(word, selected, "vocabulary-card__check");
  const title = document.createElement("h3");
  title.textContent = word.word;
  header.append(select, title, makePartOfSpeechChip(word.partOfSpeech));
  card.append(header);
  const meaning = document.createElement("p");
  meaning.className = "vocabulary-card__meaning";
  meaning.textContent = word.meaning;
  card.append(meaning);
  if (word.example) {
    const example = document.createElement("p");
    example.className = "vocabulary-card__example";
    example.textContent = word.example;
    card.append(example);
  }
  if (word.tags?.length) {
    const tags = document.createElement("p");
    tags.className = "vocabulary-tags";
    tags.textContent = word.tags.join(" · ");
    card.append(tags);
  }
  card.append(makeWordActions(word));
  return card;
}
