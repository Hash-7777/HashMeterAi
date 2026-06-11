let CAL_YEAR = new Date().getFullYear();
let CAL_MONTH = new Date().getMonth();

const CAL_COLORS = [
  "rgba(255,255,255,.06)",
  "#5c3a22",
  "#b15d23",
  "#fd802e",
  "#ffb27a",
];

function calIntensity(val, max) {
  if (val === 0 || max === 0) return 0;
  const r = val / max;
  if (r > 0.6) return 4;
  if (r > 0.35) return 3;
  if (r > 0.15) return 2;
  return 1;
}

function getDayMap(days) {
  const m = {};
  for (const d of days) {
    m[d.date] = d;
  }
  return m;
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function firstWeekday(y, m) {
  return new Date(y, m, 1).getDay();
}

function monthName(m) {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][m];
}

function ymd(y, m, d) {
  return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

// Compact heatmap of the CURRENT month, embedded in the dashboard.
function renderMiniCalendar() {
  if (!RAW) return;
  const grid = g("dash-cal-grid");
  if (!grid) return;

  const active = ALL_SRCS.filter(s => RAW.tools[s] && RAW.tools[s].present);
  const names = SOURCE === "all" ? active : [SOURCE];
  const dayMap = getDayMap(mergedDays(names));

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = daysInMonth(y, m);
  const fws = firstWeekday(y, m);

  let maxTok = 0, activeDays = 0, monthTok = 0;
  for (let d = 1; d <= dim; d++) {
    const rec = dayMap[ymd(y, m, d)];
    if (!rec) continue;
    const t = rec.newIn + rec.write + rec.out;
    if (t > maxTok) maxTok = t;
    if (t > 0) { activeDays++; monthTok += t; }
  }

  const title = g("dash-cal-title");
  if (title) title.textContent = monthName(m) + " " + y;

  grid.innerHTML = "";
  for (const d of ["S", "M", "T", "W", "T", "F", "S"]) {
    const el = document.createElement("div");
    el.className = "mini-cell mini-dow";
    el.textContent = d;
    grid.appendChild(el);
  }
  for (let i = 0; i < fws; i++) {
    const el = document.createElement("div");
    el.className = "mini-cell mini-empty";
    grid.appendChild(el);
  }
  const todayStr = ymd(y, m, now.getDate());
  for (let d = 1; d <= dim; d++) {
    const ds = ymd(y, m, d);
    const rec = dayMap[ds];
    const tok = rec ? rec.newIn + rec.write + rec.out : 0;
    const lvl = calIntensity(tok, maxTok);
    const el = document.createElement("div");
    el.className = "mini-cell" + (ds === todayStr ? " mini-today" : "");
    el.style.background = CAL_COLORS[lvl];
    if (lvl === 4) el.style.boxShadow = "0 0 6px var(--pk)";
    if (rec) el.title = ds + " · " + human(tok) + " tok";
    grid.appendChild(el);
  }

  const foot = g("dash-cal-foot");
  if (foot) {
    foot.textContent = activeDays + " active " + (activeDays === 1 ? "day" : "days") +
      " · " + human(monthTok) + " tok this month";
  }
}

function renderCalendar() {
  if (!RAW) return;
  const active = ALL_SRCS.filter(s => RAW.tools[s] && RAW.tools[s].present);
  const names = SOURCE === "all" ? active : [SOURCE];
  const days = mergedDays(names);

  const dayMap = getDayMap(days);
  let maxTok = 0;
  for (const d of days) {
    const t = d.newIn + d.write + d.out;
    if (t > maxTok) maxTok = t;
  }

  const y = CAL_YEAR;
  const m = CAL_MONTH;
  const dim = daysInMonth(y, m);
  const fws = firstWeekday(y, m);

  const monthEl = g("cal-month");
  if (monthEl) monthEl.textContent = monthName(m) + " " + y;

  const grid = g("cal-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const d of dow) {
    const el = document.createElement("div");
    el.className = "cal-cell empty";
    el.innerHTML = '<span class="cal-dow">' + d + "</span>";
    grid.appendChild(el);
  }

  for (let i = 0; i < fws; i++) {
    const el = document.createElement("div");
    el.className = "cal-cell empty";
    grid.appendChild(el);
  }

  for (let d = 1; d <= dim; d++) {
    const ds = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const rec = dayMap[ds];
    const tok = rec ? rec.newIn + rec.write + rec.out : 0;
    const lvl = calIntensity(tok, maxTok);
    const el = document.createElement("div");
    el.className = "cal-cell";
    el.style.background = CAL_COLORS[lvl];
    if (lvl === 4) el.style.boxShadow = "0 0 8px var(--pk)";
    el.innerHTML = "<div>" + d + "</div>" + (tok > 0 ? '<div class="cal-val">' + human(tok) + "</div>" : "");
    if (rec) {
      el.title = ds + " \u00b7 " + human(tok) + " tok \u00b7 " + duration(rec.focus_sec || 0) + " use time";
    }
    grid.appendChild(el);
  }
}
