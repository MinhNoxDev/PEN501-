import { APP_CONFIG } from "./config.js";

function readThemePreference() {
  try {
    const saved = localStorage.getItem(APP_CONFIG.themeStorageKey);
    return ["system", "light", "dark"].includes(saved) ? saved : "light";
  } catch {
    return "light";
  }
}

function readAnimationPreference() {
  try {
    const saved = localStorage.getItem(APP_CONFIG.animationStorageKey);
    return saved === null ? true : saved !== "false";
  } catch {
    return true;
  }
}

function readWordSuggestionsPreference() {
  try {
    const saved = localStorage.getItem(APP_CONFIG.wordSuggestionsStorageKey);
    return saved === null ? true : saved !== "false";
  } catch {
    return true;
  }
}

export const appState = {
  theme: readThemePreference(),
  animationsEnabled: readAnimationPreference(),
  wordSuggestionsEnabled: readWordSuggestionsPreference(),
};

function updateBrowserThemeColor() {
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) return;
  const usesDarkTheme = appState.theme === "dark" ||
    (appState.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  metaThemeColor.content = usesDarkTheme ? "#0a0a0a" : "#fafafa";
}

export function setThemePreference(theme) {
  if (!["system", "light", "dark"].includes(theme)) return false;
  appState.theme = theme;
  document.documentElement.dataset.theme = theme;
  updateBrowserThemeColor();
  try {
    localStorage.setItem(APP_CONFIG.themeStorageKey, theme);
  } catch {
    // The selection still applies to this page when browser storage is unavailable.
  }
  return true;
}

export function setAnimationPreference(enabled) {
  appState.animationsEnabled = Boolean(enabled);
  document.documentElement.dataset.animations = appState.animationsEnabled ? "on" : "off";
  try {
    localStorage.setItem(APP_CONFIG.animationStorageKey, String(appState.animationsEnabled));
  } catch {
    // The preference still applies to this page when browser storage is unavailable.
  }
  return true;
}

export function setWordSuggestionsPreference(enabled) {
  appState.wordSuggestionsEnabled = Boolean(enabled);
  try {
    localStorage.setItem(APP_CONFIG.wordSuggestionsStorageKey, String(appState.wordSuggestionsEnabled));
  } catch {
    // The preference still applies to this page when browser storage is unavailable.
  }
  return true;
}

export function initializePreferences() {
  document.documentElement.dataset.theme = appState.theme;
  document.documentElement.dataset.animations = appState.animationsEnabled ? "on" : "off";
  updateBrowserThemeColor();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (appState.theme === "system") updateBrowserThemeColor();
  });
}
