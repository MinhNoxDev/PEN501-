# Vocabulary and flashcards

## Vocabulary records

The Vocabulary page has two in-page panels: **Study list** for search, filters, statistics, and saved words, and **Add word** for creating or editing a record. Both read and write through `storage.js`. Valid form changes debounce by 650ms; the Add word panel reports “Saved” only after the IndexedDB transaction completes. Word, part of speech, and meaning are required. Tags are comma-separated in the form and stored as a list. Parts of speech have distinct colored chips in the list and on flashcards.

Search covers the word, meaning, example, and tags. The part-of-speech filter and sort controls operate on the saved list. Multi-selection applies to the current visible results; selections remain selected when a search or filter changes. Bulk deletion keeps existing cards and unlinks them from the deleted vocabulary records.

CSV import uses these headers: `word,partOfSpeech,meaning,example,tags`. Tags are joined with `|`. Import is case-insensitive for duplicate words and skips duplicates already stored or repeated in the same file. Invalid rows are skipped and summarized. There is no vocabulary CSV export control.

## Flashcard generation

Select one or more words and create a named set in either direction:

- **English → Vietnamese:** English word and its colored part-of-speech chip on the front; meaning on the back, with the example shown as supporting text.
- **Vietnamese → English:** meaning on the front; English word and its colored part-of-speech chip on the back, with the example shown as supporting text.

Cards keep a copy of their front/back text. If their source word is deleted, that text remains and its `vocabularyId` is cleared. Deleting a set removes its cards in the same transaction.

## Review schedule

“Know” applies the SM-2 interval progression: first successful review is due in 1 day, the second in 6 days, then the previous interval multiplied by the ease factor. “Don't know” resets repetitions, sets a 1-day interval, and lowers ease by the SM-2 grade formula with a floor of 1.3. Each rating updates `repetitions`, `easeFactor`, `interval`, `lastReviewed`, `nextReview`, and `reviewCount` before showing it as saved. A progress activity record is written after the card update; if only that activity write fails, the review remains saved and the UI says so.

The study session centers a responsive card that can grow and wrap long words or meanings. It provides flip/show-answer, previous/next, shuffle, restart remaining, and Know/Don't know controls. Rating a card removes it from the current due queue; Restart reloads cards that are still due.
