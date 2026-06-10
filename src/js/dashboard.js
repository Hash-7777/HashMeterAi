const NAMES = {
  "claude-opus-4-8": "Opus 4.8",
  "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "<synthetic>": "Synthetic",
  "gpt-5.5": "GPT-5.5",
  "gpt-5": "GPT-5",
  "kimi-code/kimi-for-coding": "Kimi for Coding",
};

const SRC_LABEL = {
  all: "All tools",
  claude: "Claude Code",
  codex: "Codex",
  kimi: "Kimi",
  continue: "Continue",
  cline: "Cline",
};

const ALL_SRCS = ["claude", "codex", "kimi", "continue", "cline"];
const LOTR = 580000;

let RAW = null;
let SOURCE = "all";
let RANGE = "all";
let TAB = "overview";
let TOKMODE = "processed";
let LASTSYNC = 0;

function pretty(id) {
  return NAMES[id] || id.replace(/^claude-/, "").replace(/[\/_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function tokmeta() {
  if (TOKMODE === "real") return ["Real tokens", "real \u00b7 in + out"];
  if (TOKMODE === "processed") return ["Tokens processed", "new \u00b7 no re-reads"];
  return ["Total tokens", "billed \u00b7 incl. cache reads"];
}

function tokval(a) {
  if (TOKMODE === "real") return a.newIn + a.out;
  if (TOKMODE === "processed") return a.newIn + a.write + a.out;
  return a.newIn + a.write + a.read + a.out;
}

function sdays(name) {
  const tool = RAW.tools[name];
  return (tool && tool.days) || [];
}

function inRange(date, arr) {
  if (RANGE === "all") return true;
  const n = +RANGE;
  const last = new Date(arr[arr.length - 1].date + "T00:00:00");
  const cut = new Date(last);
  cut.setDate(cut.getDate() - (n - 1));
  return new Date(date + "T00:00:00") >= cut;
}

function mergedDays(names) {
  const map = {};
  for (const n of names) {
    for (const r of sdays(n)) {
      const m = map[r.date] || {
        date: r.date,
        messages: 0,
        newIn: 0,
        write: 0,
        read: 0,
        out: 0,
        cost: 0,
        sessions: new Set(),
        hours: Array(24).fill(0),
        models: {},
      };
      m.messages += r.messages;
      m.newIn += r.newIn;
      m.write += r.write;
      m.read += r.read;
      m.out += r.out;
      m.cost += r.cost || 0;
      m.focus_sec = (m.focus_sec || 0) + (r.focus_sec || 0);
      r.sessions.forEach(s => m.sessions.add(n + ":" + s));
      for (let h = 0; h < 24; h++) m.hours[h] += r.hours[h];
      for (const [k, v] of Object.entries(r.models)) m.models[k] = (m.models[k] || 0) + v;
      map[r.date] = m;
    }
  }
  return Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function selDays() {
  const active = ALL_SRCS.filter(s => RAW.tools[s] && RAW.tools[s].present);
  const names = SOURCE === "all" ? active : [SOURCE];
  const all = mergedDays(names);
  if (RANGE === "all") return all;
  return all.filter(r => inRange(r.date, all));
}

function agg(days) {
  const a = {
    messages: 0,
    newIn: 0,
    write: 0,
    read: 0,
    out: 0,
    cost: 0,
    focus_sec: 0,
    sessions: new Set(),
    hours: Array(24).fill(0),
    models: {},
  };
  for (const r of days) {
    a.messages += r.messages;
    a.newIn += r.newIn;
    a.write += r.write;
    a.read += r.read;
    a.out += r.out;
    a.cost += r.cost || 0;
    a.focus_sec += r.focus_sec || 0;
    r.sessions.forEach(s => a.sessions.add(s));
    for (let h = 0; h < 24; h++) a.hours[h] += r.hours[h];
    for (const [k, v] of Object.entries(r.models)) a.models[k] = (a.models[k] || 0) + v;
  }
  return a;
}

function streaks(days) {
  const ds = days.map(r => r.date).sort();
  if (!ds.length) return [0, 0];
  let lng = 1, cur = 1;
  for (let i = 1; i < ds.length; i++) {
    const gg = (new Date(ds[i]) - new Date(ds[i - 1])) / 864e5;
    cur = gg === 1 ? cur + 1 : 1;
    lng = Math.max(lng, cur);
  }
  let cs = 1, i = ds.length - 1;
  while (i > 0 && (new Date(ds[i]) - new Date(ds[i - 1])) / 864e5 === 1) {
    cs++;
    i--;
  }
  return [lng, cs];
}

function animate(el, to, fmt) {
  const from = +(el.dataset.v || 0);
  if (from === to) {
    el.textContent = fmt(to);
    return;
  }
  if (window.REDUCED_MOTION) {
    el.textContent = fmt(to);
    el.dataset.v = to;
    return;
  }
  const t0 = performance.now();
  requestAnimationFrame(function step(t) {
    const k = Math.min(1, (t - t0) / 650);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
    else {
      el.textContent = fmt(to);
      el.dataset.v = to;
    }
  });
}

function srcCost(name) {
  const arr = sdays(name);
  const f = RANGE === "all" ? arr : arr.filter(r => inRange(r.date, arr));
  return f.reduce((s, r) => s + (r.cost || 0), 0);
}

function render() {
  if (!RAW) return;
  const days = selDays();

  // Empty state
  if (!days.length) {
    g("h-processed").textContent = "0";
    g("h-processed-sub").textContent = "No usage yet";
    g("h-focus").textContent = "0m";
    g("h-focus-sub").textContent = "Start coding with AI";
    g("h-cost").textContent = "$0.00";
    g("t-sessions").textContent = "0";
    g("t-messages").textContent = "0";
    g("t-tokens").textContent = "0";
    g("t-days").textContent = "0";
    g("t-cur").textContent = "0d";
    g("t-long").textContent = "0d";
    g("t-peak").textContent = "\u2014";
    g("t-fav").textContent = "\u2014";
    g("foot").innerHTML = '<span style="color:var(--mut)">No usage yet \u2014 start coding with any AI tool and check back.</span>';
    g("srcrow").innerHTML = "";
    g("heat").innerHTML = "";
    g("mlist").innerHTML = "";
    return;
  }

  const a = agg(days);
  const st = streaks(days);

  // Hero stats
  const processed = a.newIn + a.write + a.out;
  animate(g("h-processed"), processed, human);
  g("h-processed-sub").textContent = days.length ? days[0].date + " \u2192 " + days[days.length - 1].date : "";

  const fh = Math.floor(a.focus_sec / 3600);
  const fm = Math.floor((a.focus_sec % 3600) / 60);
  g("h-focus").textContent = fh > 0 ? fh + "h " + fm + "m" : fm + "m";
  g("h-focus-sub").textContent = a.focus_sec > 0 ? "focused work time" : "no focus data";

  animate(g("h-cost"), Math.round(a.cost * 100), function (v) { return "$" + (v / 100).toFixed(2); });

  animate(g("t-sessions"), a.sessions.size, commas);
  animate(g("t-messages"), a.messages, commas);
  g("s-messages").textContent = SOURCE === "claude" ? "user + assistant" : "model turns";

  const tv = tokval(a);
  const tm = tokmeta();
  g("l-tokens").textContent = tm[0];
  g("s-tokens").textContent = tm[1];
  animate(g("t-tokens"), tv, human);

  animate(g("t-days"), days.length, commas);
  g("s-days").textContent = days.length ? days[0].date + " \u2192 " + days[days.length - 1].date : "";

  g("t-cur").textContent = st[1] + "d";
  g("t-long").textContent = st[0] + "d";

  let ph = 0;
  for (let h = 0; h < 24; h++) if (a.hours[h] > a.hours[ph]) ph = h;
  g("t-peak").textContent = hourLabel(ph);
  g("s-peak").textContent = commas(a.hours[ph]) + " msgs";

  const fav = Object.entries(a.models).sort((x, y) => y[1] - x[1])[0];
  g("t-fav").textContent = fav ? pretty(fav[0]) : "\u2014";
  g("s-fav").textContent = fav ? human(fav[1]) + " tok" : "";

  const ratio = tv / LOTR;
  const lotrText = ratio >= 100 ? commas(Math.round(ratio)) : ratio.toFixed(1);

  const srcCosts = ALL_SRCS.map(s => [s, srcCost(s)]).filter(([, c]) => c > 0);
  const costParts = srcCosts.map(([s, c]) => SRC_LABEL[s] + " " + money(c)).join(" \u00b7 ");

  g("foot").innerHTML =
    "<b>" + SRC_LABEL[SOURCE] + "</b> \u00b7 \u2248<span class='pk'><b>" + lotrText +
    "\u00d7</b></span> the tokens in <b>The Lord of the Rings</b> across <b>" +
    a.sessions.size + "</b> sessions / <b>" + days.length + "</b> days.<br>" +
    "Est. API cost at public list rates: <b class='pk'>" + money(a.cost) + "</b>" +
    (costParts ? " \u2014 " + costParts : "") +
    ". Tap the tokens tile to switch real / processed / billed.";

  srcRow();
  heatmap(days);
  models(a);
}

function srcTotal(name) {
  const arr = sdays(name);
  const f = RANGE === "all" ? arr : arr.filter(r => inRange(r.date, arr));
  return tokval(agg(f));
}

function srcRow() {
  const host = g("srcrow");
  host.innerHTML = "";

  for (const s of ALL_SRCS) {
    const tool = RAW.tools[s];
    const present = tool && tool.present;
    const v = present ? srcTotal(s) : 0;
    const sess = new Set();
    const arr = sdays(s);
    arr.forEach(r => r.sessions.forEach(x => sess.add(x)));

    const el = document.createElement("div");
    el.className = "srcchip" + (SOURCE === s ? " on" : "") + (present ? "" : " muted");

    if (present) {
      const max = Math.max(1, ...ALL_SRCS.filter(x => RAW.tools[x] && RAW.tools[x].present).map(x => srcTotal(x)));
      el.innerHTML =
        '<div class="srcname">' + SRC_LABEL[s] + '</div>' +
        '<div class="srcval">' + human(v) + '</div>' +
        '<div class="srcmeta">' + sess.size + ' sessions \u00b7 ' + arr.length + ' days \u00b7 \u2248' + money(srcCost(s)) + '</div>' +
        '<div class="srcbar"><div class="srcfill" style="width:' + (100 * v / max) + '%"></div></div>';
      el.onclick = function () {
        SOURCE = SOURCE === s ? "all" : s;
        syncSrcButtons();
        render();
      };
    } else {
      el.innerHTML =
        '<div class="srcname">' + SRC_LABEL[s] + '</div>' +
        '<div class="srcval" style="color:var(--mut)">not detected</div>' +
        '<div class="srcmeta">\u2014</div>' +
        '<div class="srcbar"><div class="srcfill" style="width:0%"></div></div>';
      el.style.opacity = "0.5";
      el.style.cursor = "default";
    }
    host.appendChild(el);
  }
}

function shade(v) {
  if (!v) return "rgba(255,255,255,.05)";
  if (v < 150000) return "#5c3a22";
  if (v < 350000) return "#b15d23";
  if (v < 550000) return "#fd802e";
  return "#ffb27a";
}

function heatmap(days) {
  const map = {};
  days.forEach(r => { map[r.date] = r.newIn + r.write + r.out; });
  const keys = Object.keys(map).sort();
  const host = g("heat");
  host.innerHTML = "";
  if (!keys.length) {
    g("heat-range").textContent = "no activity";
    return;
  }
  g("heat-range").textContent = keys[0] + "  \u2192  " + keys[keys.length - 1];
  const first = new Date(keys[0] + "T00:00:00");
  const last = new Date(keys[keys.length - 1] + "T00:00:00");
  const gd = new Date(first);
  gd.setDate(gd.getDate() - first.getDay());
  const tip = g("tip");
  while (gd <= last) {
    const col = document.createElement("div");
    col.className = "col";
    for (let r = 0; r < 7; r++) {
      const k = gd.toISOString().slice(0, 10);
      const inR = gd >= first && gd <= last;
      const v = inR ? (map[k] || 0) : null;
      const c = document.createElement("div");
      c.className = "cell";
      if (v === null) {
        c.style.background = "transparent";
      } else {
        c.style.background = shade(v);
        if (v >= 550000) c.style.boxShadow = "0 0 8px rgba(253,128,46,.7)";
        const lbl = k + " \u00b7 " + commas(v) + " tok";
        c.onmousemove = function (e) {
          tip.textContent = lbl;
          tip.style.opacity = 1;
          tip.style.left = (e.clientX + 12) + "px";
          tip.style.top = (e.clientY + 12) + "px";
        };
        c.onmouseleave = function () {
          tip.style.opacity = 0;
        };
      }
      col.appendChild(c);
      gd.setDate(gd.getDate() + 1);
    }
    host.appendChild(col);
  }
}

function models(a) {
  const arr = Object.entries(a.models).sort((x, y) => y[1] - x[1]);
  const max = arr.length ? arr[0][1] : 1;
  const tot = arr.reduce((s, p) => s + p[1], 0) || 1;
  const host = g("mlist");
  host.innerHTML = "";
  if (!arr.length) {
    host.innerHTML = '<div class="srcmeta">no model data in range</div>';
    return;
  }
  for (const p of arr) {
    const m = p[0], t = p[1];
    const row = document.createElement("div");
    row.className = "mrow";
    row.innerHTML =
      '<div class="mname">' + pretty(m) + '</div>' +
      '<div class="mbar"><div class="mfill" style="width:' + (100 * t / max) + '%"></div></div>' +
      '<div class="mval">' + human(t) + ' \u00b7 ' + (100 * t / tot).toFixed(1) + '%</div>';
    host.appendChild(row);
  }
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
    g("sync").textContent = "\u25cf live \u00b7 synced just now";
  } catch (e) {
    g("sync").textContent = "scan error";
    console.error(e);
  }
}

setInterval(function () {
  const s = Math.max(0, Math.round((Date.now() - LASTSYNC) / 1000));
  g("sync").textContent = "\u25cf live \u00b7 synced " + s + "s ago";
}, 1000);

g("tile-tokens").onclick = function () {
  TOKMODE = TOKMODE === "billed" ? "real" : TOKMODE === "real" ? "processed" : "billed";
  render();
};
