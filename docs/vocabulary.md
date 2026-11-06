# Vocabulary and flashcards

## Vocabulary records

The Vocabulary page has four in-page panels: **Study list** for the saved words; **Add word** for creating or editing a record; **Flashcards** for set creation and study sessions; and **Quiz** for multiple-choice meaning practice. Valid Add word changes debounce by 650ms; the form reports “Saved” only after the IndexedDB transaction completes. Word, part of speech, and meaning are required. Tags are comma-separated in the form and stored as a list. Saved word, meaning, example, and tag text is stored and displayed in uppercase. Search opens from the magnifying-glass control and filters the Study list as text is entered. Filters and sorting are inside the gear menu. The Study list has no CSV import or export controls and no bulk-select checkboxes. Each word can still be edited, deleted, or spoken aloud with the browser's English voice. Part of speech is suggested locally as the word is typed, and can be changed before saving. Meaning text supports Vietnamese characters through the configured font fallbacks.

Search covers the word, meaning, example, and tags. The part-of-speech filter and sort controls operate on the saved list. Individual deletion keeps existing cards and unlinks them from the deleted vocabulary records.

Quiz sessions ask the learner to choose a word's meaning, show whether each answer is correct, and save the final score in activity history.

## Flashcard generation

From the **Flashcards** panel, use **Create set (+)** to choose saved Study list words and create a named set:

- The English word and its colored part-of-speech chip appear on the front; the meaning appears on the back, with the example shown as supporting text. Older cards use this display order too.

Cards keep a copy of their front/back text. If their source word is deleted, that text remains and its `vocabularyId` is cleared. Deleting a set removes its cards in the same transaction.

## Review schedule

Marking a card done applies a successful SM-2 review: the first completed review is due in 1 day, the second in 6 days, then the previous interval is multiplied by the ease factor. The service updates `repetitions`, `easeFactor`, `interval`, `lastReviewed`, `nextReview`, and `reviewCount` before showing completion. A progress activity record is written after the card update; if only that activity write fails, the review remains saved and the UI says so.

The study session centers a responsive card that grows and wraps long words or meanings. It provides Previous, Next, Shuffle, Restart remaining, and pronunciation controls. Press Space to flip a card and Enter to move to the next one. **Đã học xong** marks the current card as completed and schedules the next review; uncompleted cards remain due. The browser speech voice reads the English word aloud; PEN501 does not store audio or an IPA transcription.
