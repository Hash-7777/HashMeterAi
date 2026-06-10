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
      el.className = "tile";
      el.style.cssText = a.unlocked
        ? ""
        : "opacity:0.45;filter:grayscale(0.6)";

      const pct = Math.round(a.progress * 100);
      const bar = a.unlocked
        ? '<div style="height:4px;border-radius:2px;background:var(--pk);margin-top:10px;box-shadow:0 0 8px var(--pk)"></div>'
        : '<div style="height:4px;border-radius:2px;background:rgba(0,0,0,.3);margin-top:10px;overflow:hidden"><div style="height:100%;border-radius:2px;background:var(--pk-dim);width:' + pct + '%"></div></div>';

      const date = a.earned_date ? '<div style="font-size:10px;color:var(--pk2);margin-top:4px;font-family:var(--mono)">' + a.earned_date + "</div>" : "";
      const progress = !a.unlocked ? '<div style="font-size:10px;color:var(--mut);margin-top:4px;font-family:var(--mono)">' + pct + "%</div>" : "";

      el.innerHTML =
        '<div class="lab">' + a.name + "</div>" +
        '<div style="font-size:12px;color:var(--mut);margin-top:6px;line-height:1.4">' + a.description + "</div>" +
        date + progress + bar;
      grid.appendChild(el);
    }
  } catch (e) {
    console.error("achievements load error", e);
    g("ach-grid").innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mut)">Load error</div>';
  }
}

g("ach-back").onclick = function () {
  g("achievements-view").classList.add("hidden");
  g("dashboard").classList.remove("hidden");
  CURRENT_SCREEN = "dashboard";
  TAB = "overview";
  updateTabButtons();
};
