export const APP_CONFIG = Object.freeze({
  name: "PEN501",
  version: "0.2.0",
  themeStorageKey: "pen501.theme",
  animationStorageKey: "pen501.animations",
  defaultRoute: "dashboard",
});

export const ROUTES = Object.freeze({
  dashboard: { title: "Dashboard", view: "dashboard" },
  vocabulary: { title: "Vocabulary", view: "vocabulary", phase: "Ready", description: "Build your personal word bank, create flashcard sets, and review vocabulary with spaced repetition." },
  writing: { title: "Writing", view: "placeholder", phase: "Phase 3", description: "Create writing tasks across general English and IELTS modes, save drafts, and review your writing history." },
  reader: { title: "Reader", view: "placeholder", phase: "Phase 4", description: "Keep reading documents in one workspace, with annotations and notes saved alongside each file." },
  progress: { title: "Progress", view: "placeholder", phase: "After learning data is available", description: "Progress summaries will be based on real study activity once the learning modules and storage are connected." },
  settings: { title: "Settings", view: "settings" },
});
