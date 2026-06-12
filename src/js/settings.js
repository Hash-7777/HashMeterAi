const ACCENT_PRESETS = [
  { name: "Pumpkin", hex: "#FD802E" },
  { name: "Amber", hex: "#FFB02E" },
  { name: "Teal", hex: "#2EC5A8" },
  { name: "Sky", hex: "#3B82F6" },
  { name: "Violet", hex: "#9B8CFF" },
  { name: "Rose", hex: "#FF5D8F" },
  { name: "Mint", hex: "#3DDC84" },
];

async function loadSettings() {
  try {
    const p = await getProfile();
    window.PREFS = p.prefs || window.PREFS || {};
    const prefs = window.PREFS;

    g("set-name").value = p.name || "";
    g("set-reduced").checked = !!prefs.reduced_motion;
    g("set-compact").checked = !!prefs.compact;
    g("set-sync").value = String(prefs.auto_sync_secs ?? 60);
    g("set-range").value = prefs.default_range || "all";

    // Personalized hero.
    const name = (p.name || "").trim();
    g("set-hello").textContent = name ? "Hi, " + name : "Welcome";
    g("set-avatar").textContent = name ? name.charAt(0).toUpperCase() : "?";
    g("set-since").textContent = p.created_at
      ? "Using HashMeterAi since " + String(p.created_at).slice(0, 10)
      : "";

    renderAccentSwatches(prefs.accent || "#FD802E");
    renderSourceStatus();
    renderDiagnostics();
  } catch (e) {
    console.error("settings load error", e);
  }
}

// Per-source diagnostics: resolved paths (per-user), whether they exist, and
// what was parsed — so "shows 0 for me" is debuggable on any machine. No
// message content is ever shown.
async function renderDiagnostics() {
  const host = g("set-diag");
  if (!host) return;
  host.innerHTML = '<div class="set-hint">Scanning…</div>';
  let diag = [];
  try {
    diag = await getDiagnostics();
  } catch (e) {
    console.error("diagnostics error", e);
    host.innerHTML = '<div class="set-hint">Diagnostics unavailable.</div>';
    return;
  }
  window._DIAG = diag;
  host.innerHTML = "";
  for (const s of diag) {
    const roots = (s.roots || []).map(r =>
      '<div class="diag-root ' + (r.exists ? "ok" : "miss") + '">' +
        '<span class="diag-rdot"></span><span class="diag-rpath">' + r.path + '</span>' +
        '<span class="diag-rstate">' + (r.exists ? "found" : "not found") + '</span></div>'
    ).join("");
    let stat, cls;
    if (!s.detected) { stat = "not detected on this machine"; cls = "off"; }
    else if (s.processed > 0) {
      stat = human(s.processed) + " processed · " + commas(s.messages) + " msgs · " + s.days +
        " days" + (s.latest ? " · latest " + s.latest : "");
      cls = "ok";
    } else { stat = "detected, but 0 parsed — likely a format mismatch"; cls = "warn"; }
    const sample = (s.detected && s.top_model && s.top_model !== "<synthetic>")
      ? '<div class="diag-sample">latest top model: ' + prettyModel(s.top_model) + "</div>" : "";

    const el = document.createElement("div");
    el.className = "diag-src " + cls;
    el.innerHTML =
      '<div class="diag-head"><span class="diag-name">' + s.label + "</span>" +
        '<span class="diag-stat">' + stat + "</span></div>" +
      '<div class="diag-roots">' + roots + "</div>" + sample;
    host.appendChild(el);
  }

  const btn = g("set-diag-copy");
  if (btn) btn.onclick = copyDiagReport;
}

async function copyDiagReport() {
  const diag = window._DIAG || [];
  const lines = ["HashMeterAi diagnostics", new Date().toISOString(), ""];
  for (const s of diag) {
    lines.push(s.label + " (" + s.id + ") — " + (s.detected ? "detected" : "NOT detected"));
    for (const r of (s.roots || [])) lines.push("  " + (r.exists ? "[found]   " : "[missing] ") + r.path);
    if (s.detected) {
      lines.push("  parsed: " + s.processed + " processed tokens, " + s.messages + " msgs, " +
        s.days + " days, latest " + (s.latest || "-") + ", top model " + (s.top_model || "-"));
    }
    lines.push("");
  }
  const text = lines.join("\n");
  const btn = g("set-diag-copy");
  try {
    await navigator.clipboard.writeText(text);
    if (btn) { btn.textContent = "Copied!"; setTimeout(() => btn.textContent = "Copy report", 1600); }
  } catch (e) {
    console.error("copy report failed", e);
    if (btn) { btn.textContent = "Copy failed"; setTimeout(() => btn.textContent = "Copy report", 1600); }
  }
}

function renderAccentSwatches(active) {
  const host = g("set-accent");
  if (!host) return;
  host.innerHTML = "";
  for (const preset of ACCENT_PRESETS) {
    const el = document.createElement("button");
    el.className = "swatch" + (sameHex(preset.hex, active) ? " on" : "");
    el.style.background = preset.hex;
    el.title = preset.name;
    el.onclick = async function () {
      window.PREFS.accent = preset.hex;
      await setPref("accent", preset.hex);
      if (typeof applyTheme === "function") applyTheme(window.PREFS);
      renderAccentSwatches(preset.hex);
    };
    host.appendChild(el);
  }
}

function renderSourceStatus() {
  const host = g("set-sources");
  if (!host) return;
  host.innerHTML = "";
  if (typeof RAW === "undefined" || !RAW || !RAW.tools) {
    host.innerHTML = '<div class="set-src-row muted">Scanning…</div>';
    return;
  }
  for (const s of ALL_SRCS) {
    const tool = RAW.tools[s];
    const present = tool && tool.present;
    const days = present ? tool.days.length : 0;
    const est = ESTIMATED_SRCS.has(s) ? ' <span class="src-est">est</span>' : "";
    const el = document.createElement("div");
    el.className = "set-src-row" + (present ? "" : " muted");
    el.innerHTML =
      '<span class="set-src-dot' + (present ? " on" : "") + '"></span>' +
      '<span class="set-src-name">' + SRC_LABEL[s] + est + "</span>" +
      '<span class="set-src-meta">' + (present ? days + (days === 1 ? " day" : " days") : "not detected") + "</span>";
    host.appendChild(el);
  }
}

g("set-save-name").onclick = async function () {
  const name = g("set-name").value.trim();
  if (name.length < 1 || name.length > 40) return;
  const display = name.charAt(0).toUpperCase() + name.slice(1);
  await setName(display);
  window.USER_NAME = display;
  g("set-name").value = display;
  g("set-hello").textContent = "Hi, " + display;
  g("set-avatar").textContent = display.charAt(0).toUpperCase();
  if (typeof render === "function") render(); // refresh greeting
  g("set-save-name").textContent = "Saved";
  setTimeout(() => g("set-save-name").textContent = "Save", 1500);
};

g("set-reduced").onchange = async function () {
  window.PREFS.reduced_motion = this.checked;
  window.REDUCED_MOTION = this.checked;
  await setPref("reduced_motion", this.checked);
  if (typeof applyTheme === "function") applyTheme(window.PREFS);
};

g("set-compact").onchange = async function () {
  window.PREFS.compact = this.checked;
  await setPref("compact", this.checked);
  if (typeof applyTheme === "function") applyTheme(window.PREFS);
};

g("set-sync").onchange = async function () {
  const v = parseInt(this.value, 10);
  const secs = Number.isFinite(v) ? v : 60;
  window.PREFS.auto_sync_secs = secs;
  await setPref("auto_sync_secs", secs);
  if (typeof startPolling === "function") startPolling();
};

g("set-range").onchange = async function () {
  const r = this.value;
  window.PREFS.default_range = r;
  await setPref("default_range", r);
  if (typeof RANGE !== "undefined") {
    RANGE = r;
    if (typeof syncRangeButtons === "function") syncRangeButtons();
    if (typeof render === "function") render();
  }
};

g("set-open-data").onclick = async function () {
  try {
    await openDataFolder();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    alert("Could not open data folder: " + msg);
  }
};

// Ecosystem links in Settings open the repo in the system browser.
document.addEventListener("click", function (e) {
  const el = e.target.closest("[data-eco-url]");
  if (!el) return;
  e.preventDefault();
  const url = el.getAttribute("data-eco-url");
  if (url) openExternalUrl(url).catch(function () {});
});

g("set-reset").onclick = async function () {
  const ok = confirm("Reset all app data? This clears your name, preferences, and unlocked badges.");
  if (!ok) return;
  await resetProfile();
  window.location.reload();
};

function sameHex(a, b) {
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}
