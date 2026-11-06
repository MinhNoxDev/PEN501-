# Phase 2 verification

## Checks completed

- JavaScript syntax checks passed for all 16 modules.
- Vocabulary CSV smoke checks cover quoted commas, embedded newlines, header normalization, duplicate detection, and invalid rows during import.
- Spaced-repetition smoke checks cover first and second successful intervals, a lapse reset, review counters, and due-date evaluation.
- Vocabulary and flashcard page templates render, and static HTML assets resolve.

## Checks still requiring a browser

The current Node runtime does not expose IndexedDB, and browser UI verification has not been completed in this environment. Browser verification is still needed for the Vocabulary panels, add/edit/autosave persistence after reload, gear filters and search, automatic part-of-speech suggestions, browser speech pronunciation, uppercase Vietnamese text, quiz scoring/activity, flashcard creation from chosen Study list words, colored part-of-speech chips, long flashcard text, Space/Enter controls, completion scheduling, the collapsible right navigation at desktop and mobile widths, the loading screen, the small-screen review count, theme and animation preferences, and Settings backup/restore after Phase 1. Use the manual checks in the PEN501 master prompt once the app can run in a browser environment.
