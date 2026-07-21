// Escape a string for safe insertion into innerHTML. Used for any value that
// originates from scanned local files (model ids, resolved paths) so a crafted
// transcript can't inject markup. Defense in depth alongside the CSP.
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// The scanner tags every usage day with the LOCAL calendar date, so any
// "what day is it" logic must derive the local date too. Never use
// toISOString().slice(0, 10) for this — that is the UTC date, which points
// at the wrong day for part of every day in any non-UTC timezone.
function localDateStr(d) {
  d = d || new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function human(n) {
  n = Math.round(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return "" + n;
}

function money(n) {
  return n >= 100 ? "$" + Math.round(n).toLocaleString() : "$" + n.toFixed(2);
}

function commas(n) {
  return Math.round(n).toLocaleString();
}

function duration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

function hourLabel(h) {
  return ((h % 12) || 12) + " " + (h < 12 ? "AM" : "PM");
}

// Relative "time ago" that rolls its unit up as it grows: seconds, then minutes,
// then hours, then days — so the sync indicator reads "8s ago", "3m ago",
// "2h ago", "5d ago" instead of an ever-climbing seconds count.
function timeAgo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

// --- Color helpers (accent theming) ---
function hexToRgb(hex) {
  let h = (hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgba(hex, a) {
  const [r, gr, b] = hexToRgb(hex);
  return "rgba(" + r + "," + gr + "," + b + "," + a + ")";
}

// amt in [-1, 1]: positive lightens toward white, negative darkens toward black.
function lighten(hex, amt) {
  let [r, gr, b] = hexToRgb(hex);
  const target = amt < 0 ? 0 : 255;
  const t = Math.abs(amt);
  r = Math.round(r + (target - r) * t);
  gr = Math.round(gr + (target - gr) * t);
  b = Math.round(b + (target - b) * t);
  return "#" + [r, gr, b].map(x => x.toString(16).padStart(2, "0")).join("");
}
