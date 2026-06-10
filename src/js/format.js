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
