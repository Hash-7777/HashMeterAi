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
      el.style.cssText = "background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px";
      el.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--pk2);letter-spacing:.08em;text-transform:uppercase">' + t.label + '</div>' +
        '<div style="font-size:12px;color:var(--mut);margin-top:4px;font-family:var(--mono)">' + t.why + '</div>';
      host.appendChild(el);
    }
  } catch (e) {
    console.error("persona load error", e);
    g("p-title").textContent = "Just getting started";
    g("p-desc").textContent = "Not enough data yet to read your style.";
  }
}

g("persona-back").onclick = function () {
  g("persona-view").classList.add("hidden");
  g("dashboard").classList.remove("hidden");
  CURRENT_SCREEN = "dashboard";
  TAB = "overview";
  updateTabButtons();
};
