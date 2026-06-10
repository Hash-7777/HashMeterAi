async function scanUsage() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return await window.__TAURI__.core.invoke("scan_usage");
  }
  return { generated_at: new Date().toISOString(), tools: {} };
}

async function getProfile() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return await window.__TAURI__.core.invoke("get_profile");
  }
  return { name: "", created_at: null, prefs: { reduced_motion: false, default_range: "all" } };
}

async function setName(name) {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    await window.__TAURI__.core.invoke("set_name", { name });
  }
}

async function getPersona() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return await window.__TAURI__.core.invoke("get_persona");
  }
  return {
    title: "Just getting started",
    subtitle: "Dabbler",
    description: "Not enough data yet.",
    traits: [],
    confidence: "low",
  };
}

async function getAchievements() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return await window.__TAURI__.core.invoke("get_achievements");
  }
  return [];
}
