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

  // Pumpkin glow corner
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 500);
  glow.addColorStop(0, "rgba(253,128,46,0.12)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Logo text
  ctx.fillStyle = "#eef4f7";
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("HashMeter", 48, 56);
  ctx.fillStyle = ACCENT;
  ctx.fillText("Ai", 48 + ctx.measureText("HashMeter").width, 56);

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

  // Compute stats from snapshot
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
    // streak
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
    roundRect(x, y, w, 78, 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
    ctx.fillStyle = "#eef4f7";
    ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(val, x + 18, y + 44);
    ctx.fillStyle = "#86a0ad";
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(lab, x + 18, y + 66);
    ctx.restore();
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
  ctx.fillRect(0, 0, W, 110);

  // Header line
  ctx.strokeStyle = hexToRgba(ACCENT, 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, 76);
  ctx.lineTo(W - 48, 76);
  ctx.stroke();

  // Logo
  ctx.fillStyle = "#eef4f7";
  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("HashMeter", 48, 52);
  ctx.fillStyle = ACCENT;
  ctx.fillText("Ai", 48 + ctx.measureText("HashMeter").width + 2, 52);

  // Persona title (hero)
  ctx.fillStyle = ACCENT;
  ctx.font = "bold 68px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(ptitle, 48, 166);

  // Name line
  ctx.fillStyle = "rgba(238,244,247,0.85)";
  ctx.font = "22px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(uname ? uname + "'s AI usage" : "My AI usage", 48, 202);

  // Stats row
  const stats = [
    [money(cost), "Est. cost"],
    [human(processed), "Processed tokens"],
    [streak + "d", "Best streak"],
    [focusStr, "Avg use/day"],
  ];
  const statW = 258, statGap = 16;
  let sx = 48;
  for (const [val, lab] of stats) {
    drawStat(sx, 232, statW, val, lab);
    sx += statW + statGap;
  }

  // LOTR yardstick
  const ratio = processed / LOTR;
  const lotrText = ratio >= 100 ? Math.round(ratio) + "x" : ratio.toFixed(1) + "x";
  ctx.fillStyle = "#86a0ad";
  ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("\u2248 " + lotrText + " the length of The Lord of the Rings  \u00b7  " + tools + " tools", 48, 350);

  // Tokens-by-tool bar chart
  const toolOrder = ["claude", "codex", "kimi", "hashcortx", "cline"];
  const toolLabel = { claude: "Claude", codex: "Codex", kimi: "Kimi", hashcortx: "HashCortx", cline: "Cline" };
  const toolColors = [ACCENT, "#6fb4ff", "#b79bff", "#54ffc4", "#ffcf6b"];
  const chartY = 375;
  const chartW = W - 96;
  const presentTools = toolOrder.filter(t => toolTokens[t] > 0);
  if (presentTools.length > 0) {
    const maxTok = Math.max(...presentTools.map(t => toolTokens[t]));
    let bx = 48, by = chartY;
    for (let i = 0; i < presentTools.length; i++) {
      const t = presentTools[i];
      const v = toolTokens[t];
      const pct = v / maxTok;
      const bw = Math.max(6, chartW * pct);
      const bh = 22;
      if (by + bh > 440) break;
      ctx.fillStyle = "rgba(134,160,173,0.7)";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(toolLabel[t], 48, by + 16);
      roundRect(140, by, bw, bh, 6);
      ctx.fillStyle = toolColors[i % toolColors.length];
      ctx.fill();
      ctx.fillStyle = "rgba(238,244,247,0.9)";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(human(v), 146 + bw, by + 15);
      by += 30;
    }
  }

  // Top unlocked badges
  const unlocked = achievements.filter(a => a.unlocked).sort((a, b) => b.progress - a.progress);
  const topBadges = unlocked.slice(0, 3);
  if (topBadges.length > 0) {
    ctx.fillStyle = "rgba(134,160,173,0.7)";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Top badges", 48, 486);
    let bx = 48;
    for (const b of topBadges) {
      const color = tierColor[b.tier] || ACCENT;
      const w = ctx.measureText(b.name).width + 28;
      roundRect(bx, 498, w, 30, 8);
      ctx.fillStyle = hexToRgba(color, 0.14);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexToRgba(color, 0.45);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(b.name, bx + 14, 518);
      bx += w + 12;
    }
  }

  // Caveat + estimated note
  ctx.fillStyle = "rgba(134,160,173,0.65)";
  ctx.font = "12px ui-monospace, monospace";
  let noteY = 566;
  ctx.fillText("Cost is estimated at public API list prices. Actual billing may differ.", 48, noteY);
  if (hashcortxEstimated) {
    noteY += 18;
    ctx.fillText("HashCortx token counts are estimated from message length.", 48, noteY);
  }

  // Footer
  ctx.fillStyle = "rgba(134,160,173,0.55)";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Made with HashMeterAi  \u00b7  local & private", 48, 610);
}

g("btn-share").onclick = function () {
  showView("share");
};

g("share-copy").onclick = async function () {
  const canvas = g("share-canvas");
  canvas.toBlob(async function (blob) {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      g("share-copy").textContent = "Copied!";
      setTimeout(() => g("share-copy").textContent = "Copy image", 2000);
    } catch (e) {
      console.error("copy failed", e);
    }
  });
};

g("share-save").onclick = function () {
  const canvas = g("share-canvas");
  const link = document.createElement("a");
  link.download = "hashmeterai-share.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};
