// Outline SVG glyphs (no emoji). Keyed by the backend achievement id so the
// icon is always correct regardless of display name.
const ACH_GLYPHS = {
  sun: '<circle cx="12" cy="14" r="4"/><path d="M12 3v3M5 14H2M22 14h-3M5.6 7.6 7 9M18.4 7.6 17 9M2 19h20"/>',
  coin: '<ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v6c0 1.7 3.6 3 8 3s8-1.3 8-3V7"/><path d="M4 13c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3 7 9l5 12 5-12-2-6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  flame: '<path d="M12 2c2 4 5 5.5 5 9a5 5 0 0 1-10 0c0-2 .8-3.2 2-4.2 0 1.8 1 2.7 1.8 2.7.7 0 1.2-.6 1.2-1.5 0-2-1-3-1-6z"/>',
  layers: '<path d="M12 3 3 7.5 12 12l9-4.5z"/><path d="M3 12l9 4.5L21 12M3 16.5 12 21l9-4.5"/>',
  shuffle: '<path d="M16 4h4v4M20 4l-7 7M16 20h4v-4M20 20 4 4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M9 9.5 6.5 3M15 9.5 17.5 3M12 12.5l.9 1.8 2 .3-1.45 1.4.35 2L12 17l-1.8.95.35-2L9.1 14.6l2-.3z"/>',
  brain: '<path d="M9.5 3A2.5 2.5 0 0 0 7 5.5 3 3 0 0 0 5.5 11 3 3 0 0 0 7 16.5 2.5 2.5 0 0 0 12 18V4a2.5 2.5 0 0 0-2.5-1z"/><path d="M14.5 3A2.5 2.5 0 0 1 17 5.5 3 3 0 0 1 18.5 11 3 3 0 0 1 17 16.5 2.5 2.5 0 0 1 12 18"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  dollar: '<circle cx="12" cy="12" r="9"/><path d="M15 8.6C15 7.2 13.7 6.2 12 6.2S9 7.2 9 8.6 10.3 11 12 11.4s3 .9 3 2.4-1.3 2.4-3 2.4-3-1-3-2.4"/><path d="M12 5v1.4M12 16v1.4"/>',
  star: '<path d="m12 3 2.6 5.6L21 9.3l-4.5 4.3 1.1 6.2L12 17l-5.6 2.8 1.1-6.2L3 9.3l6.4-.7z"/>',
};

const ACH_ICON_FOR = {
  earlybird: "sun",
  million: "coin", tens: "coin", hundred: "coin", billion: "gem", five_billion: "gem",
  marathon: "bolt", ultra_day: "bolt",
  streak3: "flame", streak7: "flame", streak30: "flame", streak100: "flame",
  polyglot2: "layers", polyglot3: "layers", polyglot5: "layers",
  hopper: "shuffle", polymath: "shuffle",
  nightowl: "moon", around_clock: "clock",
  deep_work: "target", locked_in: "lock", iron_focus: "lock",
  centurion: "shield", veteran: "medal",
  opus: "brain",
  cache: "db", cache_master: "db",
  spend100: "dollar", spend1k: "dollar", spend5k: "gem",
};

const TIER_WEIGHT = { legendary: 4, epic: 3, rare: 2, common: 1 };

function achIcon(id) {
  const inner = ACH_GLYPHS[ACH_ICON_FOR[id]] || ACH_GLYPHS.star;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
}

async function loadAchievements() {
  try {
    const list = await getAchievements();
    const unlocked = list.filter(a => a.unlocked).length;

    // Personalized header with a per-tier breakdown of what's earned.
    const name = (window.USER_NAME || "").trim();
    const owner = name ? name + "'s badges" : "Achievements";
    const tiers = ["legendary", "epic", "rare", "common"];
    const chips = tiers.map(t => {
      const all = list.filter(a => a.tier === t);
      const got = all.filter(a => a.unlocked).length;
      if (!all.length) return "";
      return '<span class="tier-chip tier-' + t + '">' + t + " " + got + "/" + all.length + "</span>";
    }).join("");
    g("ach-header").innerHTML =
      '<div class="ach-head-row"><span class="ach-head-title">' + owner + "</span>" +
      '<span class="ach-head-count">' + unlocked + " / " + list.length + " unlocked</span></div>" +
      '<div class="ach-head-bar"><div class="ach-head-fill" style="width:' +
      (list.length ? Math.round(100 * unlocked / list.length) : 0) + '%"></div></div>' +
      '<div class="ach-head-chips">' + chips + "</div>";

    const grid = g("ach-grid");
    grid.innerHTML = "";

    // Unlocked first (rarest shown off first), then locked by progress.
    const sorted = list.slice().sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked) return (TIER_WEIGHT[b.tier] || 0) - (TIER_WEIGHT[a.tier] || 0);
      return b.progress - a.progress;
    });

    for (const a of sorted) {
      const el = document.createElement("div");
      el.className = "ach-badge tier-" + a.tier + (a.unlocked ? " unlocked" : " locked");

      const pct = Math.round(a.progress * 100);
      const date = a.earned_date && a.unlocked
        ? '<div class="ach-date">earned ' + a.earned_date + "</div>"
        : "";
      const progress = a.unlocked
        ? '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:100%"></div></div>'
        : '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:' + pct + '%"></div></div><div class="ach-pct">' + pct + "%</div>";

      el.innerHTML =
        '<div class="ach-tier-tag">' + a.tier + "</div>" +
        '<div class="ach-icon">' + achIcon(a.id) + "</div>" +
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
