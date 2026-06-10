async function scanUsage() {
  if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
    return await window.__TAURI__.core.invoke("scan_usage");
  }
  // Fallback for browser dev
  return { generated_at: new Date().toISOString(), tools: {} };
}
