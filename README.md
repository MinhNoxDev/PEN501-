# PEN501

PEN501 is a personal English learning workspace for vocabulary, writing, and reading. Version 1.0 is planned as a static-first browser application: HTML, CSS, vanilla JavaScript, IndexedDB for learning data, and LocalStorage for small interface preferences. It has no application backend or account system.

## Current status

Phases 0 through 2 provide the responsive application shell, versioned IndexedDB storage, JSON backup/restore, vocabulary management, quizzes, flashcard sets, and spaced-repetition review. Writing and Reader screens remain planned; the Dashboard shows real counts and learning activity, with no sample data.

## Run locally

Serve this folder over HTTP so ES modules and browser storage APIs work reliably. Do not open `index.html` directly from File Explorer; browsers block its JavaScript modules in that mode, leaving the page content blank. With Python available, run this command from the project folder:

```powershell
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). This is a static file server; it does not add an application backend. You can also use another local static server.

## Folder structure

```text
PEN501/
├── index.html
├── manifest.webmanifest
├── css/
│   ├── modules/
│   │   ├── dashboard.css, vocabulary.css, flashcards.css
│   ├── themes/
│   └── reset.css, variables.css, typography.css, layout.css,
│       components.css, responsive.css
├── js/
│   ├── app.js, config.js, router.js, state.js
│   ├── components/
│   ├── database/
│   │   ├── db.js, errors.js, migrations.js, storage.js
│   ├── modules/
│   │   ├── dashboard.js, placeholders.js, vocabulary.js
│   │   ├── vocabularyView.js, flashcards.js
│   ├── services/
│   │   ├── backupService.js
│   │   ├── flashcardService.js
│   │   └── vocabularyService.js
│   └── utils/
└── docs/
    ├── phase-0-notes.md
    ├── database.md
    ├── vocabulary.md
    ├── phase-1-verification.md
    └── phase-2-verification.md
```

## Design and architecture

The interface follows `voicebox-DESIGN.md`: a light editorial canvas, sharp geometry, Archivo Black headlines, Work Sans body text, Space Mono utility labels, subtle structural borders, and a restrained red accent. If Google Fonts cannot load, local system font fallbacks keep the app usable. Bootstrap Icons are loaded from the official versioned icon stylesheet.

Navigation is hash-based, so it works on static hosting without server rewrite rules. The right-side navigation drawer can be opened or collapsed at desktop and mobile sizes. Views are separate ES modules, while `app.js` wires shared behavior. Light is the default theme; theme and motion preferences are stored in LocalStorage. Learning data uses `PEN501_DB` through the shared Storage Service; modules should not access IndexedDB directly.

## Technology and data plan

- HTML5, CSS3, vanilla JavaScript ES modules
- IndexedDB: vocabulary, flashcards, writing, documents, annotations, progress, and application settings
- LocalStorage: theme and small UI preferences only
- No framework, package manager, backend, or third-party runtime library
- Google Fonts is an optional online typeface source; system fallbacks are configured

## Known limitations

- Writing and Reader learning workflows, and the full Progress history view, are not implemented yet; their screens state this explicitly.
- Theme preference is browser-local and does not sync between devices.
- Google Fonts needs a network connection for the intended typefaces.
- Bootstrap Icons use the official versioned CDN stylesheet and need a network connection to render.
- Backup JSON encodes document Blobs as base64 and can use substantial memory for large files.
- Backup files must match the current database version; cross-version conversion is not implemented.
- Browser-level storage and UI verification for Phases 1 and 2 remains pending in this environment.
- No service worker, offline cache, or AI integration exists yet.

## Development phases

0. Project shell, design system, navigation, theme, and dashboard — implemented.
1. IndexedDB schema, storage service, migrations, storage status, and JSON backup/restore — implementation present; browser verification pending.
2. Vocabulary, quizzes, flashcards, spaced repetition, and dashboard activity — implementation present; browser verification pending.
3. General Writing workspace, with IELTS as an optional mode.
4. Reader, document rendering, and annotations.
5. Backup refinements, PWA manifest validation, and offline app shell.
6. Cross-module testing, optimization, and complete user documentation.

See [the Phase 0 audit and risk notes](docs/phase-0-notes.md), [the database guide](docs/database.md), [the vocabulary and flashcard guide](docs/vocabulary.md), and the [Phase 1](docs/phase-1-verification.md) and [Phase 2 verification notes](docs/phase-2-verification.md).
