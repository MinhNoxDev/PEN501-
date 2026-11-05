# Phase 0 audit and decisions

## Repository audit

The PEN501 workspace was empty: no application files, existing Git repository, or local project instructions were present. Phase 0 starts a clean static project in this folder. No existing behavior or data needed migration.

## RawBlock design audit

- **Color:** black `#000000`, white `#FFFFFF`, blue `#0000FF` for links only; green, orange, and red for success, warning, and error states. Dark mode inverts surfaces and text. Light gray is reserved for input surfaces.
- **Type:** Archivo Black for display headings, Work Sans for body copy, and Space Mono for controls and compact metadata. Google Fonts provides these online; system stacks are the offline fallback.
- **Shape and hierarchy:** 0px radius, no shadows or gradients, 1px/3px/5px borders. Border weight and type scale establish priority.
- **Spacing:** 4, 8, 16, 24, 40, 64, 80, and 120px tokens. The layout uses these as a base and tightens on small screens.
- **Interaction:** uppercase tracked buttons, inverse hover states, visible keyboard focus, semantic links and controls, and clear disabled/status styles.
- **Layout:** fixed desktop sidebar with a single-column mobile drawer; content and controls adapt to tablet and phone widths.

## Architecture decisions

1. Keep Phase 0 dependency-free and static. Use browser ES modules and hash routes, which are compatible with static hosting paths.
2. Keep views separate from application wiring. Later learning modules will use shared services rather than opening their own database connections.
3. Persist only the theme preference in LocalStorage until the IndexedDB storage service is implemented.
4. Avoid fake metrics and fake module actions. The dashboard reports the current foundation status; future modules identify themselves as planned.
5. Do not create a service worker in this phase. Offline caching is planned with Phase 5 so cache invalidation and data migration can be designed together.

## Risk register

| Risk | Phase 0 handling | Follow-up |
|---|---|---|
| Browser storage limits or private-mode failures | No learning data is written yet. | Phase 1: catch quota/open errors; show storage status and export guidance. |
| IndexedDB schema changes | Database not started yet. | Phase 1: version the schema and write forward migrations; never delete user data on upgrade. |
| Large documents and memory pressure | No document upload yet. | Phase 4: store Blobs, validate size/type, and process pages incrementally. |
| OCR performance | OCR is not included. | Phase 4: make OCR optional, explain local processing, and allow cancellation. |
| PDF annotation positioning | Reader is not included. | Phase 4: use stable page-relative coordinates and test after zoom/reopen. |
| DOCX rendering and untrusted HTML | DOCX rendering is not included. | Phase 4: sanitize rendered content and never execute embedded document markup. |
| API key exposure | No remote AI calls are implemented. | Keep AI optional; do not embed secret provider keys in a static client. Require user initiation before sending private text. |
| Offline availability | Shell is static; fonts are remotely hosted with local fallbacks. | Phase 5: cache required assets and vendor selected runtime dependencies. |

