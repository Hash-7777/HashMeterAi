async function loadPersona() {
  try {
    const p = await getPersona();
    g("p-title").textContent = p.title;
    g("p-subtitle").textContent = p.subtitle;
    g("p-confidence").textContent = "confidence: " + p.confidence;
    g("p-desc").textContent = p.description;

    const host = g("p-traits");
    host.innerHTML = "";
    for (const t of p.traits) {
      const el = document.createElement("div");
      el.className = "persona-trait";
      el.innerHTML = '<div class="persona-trait-label">' + t.label + '</div>' +
        '<div class="persona-trait-why">' + t.why + '</div>';
      host.appendChild(el);
    }
  } catch (e) {
    console.error("persona load error", e);
    g("p-title").textContent = "Just getting started";
    g("p-desc").textContent = "Not enough data yet to read your style.";
  }
}
