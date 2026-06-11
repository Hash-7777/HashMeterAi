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

async function setPref(key, value) {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    await window.__TAURI__.core.invoke("set_pref", { key, value });
  }
}

async function openDataFolder() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return await window.__TAURI__.core.invoke("open_data_folder");
  }
  return Promise.reject(new Error("Tauri runtime not available"));
}

async function resetProfile() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    await window.__TAURI__.core.invoke("reset_profile");
  }
}

async function copyImageToClipboard(base64Data) {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    await window.__TAURI__.core.invoke("copy_image_to_clipboard", { base64Data });
  } else {
    return Promise.reject(new Error("Tauri runtime not available"));
  }
}
