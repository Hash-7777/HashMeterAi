let ONBOARDING_NAME = "";

function initOnboarding() {
  const host = g("onboarding");
  host.classList.remove("hidden");

  const input = g("onb-name");
  input.focus();

  input.addEventListener("input", function () {
    ONBOARDING_NAME = input.value.trim();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") submitName();
  });

  g("onb-go").onclick = submitName;
}

async function submitName() {
  const name = ONBOARDING_NAME;
  if (!name || name.length < 1 || name.length > 40) {
    const input = g("onb-name");
    const err = g("onb-err");
    err.textContent = "Please enter a name (1-40 characters).";
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 400);
    return;
  }
  g("onb-err").textContent = "";

  const display = name.charAt(0).toUpperCase() + name.slice(1);
  await setName(display);
  window.USER_NAME = display;
  const host = g("onboarding");
  host.style.opacity = "0";
  setTimeout(function () {
    host.classList.add("hidden");
    host.style.opacity = "";
    showApp();
  }, 350);
}
