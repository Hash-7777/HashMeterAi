let RAW = null;
let RANGE = "all";
let SOURCE = "all";
let LASTSYNC = 0;
let SYNC_TXT = "";
let HERO_TOKEN_VIEW = 1; // 0 = Pure Signal, 1 = Real Work, 2 = Full Footprint

const SRC_LABEL = {
  claude: "Claude",
  codex: "Codex",
  kimi: "Kimi",
  hashcortx: "HashCortx",
  hashcerebrum: "HashCerebrum",
  cline: "Cline",
  all: "All tools",
};

const ALL_SRCS = ["claude", "codex", "kimi", "hashcortx", "hashcerebrum", "cline"];

// Sources whose token counts are estimated rather than measured. HashCortx and
// HashCerebrum now record real per-response counts, so nothing is estimated.
const ESTIMATED_SRCS = new Set([]);

// Clean display names for model ids. Never show a raw hyphenated id.
const MODEL_NAMES = {
  "claude-opus-4-8": "Opus 4.8",
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-haiku-4-5": "Haiku 4.5",
  "gpt-5.5": "GPT-5.5",
  "gpt-5": "GPT-5",
  "kimi-code/kimi-for-coding": "Kimi for Coding",
  "gpt-oss-120b": "GPT-OSS 120B",
  "gpt-oss-20b": "GPT-OSS 20B",
  "llama-3.1-8b-instant": "Llama 3.1 8B",
  "llama-3.3-70b-versatile": "Llama 3.3 70B",
  "qwen3-32b": "Qwen3 32B",
  "hashcortx": "HashCortx",
  "<synthetic>": "Synthetic",
};

// Models seen under the HashCortx source — used to tag them "via HashCortx" in
// the Models breakdown (they're real models, just reached through HashCortx).
function hashcortxModels() {
  const set = new Set();
  const t = RAW && RAW.tools && RAW.tools.hashcortx;
  if (t && t.present) {
    for (const d of (t.days || [])) {
      for (const k of Object.keys(d.models || {})) set.add(k);
    }
  }
  return set;
}

function prettyModel(id) {
  if (MODEL_NAMES[id]) return MODEL_NAMES[id];
  // HashCerebrum logs its full model ref "cloud:provider:model" /
  // "local:ollama:model" — show just the model name, cleaned up.
  let m = id.includes(":") ? id.split(":").pop() : id;
  if (MODEL_NAMES[m]) return MODEL_NAMES[m];
  return m.replace(/^claude-/, "").split(/[-_/\s]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Models seen under the HashCerebrum source — tagged "via HashCerebrum" in the
// Models breakdown, the same way HashCortx models are.
function hashcerebrumModels() {
  const set = new Set();
  const t = RAW && RAW.tools && RAW.tools.hashcerebrum;
  if (t && t.present) {
    for (const d of (t.days || [])) {
      for (const k of Object.keys(d.models || {})) set.add(k);
    }
  }
  return set;
}

function sdays(name) {
  if (!RAW || !RAW.tools[name]) return [];
  return RAW.tools[name].days || [];
}

function mergedDays(names) {
  const map = {};
  for (const n of names) {
    for (const d of sdays(n)) {
      const e = map[d.date] || {
        date: d.date,
        messages: 0,
        newIn: 0,
        write: 0,
        read: 0,
        out: 0,
        cost: 0,
        sessions: new Set(),
        hours: new Array(24).fill(0),
        models: {},
        focus_sec: 0,
      };
      e.messages += d.messages || 0;
      e.newIn += d.newIn || 0;
      e.write += d.write || 0;
      e.read += d.read || 0;
      e.out += d.out || 0;
      e.cost += d.cost || 0;
      e.focus_sec += d.focus_sec || 0;
      (d.sessions || []).forEach(s => e.sessions.add(s));
      (d.hours || []).forEach((v, i) => { e.hours[i] += v; });
      for (const [k, v] of Object.entries(d.models || {})) {
        e.models[k] = (e.models[k] || 0) + v;
      }
      map[d.date] = e;
    }
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

function selDays() {
  if (SOURCE === "all") {
    const active = ALL_SRCS.filter(s => RAW.tools[s] && RAW.tools[s].present);
    return mergedDays(active);
  }
  return mergedDays([SOURCE]);
}

function agg(days) {
  const out = {
    messages: 0, newIn: 0, write: 0, read: 0, out: 0,
    cost: 0, sessions: new Set(), hours: new Array(24).fill(0),
    models: {}, focus_sec: 0,
  };
  for (const d of days) {
    out.messages += d.messages;
    out.newIn += d.newIn;
    out.write += d.write;
    out.read += d.read;
    out.out += d.out;
    out.cost += d.cost;
    out.focus_sec += d.focus_sec;
    d.sessions.forEach(s => out.sessions.add(s));
    d.hours.forEach((v, i) => { out.hours[i] += v; });
    for (const [k, v] of Object.entries(d.models)) {
      out.models[k] = (out.models[k] || 0) + v;
    }
  }
  return out;
}

function streaks(days) {
  if (!days.length) return [0, 0];
  const ds = days.map(d => d.date).sort();
  let longest = 1, current = 1;
  for (let i = 1; i < ds.length; i++) {
    const a = new Date(ds[i - 1] + "T00:00:00");
    const b = new Date(ds[i] + "T00:00:00");
    const diff = (b - a) / 864e5;
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const last = ds[ds.length - 1];
  const lastDate = new Date(last + "T00:00:00");
  const todayDate = new Date(today + "T00:00:00");
  const gap = (todayDate - lastDate) / 864e5;
  if (gap > 1) current = 0;
  return [longest, current];
}

function inRange(date, all) {
  if (RANGE === "all") return true;
  const days = parseInt(RANGE, 10);
  const end = all.length ? all[all.length - 1].date : date;
  const cutoff = new Date(end + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - days);
  const d = new Date(date + "T00:00:00");
  return d >= cutoff;
}

function pretty(name) {
  return name.replace(/_/g, " ").replace(/-/g, " ");
}

function animate(el, target, fmt) {
  const start = parseFloat(el.dataset.val) || 0;
  const diff = target - start;
  if (!diff) { el.textContent = fmt(target); el.dataset.val = target; return; }
  const dur = window.REDUCED_MOTION ? 0 : 500;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    const ease = 1 - Math.pow(1 - p, 3);
    const v = start + diff * ease;
    el.textContent = fmt(v);
    if (p < 1) requestAnimationFrame(step);
    else { el.dataset.val = target; }
  }
  requestAnimationFrame(step);
}

function srcCost(name) {
  const arr = sdays(name);
  const f = RANGE === "all" ? arr : arr.filter(r => inRange(r.date, arr));
  return f.reduce((s, r) => s + (r.cost || 0), 0);
}

function srcTokens(name) {
  const arr = sdays(name);
  const f = RANGE === "all" ? arr : arr.filter(r => inRange(r.date, arr));
  return f.reduce((s, r) => s + (r.newIn || 0) + (r.write || 0) + (r.out || 0), 0);
}

// Catchy greetings by time of day. "{n}" is the optional name slot — it expands
// to ", Seif" when a name is set, or to nothing when it isn't, so every line
// reads cleanly either way.
const GREETINGS = {
  latenight: [  // 0–4
    "Still up{n}?", "Burning the midnight oil{n}", "Whoa, it's late{n}",
    "The 2 AM grind hits different", "Who needs sleep{n}?", "Night owl mode{n}",
  ],
  early: [      // 5–8
    "Wow, that's early{n}!", "Rise and grind{n}", "Up with the sun{n}",
    "Good morning{n}", "Early bird mode{n}", "Dawn patrol{n}",
  ],
  morning: [    // 9–11
    "Good morning{n}", "Morning{n}", "Let's build something{n}",
    "Fresh start{n}", "Coffee's brewing{n}?", "Ready to ship{n}?",
  ],
  afternoon: [  // 12–16
    "Good afternoon{n}", "Afternoon{n}", "Cruising along{n}",
    "Back at it{n}", "Deep in it{n}?", "Hey{n}, let's roll",
  ],
  evening: [    // 17–21
    "Good evening{n}", "Evening{n}", "Golden hour{n}",
    "Winding down{n}?", "Still in the zone{n}?", "Evening shift{n}",
  ],
  night: [      // 22–23
    "Good night{n}", "Still shipping{n}?", "One more commit{n}?",
    "Late-night build{n}", "Burning it down{n}", "The night is young{n}",
  ],
};

function greetBucket(h) {
  if (h < 5) return "latenight";
  if (h < 9) return "early";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}

// Cache the picked template per time-bucket so the greeting stays stable across
// the frequent re-syncs (only re-rolls when the time-of-day bucket changes), but
// re-fill the name each time so a name edit shows up immediately.
let GREET_PICK = null;
function greet(name) {
  const bucket = greetBucket(new Date().getHours());
  if (!GREET_PICK || GREET_PICK.bucket !== bucket) {
    const list = GREETINGS[bucket];
    GREET_PICK = { bucket, tpl: list[Math.floor(Math.random() * list.length)] };
  }
  return GREET_PICK.tpl.replace("{n}", name ? ", " + name : "");
}

function updateGreeting(a, days) {
  const name = (window.USER_NAME || "").trim();
  const hi = g("greeting-hi");
  const sub = g("greeting-sub");
  if (!hi) return;
  hi.textContent = greet(name);
  if (!sub) return;
  if (!a || !days || !days.length) {
    sub.textContent = "No usage yet — start coding with any AI tool.";
    return;
  }
  const processed = a.newIn + a.write + a.out;
  const fh = Math.floor(a.focus_sec / 3600);
  const where = SOURCE === "all" ? "across your tools" : "on " + SRC_LABEL[SOURCE];
  sub.textContent =
    "You've processed " + human(processed) + " tokens " + where +
    " over " + days.length + " active " + (days.length === 1 ? "day" : "days") +
    (fh > 0 ? " · " + fh + "h focused" : "") + ".";
}

function render() {
  if (!RAW) return;
  const days = selDays();

  // Empty state
  if (!days.length) {
    updateGreeting(null, []);
    if (g("dash-cal-grid")) g("dash-cal-grid").innerHTML = "";
    if (g("dash-cal-foot")) g("dash-cal-foot").textContent = "";
    g("h-processed").textContent = "0";
    g("h-processed-lab").textContent = "Real Work";
    g("h-processed-sub").textContent = "No usage yet";
    g("h-focus").textContent = "0m";
    g("h-focus-sub").textContent = "Start coding with AI";
    g("h-cost").textContent = "$0.00";
    g("t-sessions").textContent = "0";
    g("t-messages").textContent = "0";
    g("t-days").textContent = "0";
    g("t-cur").textContent = "0d";
    g("t-long").textContent = "0d";
    g("t-peak").textContent = "\u2014";
    g("t-fav").textContent = "\u2014";
    g("foot").innerHTML = "";
    g("cal-grid").innerHTML = "";
    g("mlist").innerHTML = "";
    return;
  }

  const a = agg(days);
  const st = streaks(days);

  updateGreeting(a, days);

  // Hero stats \u2014 token tile cycles through three honest definitions
  const tokenViews = [
    { name: "Pure Signal", val: a.newIn + a.out, desc: "input + output only" },
    { name: "Real Work", val: a.newIn + a.write + a.out, desc: "input + cache-write + output" },
    { name: "Full Footprint", val: a.newIn + a.write + a.read + a.out, desc: "all billed tokens incl. cache-read" },
  ];
  const tv = tokenViews[HERO_TOKEN_VIEW];
  animate(g("h-processed"), tv.val, human);
  g("h-processed-lab").textContent = tv.name;
  const dateRange = days.length ? days[0].date + " \u2192 " + days[days.length - 1].date : "";
  g("h-processed-sub").textContent = tv.desc + (dateRange ? " \u00b7 " + dateRange : "");

  const fh = Math.floor(a.focus_sec / 3600);
  const fm = Math.floor((a.focus_sec % 3600) / 60);
  g("h-focus").textContent = fh > 0 ? fh + "h " + fm + "m" : fm + "m";
  g("h-focus-sub").textContent = a.focus_sec > 0 ? "focused, gaps under 5 min" : "no use time data";

  animate(g("h-cost"), Math.round(a.cost * 100), function (v) { return "$" + (v / 100).toFixed(2); });
  g("h-cost-sub").textContent = (SOURCE === "hashcortx" || SOURCE === "hashcerebrum") ? "free-tier \u00b7 not billed" : "all time \u00b7 public list rates";

  g("s-cur").textContent = st[1] > 0 ? "keep it going" : "start a new one";
  animate(g("t-sessions"), a.sessions.size, commas);
  animate(g("t-messages"), a.messages, commas);
  g("s-messages").textContent = SOURCE === "claude" ? "user + assistant" : "model turns";

  animate(g("t-days"), days.length, commas);
  g("s-days").textContent = days.length ? days[0].date + " \u2192 " + days[days.length - 1].date : "";

  g("t-cur").textContent = st[1] + "d";
  g("t-long").textContent = st[0] + "d";

  let ph = 0;
  for (let h = 0; h < 24; h++) if (a.hours[h] > a.hours[ph]) ph = h;

  g("t-peak").textContent = hourLabel(ph);
  g("s-peak").textContent = commas(a.hours[ph]) + " msgs";

  const fav = Object.entries(a.models).filter(([m]) => m && m !== "<synthetic>").sort((x, y) => y[1] - x[1])[0];
  g("t-fav").textContent = fav ? prettyModel(fav[0]) : "\u2014";
  g("s-fav").textContent = fav ? human(fav[1]) + " tok" : "";

  renderCalendar();
  renderMiniCalendar();
  models(a);
}

function models(a) {
  // Hide the synthetic placeholder model from the breakdown.
  const arr = Object.entries(a.models).filter(([m]) => m && m !== "<synthetic>").sort((x, y) => y[1] - x[1]);
  const max = arr.length ? arr[0][1] : 1;
  const tot = arr.reduce((s, p) => s + p[1], 0) || 1;
  const host = g("mlist");
  host.innerHTML = "";
  if (!arr.length) {
    host.innerHTML = '<div class="srcmeta">no model data in range</div>';
    return;
  }
  // Distinct color per model so the bars actually distinguish them (not one
  // flat pumpkin fill); a leading dot echoes the bar color next to the name.
  // Models reached through HashCortx get a "via HashCortx" tag.
  const COLORS = ["#FD802E", "#6fb4ff", "#b79bff", "#54ffc4", "#ffcf6b", "#ff7a9c", "#7dd87d", "#f0997b", "#9fb3bd"];
  const hc = hashcortxModels();
  const hcer = hashcerebrumModels();
  arr.forEach((p, i) => {
    const m = p[0], t = p[1];
    const color = COLORS[i % COLORS.length];
    const via = (hc.has(m) && m !== "hashcortx") ? '<span class="mvia">via HashCortx</span>'
              : (hcer.has(m) && m !== "hashcerebrum") ? '<span class="mvia">via HashCerebrum</span>'
              : "";
    const row = document.createElement("div");
    row.className = "mrow";
    row.innerHTML =
      '<div class="mname"><span class="mdot" style="background:' + color + '"></span>' +
        '<span class="mname-txt">' + prettyModel(m) + '</span>' + via + '</div>' +
      '<div class="mbar"><div class="mfill" style="width:' + (100 * t / max) + '%;background:' + color + '"></div></div>' +
      '<div class="mval">' + human(t) + ' \u00b7 ' + (100 * t / tot).toFixed(1) + '%</div>';
    host.appendChild(row);
  });
}

function g(id) {
  return document.getElementById(id);
}

function syncSrcButtons() {
  const bs = g("src").children;
  for (const b of bs) b.classList.toggle("on", b.dataset.s === SOURCE);
}

async function load() {
  try {
    RAW = await scanUsage();
    LASTSYNC = Date.now();
    render();
    // Keep the Settings "detected sources" list current if it's open.
    if (typeof CURRENT_VIEW !== "undefined" && CURRENT_VIEW === "settings" &&
        typeof renderSourceStatus === "function") {
      renderSourceStatus();
    }
    SYNC_TXT = "\u25cf live \u00b7 synced just now";
    g("sync").textContent = SYNC_TXT;
  } catch (e) {
    g("sync").textContent = "scan error";
    console.error(e);
  }
}

// Tick once a second, but the displayed unit scales (s -> m -> h -> d) and we
// only touch the DOM when the rendered string actually changes \u2014 so once we're
// past a minute the label updates rarely, not every second.
setInterval(function () {
  if (!LASTSYNC) return;
  const txt = "\u25cf live \u00b7 synced " + timeAgo(Date.now() - LASTSYNC);
  if (txt !== SYNC_TXT) {
    SYNC_TXT = txt;
    g("sync").textContent = txt;
  }
}, 1000);

g("h-processed-tile").onclick = function () {
  HERO_TOKEN_VIEW = (HERO_TOKEN_VIEW + 1) % 3;
  if (typeof render === "function") render();
};
