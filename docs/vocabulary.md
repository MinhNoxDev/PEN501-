# Vocabulary and flashcards

## Vocabulary records

The Vocabulary page reads and writes through `storage.js`. Add and edit forms debounce valid changes by 650ms; the dialog reports “Saved” only after the IndexedDB transaction completes. Word, part of speech, and meaning are required. Tags are comma-separated in the form and stored as a list.

Search covers the word, meaning, example, and tags. The part-of-speech filter and sort controls operate on the saved list. Multi-selection applies to the current visible results; selections remain selected when a search or filter changes. Bulk deletion keeps existing cards and unlinks them from the deleted vocabulary records.

CSV uses these headers: `word,partOfSpeech,meaning,example,tags`. Tags are joined with `|`. Import is case-insensitive for duplicate words and skips duplicates already stored or repeated in the same file. Invalid rows are skipped and summarized. Export quotes CSV fields and prefixes spreadsheet formula-like values with an apostrophe for safer opening in spreadsheet software.

## Flashcard generation

Select one or more words and create a named set in either direction:

- **English → Vietnamese:** English word on the front; meaning and example on the back.
- **Vietnamese → English:** meaning on the front; English word, part of speech, and example on the back.

Cards keep a copy of their front/back text. If their source word is deleted, that text remains and its `vocabularyId` is cleared. Deleting a set removes its cards in the same transaction.

## Review schedule

“Know” applies the SM-2 interval progression: first successful review is due in 1 day, the second in 6 days, then the previous interval multiplied by the ease factor. “Don't know” resets repetitions, sets a 1-day interval, and lowers ease by the SM-2 grade formula with a floor of 1.3. Each rating updates `repetitions`, `easeFactor`, `interval`, `lastReviewed`, `nextReview`, and `reviewCount` before showing it as saved. A progress activity record is written after the card update; if only that activity write fails, the review remains saved and the UI says so.

The study session provides flip/show-answer, previous/next, shuffle, restart remaining, and Know/Don't know controls. Rating a card removes it from the current due queue; Restart reloads cards that are still due.
