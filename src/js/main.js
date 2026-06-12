let CURRENT_VIEW = "dashboard";
let CURRENT_SCREEN = "loading";

async function boot() {
  try {
    const profile = await getProfile();
    applyProfile(profile);
    if (!profile.name) {
      CURRENT_SCREEN = "onboarding";
      initOnboarding();
    } else {
      CURRENT_SCREEN = "app";
      showApp();
      showView("dashboard");
    }
  } catch (e) {
    console.error("boot error", e);
    CURRENT_SCREEN = "app";
    showApp();
    showView("dashboard");
  }
}

// Apply the stored profile to the UI: name, theme, density, defaults.
function applyProfile(profile) {
  const prefs = (profile && profile.prefs) || {};
  window.USER_NAME = (profile && profile.name) || "";
  window.PROFILE = profile || {};
  window.PREFS = prefs;
  window.REDUCED_MOTION = !!prefs.reduced_motion;
  applyTheme(prefs);
  if (prefs.default_range && typeof RANGE !== "undefined") {
    RANGE = prefs.default_range;
    syncRangeButtons();
  }
}

// Accent color + compact density are pure CSS toggles applied at runtime.
function applyTheme(prefs) {
  const accent = (prefs && prefs.accent) || "#FD802E";
  const root = document.documentElement;
  root.style.setProperty("--pk", accent);
  root.style.setProperty("--pk2", lighten(accent, 0.18));
  root.style.setProperty("--pk-dim", lighten(accent, -0.22));
  root.style.setProperty("--line-pk", hexToRgba(accent, 0.3));
  document.body.classList.toggle("compact", !!(prefs && prefs.compact));
  document.body.classList.toggle("reduced", !!(prefs && prefs.reduced_motion));
}

function syncRangeButtons() {
  const host = g("range");
  if (!host) return;
  for (const b of host.children) b.classList.toggle("on", b.dataset.r === RANGE);
}

function showApp() {
  g("onboarding").classList.add("hidden");
  g("app").classList.remove("hidden");
  load();
  startPolling();
}

// --- Energy-aware polling: sync on the configured interval, but pause while
// the window is hidden or blurred so an idle app does no disk work. ---
function pollMs() {
  const s = (window.PREFS && window.PREFS.auto_sync_secs) || 60;
  return Math.max(15, s) * 1000;
}

function startPolling() {
  stopPolling();
  if (document.hidden) return;
  window._poll = setInterval(load, pollMs());
}

function stopPolling() {
  if (window._poll) {
    clearInterval(window._poll);
    window._poll = null;
  }
}

document.addEventListener("visibilitychange", function () {
  if (CURRENT_SCREEN !== "app") return;
  if (document.hidden) {
    stopPolling();
  } else {
    load();
    startPolling();
  }
});

function showView(name) {
  CURRENT_VIEW = name;
  for (const el of document.querySelectorAll(".nav-tab")) {
    el.classList.toggle("on", el.dataset.view === name);
  }
  for (const id of ["view-dashboard", "view-calendar", "view-persona", "view-achievements", "view-settings", "view-share"]) {
    const el = g(id);
    if (el) el.classList.toggle("hidden", id !== "view-" + name);
  }
  if (name === "calendar") renderCalendar();
  if (name === "persona") loadPersona();
  if (name === "achievements") loadAchievements();
  if (name === "settings") loadSettings();
  if (name === "share") renderShareCard();
  if (name === "dashboard") {
    // Reset to the Overview sub-tab and keep the segmented buttons in sync, so
    // coming back from another view never shows Overview with Models still lit.
    TAB = "overview";
    g("models-card").classList.add("hidden");
    g("overview").classList.remove("hidden");
    updateTabButtons();
  }
}

function showModels() {
  TAB = "models";
  g("overview").classList.add("hidden");
  g("models-card").classList.remove("hidden");
}

function showOverview() {
  TAB = "overview";
  g("overview").classList.remove("hidden");
  g("models-card").classList.add("hidden");
}

function updateTabButtons() {
  const tabBtn = g("tab");
  if (!tabBtn) return;
  for (const x of tabBtn.children) {
    x.classList.toggle("on", x.dataset.t === TAB);
  }
}

// Toolbar navigation
g("app").onclick = function (e) {
  const b = e.target.closest(".nav-tab");
  if (!b) return;
  showView(b.dataset.view);
};

// Dashboard tabs
g("tab").onclick = function (e) {
  const b = e.target.closest("button");
  if (!b) return;
  const t = b.dataset.t;
  if (t === "overview") showOverview();
  else if (t === "models") showModels();
  updateTabButtons();
};

g("range").onclick = function (e) {
  const b = e.target.closest("button");
  if (!b) return;
  RANGE = b.dataset.r;
  for (const x of e.currentTarget.children) x.classList.toggle("on", x === b);
  render();
};

g("src").onclick = function (e) {
  const b = e.target.closest("button");
  if (!b) return;
  SOURCE = b.dataset.s;
  syncSrcButtons();
  render();
};

g("btn-sync").onclick = function () {
  load();
};

// Calendar month navigation (CAL_MONTH / CAL_YEAR live in calendar.js)
g("cal-prev").onclick = function () {
  CAL_MONTH--;
  if (CAL_MONTH < 0) { CAL_MONTH = 11; CAL_YEAR--; }
  renderCalendar();
};
g("cal-next").onclick = function () {
  CAL_MONTH++;
  if (CAL_MONTH > 11) { CAL_MONTH = 0; CAL_YEAR++; }
  renderCalendar();
};
g("cal-today").onclick = function () {
  CAL_YEAR = new Date().getFullYear();
  CAL_MONTH = new Date().getMonth();
  renderCalendar();
};

// Dashboard calendar panel -> jump to the full Calendar view.
g("dash-cal-open").onclick = function () {
  showView("calendar");
};

g("dash-cal-prev").onclick = function () {
  MINI_CAL_MONTH--;
  if (MINI_CAL_MONTH < 0) { MINI_CAL_MONTH = 11; MINI_CAL_YEAR--; }
  renderMiniCalendar();
};
g("dash-cal-next").onclick = function () {
  MINI_CAL_MONTH++;
  if (MINI_CAL_MONTH > 11) { MINI_CAL_MONTH = 0; MINI_CAL_YEAR++; }
  renderMiniCalendar();
};

boot();
