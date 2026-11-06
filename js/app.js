import { APP_CONFIG } from "./config.js";
import { initializePreferences, setAnimationPreference, setThemePreference, setWordSuggestionsPreference, appState } from "./state.js";
import { normalizeInitialRoute, renderRoute } from "./router.js";
import { loadDashboardSummary } from "./modules/dashboard.js";
import { mountVocabulary } from "./modules/vocabulary.js";
import { getStorageStatus } from "./database/storage.js";
import { createBackupBlob, downloadBackup, readBackupFile } from "./services/backupService.js";

const menuToggle = document.getElementById("menu-toggle");
const sidebarScrim = document.getElementById("sidebar-scrim");
const sidebar = document.getElementById("sidebar");
const themeSelect = document.getElementById("theme-select");
const loadingScreen = document.getElementById("app-loading");
const mobileLayout = window.matchMedia("(max-width: 820px)");
let cleanupActiveView = null;

function syncSidebarInert() {
  sidebar.inert = mobileLayout.matches
    ? !document.body.classList.contains("nav-open")
    : document.body.classList.contains("nav-hidden");
}

function navigationIsOpen() {
  return mobileLayout.matches
    ? document.body.classList.contains("nav-open")
    : !document.body.classList.contains("nav-hidden");
}

function syncNavigationButton() {
  const isOpen = navigationIsOpen();
  const label = `${isOpen ? "Close" : "Open"} navigation`;
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", label);
  menuToggle.title = label;
  const icon = document.getElementById("menu-toggle-icon");
  icon.className = `bi ${isOpen ? "bi-x-lg" : "bi-list"} menu-toggle__icon`;
}

function closeNavigation(returnFocus = false) {
  if (mobileLayout.matches) document.body.classList.remove("nav-open");
  else document.body.classList.add("nav-hidden");
  syncSidebarInert();
  syncNavigationButton();
  if (returnFocus) menuToggle.focus();
}

function toggleNavigation() {
  if (mobileLayout.matches) document.body.classList.toggle("nav-open");
  else document.body.classList.toggle("nav-hidden");
  const isOpen = navigationIsOpen();
  syncSidebarInert();
  syncNavigationButton();
  if (isOpen) sidebar.querySelector(".primary-nav a")?.focus();
  else menuToggle.focus();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Unavailable";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}

async function refreshStorageStatus() {
  const statusElement = document.getElementById("storage-status");
  const detailElement = document.getElementById("storage-detail");
  const retentionElement = document.getElementById("storage-retention");
  if (!statusElement) return;

  statusElement.textContent = "Checking IndexedDB…";
  const status = await getStorageStatus();
  if (!status.supported) {
    statusElement.textContent = "IndexedDB is not available in this browser context.";
    detailElement.textContent = "Open PEN501 from a current browser over HTTP or HTTPS.";
    retentionElement.textContent = "";
    return;
  }
  if (!status.connected) {
    statusElement.textContent = "PEN501 could not open its local database.";
    detailElement.textContent = status.error || "Check whether another PEN501 tab is upgrading the database, then reload.";
    retentionElement.textContent = "No learning records were changed by this status check.";
    return;
  }

  statusElement.textContent = "PEN501 local database is ready.";
  detailElement.textContent = status.usage === null
    ? "This browser does not provide a storage usage estimate."
    : `This site uses about ${formatBytes(status.usage)}${status.quota === null ? "" : ` of an estimated ${formatBytes(status.quota)} available for this origin`}.`;
  retentionElement.textContent = status.persistent === null
    ? "Browser storage retention status is not available."
    : status.persistent
      ? "The browser reports this site's storage as persistent."
      : "The browser manages storage retention for this site; export backups regularly.";
}

function setBackupMessage(message, state = "default") {
  const status = document.getElementById("backup-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function setDashboardUnavailable() {
  for (const id of ["metric-vocabulary", "metric-flashcards-due", "metric-writing", "metric-documents"]) {
    const metric = document.getElementById(id);
    if (metric) metric.textContent = "Unavailable";
  }
  const activity = document.getElementById("recent-activity");
  if (activity) activity.textContent = "Learning data could not be read from this browser.";
}

function formatActivityDate(value) {
  if (!value) return "DATE NOT RECORDED";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "DATE NOT RECORDED";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date).toUpperCase();
}

async function refreshDashboard() {
  if (!document.getElementById("metric-vocabulary")) return;
  try {
    const summary = await loadDashboardSummary();
    const values = {
      "metric-vocabulary": summary.vocabulary,
      "metric-flashcards-due": summary.dueFlashcards,
      "metric-writing": summary.completedWriting,
      "metric-documents": summary.documents,
    };
    for (const [id, value] of Object.entries(values)) {
      const metric = document.getElementById(id);
      if (metric) metric.textContent = String(value);
    }

    const activity = document.getElementById("recent-activity");
    if (!activity) return;
    if (summary.activity.length === 0) {
      activity.textContent = "No activity to show yet. Activity history will appear when a learning module records a study session.";
      return;
    }
    const labels = {
      vocabulary_added: "Vocabulary added",
      vocabulary_quiz_completed: "Vocabulary quiz completed",
      flashcard_reviewed: "Flashcard reviewed",
      writing_completed: "Writing completed",
      document_opened: "Document opened",
    };
    const list = document.createElement("ul");
    list.className = "activity-list";
    for (const item of summary.activity) {
      const row = document.createElement("li");
      const title = document.createElement("span");
      const detail = typeof item.activityData?.title === "string"
        ? item.activityData.title
        : typeof item.activityData?.word === "string"
          ? item.activityData.word
          : Number.isFinite(item.activityData?.score) && Number.isFinite(item.activityData?.total)
            ? `${item.activityData.score}/${item.activityData.total}`
            : "";
      title.textContent = `${labels[item.activityType] || String(item.activityType || "Study activity").replaceAll("_", " ")}${detail ? ` · ${detail}` : ""}`;
      const date = document.createElement("time");
      date.textContent = formatActivityDate(item.activityDate || item.createdAt);
      row.append(title, date);
      list.append(row);
    }
    activity.replaceChildren(list);
  } catch {
    setDashboardUnavailable();
  }
}

function showErrorMessage(error) {
  if (error?.code === "DATABASE_BLOCKED") return "Close other PEN501 tabs, then try again.";
  if (error?.code === "INDEXEDDB_UNAVAILABLE") return "IndexedDB is unavailable in this browser context.";
  return error?.message || "The requested storage operation could not be completed.";
}

async function handleBackupExport(button) {
  button.disabled = true;
  setBackupMessage("Preparing a local backup…");
  try {
    const backup = await createBackupBlob();
    downloadBackup(backup);
    setBackupMessage(`Backup download started (${formatBytes(backup.size)}). Keep the file somewhere safe.`, "success");
  } catch (error) {
    setBackupMessage(`Backup could not be created: ${showErrorMessage(error)}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function handleBackupRestore(button) {
  const fileInput = document.getElementById("backup-file");
  const file = fileInput?.files?.[0];
  if (!file) {
    setBackupMessage("Choose a PEN501 backup file first.", "error");
    return;
  }
  const confirmed = window.confirm("Restoring this backup replaces all existing PEN501 records in this browser. Continue?");
  if (!confirmed) return;

  button.disabled = true;
  setBackupMessage("Validating backup and restoring records…");
  try {
    const counts = await readBackupFile(file);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    setBackupMessage(`Restore complete. ${total} record${total === 1 ? "" : "s"} restored across ${Object.keys(counts).length} data stores.`, "success");
    fileInput.value = "";
    await refreshStorageStatus();
  } catch (error) {
    setBackupMessage(`Backup could not be restored: ${showErrorMessage(error)}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function renderCurrentRoute() {
  cleanupActiveView?.();
  cleanupActiveView = null;
  const key = renderRoute();
  const pending = [];
  if (key === "settings") pending.push(refreshStorageStatus());
  if (key === "settings") {
    const animationToggle = document.getElementById("animations-enabled");
    if (animationToggle) animationToggle.checked = appState.animationsEnabled;
    const suggestionsToggle = document.getElementById("word-suggestions-enabled");
    if (suggestionsToggle) suggestionsToggle.checked = appState.wordSuggestionsEnabled;
  }
  if (key === "dashboard") pending.push(refreshDashboard());
  if (key === "vocabulary") {
    cleanupActiveView = mountVocabulary(document.getElementById("view-content"));
    pending.push(cleanupActiveView.ready);
  }
  await Promise.allSettled(pending);
}

function hideLoadingScreen() {
  if (!loadingScreen) return;
  loadingScreen.classList.add("loading-screen--hidden");
  window.setTimeout(() => { loadingScreen.hidden = true; }, 260);
}

function initializeApp() {
  initializePreferences();
  themeSelect.value = appState.theme;
  document.getElementById("app-version").textContent = `v${APP_CONFIG.version}`;

  themeSelect.addEventListener("change", (event) => {
    setThemePreference(event.target.value);
  });

  menuToggle.addEventListener("click", toggleNavigation);
  sidebarScrim.addEventListener("click", () => closeNavigation(true));
  document.querySelectorAll(".nav-link, .wordmark").forEach((link) => {
    link.addEventListener("click", () => closeNavigation());
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigationIsOpen() && !document.querySelector("dialog[open]")) closeNavigation(true);
  });
  mobileLayout.addEventListener("change", () => {
    if (!mobileLayout.matches) document.body.classList.remove("nav-open");
    syncSidebarInert();
    syncNavigationButton();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "animations-enabled") setAnimationPreference(event.target.checked);
    if (event.target.id === "word-suggestions-enabled") setWordSuggestionsPreference(event.target.checked);
  });

  document.addEventListener("click", (event) => {
    const exportButton = event.target.closest("#backup-export");
    if (exportButton) void handleBackupExport(exportButton);
    const restoreButton = event.target.closest("#backup-restore");
    if (restoreButton && !restoreButton.disabled) void handleBackupRestore(restoreButton);
  });
  document.addEventListener("change", (event) => {
    if (event.target.id !== "backup-file") return;
    const restoreButton = document.getElementById("backup-restore");
    if (!restoreButton) return;
    restoreButton.disabled = !event.target.files?.length;
    if (restoreButton.disabled) setBackupMessage("Select a PEN501 JSON backup file to enable restore.");
    else setBackupMessage("Ready to validate the selected file. Restore will replace current PEN501 records.");
  });

  normalizeInitialRoute();
  const initialRender = renderCurrentRoute();
  syncSidebarInert();
  syncNavigationButton();
  void Promise.race([
    Promise.all([initialRender, new Promise((resolve) => window.setTimeout(resolve, 320))]),
    new Promise((resolve) => window.setTimeout(resolve, 8000)),
  ]).finally(hideLoadingScreen);
  window.addEventListener("hashchange", () => {
    void renderCurrentRoute();
    closeNavigation();
    document.getElementById("main-content").focus({ preventScroll: true });
  });
}

initializeApp();
