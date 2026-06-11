const LOTR = 580000;

async function renderShareCard() {
  const canvas = g("share-canvas");
  const ctx = canvas.getContext("2d");
  const W = 1200;
  const H = 630;
  const dpr = window.devicePixelRatio || 1;
  const ACCENT = (window.PREFS && window.PREFS.accent) || "#FD802E";

  // Render at device-pixel ratio for crisp PNGs on retina displays.
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.maxWidth = "100%";
  canvas.style.height = "auto";
  ctx.scale(dpr, dpr);

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0c1c25");
  grad.addColorStop(1, "#05090d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Faint grid
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 52) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 52) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

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
  const uname = (window.USER_NAME || "").trim();

  // Compute stats
  let processed = 0, cost = 0, days = 0, sessions = 0, focus = 0, tools = 0, streak = 0;
  const allDays = {};
  const toolTokens = {};
  let hashcortxEstimated = false;
  if (snap && snap.tools) {
    for (const [sid, tool] of Object.entries(snap.tools)) {
      if (!tool.present) continue;
      tools++;
      let toolTok = 0;
      for (const d of tool.days) {
        const tok = d.newIn + d.write + d.out;
        processed += tok;
        cost += d.cost || 0;
        sessions += d.sessions.length;
        focus += d.focus_sec || 0;
        days++;
        toolTok += tok;
        if (!allDays[d.date]) allDays[d.date] = 0;
        allDays[d.date] += tok;
      }
      toolTokens[sid] = toolTok;
      if (sid === "hashcortx" && toolTok > 0) hashcortxEstimated = true;
    }
    const ds = Object.keys(allDays).sort();
    let cur = 1, lng = 1;
    for (let i = 1; i < ds.length; i++) {
      const a = new Date(ds[i-1] + "T00:00:00");
      const b = new Date(ds[i] + "T00:00:00");
      cur = (b - a) / 864e5 === 1 ? cur + 1 : 1;
      lng = Math.max(lng, cur);
    }
    streak = lng;
  }

  const distinctDays = Object.keys(allDays).length;
  const avgFocus = distinctDays > 0 ? Math.round(focus / distinctDays) : 0;
  const fh = Math.floor(avgFocus / 3600);
  const fm = Math.floor((avgFocus % 3600) / 60);
  const focusStr = fh > 0 ? fh + "h " + fm + "m" : fm + "m";

  // Helpers
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
    roundRect(x, y, w, 64, 10);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
    ctx.fillStyle = "#eef4f7";
    ctx.font = "bold 30px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(val, x + 16, y + 36);
    ctx.fillStyle = "#86a0ad";
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(lab, x + 16, y + 54);
    ctx.restore();
  }

  function fitTitle(text, maxWidth, maxLines) {
    let fontSize = 46;
    while (fontSize >= 26) {
      ctx.font = "bold " + fontSize + "px -apple-system, BlinkMacSystemFont, sans-serif";
      const words = text.split(/(\s+)/).filter(Boolean);
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
      if (lines.length <= maxLines) return { fontSize, lines };
      fontSize -= 4;
    }
    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, sans-serif";
    let truncated = text;
    while (ctx.measureText(truncated + "...").width > maxWidth && truncated.length > 3) {
      truncated = truncated.slice(0, -1);
    }
    return { fontSize: 26, lines: [truncated + "..."] };
  }

  const tierColor = {
    common: ACCENT,
    rare: "#6fb4ff",
    epic: "#b79bff",
    legendary: "#ffcf6b",
  };

  // Accent header bar
  const hdr = ctx.createLinearGradient(0, 0, W, 0);
  hdr.addColorStop(0, hexToRgba(ACCENT, 0.28));
  hdr.addColorStop(0.55, hexToRgba(ACCENT, 0.08));
  hdr.addColorStop(1, "transparent");
  ctx.fillStyle = hdr;
  ctx.fillRect(0, 0, W, 72);

  // Header line
  ctx.strokeStyle = hexToRgba(ACCENT, 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, 52);
  ctx.lineTo(W - 48, 52);
  ctx.stroke();

  // Logo
  ctx.fillStyle = "#eef4f7";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("HashMeter", 48, 36);
  ctx.fillStyle = ACCENT;
  ctx.fillText("Ai", 48 + ctx.measureText("HashMeter").width + 2, 36);

  // Persona title (wrapped + sized to fit)
  ctx.fillStyle = ACCENT;
  const titleFit = fitTitle(ptitle, W - 96, 2);
  let ty = 88;
  for (const line of titleFit.lines) {
    ctx.font = "bold " + titleFit.fontSize + "px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(line, 48, ty);
    ty += titleFit.fontSize + 10;
  }

  // Name line
  ctx.fillStyle = "rgba(238,244,247,0.85)";
  ctx.font = "18px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(uname ? uname + "'s AI usage" : "My AI usage", 48, ty + 4);

  // Stats row
  const stats = [
    [money(cost), "Est. cost"],
    [human(processed), "Processed tokens"],
    [streak + "d", "Best streak"],
    [focusStr, "Avg use/day"],
  ];
  const statW = 258, statGap = 16;
  let sx = 48;
  const statsY = ty + 40;
  for (const [val, lab] of stats) {
    drawStat(sx, statsY, statW, val, lab);
    sx += statW + statGap;
  }

  // LOTR yardstick
  const ratio = processed / LOTR;
  const lotrText = ratio >= 100 ? Math.round(ratio) + "x" : ratio.toFixed(1) + "x";
  ctx.fillStyle = "#86a0ad";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("\u2248 " + lotrText + " the length of The Lord of the Rings  \u00b7  " + tools + " tools", 48, statsY + 84);

  // Tokens-by-tool bar chart
  const toolOrder = ["claude", "codex", "kimi", "hashcortx", "cline"];
  const toolLabel = { claude: "Claude", codex: "Codex", kimi: "Kimi", hashcortx: "HashCortx", cline: "Cline" };
  const toolColors = [ACCENT, "#6fb4ff", "#b79bff", "#54ffc4", "#ffcf6b"];
  const chartY = statsY + 102;
  const chartW = W - 200;
  const presentTools = toolOrder.filter(t => toolTokens[t] > 0);
  if (presentTools.length > 0) {
    const maxTok = Math.max(...presentTools.map(t => toolTokens[t]));
    let by = chartY;
    for (let i = 0; i < presentTools.length; i++) {
      const t = presentTools[i];
      const v = toolTokens[t];
      const pct = v / maxTok;
      const bw = Math.max(6, chartW * pct);
      const bh = 20;
      if (by + bh > H - 180) break;
      ctx.fillStyle = "rgba(134,160,173,0.7)";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(toolLabel[t], 48, by + 14);
      roundRect(120, by, bw, bh, 5);
      ctx.fillStyle = toolColors[i % toolColors.length];
      ctx.fill();

      // Value label: inside if bar is wide, outside if narrow
      const valStr = human(v);
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
      const valW = ctx.measureText(valStr).width;
      if (bw > chartW * 0.62) {
        ctx.fillStyle = "rgba(5,9,13,0.85)";
        ctx.fillText(valStr, 120 + bw - valW - 8, by + 14);
      } else {
        ctx.fillStyle = "rgba(238,244,247,0.9)";
        ctx.fillText(valStr, 124 + bw + 6, by + 14);
      }
      by += 26;
    }
  }

  // Top unlocked badges
  const unlocked = achievements.filter(a => a.unlocked).sort((a, b) => b.progress - a.progress);
  const topBadges = unlocked.slice(0, 3);
  let badgesY = chartY + (presentTools.length * 26) + 20;
  if (badgesY < statsY + 102) badgesY = statsY + 102;
  if (topBadges.length > 0) {
    ctx.fillStyle = "rgba(134,160,173,0.7)";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Top badges", 48, badgesY);
    let bx = 48;
    for (const b of topBadges) {
      const color = tierColor[b.tier] || ACCENT;
      const w = ctx.measureText(b.name).width + 24;
      roundRect(bx, badgesY + 12, w, 28, 7);
      ctx.fillStyle = hexToRgba(color, 0.14);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexToRgba(color, 0.45);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(b.name, bx + 12, badgesY + 31);
      bx += w + 10;
    }
    badgesY += 56;
  }

  // Caveat + estimated note
  ctx.fillStyle = "rgba(134,160,173,0.65)";
  ctx.font = "12px ui-monospace, monospace";
  let noteY = Math.min(badgesY + 16, H - 58);
  ctx.fillText("Cost is estimated at public API list prices. Actual billing may differ.", 48, noteY);
  if (hashcortxEstimated) {
    noteY += 16;
    ctx.fillText("HashCortx token counts are estimated from message length.", 48, noteY);
  }

  // Footer
  ctx.fillStyle = "rgba(134,160,173,0.55)";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Made with HashMeterAi  \u00b7  local & private", 48, H - 20);
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
