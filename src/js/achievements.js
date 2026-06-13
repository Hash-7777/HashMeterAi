// Bold, filled "engraved emblem" glyphs (no emoji). Keyed by a stable glyph
// name; ACH_ICON_FOR maps each trophy id to one. Designed to sit on the metallic
// tier medallions in components.css — solid silhouettes with light-catching
// rgba highlights read far better than thin outlines.
const ACH_GLYPHS = {
  signal: '<circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M8.3 8.3a5.2 5.2 0 0 0 0 7.4M15.7 8.3a5.2 5.2 0 0 1 0 7.4M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>',
  hook: '<circle cx="15" cy="4.5" r="1.7" fill="currentColor"/><path d="M15 6.2v6.3a4.2 4.2 0 0 1-8.4 0" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><path d="M6.6 12.5 4.7 14.4M6.6 12.5l1.9 1.9" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',
  coin: '<ellipse cx="12" cy="16.4" rx="7" ry="2.6" fill="currentColor"/><ellipse cx="12" cy="12.4" rx="7" ry="2.6" fill="currentColor"/><ellipse cx="12" cy="8.4" rx="7" ry="2.6" fill="currentColor"/><ellipse cx="12" cy="8.4" rx="7" ry="2.6" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1"/><path d="M9.6 8.1c1-.8 3.8-.8 4.8 0" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1" stroke-linecap="round"/>',
  layers: '<path d="M12 3 3 7.5 12 12l9-4.5z" fill="currentColor"/><path d="M3 12l9 4.5L21 12M3 16.5 12 21l9-4.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" fill="currentColor"/><circle cx="16.4" cy="7.6" r=".95" fill="rgba(255,255,255,.6)"/>',
  flag: '<path d="M5.6 21V3.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M5.6 4h11l-2.4 4 2.4 4h-11z" fill="currentColor"/>',
  anchor: '<circle cx="12" cy="5" r="2.2" fill="currentColor"/><path d="M12 7.2V20M6 12a6 6 0 0 0 12 0M4.4 12H7M17 12h2.6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  vault: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.6" fill="currentColor"/><circle cx="11" cy="12" r="3.9" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.4"/><path d="M11 8.4v3.6l2.3 1.4" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.4" stroke-linecap="round"/><path d="M17.4 9v6" stroke="rgba(255,255,255,.45)" stroke-width="1.4" stroke-linecap="round"/>',
  brain: '<path d="M9.5 3A2.5 2.5 0 0 0 7 5.5 3 3 0 0 0 5.5 11 3 3 0 0 0 7 16.5 2.5 2.5 0 0 0 12 18V4a2.5 2.5 0 0 0-2.5-1z" fill="currentColor"/><path d="M14.5 3A2.5 2.5 0 0 1 17 5.5 3 3 0 0 1 18.5 11 3 3 0 0 1 17 16.5 2.5 2.5 0 0 1 12 18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 6.4V12l3.6 2.2" fill="none" stroke="rgba(255,255,255,.78)" stroke-width="1.8" stroke-linecap="round"/>',
  wand: '<path d="M4 20 14.4 9.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M15 3.4l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="currentColor"/><path d="M19.6 12l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" opacity=".8"/>',
  dollar: '<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M14.6 9C14.6 7.7 13.4 7 12 7s-2.6.8-2.6 2 1.2 1.9 2.6 2.2 2.8.9 2.8 2.3S13.4 17 12 17s-2.8-.9-2.8-2.3" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="1.5" stroke-linecap="round"/><path d="M12 5.4v1.5M12 17v1.5" stroke="rgba(255,255,255,.72)" stroke-width="1.5" stroke-linecap="round"/>',
  gem: '<path d="M6 3.5h12l3.2 5.2L12 21 2.8 8.7z" fill="currentColor"/><path d="M2.8 8.7h18.4M9 3.5 7 8.7l5 12.3 5-12.3-2-5.2" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.1"/>',
  infinity: '<path d="M12 12c1.6-2.2 3.2-3.2 4.8-3.2a3.2 3.2 0 0 1 0 6.4c-1.6 0-3.2-1-4.8-3.2z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12c-1.6 2.2-3.2 3.2-4.8 3.2a3.2 3.2 0 0 1 0-6.4c1.6 0 3.2 1 4.8 3.2z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  weight: '<rect x="2.3" y="9.4" width="2.7" height="5.2" rx="1" fill="currentColor"/><rect x="5" y="7.8" width="2.5" height="8.4" rx="1" fill="currentColor"/><rect x="16.5" y="7.8" width="2.5" height="8.4" rx="1" fill="currentColor"/><rect x="19" y="9.4" width="2.7" height="5.2" rx="1" fill="currentColor"/><rect x="7" y="10.9" width="10" height="2.2" fill="currentColor"/>',
  whale: '<path d="M3 13c0-3 3-5.4 7-5.4 4.5 0 7.8 3 7.8 6.4 0 .8-.2 1.4-.2 1.4-1.4 2-4.1 3-6.8 3C6.9 18.4 3 16 3 13z" fill="currentColor"/><path d="M17.8 8.6c.9-.6 1.7-1.5 1.9-2.7.2 1.3.7 2.2.6 2.5" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="rgba(255,255,255,.85)"/><path d="M5.6 15.4c1.3.8 3.1 1.2 5 1.2" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1"/>',
  box: '<path d="M4 8.5 12 5l8 3.5v7L12 19l-8-3.5z" fill="currentColor"/><path d="M4 8.5 12 12l8-3.5M12 12v7" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.4" fill="currentColor"/><circle cx="9" cy="9" r="1.35" fill="rgba(255,255,255,.88)"/><circle cx="15" cy="9" r="1.35" fill="rgba(255,255,255,.88)"/><circle cx="12" cy="12" r="1.35" fill="rgba(255,255,255,.88)"/><circle cx="9" cy="15" r="1.35" fill="rgba(255,255,255,.88)"/><circle cx="15" cy="15" r="1.35" fill="rgba(255,255,255,.88)"/>',
  crown: '<path d="M4 18.4 3 7.8l4.9 3.2L12 4.8l4.1 6.2L21 7.8l-1 10.6z" fill="currentColor"/><rect x="4" y="18" width="16" height="2.6" rx="1" fill="currentColor"/><circle cx="12" cy="9.4" r="1" fill="rgba(255,255,255,.85)"/><circle cx="6.1" cy="13.8" r=".85" fill="rgba(255,255,255,.7)"/><circle cx="17.9" cy="13.8" r=".85" fill="rgba(255,255,255,.7)"/>',
  flame: '<path d="M12 2.4c2.2 4 5.2 5.6 5.2 9.5a5.2 5.2 0 0 1-10.4 0c0-2 .8-3.4 2-4.5 0 1.9 1 2.9 1.9 2.9.8 0 1.3-.7 1.3-1.6 0-2.1-1-3.2-1-6.5z" fill="currentColor"/><path d="M12 19.4a2.9 2.9 0 0 0 2.9-2.9c0-1.7-1.2-2.6-1.8-3.8-.5 1.3-2.1 1.6-2.1 3.4a2.8 2.8 0 0 0 1 2.4z" fill="rgba(255,255,255,.42)"/>',
  mountain: '<path d="M2.4 19.5 9.4 6.8l3 5 2-3.1 6.7 10.8z" fill="currentColor"/><path d="M9.4 6.8 11 9.6l-1.4 2.2-1.4-2z" fill="rgba(255,255,255,.55)"/>',
  boxes: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="currentColor" opacity=".72"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="currentColor" opacity=".72"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" fill="currentColor"/>',
  atom: '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  medal: '<path d="M9 3 6.5 9M15 3l2.5 6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="15" r="6" fill="currentColor"/><path d="m12 11.6 1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2L9.8 13.9l2.2-.3z" fill="rgba(255,255,255,.88)"/>',
  diamond: '<path d="M5 4.5h14l3 4.5L12 21 2 9z" fill="currentColor"/><path d="M2 9h20M5 4.5 8 9l4 12 4-12 3-4.5M8 9h8" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.1"/>',
  shuffle: '<path d="M16 4h4v4M20 4l-8 8M16 20h4v-4M20 20 13 13M4 4l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" fill="currentColor"/><path d="M8.5 12l2.4 2.4 4.6-4.8" fill="none" stroke="rgba(255,255,255,.88)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  bolt: '<path d="M13.6 2 4.8 13.4h5L8.4 22 19.2 10.2h-5.2z" fill="currentColor"/><path d="M13.6 2 4.8 13.4h5" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1" stroke-linejoin="round"/>',
  star: '<path d="m12 2.8 2.7 5.9 6.5.7-4.8 4.4 1.3 6.4L12 17.6 6 21l1.3-6.4L2.5 9.4l6.5-.7z" fill="currentColor"/>',
};

// Glyph per trophy id (ids are stable across the curation).
const ACH_ICON_FOR = {
  // Volume
  first_million: "coin", tens: "coin", fifty_m: "coin", hundred: "vault",
  spend100: "dollar", spend500: "dollar", spend1k: "dollar", high_roller: "dice",
  archive: "box", quarter_b: "gem", billion: "gem", spend5k: "whale",
  five_billion: "crown", ten_billion: "diamond",
  // Intensity
  streak3: "hook", streak7: "hook", streak14: "flag", nightowl: "moon",
  marathon: "flag", big_day5: "flame", focused2: "clock", deep_work: "anchor",
  ultra_day: "weight", streak30: "flame", streak60: "flame", colossus: "mountain",
  streak100: "infinity", mega_day: "bolt",
  // Mastery
  earlybird: "signal", two_tools: "layers", hopper: "shuffle", polyglot3: "layers",
  models6: "shuffle", polymath: "brain", polyglot5: "boxes", around_clock: "clock",
  cache_master: "wand", models10: "atom", omnivore: "atom", veteran: "medal",
  lifer: "shield",
};

// Ornate, sparkle-detailed figures for the legendary roster only — keyed by
// trophy id. They headline the Legendary hero row on the gold medallion, so they
// carry more facets/highlights than the base glyphs. Falls back to ACH_ICON_FOR.
const ACH_GLYPHS_LEGENDARY = {
  billion: '<path d="M6 3.4h12l3.1 5.3L12 21 2.9 8.7z" fill="currentColor"/><path d="M2.9 8.7h18.2M9 3.4 7 8.7l5 12.3 5-12.3-2-5.3M7 8.7h10" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.1"/><path d="M9.6 5.6 11 7M14.4 5.6 13 7" stroke="rgba(255,255,255,.8)" stroke-width="1" stroke-linecap="round"/>',
  spend5k: '<path d="M3 13c0-3 3-5.4 7-5.4 4.5 0 7.8 3 7.8 6.4 0 .8-.2 1.4-.2 1.4-1.4 2-4.1 3-6.8 3C6.9 18.4 3 16 3 13z" fill="currentColor"/><path d="M17.8 8.6c.9-.6 1.7-1.5 1.9-2.7.2 1.3.7 2.2.6 2.5" fill="currentColor"/><circle cx="8" cy="11.8" r="1.05" fill="rgba(255,255,255,.9)"/><path d="M5.4 15.2c1.4.9 3.2 1.4 5.2 1.4" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1"/>',
  five_billion: '<path d="M3.6 18.4 2.5 7.4l5.2 3.4L12 4.4l4.3 6.4 5.2-3.4-1.1 11z" fill="currentColor"/><rect x="3.6" y="18" width="16.8" height="2.7" rx="1" fill="currentColor"/><circle cx="12" cy="9.1" r="1.15" fill="rgba(255,255,255,.92)"/><circle cx="5.8" cy="13.3" r=".9" fill="rgba(255,255,255,.75)"/><circle cx="18.2" cy="13.3" r=".9" fill="rgba(255,255,255,.75)"/>',
  ten_billion: '<path d="M5 4.3h14l3 4.6L12 21.2 2 8.9z" fill="currentColor"/><path d="M2 8.9h20M5 4.3 8 8.9l4 12.3 4-12.3 3-4.6M8 8.9h8" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.1"/><path d="M10.2 6.6h3.6" stroke="rgba(255,255,255,.7)" stroke-width="1" stroke-linecap="round"/>',
  colossus: '<path d="M2.4 19.6 9.4 6.6l3 5 2-3.1 6.8 11.1z" fill="currentColor"/><path d="M9.4 6.6 11 9.4l-1.4 2.2-1.5-2z" fill="rgba(255,255,255,.6)"/><path d="M14.4 8.5l1.2 2-1.1 1.7z" fill="rgba(255,255,255,.4)"/>',
  streak100: '<path d="M12 12c1.8-2.5 3.5-3.6 5.2-3.6a3.6 3.6 0 0 1 0 7.2c-1.7 0-3.4-1.1-5.2-3.6z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12c-1.8 2.5-3.5 3.6-5.2 3.6a3.6 3.6 0 0 1 0-7.2c1.7 0 3.4 1.1 5.2 3.6z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  mega_day: '<path d="M13.6 2 4.8 13.4h5L8.4 22 19.2 10.2h-5.2z" fill="currentColor"/><path d="M13.6 2 4.8 13.4h5" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1" stroke-linejoin="round"/>',
  omnivore: '<circle cx="12" cy="12" r="2.4" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.7" fill="none" stroke="currentColor" stroke-width="1.9"/><ellipse cx="12" cy="12" rx="9" ry="3.7" transform="rotate(60 12 12)" fill="none" stroke="currentColor" stroke-width="1.9"/><ellipse cx="12" cy="12" rx="9" ry="3.7" transform="rotate(120 12 12)" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="20.5" cy="12" r="1" fill="rgba(255,255,255,.85)"/>',
  veteran: '<path d="M8.8 3 6.2 9M15.2 3l2.6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="15" r="6.2" fill="currentColor"/><path d="m12 11.2 1.08 2.18 2.4.35-1.74 1.7.41 2.4L12 18.78l-2.15 1.13.41-2.4-1.74-1.7 2.4-.35z" fill="rgba(255,255,255,.92)"/>',
  lifer: '<path d="M12 2.8 20.2 6v6.2c0 5.2-3.7 8.3-8.2 9.3-4.5-1-8.2-4.1-8.2-9.3V6z" fill="currentColor"/><path d="M8.4 12.2l2.5 2.5 4.8-5" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
};

// Display categories — one horizontally-scrolling row each, in this order.
// (Legendary trophies are pulled into their own hero row above these.)
const ACH_CATS = [
  { id: "volume", label: "Volume & Spend" },
  { id: "intensity", label: "Intensity & Streaks" },
  { id: "mastery", label: "Breadth & Mastery" },
];

function achIcon(id, tier) {
  const inner = (tier === "legendary" && ACH_GLYPHS_LEGENDARY[id])
    ? ACH_GLYPHS_LEGENDARY[id]
    : (ACH_GLYPHS[ACH_ICON_FOR[id]] || ACH_GLYPHS.star);
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
}

async function loadAchievements() {
  try {
    const list = await getAchievements();
    const unlocked = list.filter(a => a.unlocked).length;

    // Personalized header with a per-tier breakdown of what's earned.
    const name = (window.USER_NAME || "").trim();
    const owner = name ? name + "'s trophies" : "Trophies";
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

    // Within a row: unlocked first (hardest by rank), then locked by how close
    // they are to earning.
    const sorted = list.slice().sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked) return b.rank - a.rank;
      return b.progress - a.progress;
    });

    // Legendary trophies get their own flashy hero row at the very top.
    const legend = sorted.filter(a => a.tier === "legendary");
    if (legend.length) {
      const got = legend.filter(a => a.unlocked).length;
      host.appendChild(achSection("Legendary", got + " / " + legend.length, legend, true));
    }

    // Then one horizontally-scrolling row per category (legendary excluded).
    for (const cat of ACH_CATS) {
      const items = sorted.filter(a => a.category === cat.id && a.tier !== "legendary");
      if (!items.length) continue;
      const got = items.filter(a => a.unlocked).length;
      host.appendChild(achSection(cat.label, got + " / " + items.length, items, false));
    }
  } catch (e) {
    console.error("achievements load error", e);
    g("ach-grid").innerHTML = '<div style="text-align:center;color:var(--mut)">Load error</div>';
  }
}

// Build one labelled row of badges. The legendary hero row wraps (so the
// whole-card gold glow isn't clipped by a scroller); category rows scroll.
function achSection(label, count, items, isLegend) {
  const sec = document.createElement("div");
  sec.className = "ach-cat" + (isLegend ? " ach-legend" : "");
  sec.innerHTML =
    '<div class="ach-cat-head"><span class="ach-cat-label">' + label + "</span>" +
    '<span class="ach-cat-count">' + count + "</span></div>";
  const row = document.createElement("div");
  row.className = "ach-cat-row" + (isLegend ? " ach-legend-row" : "");
  for (const a of items) row.appendChild(buildBadge(a));
  sec.appendChild(row);
  return sec;
}

// Build one badge card (medallion + name + description + date/progress).
function buildBadge(a) {
  const el = document.createElement("div");
  el.className = "ach-badge tier-" + a.tier + (a.unlocked ? " unlocked" : " locked");

  const pct = Math.round(a.progress * 100);
  // Meta line (earned date when unlocked, % when locked) sits ABOVE the bar so
  // the bar is always the last element — pinned to the card bottom and aligned
  // across every card in the row.
  const meta = a.unlocked
    ? (a.earned_date ? '<div class="ach-date">earned ' + a.earned_date + "</div>" : '<div class="ach-date">earned</div>')
    : '<div class="ach-pct">' + pct + "%</div>";
  const bar = a.unlocked
    ? '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:100%"></div></div>'
    : '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:' + pct + '%"></div></div>';

  el.innerHTML =
    '<div class="ach-tier-tag">' + a.tier + "</div>" +
    '<div class="ach-icon">' + achIcon(a.id, a.tier) + "</div>" +
    '<div class="ach-name">' + a.name + "</div>" +
    '<div class="ach-desc">' + a.description + "</div>" +
    '<div class="ach-foot">' + meta + bar + "</div>";
  return el;
}
