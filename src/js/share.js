const SANS = "-apple-system, BlinkMacSystemFont, sans-serif";

let SHARE_THEME = 0;

// Card themes the user can pick before exporting. The first ("Default") tracks
// the app's accent preference; the rest are fixed alternative palettes. All are
// dark so the card's light text stays legible.
function shareThemes() {
  const accent = (window.PREFS && window.PREFS.accent) || "#FD802E";
  return [
    { id: "default", name: "Default", accent: accent, bg: ["#06101a", "#1a130b", "#05090d"] },
    { id: "midnight", name: "Midnight", accent: "#6fb4ff", bg: ["#060a14", "#0b1830", "#05080f"] },
    { id: "aurora", name: "Aurora", accent: "#2ec5a8", bg: ["#05110f", "#0a2620", "#05100d"] },
    { id: "violet", name: "Violet", accent: "#9b8cff", bg: ["#0a0816", "#160f2e", "#070611"] },
    { id: "gold", name: "Gold", accent: "#ffce5e", bg: ["#0f0a04", "#241804", "#0c0802"] },
    { id: "mono", name: "Mono", accent: "#cfd8e0", bg: ["#0a0d11", "#161b21", "#06080b"] },
  ];
}

function renderShareThemes() {
  const host = g("share-themes");
  if (!host) return;
  host.innerHTML = shareThemes().map((t, i) =>
    '<button class="share-theme-btn' + (i === SHARE_THEME ? " on" : "") + '" data-theme="' + i + '">' +
      '<span class="share-theme-sw"></span>' + t.name +
    "</button>"
  ).join("");
  // CSSOM color (inline style="" attributes are stripped by the nonce'd CSP).
  const sws = host.querySelectorAll(".share-theme-sw");
  shareThemes().forEach((t, i) => { if (sws[i]) sws[i].style.background = t.accent; });
}

// Wrap text to a max width on the canvas, capped at maxLines (last line
// ellipsized if it still overflows). Used for trophy descriptions on the card.
function wrapShareText(ctx, text, maxWidth, font, maxLines) {
  ctx.font = font;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxWidth) {
      last = last.replace(/\s*\S$/, "");
    }
    kept[maxLines - 1] = last + "…";
    return kept;
  }
  return lines;
}

// Build a trophy's real SVG emblem as an <img> so the share canvas can draw the
// actual figure (dark engraving) on the medallion instead of a generic star.
// Reuses the same glyph sets as the Trophies tab. Returns null on failure.
async function loadTrophyFigure(id, tier) {
  try {
    const inner = (tier === "legendary" && typeof ACH_GLYPHS_LEGENDARY !== "undefined" && ACH_GLYPHS_LEGENDARY[id])
      ? ACH_GLYPHS_LEGENDARY[id]
      : (ACH_GLYPHS[ACH_ICON_FOR[id]] || ACH_GLYPHS.star);
    const color = tier === "legendary" ? "#3a2606" : "#10202a";
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" ' +
      'fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      inner + "</svg>";
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    return img;
  } catch (_e) {
    return null;
  }
}

async function renderShareCard() {
  const canvas = g("share-canvas");
  const ctx = canvas.getContext("2d");
  const W = 1200;
  const H = 630;
  const CX = W / 2;
  const dpr = window.devicePixelRatio || 1;

  // Render at device-pixel ratio for crisp PNGs on retina displays.
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.maxWidth = "100%";
  canvas.style.height = "auto";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textBaseline = "alphabetic";

  // Active card theme (chosen via the theme buttons). Drives the accent and the
  // background gradient; the preview's glow is tinted to match.
  renderShareThemes();
  const theme = shareThemes()[SHARE_THEME] || shareThemes()[0];
  const ACCENT = theme.accent;
  const preview = g("share-preview");
  if (preview) preview.style.setProperty("--share-glow", hexToRgba(ACCENT, 0.5));

  // Background — clean vertical gradient from the active theme. No grid.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.bg[0]);
  grad.addColorStop(0.5, theme.bg[1]);
  grad.addColorStop(1, theme.bg[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Fetch data
  let persona = null;
  let achievements = [];
  let snap = null;
  try {
    persona = await getPersona();
    achievements = await getAchievements();
    snap = await scanUsage();
  } catch (e) {
    console.error("share data error", e);
  }

  // Brand mark for the header — best-effort; the card still renders without it.
  let logoImg = null;
  try {
    const img = new Image();
    img.src = "assets/share-logo.png";
    await img.decode();
    logoImg = img;
  } catch (_e) {
    logoImg = null;
  }

  const ptitle = persona ? persona.title : "AI Explorer";
  const psub = persona ? (persona.subtitle || "") : "";
  const standing = persona ? persona.standing : null;
  const uname = (window.USER_NAME || "").trim();

  // Compute stats
  let processed = 0, cost = 0, tools = 0, streak = 0;
  const allDays = {};
  const toolTokens = {};
  if (snap && snap.tools) {
    for (const [sid, tool] of Object.entries(snap.tools)) {
      if (!tool.present) continue;
      tools++;
      let toolTok = 0;
      for (const d of tool.days) {
        const tok = d.newIn + d.write + d.out;
        processed += tok;
        cost += d.cost || 0;
        toolTok += tok;
        if (!allDays[d.date]) allDays[d.date] = 0;
        allDays[d.date] += tok;
      }
      toolTokens[sid] = toolTok;
    }
    const ds = Object.keys(allDays).sort();
    let cur = 1, lng = 1;
    for (let i = 1; i < ds.length; i++) {
      const a = new Date(ds[i - 1] + "T00:00:00");
      const b = new Date(ds[i] + "T00:00:00");
      cur = (b - a) / 864e5 === 1 ? cur + 1 : 1;
      lng = Math.max(lng, cur);
    }
    streak = lng;
  }

  // ---- Drawing helpers ----
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function drawStat(x, y, w, val, lab) {
    ctx.save();
    roundRect(x, y, w, 66, 11);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#eef4f7";
    ctx.font = "bold 28px " + SANS;
    ctx.fillText(val, x + w / 2, y + 36);
    ctx.fillStyle = "#86a0ad";
    ctx.font = "600 11px " + SANS;
    ctx.fillText(lab, x + w / 2, y + 54);
    ctx.restore();
  }

  function fitTitle(text, maxWidth, maxLines) {
    for (let fontSize = 40; fontSize >= 22; fontSize -= 3) {
      ctx.font = "bold " + fontSize + "px " + SANS;
      const words = text.split(/(\s+|·|-)/).filter(Boolean);
      const lines = [];
      let line = "";
      for (const word of words) {
        const test = line + word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line.trim());
          line = word;
        } else {
          line = test;
        }
      }
      if (line.trim()) lines.push(line.trim());
      const allFit = lines.every(l => ctx.measureText(l).width <= maxWidth);
      if (lines.length <= maxLines && allFit) return { fontSize, lines };
    }
    ctx.font = "bold 22px " + SANS;
    let truncated = text;
    while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 3) {
      truncated = truncated.slice(0, -1);
    }
    return { fontSize: 22, lines: [truncated + "..."] };
  }

  // A tier-shaped trophy medallion (matches the Achievements grid silhouettes),
  // filled with the tier gradient and embossed with a small award star.
  const MEDAL_GRAD = {
    common: [lighten(ACCENT, -0.22), ACCENT],
    rare: ["#3a6fb0", "#6fb4ff"],
    epic: ["#6b4fd0", "#b79bff"],
    legendary: ["#c9962e", "#ffcf6b"],
  };
  function medalPath(cx, cy, r, tier) {
    if (tier === "legendary") {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 3;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    } else if (tier === "epic") {
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy - r);
      ctx.lineTo(cx + r, cy - r * 0.1);
      ctx.quadraticCurveTo(cx + r, cy + r * 0.7, cx, cy + r);
      ctx.quadraticCurveTo(cx - r, cy + r * 0.7, cx - r, cy - r * 0.1);
      ctx.closePath();
    } else if (tier === "rare") {
      roundRect(cx - r, cy - r, 2 * r, 2 * r, r * 0.5);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  }
  function drawStar(cx, cy, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function drawMedallion(cx, cy, r, tier, withStar) {
    const [c1, c2] = MEDAL_GRAD[tier] || MEDAL_GRAD.common;
    const lg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    lg.addColorStop(0, c1);
    lg.addColorStop(1, c2);
    medalPath(cx, cy, r, tier);
    ctx.fillStyle = lg;
    ctx.fill();
    if (withStar !== false) {
      drawStar(cx, cy - (tier === "epic" ? 1 : 0), r * 0.42, "rgba(14,26,34,0.78)");
    }
  }

  // ===== Header =====
  // Soft top glow that fades into the background — no hard-edged band.
  const topGlow = ctx.createLinearGradient(0, 0, 0, 120);
  topGlow.addColorStop(0, hexToRgba(ACCENT, 0.13));
  topGlow.addColorStop(1, "transparent");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, 120);

  ctx.textAlign = "left";
  ctx.fillStyle = "#eef4f7";
  ctx.font = "bold 24px " + SANS;
  ctx.fillText("HashMeter", 48, 50);
  ctx.fillStyle = ACCENT;
  ctx.fillText("Ai", 48 + ctx.measureText("HashMeter").width + 2, 50);

  // Brand mark, top-right (the "100% local · private" line lives in the footer).
  if (logoImg) {
    const lh = 46;
    const lw = lh * ((logoImg.naturalWidth || 1) / (logoImg.naturalHeight || 1));
    ctx.drawImage(logoImg, W - 48 - lw, 12, lw, lh);
  }

  // A single divider that's an accent gradient (strong under the wordmark,
  // fading out to the right) rather than a flat rule — reads as a design accent.
  const lineGrad = ctx.createLinearGradient(48, 0, W - 48, 0);
  lineGrad.addColorStop(0, hexToRgba(ACCENT, 0.6));
  lineGrad.addColorStop(0.5, hexToRgba(ACCENT, 0.16));
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(48, 80);
  ctx.lineTo(W - 48, 80);
  ctx.stroke();

  // ===== Persona cluster (eyebrow + title + name, flows down) =====
  ctx.textAlign = "center";
  // Eyebrow — mirrors the in-app Persona card so the two read as one design.
  ctx.save();
  ctx.letterSpacing = "4px";
  ctx.fillStyle = lighten(ACCENT, 0.2);
  ctx.font = "bold 12px " + SANS;
  ctx.fillText("YOUR AI PERSONA", CX, 104);
  ctx.restore();

  ctx.fillStyle = ACCENT;
  const titleFit = fitTitle(ptitle, W - 150, 2);
  let y = 104 + titleFit.fontSize + 6;
  for (const line of titleFit.lines) {
    ctx.font = "bold " + titleFit.fontSize + "px " + SANS;
    ctx.fillText(line, CX, y);
    y += titleFit.fontSize + 8;
  }
  const nameLine = uname
    ? (psub ? uname + "  ·  " + psub : uname + "'s AI usage")
    : (psub || "My AI usage");
  ctx.fillStyle = "rgba(238,244,247,0.82)";
  ctx.font = "17px " + SANS;
  ctx.fillText(nameLine, CX, y);

  // ===== Hero: processed tokens (the truest measure of work) =====
  const heroY = y + 70;
  // Soft radial glow so the headline number really pops.
  const heroGlow = ctx.createRadialGradient(CX, heroY - 16, 0, CX, heroY - 16, 250);
  heroGlow.addColorStop(0, hexToRgba(ACCENT, 0.17));
  heroGlow.addColorStop(1, "transparent");
  ctx.fillStyle = heroGlow;
  ctx.fillRect(CX - 340, heroY - 78, 680, 150);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 74px " + SANS;
  ctx.fillText(human(processed), CX, heroY);
  ctx.fillStyle = "#9fb3bd";
  ctx.font = "600 14px " + SANS;
  ctx.fillText("tokens processed", CX, heroY + 24);

  // ===== Top X% pill (honest, from the benchmark) =====
  let blockBottom = heroY + 24;
  if (standing) {
    const label = standing.label + "  *";
    ctx.font = "bold 18px " + SANS;
    const tw = ctx.measureText(label).width;
    const pw = tw + 40, ph = 38, px = CX - pw / 2, py = heroY + 42;
    roundRect(px, py, pw, ph, 19);
    ctx.fillStyle = hexToRgba(ACCENT, 0.2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = hexToRgba(ACCENT, 0.7);
    ctx.stroke();
    ctx.fillStyle = lighten(ACCENT, 0.2);
    ctx.textAlign = "center";
    ctx.font = "bold 18px " + SANS;
    ctx.fillText(label, CX, py + 25);
    blockBottom = py + ph;
  }

  // ===== Supporting stats (3) =====
  const statsY = blockBottom + 26;
  const stats = [
    [money(cost), "est. compute value"],
    [streak + "d", "best streak"],
    [String(tools), "AI tools unified"],
  ];
  const statW = 232, statGap = 16;
  const statsTotalW = stats.length * statW + (stats.length - 1) * statGap;
  let sx = (W - statsTotalW) / 2;
  for (const [val, lab] of stats) {
    drawStat(sx, statsY, statW, val, lab);
    sx += statW + statGap;
  }

  // ===== Rarest trophies — the three hardest earned badges, each with its
  // description so anyone who sees the card understands what it took. =====
  const unlocked = achievements.filter(a => a.unlocked).sort((a, b) => b.rank - a.rank);
  const tops = unlocked.slice(0, 3);
  if (tops.length) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#86a0ad";
    ctx.font = "600 11px " + SANS;
    ctx.save();
    ctx.letterSpacing = "1.5px";
    ctx.fillText(tops.length > 1 ? "RAREST TROPHIES" : "RAREST TROPHY", CX, H - 128);
    ctx.restore();

    const r = 19;
    const colW = (W - 96) / tops.length;
    const rowCy = H - 86;
    // Preload each trophy's real figure so the medallion shows the actual emblem.
    const figs = await Promise.all(tops.map(t => loadTrophyFigure(t.id, t.tier)));
    for (let i = 0; i < tops.length; i++) {
      const t = tops[i];
      const colCx = 48 + colW * i + colW / 2;
      ctx.font = "bold 15px " + SANS;
      const nameW = ctx.measureText(t.name).width;
      const descLines = wrapShareText(ctx, t.description, colW - 2 * r - 34, "11px " + SANS, 2);
      let descW = 0;
      ctx.font = "11px " + SANS;
      for (const l of descLines) descW = Math.max(descW, ctx.measureText(l).width);
      const gapM = 12;
      const groupW = 2 * r + gapM + Math.max(nameW, descW);
      const gx = colCx - groupW / 2;
      const mcx = gx + r;
      const fig = figs[i];
      drawMedallion(mcx, rowCy, r, t.tier, !fig);
      if (fig) {
        const fs = r * 1.4;
        ctx.drawImage(fig, mcx - fs / 2, rowCy - fs / 2, fs, fs);
      }
      const tx = gx + 2 * r + gapM;
      ctx.textAlign = "left";
      ctx.fillStyle = "#eef4f7";
      ctx.font = "bold 15px " + SANS;
      ctx.fillText(t.name, tx, rowCy - 4);
      ctx.fillStyle = "#9fb3bd";
      ctx.font = "11px " + SANS;
      let dy = rowCy + 12;
      for (const line of descLines) { ctx.fillText(line, tx, dy); dy += 13; }
    }
    ctx.textAlign = "left";
  }

  // ===== Footer =====
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(134,160,173,0.5)";
  ctx.font = "11px ui-monospace, monospace";
  let footnote = "Cost estimated at public API list prices.";
  if (standing) footnote += "   *Top % vs. a modeled 2025–26 usage benchmark.";
  ctx.fillText(footnote, CX, H - 14);

  ctx.fillStyle = "rgba(134,160,173,0.6)";
  ctx.font = "12px " + SANS;
  ctx.textAlign = "left";
  ctx.fillText("Made with HashMeterAi  ·  100% local & private", 48, H - 36);
  ctx.textAlign = "right";
  ctx.fillText("github.com/Hash-7777/HashMeterAi", W - 48, H - 36);

  ctx.textAlign = "left";
}

g("btn-share").onclick = function () {
  showView("share");
};

g("share-copy").onclick = async function () {
  const canvas = g("share-canvas");
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    await copyImageToClipboard(base64);
    g("share-copy").textContent = "Copied!";
    setTimeout(() => g("share-copy").textContent = "Copy image", 2000);
  } catch (e) {
    console.error("copy failed", e);
    g("share-copy").textContent = "Copy failed";
    setTimeout(() => g("share-copy").textContent = "Copy image", 2000);
  }
};

g("share-save").onclick = function () {
  const canvas = g("share-canvas");
  try {
    const link = document.createElement("a");
    link.download = "hashmeterai-share.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (e) {
    console.error("save failed", e);
    g("share-save").textContent = "Save failed";
    setTimeout(() => { g("share-save").textContent = "Save PNG"; }, 2000);
  }
};

// Pick a card theme, then re-render the canvas (and the swatches' active state).
g("share-themes").onclick = function (e) {
  const b = e.target.closest(".share-theme-btn");
  if (!b) return;
  SHARE_THEME = parseInt(b.dataset.theme, 10) || 0;
  renderShareThemes();
  renderShareCard();
};
