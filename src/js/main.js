let CURRENT_SCREEN = "loading";

async function boot() {
  try {
    const profile = await getProfile();
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
  g("dashboard").classList.remove("hidden");
  load();
  setInterval(load, 12000);
}

function showCalendar() {
  g("dashboard").classList.add("hidden");
  g("calendar-view").classList.remove("hidden");
  renderCalendar();
}

function showModels() {
  // models tab is inline inside dashboard
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
  if (t === "overview") showOverview();
  else if (t === "models") showModels();
  else if (t === "calendar") showCalendar();
  updateTabButtons();
};

g("range").onclick = function (e) {
  const b = e.target.closest("button");
  if (!b) return;
  RANGE = b.dataset.r;
  for (const x of e.currentTarget.children) x.classList.toggle("on", x === b);
  renderDashboard();
};

g("src").onclick = function (e) {
  const b = e.target.closest("button");
  if (!b) return;
  SOURCE = b.dataset.s;
  syncSrcButtons();
  renderDashboard();
};

boot();
