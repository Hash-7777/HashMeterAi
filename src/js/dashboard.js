let RAW = null;
let RANGE = "all";
let SOURCE = "all";
let LASTSYNC = 0;

const SRC_LABEL = {
  claude: "Claude",
  codex: "Codex",
  kimi: "Kimi",
  hashcortx: "HashCortX",
  cline: "Cline",
  all: "All tools",
};

const ALL_SRCS = ["claude", "codex", "kimi", "hashcortx", "cline"];

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
    g("t-days").textContent = "0";
    g("t-cur").textContent = "0d";
    g("t-long").textContent = "0d";
    g("t-peak").textContent = "\u2014";
    g("t-fav").textContent = "\u2014";
    g("foot").innerHTML = '<span style="color:var(--mut)">No usage yet \u2014 start coding with any AI tool and check back.</span>';
    g("srcrow").innerHTML = "";
    g("cal-grid").innerHTML = "";
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
  g("h-focus-sub").textContent = a.focus_sec > 0 ? "Total AI use time" : "no use time data";

  animate(g("h-cost"), Math.round(a.cost * 100), function (v) { return "$" + (v / 100).toFixed(2); });

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

  const fav = Object.entries(a.models).sort((x, y) => y[1] - x[1])[0];
  g("t-fav").textContent = fav ? pretty(fav[0]) : "\u2014";
  g("s-fav").textContent = fav ? human(fav[1]) + " tok" : "";

  const ratio = processed / LOTR;
  const lotrText = ratio >= 100 ? commas(Math.round(ratio)) : ratio.toFixed(1);

  const srcCosts = ALL_SRCS.map(s => [s, srcCost(s)]).filter(([, c]) => c > 0);
  const costParts = srcCosts.map(([s, c]) => SRC_LABEL[s] + " " + money(c)).join(" \u00b7 ");

  g("foot").innerHTML =
    "<b>" + SRC_LABEL[SOURCE] + "</b> \u00b7 \u2248<span class='pk'><b>" + lotrText +
    "\u00d7</b></span> the tokens in <b>The Lord of the Rings</b> across <b>" +
    a.sessions.size + "</b> sessions / <b>" + days.length + "</b> days.<br>" +
    "Est. API cost at public list rates: <b class='pk'>" + money(a.cost) + "</b>" +
    (costParts ? " \u2014 " + costParts : "") + ".";

  srcRow();
  renderCalendar();
  models(a);
}

function srcRow() {
  const host = g("srcrow");
  host.innerHTML = "";

  for (const s of ALL_SRCS) {
    const tool = RAW.tools[s];
    const present = tool && tool.present;
    const v = present ? srcTokens(s) : 0;
    const sess = new Set();
    const arr = sdays(s);
    arr.forEach(r => r.sessions.forEach(x => sess.add(x)));

    const el = document.createElement("div");
    el.className = "srcchip" + (SOURCE === s ? " on" : "") + (present ? "" : " muted");

    if (present) {
      const max = Math.max(1, ...ALL_SRCS.filter(x => RAW.tools[x] && RAW.tools[x].present).map(x => srcTokens(x)));
      const costStr = srcCost(s) > 0 ? " \u00b7 \u2248" + money(srcCost(s)) : "";
      el.innerHTML =
        '<div class="srcname">' + SRC_LABEL[s] + '</div>' +
        '<div class="srcval">' + human(v) + '</div>' +
        '<div class="srcmeta">' + sess.size + ' sessions \u00b7 ' + arr.length + ' days' + costStr + '</div>' +
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
