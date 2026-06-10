const ACH_ICONS = {
  "First Token": "🥇",
  "Generator": "📝",
  "Context Maximalist": "📚",
  "Polyglot": "🌐",
  "Deep Thinker": "🧠",
  "Speed Runner": "⚡",
  "Night-Shift": "🌙",
  "Daily Driver": "📅",
  "Marathoner": "🏃",
  "Locked-In": "🔒",
  "Penny Pincher": "🪙",
  "High Roller": "💎",
  "Completionist": "🏆",
};

async function loadAchievements() {
  try {
    const list = await getAchievements();
    const unlocked = list.filter(a => a.unlocked).length;
    g("ach-header").textContent = "Achievements \u00b7 " + unlocked + " / " + list.length + " unlocked";
    const grid = g("ach-grid");
    grid.innerHTML = "";

    // Sort: unlocked first, then by progress desc
    const sorted = list.slice().sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      return b.progress - a.progress;
    });

    for (const a of sorted) {
      const el = document.createElement("div");
      el.className = "ach-badge" + (a.unlocked ? "" : " locked");

      const icon = ACH_ICONS[a.name] || "⭐";
      const pct = Math.round(a.progress * 100);

      const date = a.earned_date
        ? '<div class="ach-date">' + a.earned_date + "</div>"
        : "";
      const progress = !a.unlocked
        ? '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:' + pct + '%"></div></div><div class="ach-pct">' + pct + "%</div>"
        : '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:100%"></div></div>';

      el.innerHTML =
        '<div class="ach-icon">' + icon + "</div>" +
        '<div class="ach-name">' + a.name + "</div>" +
        '<div class="ach-desc">' + a.description + "</div>" +
        date + progress;
      grid.appendChild(el);
    }
  } catch (e) {
    console.error("achievements load error", e);
    g("ach-grid").innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mut)">Load error</div>';
  }
}
