const SANS = "-apple-system, BlinkMacSystemFont, sans-serif";

async function renderShareCard() {
  const canvas = g("share-canvas");
  const ctx = canvas.getContext("2d");
  const W = 1200;
  const H = 630;
  const CX = W / 2;
  const dpr = window.devicePixelRatio || 1;
  const ACCENT = (window.PREFS && window.PREFS.accent) || "#FD802E";

  // Render at device-pixel ratio for crisp PNGs on retina displays.
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.maxWidth = "100%";
  canvas.style.height = "auto";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textBaseline = "alphabetic";

  // Background — clean vertical gradient (teal edge, warm pumpkin-tinted middle),
  // matching the website. No grid.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#06101a");
  grad.addColorStop(0.5, "#1a130b");
  grad.addColorStop(1, "#05090d");
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
  function drawMedallion(cx, cy, r, tier) {
    const [c1, c2] = MEDAL_GRAD[tier] || MEDAL_GRAD.common;
    const lg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    lg.addColorStop(0, c1);
    lg.addColorStop(1, c2);
    medalPath(cx, cy, r, tier);
    ctx.fillStyle = lg;
    ctx.fill();
    drawStar(cx, cy - (tier === "epic" ? 1 : 0), r * 0.42, "rgba(14,26,34,0.78)");
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

  // Privacy tag on the right — replaces the tagline to keep the header clean.
  ctx.textAlign = "right";
  ctx.fillStyle = "#86a0ad";
  ctx.font = "600 12px " + SANS;
  ctx.fillText("100% local  ·  private", W - 48, 48);

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

  // ===== Rarest trophy — the single hardest earned badge (centered) =====
  const unlocked = achievements.filter(a => a.unlocked).sort((a, b) => b.rank - a.rank);
  const top = unlocked[0];
  if (top) {
    const r = 24;
    ctx.font = "bold 22px " + SANS;
    const nameW = ctx.measureText(top.name).width;
    ctx.font = "600 11px " + SANS;
    const labelW = ctx.measureText("RAREST TROPHY").width;
    const textW = Math.max(nameW, labelW);
    const gapM = 15;
    const groupW = 2 * r + gapM + textW;
    const gx = CX - groupW / 2;
    const medCy = H - 88;
    const medCx = gx + r;
    drawMedallion(medCx, medCy, r, top.tier);
    const tx = gx + 2 * r + gapM;
    ctx.textAlign = "left";
    ctx.fillStyle = "#86a0ad";
    ctx.font = "600 11px " + SANS;
    ctx.fillText("RAREST TROPHY", tx, medCy - 6);
    ctx.fillStyle = "#eef4f7";
    ctx.font = "bold 22px " + SANS;
    ctx.fillText(top.name, tx, medCy + 17);
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
  const link = document.createElement("a");
  link.download = "hashmeterai-share.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};
