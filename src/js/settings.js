async function loadSettings() {
  try {
    const p = await getProfile();
    g("set-name").value = p.name || "";
    g("set-reduced").checked = p.prefs && p.prefs.reduced_motion;
  } catch (e) {
    console.error("settings load error", e);
  }
}

g("set-save-name").onclick = async function () {
  const name = g("set-name").value.trim();
  if (name.length < 1 || name.length > 40) return;
  await setName(name);
  g("set-save-name").textContent = "Saved";
  setTimeout(() => g("set-save-name").textContent = "Save name", 1500);
};

g("set-reduced").onchange = async function () {
  await setPref("reduced_motion", this.checked);
};

g("set-open-data").onclick = async function () {
  await openDataFolder();
};

g("set-reset").onclick = async function () {
  const ok = confirm("Reset all app data? This clears your name, preferences, and unlocked badges.");
  if (!ok) return;
  await resetProfile();
  window.location.reload();
};

g("set-back").onclick = function () {
  g("settings-view").classList.add("hidden");
  g("dashboard").classList.remove("hidden");
  CURRENT_SCREEN = "dashboard";
  TAB = "overview";
  updateTabButtons();
};
