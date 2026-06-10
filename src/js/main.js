let CURRENT_SCREEN = "loading";

async function boot() {
  try {
    const profile = await getProfile();
    window.REDUCED_MOTION = profile.prefs && profile.prefs.reduced_motion;
    if (!profile.name) {
      CURRENT_SCREEN = "onboarding";
      initOnboarding();
    } else {
      CURRENT_SCREEN = "dashboard";
      showDashboard();
    }
  } catch (e) {
    console.error("boot error", e);
    CURRENT_SCREEN = "dashboard";
    showDashboard();
  }
}

function showDashboard() {
  g("onboarding").classList.add("hidden");
  g("persona-view").classList.add("hidden");
  g("achievements-view").classList.add("hidden");
  g("settings-view").classList.add("hidden");
  g("calendar-view").classList.add("hidden");
  g("dashboard").classList.remove("hidden");
  load();
  if (!window._poll) {
    window._poll = setInterval(load, 30000);
  }
}

function showCalendar() {
  hideAllViews();
  g("calendar-view").classList.remove("hidden");
  renderCalendar();
}

function showPersona() {
  hideAllViews();
  g("persona-view").classList.remove("hidden");
  loadPersona();
}

function showAchievements() {
  hideAllViews();
  g("achievements-view").classList.remove("hidden");
  loadAchievements();
}

function showSettings() {
  hideAllViews();
  g("settings-view").classList.remove("hidden");
  loadSettings();
}

function hideAllViews() {
  g("dashboard").classList.add("hidden");
  g("calendar-view").classList.add("hidden");
  g("persona-view").classList.add("hidden");
  g("achievements-view").classList.add("hidden");
  g("settings-view").classList.add("hidden");
  g("share-view").classList.add("hidden");
}

function showModels() {
  TAB = "models";
  g("overview").classList.add("hidden");
  g("models").classList.remove("hidden");
  updateTabButtons();
}

function showOverview() {
  TAB = "overview";
  g("overview").classList.remove("hidden");
  g("models").classList.add("hidden");
  updateTabButtons();
}

function updateTabButtons() {
  const tabBtn = g("tab");
  if (!tabBtn) return;
  for (const x of tabBtn.children) {
    x.classList.toggle("on", x.dataset.t === TAB);
  }
}

// Tab navigation
g("tab").onclick = function (e) {
  const b = e.target.closest("button");
  if (!b) return;
  const t = b.dataset.t;
  if (t === "overview") { showDashboard(); showOverview(); }
  else if (t === "models") { showDashboard(); showModels(); }
  else if (t === "calendar") showCalendar();
  else if (t === "persona") showPersona();
  else if (t === "achievements") showAchievements();
  else if (t === "settings") showSettings();
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
