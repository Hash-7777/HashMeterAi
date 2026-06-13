async function loadPersona() {
  try {
    const p = await getPersona();
    g("p-title").textContent = p.title;
    g("p-subtitle").textContent = p.subtitle;
    g("p-subtitle").style.display = p.subtitle ? "" : "none";
    renderStanding(p.standing);
    renderConfidence(p.confidence);

    const host = g("p-traits");
    host.innerHTML = "";
    for (const t of p.traits) {
      const el = document.createElement("div");
      el.className = "ptrait";
      el.innerHTML = '<div class="ptrait-label">' + t.label + '</div>' +
        '<div class="ptrait-why">' + t.why + '</div>';
      host.appendChild(el);
    }
    g("p-foot").style.display = p.traits.length ? "" : "none";
    renderTopTrophies();
  } catch (e) {
    console.error("persona load error", e);
    g("p-title").textContent = "Just getting started";
    g("p-subtitle").style.display = "none";
    g("p-confidence").style.display = "none";
    g("p-standing").style.display = "none";
    g("p-traits").innerHTML =
      '<div class="persona-empty">Not enough usage yet to read your style. Keep using your AI tools and check back.</div>';
    g("p-foot").style.display = "none";
    const tr = g("p-trophies");
    if (tr) { tr.style.display = "none"; tr.innerHTML = ""; }
  }
}

// The three hardest trophies earned (rarest first), shown on the Persona card as
// flashy medallion chips — the same emblems and tier styling as the Trophies tab.
async function renderTopTrophies() {
  const host = g("p-trophies");
  if (!host) return;
  try {
    const list = await getAchievements();
    const top = list.filter(a => a.unlocked).sort((a, b) => b.rank - a.rank).slice(0, 3);
    if (!top.length) {
      host.style.display = "none";
      host.innerHTML = "";
      return;
    }
    host.style.display = "";
    host.innerHTML =
      '<div class="persona-trophies-label">Top trophies</div>' +
      '<div class="persona-trophies-row">' +
      top.map(a =>
        '<div class="ach-badge tier-' + a.tier + ' unlocked ptrophy">' +
          '<div class="ach-icon">' + achIcon(a.id, a.tier) + "</div>" +
          '<div class="ptrophy-name">' + a.name + "</div>" +
          '<div class="ptrophy-tier">' + a.tier + "</div>" +
        "</div>"
      ).join("") +
      "</div>";
  } catch (e) {
    console.error("persona trophies error", e);
    host.style.display = "none";
    host.innerHTML = "";
  }
}

// Confidence shown as a small colored-dot chip (green=high, amber=medium, grey=low).
function renderConfidence(conf) {
  const el = g("p-confidence");
  if (!conf) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "";
  el.className = "persona-conf" + (conf === "medium" ? " med" : conf === "low" ? " low" : "");
  el.textContent = conf + " confidence";
}

// The honest "where do you stand" line: top X% with its number + footnote, or
// hidden entirely when below the benchmark's data floor.
function renderStanding(standing) {
  const el = g("p-standing");
  if (!standing) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.style.display = "";
  el.innerHTML =
    '<div class="ps-top">' + standing.label + '<span class="ps-star">*</span></div>' +
    '<div class="ps-basis">' + standing.basis + '</div>' +
    '<div class="ps-note">*' + standing.note + '</div>';
}
