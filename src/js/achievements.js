// Outline SVG glyphs (no emoji). Keyed by the backend achievement id so the
// icon is always correct regardless of display name. One distinctive glyph per
// trophy — no repeats across the roster.
const ACH_GLYPHS = {
  signal: '<circle cx="12" cy="12" r="1.6"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  hook: '<circle cx="15" cy="4.2" r="1.4"/><path d="M15 5.6v6.4a4 4 0 0 1-8 0"/><path d="M7 12l-2 2M7 12l2 2"/>',
  coin: '<ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v6c0 1.7 3.6 3 8 3s8-1.3 8-3V7"/><path d="M4 13c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  layers: '<path d="M12 3 3 7.5 12 12l9-4.5z"/><path d="M3 12l9 4.5L21 12M3 16.5 12 21l9-4.5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M6 12a6 6 0 0 0 12 0M4.5 12H7M17 12h2.5"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="11" cy="12" r="3.4"/><path d="M11 8.6v3.4l2 2M18 9v6"/>',
  brain: '<path d="M9.5 3A2.5 2.5 0 0 0 7 5.5 3 3 0 0 0 5.5 11 3 3 0 0 0 7 16.5 2.5 2.5 0 0 0 12 18V4a2.5 2.5 0 0 0-2.5-1z"/><path d="M14.5 3A2.5 2.5 0 0 1 17 5.5 3 3 0 0 1 18.5 11 3 3 0 0 1 17 16.5 2.5 2.5 0 0 1 12 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wand: '<path d="M4 20 15 9"/><path d="M15 3.6l.9 2.1L18 6.6l-2.1.9L15 9.6l-.9-2.1L12 6.6l2.1-.9z"/><path d="M19.5 12l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  dollar: '<circle cx="12" cy="12" r="9"/><path d="M15 8.6C15 7.2 13.7 6.2 12 6.2S9 7.2 9 8.6 10.3 11 12 11.4s3 .9 3 2.4-1.3 2.4-3 2.4-3-1-3-2.4"/><path d="M12 5v1.4M12 16v1.4"/>',
  gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3 7 9l5 12 5-12-2-6"/>',
  infinity: '<path d="M12 12c1.5-2 3-3 4.5-3a3 3 0 0 1 0 6c-1.5 0-3-1-4.5-3z"/><path d="M12 12c-1.5 2-3 3-4.5 3a3 3 0 0 1 0-6c1.5 0 3 1 4.5 3z"/>',
  weight: '<path d="M6 9v6M18 9v6M3 10.5v3M21 10.5v3M6 12h12"/>',
  whale: '<path d="M3 13c1.5 2.6 4.5 4 8 4 4.5 0 8-2.5 8-6 0-1-.3-1.8-.3-1.8M5 13c0-2.2 2-4 5-4 2 0 3.5.8 4.5 2"/><path d="M19 9c.7-.3 1.5-1 1.8-2-.2 1.2.3 2 .2 2"/><path d="M9 12h.01"/>',
  box: '<rect x="3.5" y="7" width="17" height="13" rx="1.5"/><path d="M3.5 7l2-3h13l2 3M9 11h6"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/><circle cx="15" cy="15" r="1.1"/>',
  crown: '<path d="M4 18h16M5 18 4 8l4.5 3L12 5l3.5 6L20 8l-1 10z"/>',
  flame: '<path d="M12 2c2 4 5 5.5 5 9a5 5 0 0 1-10 0c0-2 .8-3.2 2-4.2 0 1.8 1 2.7 1.8 2.7.7 0 1.2-.6 1.2-1.5 0-2-1-3-1-6z"/>',
  mountain: '<path d="M3 20h18L13.5 6l-3.5 6-2-3z"/><path d="M11.5 9l2-2.6"/>',
  boxes: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
  atom: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M9 9.6 6.5 3M15 9.6 17.5 3M12 12.6l.85 1.7 1.9.28-1.37 1.34.32 1.88L12 16.6l-1.7.9.32-1.88L9.25 14.26l1.9-.28z"/>',
  star: '<path d="m12 3 2.6 5.6L21 9.3l-4.5 4.3 1.1 6.2L12 17l-5.6 2.8 1.1-6.2L3 9.3l6.4-.7z"/>',
};

// One unique glyph per trophy id (ids are stable across the curation).
const ACH_ICON_FOR = {
  earlybird: "signal",    // First Contact
  streak7: "hook",        // Hooked
  tens: "coin",           // The Stack
  polyglot3: "layers",    // Polyglot
  nightowl: "moon",       // Night Owl
  marathon: "flag",       // Marathoner
  deep_work: "anchor",    // Deep Diver
  hundred: "vault",       // The Vault
  polymath: "brain",      // Mind Palace
  ultra_day: "weight",    // Heavy Lifter
  around_clock: "clock",  // Around the Clock
  cache_master: "wand",   // Cache Sorcerer
  spend1k: "dollar",      // Big Spender
  billion: "gem",         // Billionaire
  streak100: "infinity",  // Unbroken
  spend5k: "whale",       // The Whale
  archive: "box",         // The Archive
  high_roller: "dice",    // High Roller
  five_billion: "crown",  // Ten-Figure Mind
  streak30: "flame",      // Ironclad
  colossus: "mountain",   // Colossus
  polyglot5: "boxes",     // Full Stack
  omnivore: "atom",       // Omnivore
  veteran: "medal",       // Veteran
};

// Display categories — one horizontally-scrolling row each, in this order.
const ACH_CATS = [
  { id: "volume", label: "Volume & Spend" },
  { id: "intensity", label: "Intensity & Streaks" },
  { id: "mastery", label: "Breadth & Mastery" },
];

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

    const host = g("ach-grid");
    host.innerHTML = "";

    // Within a category: unlocked first (hardest by rank), then locked by how
    // close they are to earning.
    const sorted = list.slice().sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked) return b.rank - a.rank;
      return b.progress - a.progress;
    });

    // One horizontally-scrolling row per category.
    for (const cat of ACH_CATS) {
      const items = sorted.filter(a => a.category === cat.id);
      if (!items.length) continue;
      const got = items.filter(a => a.unlocked).length;

      const sec = document.createElement("div");
      sec.className = "ach-cat";
      sec.innerHTML =
        '<div class="ach-cat-head"><span class="ach-cat-label">' + cat.label + "</span>" +
        '<span class="ach-cat-count">' + got + " / " + items.length + "</span></div>";

      const row = document.createElement("div");
      row.className = "ach-cat-row";
      for (const a of items) row.appendChild(buildBadge(a));
      sec.appendChild(row);
      host.appendChild(sec);
    }
  } catch (e) {
    console.error("achievements load error", e);
    g("ach-grid").innerHTML = '<div style="text-align:center;color:var(--mut)">Load error</div>';
  }
}

// Build one badge card (medallion + name + description + date/progress).
function buildBadge(a) {
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
  return el;
}
