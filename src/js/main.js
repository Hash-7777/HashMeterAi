let CURRENT_VIEW = "dashboard";
let CURRENT_SCREEN = "loading";

async function boot() {
  try {
    const profile = await getProfile();
    window.REDUCED_MOTION = profile.prefs && profile.prefs.reduced_motion;
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

function showApp() {
  g("onboarding").classList.add("hidden");
  g("app").classList.remove("hidden");
  load();
  if (!window._poll) {
    window._poll = setInterval(load, 30000);
  }
}

function showView(name) {
  CURRENT_VIEW = name;
  for (const el of document.querySelectorAll(".nav-tab")) {
    el.classList.toggle("on", el.dataset.view === name);
  }
  for (const id of ["view-dashboard", "view-persona", "view-achievements", "view-settings", "view-share"]) {
    const el = g(id);
    if (el) el.classList.toggle("hidden", id !== "view-" + name);
  }
  if (name === "persona") loadPersona();
  if (name === "achievements") loadAchievements();
  if (name === "settings") loadSettings();
  if (name === "share") renderShareCard();
  if (name === "dashboard") {
    g("models-card").classList.add("hidden");
    TAB = "overview";
    g("overview").classList.remove("hidden");
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

boot();
