function loadAchievements() {
  g("ach-header").textContent = "Achievements";
  const grid = g("ach-grid");
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mut);font-size:13px;padding:20px">Coming soon</div>';
}

g("ach-back").onclick = function () {
  g("achievements-view").classList.add("hidden");
  g("dashboard").classList.remove("hidden");
  CURRENT_SCREEN = "dashboard";
  TAB = "overview";
  updateTabButtons();
};
