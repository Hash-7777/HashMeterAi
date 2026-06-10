async function loadSettings() {
  try {
    const p = await getProfile();
    g("set-name").value = p.name || "";
  } catch (e) {
    console.error("settings load error", e);
  }
}

g("set-save-name").onclick = async function () {
  const name = g("set-name").value.trim();
  if (name.length < 1 || name.length > 40) return;
  await setName(name);
};

g("set-back").onclick = function () {
  g("settings-view").classList.add("hidden");
  g("dashboard").classList.remove("hidden");
  CURRENT_SCREEN = "dashboard";
  TAB = "overview";
  updateTabButtons();
};
