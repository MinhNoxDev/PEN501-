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
        <button class="vocabulary-nav__tab" id="vocabulary-tab-flashcards" type="button" role="tab" aria-selected="false" aria-controls="flashcard-panel" data-vocabulary-panel="flashcards" tabindex="-1">Flashcards</button>
        <button class="vocabulary-nav__tab" id="vocabulary-tab-quiz" type="button" role="tab" aria-selected="false" aria-controls="quiz-panel" data-vocabulary-panel="quiz" tabindex="-1">Quiz</button>
      </nav>

      <section class="vocabulary-panel" id="study-list-panel" role="tabpanel" aria-labelledby="vocabulary-tab-study">
        <div class="vocabulary-stats" aria-label="Vocabulary study summary">
          <article class="vocabulary-stat"><span>Words saved</span><strong id="vocabulary-total-count">0</strong></article>
          <article class="vocabulary-stat"><span>Cards due</span><strong id="vocabulary-due-count">0</strong></article>
          <article class="vocabulary-stat"><span>Study sets</span><strong id="vocabulary-set-count">0</strong></article>
        </div>

        <div class="vocabulary-tools" aria-label="Study list tools">
          <button class="search-trigger" id="open-vocabulary-search" type="button" aria-label="Search your words" aria-haspopup="dialog" aria-controls="vocabulary-search-dialog" title="Search your words">
            <i class="bi bi-search" aria-hidden="true"></i>
            <span class="sr-only">Search your words</span>
          </button>
          <button class="icon-button filter-toggle" id="toggle-vocabulary-filters" type="button" aria-label="Show filters and sorting" aria-controls="vocabulary-filter-panel" aria-expanded="false" title="Filters and sorting">
            <i class="bi bi-gear" aria-hidden="true"></i>
          </button>
        </div>

        <section class="vocabulary-filter-panel" id="vocabulary-filter-panel" aria-label="Filter and sort the study list" hidden>
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

        <div class="vocabulary-list-summary">
          <p id="vocabulary-status" class="vocabulary-status" role="status" aria-live="polite">Loading vocabulary from this browser…</p>
          <button class="button button--secondary button--small" id="add-word-from-list" type="button">Add a word</button>
        </div>

        <div class="vocabulary-table-wrap">
          <table class="vocabulary-table">
            <thead>
              <tr><th scope="col">Word</th><th scope="col">IPA</th><th scope="col">Part of speech</th><th scope="col">Meaning</th><th scope="col">Example</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody id="vocabulary-rows"></tbody>
          </table>
        </div>
        <div class="vocabulary-mobile-list" id="vocabulary-mobile-list"></div>
      </section>

      <section class="vocabulary-panel vocabulary-add-panel" id="add-word-panel" role="tabpanel" aria-labelledby="vocabulary-tab-add" hidden>
        <header class="vocabulary-add-heading">
          <p class="eyebrow">Vocabulary record</p>
          <h3 id="vocabulary-form-title">Add a word</h3>
          <p>Add a word, meaning, and part of speech. PEN501 sends the word to the public Free Dictionary API to look up IPA and an example; edit any suggestion before saving.</p>
        </header>
        <form id="vocabulary-form" class="vocabulary-form" novalidate>
          <input type="hidden" name="id">
          <div class="vocabulary-form-grid">
            <div class="form-field">
              <label for="vocabulary-word">Word *</label>
                <div class="vocabulary-word-input">
                  <input class="field-control" id="vocabulary-word" name="word" type="text" maxlength="160" required autocomplete="off" aria-autocomplete="list" aria-controls="vocabulary-word-suggestions" aria-expanded="false">
                  <button class="icon-button pronunciation-trigger" id="pronunciation-preview" type="button" aria-label="Hear this word" title="Hear this word">
                    <i class="bi bi-volume-up-fill" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="word-suggestions" id="vocabulary-word-suggestions" role="listbox" aria-label="Saved word suggestions" hidden></div>
                <p class="field-hint">Pronunciation plays with the voice available in your browser.</p>
                <p class="field-hint dictionary-lookup-status" id="dictionary-lookup-status" role="status" aria-live="polite"></p>
            </div>
            <div class="form-field">
              <label for="vocabulary-part-of-speech">Part of speech *</label>
              <select class="field-control" id="vocabulary-part-of-speech" name="partOfSpeech" required><option value="">Type a word for a suggestion</option>${partOptions}</select>
              <p class="field-hint" id="part-of-speech-suggestion" role="status" aria-live="polite">We'll suggest a part of speech as you type. You can change it at any time.</p>
            </div>
            <div class="form-field form-field--wide">
              <label for="vocabulary-pronunciation">International phonetic (IPA) <span class="label-hint">Editable</span></label>
              <input class="field-control vocabulary-phonetic-input" id="vocabulary-pronunciation" name="pronunciation" type="text" maxlength="300" autocomplete="off" placeholder="e.g. /kəmˈpəʊnənt/">
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

      <section class="vocabulary-panel vocabulary-quiz" id="quiz-panel" role="tabpanel" aria-labelledby="vocabulary-tab-quiz" hidden>
        <header class="flashcard-library__header">
          <div>
            <p class="eyebrow">Vocabulary / Quick practice</p>
            <h3>Meaning quiz</h3>
            <p>Choose the meaning that matches the word. You have 15 seconds per question.</p>
          </div>
          <div class="quiz-summary">
            <span id="quiz-progress">Ready to start</span>
            <strong id="quiz-score">0 / 0</strong>
            <span class="quiz-timer" id="quiz-timer" aria-live="off">00:15</span>
          </div>
        </header>
        <div class="quiz-stage" id="quiz-stage" hidden>
          <article class="quiz-question">
            <p class="eyebrow">What does this word mean?</p>
            <h4 id="quiz-word"></h4>
            <div id="quiz-part-of-speech"></div>
          </article>
          <div class="quiz-choices" id="quiz-choices" aria-label="Answer choices"></div>
          <p class="quiz-feedback" id="quiz-feedback" role="status" aria-live="polite"></p>
        </div>
        <p class="quiz-empty" id="quiz-empty" hidden>Add at least two words with meanings to start a quiz.</p>
        <div class="quiz-actions">
          <button class="button button--primary" id="quiz-start" type="button">Start quiz</button>
          <button class="button button--secondary" id="quiz-next" type="button" disabled hidden>Next question</button>
        </div>
      </section>

      <section class="vocabulary-panel flashcard-library" id="flashcard-panel" role="tabpanel" aria-labelledby="vocabulary-tab-flashcards" hidden>
        <header class="flashcard-library__header">
          <div>
            <p class="eyebrow">Review / Spaced repetition</p>
            <h3>Your flashcard sets</h3>
            <p>Choose a set to study, or build one from your Study list.</p>
          </div>
          <div class="flashcard-library__actions">
            <button class="button button--secondary" id="study-due-all" type="button" disabled>Study due (0)</button>
            <button class="button button--primary" id="open-create-flashcard-set" type="button" aria-label="Create a flashcard set">
              <i class="bi bi-plus-lg" aria-hidden="true"></i>
              <span>Create set</span>
            </button>
          </div>
        </header>
        <div class="vocabulary-stats flashcard-stats" aria-label="Flashcard study summary">
          <article class="vocabulary-stat"><span>Study sets</span><strong id="flashcard-set-count">0</strong></article>
          <article class="vocabulary-stat"><span>Cards due</span><strong id="flashcard-due-count">0</strong></article>
          <article class="vocabulary-stat"><span>Reviews completed</span><strong id="flashcard-review-count">0</strong></article>
        </div>
        <p class="vocabulary-status" id="flashcard-status" role="status" aria-live="polite"></p>
        <div class="flashcard-set-list" id="flashcard-set-list" aria-live="polite">
          <p class="vocabulary-empty">Loading flashcard sets…</p>
        </div>
      </section>
    </section>

    <dialog class="raw-dialog search-dialog" id="vocabulary-search-dialog" aria-labelledby="vocabulary-search-title">
      <div class="search-dialog__header">
        <div>
          <p class="eyebrow">Study list / Find a word</p>
          <h2 id="vocabulary-search-title">Search your words</h2>
        </div>
        <button class="icon-button" id="close-vocabulary-search" type="button" aria-label="Close search" title="Close search">×</button>
      </div>
      <label for="vocabulary-search">Search by word, meaning, example, or tag</label>
      <input id="vocabulary-search" class="field-control" type="search" placeholder="Start typing…" autocomplete="off">
      <div class="search-dialog__footer">
        <p id="search-result-count" role="status" aria-live="polite">All words shown</p>
        <button class="button button--secondary" id="clear-vocabulary-search" type="button">Clear search</button>
      </div>
    </dialog>

    <section class="flashcard-study" id="flashcard-study" hidden aria-labelledby="study-heading">
      <header class="module-header flashcard-study__header">
        <div>
          <p class="eyebrow">Flashcard review</p>
          <h2 id="study-heading" tabindex="-1">Study session</h2>
        </div>
        <button class="button button--secondary" id="study-close" type="button">Back to flashcards</button>
      </header>
      <p class="study-progress" id="study-progress" role="status" aria-live="polite"></p>
      <p class="study-shortcuts"><kbd>Space</kbd> flip card <span aria-hidden="true">·</span> <kbd>Enter</kbd> next card</p>
      <div class="flashcard-stage" id="flashcard-stage">
        <button class="flashcard-face" id="flashcard-flip" type="button" aria-label="Show answer">
          <span class="flashcard-face__label" id="flashcard-face-label">Front</span>
          <span class="flashcard-face__content">
            <span class="flashcard-face__main" id="flashcard-face-main"></span>
            <span class="flashcard-face__pronunciation" id="flashcard-face-pronunciation" hidden></span>
            <span class="part-of-speech-chip flashcard-face__pos" id="flashcard-face-pos" hidden></span>
            <span class="flashcard-face__example" id="flashcard-face-example" hidden></span>
          </span>
          <span class="flashcard-face__hint" id="flashcard-face-hint">SELECT TO FLIP</span>
        </button>
      </div>
      <div class="flashcard-controls">
        <button class="button button--secondary" id="study-pronounce" type="button" aria-label="Play word pronunciation" title="Play word pronunciation"><i class="bi bi-volume-up-fill" aria-hidden="true"></i><span>Listen</span></button>
        <button class="button button--secondary" id="study-pronunciation-check" type="button" aria-label="Check pronunciation with microphone"><i class="bi bi-mic-fill" aria-hidden="true"></i><span>Check pronunciation</span></button>
        <button class="button button--secondary" id="study-previous" type="button">Previous</button>
        <button class="button button--secondary" id="study-next" type="button">Next</button>
        <button class="button button--secondary" id="study-shuffle" type="button">Shuffle</button>
        <button class="button button--secondary" id="study-restart" type="button">Restart remaining</button>
      </div>
      <p class="field-hint pronunciation-check-note">Browser recognition may use its own online service. PEN501 does not store microphone audio.</p>
      <p class="pronunciation-check-feedback" id="study-pronunciation-feedback" role="status" aria-live="polite"></p>
      <div class="flashcard-rating">
        <button class="button button--primary" id="study-done" type="button">Đã học xong</button>
      </div>
      <p class="study-message" id="study-message" role="status" aria-live="polite"></p>
    </section>

    <dialog class="raw-dialog flashcard-create-dialog" id="flashcard-set-dialog" aria-labelledby="flashcard-set-dialog-title">
      <form id="flashcard-set-form" novalidate>
        <header class="search-dialog__header">
          <div>
            <p class="eyebrow">Flashcards / New set</p>
            <h2 id="flashcard-set-dialog-title">Create a set</h2>
          </div>
          <button class="icon-button" id="flashcard-set-cancel-icon" type="button" aria-label="Close create set" title="Close">×</button>
        </header>
        <div class="flashcard-create-fields flashcard-create-fields--single">
          <div class="form-field">
            <label for="flashcard-set-name">Set name *</label>
            <input class="field-control" id="flashcard-set-name" name="name" type="text" maxlength="120" required autocomplete="off">
            <p class="field-hint">Cards show the English word and part of speech first, then its meaning.</p>
          </div>
        </div>
        <div class="flashcard-word-picker__heading">
          <label for="flashcard-word-search">Choose words from Study list</label>
          <span id="flashcard-selection-count">0 selected</span>
        </div>
        <input class="field-control flashcard-word-search" id="flashcard-word-search" type="search" placeholder="Filter words…" autocomplete="off">
        <div class="flashcard-word-picker" id="flashcard-create-word-list" aria-label="Words available for this set"></div>
        <p class="flashcard-set-selection" id="flashcard-set-selection" role="status" aria-live="polite">Select at least one word.</p>
        <div class="dialog-actions">
          <button class="button button--secondary" id="flashcard-set-cancel" type="button">Cancel</button>
          <button class="button button--primary" id="flashcard-set-submit" type="submit">Create flashcards</button>
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
  if (id) button.dataset.id = id;
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

function makeWordActions(word) {
  const wrapper = document.createElement("div");
  wrapper.className = "row-actions";
  const listen = document.createElement("button");
  listen.type = "button";
  listen.className = "icon-button pronunciation-trigger";
  listen.dataset.action = "pronounce-word";
  listen.dataset.id = word.id;
  listen.setAttribute("aria-label", `Play pronunciation for ${word.word}`);
  listen.title = `Play pronunciation for ${word.word}`;
  const icon = document.createElement("i");
  icon.className = "bi bi-volume-up-fill";
  icon.setAttribute("aria-hidden", "true");
  wrapper.append(
    listen,
    makeButton("Edit", "edit-word", word.id),
    makeButton("Delete", "delete-word", word.id, "destructive"),
  );
  listen.append(icon);
  return wrapper;
}

export function renderWordRow(word) {
  const row = document.createElement("tr");
  const wordCell = addCell(row, word.word, "vocabulary-word-cell");
  if (word.tags?.length) {
    const tags = document.createElement("small");
    tags.className = "vocabulary-tags";
    tags.textContent = word.tags.join(" · ");
    wordCell.append(tags);
  }
  addCell(row, word.pronunciation || "—", "vocabulary-phonetic");
  const posCell = document.createElement("td");
  posCell.className = "vocabulary-pos-cell";
  posCell.append(makePartOfSpeechChip(word.partOfSpeech));
  row.append(posCell);
  addCell(row, word.meaning, "vocabulary-meaning-cell");
  addCell(row, word.example || "—", "vocabulary-example-cell");
  const actions = document.createElement("td");
  actions.append(makeWordActions(word));
  row.append(actions);
  return row;
}

export function renderWordCard(word) {
  const card = document.createElement("article");
  card.className = "vocabulary-card";
  const header = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = word.word;
  header.append(title, makePartOfSpeechChip(word.partOfSpeech));
  card.append(header);
  if (word.pronunciation) {
    const phonetic = document.createElement("p");
    phonetic.className = "vocabulary-phonetic";
    phonetic.textContent = word.pronunciation;
    card.append(phonetic);
  }
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
