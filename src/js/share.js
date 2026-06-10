const LOTR = 580000;

async function renderShareCard() {
  const canvas = g("share-canvas");
  const ctx = canvas.getContext("2d");
  const W = 1200;
  const H = 630;

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
  ctx.fillStyle = "#FD802E";
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

  const name = (persona && persona.title !== "Just getting started") ? persona.title.split(" \u00b7 ")[0] : "You";
  const ptitle = persona ? persona.title : "AI Explorer";

  // Headline
  ctx.fillStyle = "#eef4f7";
  ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("My AI usage", 48, 140);

  // Persona title
  ctx.fillStyle = "#FD802E";
  ctx.font = "bold 56px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(ptitle, 48, 210);

  // Compute stats from snapshot
  let processed = 0, cost = 0, days = 0, sessions = 0, focus = 0, tools = 0, streak = 0;
  if (snap && snap.tools) {
    const allDays = {};
    for (const [sid, tool] of Object.entries(snap.tools)) {
      if (!tool.present) continue;
      tools++;
      for (const d of tool.days) {
        processed += d.new_in + d.write + d.out;
        cost += d.cost || 0;
        sessions += d.sessions.length;
        focus += d.focus_sec || 0;
        days++;
        if (!allDays[d.date]) allDays[d.date] = 0;
        allDays[d.date] += d.new_in + d.write + d.out;
      }
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

  const avgFocus = days > 0 ? Math.round(focus / days) : 0;
  const fh = Math.floor(avgFocus / 3600);
  const fm = Math.floor((avgFocus % 3600) / 60);
  const focusStr = fh > 0 ? fh + "h " + fm + "m" : fm + "m";

  // Stats row
  const stats = [
    [money(cost), "Est. cost"],
    [human(processed), "Processed"],
    [streak + "d", "Best streak"],
    [focusStr, "Avg focus/day"],
  ];

  let sx = 48;
  for (const [val, lab] of stats) {
    ctx.fillStyle = "#eef4f7";
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(val, sx, 310);
    ctx.fillStyle = "#86a0ad";
    ctx.font = "600 14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(lab, sx, 340);
    sx += 260;
  }

  // Sub line
  const ratio = processed / LOTR;
  const lotrText = ratio >= 100 ? Math.round(ratio) + "x" : ratio.toFixed(1) + "x";
  ctx.fillStyle = "#86a0ad";
  ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("\u2248 " + lotrText + " The Lord of the Rings  \u00b7  " + tools + " tools  \u00b7  since first use", 48, 410);

  // Top achievement
  const top = achievements.filter(a => a.unlocked).sort((a, b) => (b.progress - a.progress))[0];
  if (top) {
    ctx.fillStyle = "#FD802E";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Top badge: " + top.name, 48, 460);
  }

  // Caveat
  ctx.fillStyle = "rgba(134,160,173,0.7)";
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText("Cost is estimated at public API list prices. Actual billing may differ.", 48, 580);

  // Footer
  ctx.fillStyle = "rgba(134,160,173,0.6)";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Made with HashMeterAi  \u00b7  local & private", 48, 610);
}

async function showShare() {
  hideAllViews();
  g("share-view").classList.remove("hidden");
  await renderShareCard();
}

g("btn-share").onclick = showShare;

g("share-back").onclick = function () {
  g("share-view").classList.add("hidden");
  g("dashboard").classList.remove("hidden");
  CURRENT_SCREEN = "dashboard";
  TAB = "overview";
  updateTabButtons();
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
