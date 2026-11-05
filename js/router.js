import { ROUTES, APP_CONFIG } from "./config.js";
import { renderDashboard } from "./modules/dashboard.js";
import { renderPlannedModule, renderSettings } from "./modules/placeholders.js";
import { renderVocabulary } from "./modules/vocabularyView.js";

function routeFromHash() {
  const key = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return ROUTES[key] ? key : APP_CONFIG.defaultRoute;
}

export function renderRoute() {
  const key = routeFromHash();
  const route = ROUTES[key];
  const view = document.getElementById("view-content");
  const title = document.getElementById("page-title");

  title.textContent = route.title;
  if (route.view === "dashboard") view.innerHTML = renderDashboard();
  else if (route.view === "vocabulary") view.innerHTML = renderVocabulary();
  else if (route.view === "settings") view.innerHTML = renderSettings();
  else view.innerHTML = renderPlannedModule(route);

  document.querySelectorAll(".nav-link[data-route]").forEach((link) => {
    if (link.dataset.route === key) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  document.title = `${route.title} — ${APP_CONFIG.name}`;
  return key;
}

export function normalizeInitialRoute() {
  if (!window.location.hash) window.location.hash = `#/${APP_CONFIG.defaultRoute}`;
}
