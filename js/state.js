import { APP_CONFIG } from "./config.js";

function readThemePreference() {
  try {
    const saved = localStorage.getItem(APP_CONFIG.themeStorageKey);
    return ["system", "light", "dark"].includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export const appState = {
  theme: readThemePreference(),
};

function updateBrowserThemeColor() {
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) return;
  const usesDarkTheme = appState.theme === "dark" ||
    (appState.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  metaThemeColor.content = usesDarkTheme ? "#000000" : "#ffffff";
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

export function initializePreferences() {
  document.documentElement.dataset.theme = appState.theme;
  updateBrowserThemeColor();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (appState.theme === "system") updateBrowserThemeColor();
  });
}
