import { storage } from "../database/storage.js";
import { isFlashcardDue } from "../services/flashcardService.js";

export function renderDashboard() {
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return `
    <section class="dashboard-intro" aria-labelledby="welcome-title">
      <div class="dashboard-intro__copy">
        <p class="eyebrow">A place to practice, collect, and grow</p>
        <h2 id="welcome-title">Make room for better English.</h2>
      </div>
      <p class="dashboard-intro__date"><span>Today</span>${formattedDate}</p>
    </section>

    <div class="foundation-banner" role="status">
      <span class="foundation-banner__mark">PHASE 2</span>
      <p>Vocabulary and flashcard review are ready. Add words to begin; your counts and recent reviews update from this browser's saved data.</p>
    </div>

    <section class="dashboard-section" aria-labelledby="overview-title">
      <header class="dashboard-section__header">
        <p class="eyebrow">Your learning data</p>
        <h3 id="overview-title">Learning overview</h3>
      </header>
      <div class="learning-metrics">
        <article class="metric-card"><p>Total vocabulary</p><strong id="metric-vocabulary" aria-live="polite">Loading…</strong></article>
        <article class="metric-card"><p>Flashcards due</p><strong id="metric-flashcards-due" aria-live="polite">Loading…</strong></article>
        <article class="metric-card"><p>Writing completed</p><strong id="metric-writing" aria-live="polite">Loading…</strong></article>
        <article class="metric-card"><p>Documents saved</p><strong id="metric-documents" aria-live="polite">Loading…</strong></article>
      </div>
    </section>

    <section class="dashboard-section" aria-labelledby="start-title">
      <header class="dashboard-section__header">
        <p class="eyebrow">Choose a workspace</p>
        <h3 id="start-title">Start here</h3>
      </header>
      <div class="quick-actions">
        <a class="quick-card" href="#/vocabulary">
          <span class="quick-card__number">01 / WORDS</span>
          <h4>Vocabulary</h4>
          <p>Collect useful words and build a review habit.</p>
          <span class="quick-card__link">VIEW STATUS →</span>
        </a>
        <a class="quick-card" href="#/writing">
          <span class="quick-card__number">02 / PRACTICE</span>
          <h4>Writing</h4>
          <p>Practice general English writing and IELTS tasks.</p>
          <span class="quick-card__link">VIEW STATUS →</span>
        </a>
        <a class="quick-card" href="#/reader">
          <span class="quick-card__number">03 / READING</span>
          <h4>Reader</h4>
          <p>Read documents, capture notes, and mark passages.</p>
          <span class="quick-card__link">VIEW STATUS →</span>
        </a>
      </div>
    </section>

    <section class="dashboard-section dashboard-bottom" aria-label="Activity and privacy">
      <div>
        <header class="dashboard-section__header">
          <p class="eyebrow">A record of your practice</p>
          <h3>Recent activity</h3>
        </header>
        <div class="empty-activity" id="recent-activity" aria-live="polite">
          <p>No activity to show yet. Activity history will appear when a learning module records a study session.</p>
        </div>
      </div>
      <aside class="privacy-note" aria-labelledby="privacy-title">
        <h4 id="privacy-title">Your own learning space</h4>
        <p>PEN501 is designed to keep learning data on this device. It will not sync to another device automatically.</p>
      </aside>
    </section>
  `;
}

export async function loadDashboardSummary() {
  const [vocabulary, flashcards, submissions, documents, activity] = await Promise.all([
    storage.list("vocabulary"),
    storage.list("flashcards"),
    storage.list("writingSubmissions"),
    storage.list("documents"),
    storage.list("appProgress"),
  ]);
  const dueFlashcards = flashcards.filter((card) => isFlashcardDue(card)).length;
  const completedWriting = submissions.filter((submission) =>
    submission.status === "completed" || submission.status === "submitted" || Boolean(submission.submittedAt),
  ).length;
  const sortedActivity = [...activity].sort((a, b) => {
    const aTime = Date.parse(a.activityDate || a.createdAt || "") || 0;
    const bTime = Date.parse(b.activityDate || b.createdAt || "") || 0;
    return bTime - aTime;
  }).slice(0, 5);

  return {
    vocabulary: vocabulary.length,
    dueFlashcards,
    completedWriting,
    documents: documents.length,
    activity: sortedActivity,
  };
}
