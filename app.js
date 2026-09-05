const BASE_API_URL = "https://api.octopus.energy/v1/";
const STORAGE_KEYS = {
  postcode: "postcode",
  plan: "plan",
  electricityTomorrowRate: "electricityTomorrowRate",
  gasTomorrowRate: "gasTomorrowRate"
};

const AVAILABLE_PLANS = [
  "SILVER-24-04-03",
  "SILVER-24-07-01",
  "SILVER-24-10-01",
  "SILVER-24-12-31",
  "SILVER-25-04-11",
  "SILVER-25-04-15",
  "SILVER-25-09-02",
  "SILVER-26-04-01"
];

const state = {
  postcode: localStorage.getItem(STORAGE_KEYS.postcode) || "",
  plan: localStorage.getItem(STORAGE_KEYS.plan) || "",
  planFullName: null,
  planDisplayName: null,
  rates: {
    electricity: { today: null, tomorrow: null, error: null, loading: false },
    gas: { today: null, tomorrow: null, error: null, loading: false }
  }
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  setupEvents();
  populatePlanOptions();
  render();
  loadAllPlanNames();

  if (state.postcode && state.plan) {
    refreshAll();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

function cacheElements() {
  Object.assign(els, {
    menuButton: document.querySelector("#menuButton"),
    menuPopover: document.querySelector("#menuPopover"),
    menuScrim: document.querySelector("#menuScrim"),
    openSettings: document.querySelector("#openSettings"),
    openDisclaimer: document.querySelector("#openDisclaimer"),
    settingsDialog: document.querySelector("#settingsDialog"),
    disclaimerDialog: document.querySelector("#disclaimerDialog"),
    settingsForm: document.querySelector("#settingsForm"),
    postcodeInput: document.querySelector("#postcodeInput"),
    postcodeError: document.querySelector("#postcodeError"),
    planSelect: document.querySelector("#planSelect"),
    saveSettings: document.querySelector("#saveSettings"),
    loadingState: document.querySelector("#loadingState"),
    electricityError: document.querySelector("#electricityError"),
    gasError: document.querySelector("#gasError"),
    setupMessage: document.querySelector("#setupMessage"),
    rateDashboard: document.querySelector("#rateDashboard"),
    planName: document.querySelector("#planName"),
    postcodeDisplay: document.querySelector("#postcodeDisplay"),
    electricityToday: document.querySelector("#electricityToday"),
    electricityTomorrow: document.querySelector("#electricityTomorrow"),
    electricityTodayMissing: document.querySelector("#electricityTodayMissing"),
    electricityTomorrowMissing: document.querySelector("#electricityTomorrowMissing"),
    gasToday: document.querySelector("#gasToday"),
    gasTomorrow: document.querySelector("#gasTomorrow"),
    gasTodayMissing: document.querySelector("#gasTodayMissing"),
    gasTomorrowMissing: document.querySelector("#gasTomorrowMissing"),
    refreshButton: document.querySelector("#refreshButton")
  });
}

function setupEvents() {
  els.menuButton.addEventListener("click", () => setMenuOpen(true));
  els.menuScrim.addEventListener("click", () => setMenuOpen(false));
  els.openSettings.addEventListener("click", () => {
    setMenuOpen(false);
    openSettingsDialog();
  });
  els.openDisclaimer.addEventListener("click", () => {
    setMenuOpen(false);
    els.disclaimerDialog.showModal();
  });
  els.refreshButton.addEventListener("click", refreshAll);
  els.postcodeInput.addEventListener("input", () => {
    els.postcodeInput.value = els.postcodeInput.value.toUpperCase();
    els.postcodeError.classList.add("hidden");
  });
  els.settingsForm.addEventListener("submit", saveSettings);
}

function setMenuOpen(open) {
  els.menuButton.setAttribute("aria-expanded", String(open));
  els.menuPopover.classList.toggle("hidden", !open);
  els.menuScrim.classList.toggle("hidden", !open);
}

function openSettingsDialog() {
  els.postcodeInput.value = state.postcode;
  els.planSelect.value = state.plan || AVAILABLE_PLANS[0];
  els.postcodeError.classList.add("hidden");
  els.settingsDialog.showModal();
}

function populatePlanOptions(planNameMap = {}) {
  els.planSelect.innerHTML = "";
  for (const code of AVAILABLE_PLANS) {
    const option = document.createElement("option");
    option.value = code;
    const label = planNameMap[code] ? `${planNameMap[code]} (${code})` : `Loading... (${code})`;
    option.textContent = label;
    els.planSelect.append(option);
  }
  els.planSelect.value = state.plan || AVAILABLE_PLANS[0];
}

async function loadAllPlanNames() {
  const entries = await Promise.all(
    AVAILABLE_PLANS.map(async (code) => [code, await fetchTrimmedPlanName(code)])
  );
  populatePlanOptions(Object.fromEntries(entries));
}

async function saveSettings(event) {
  event.preventDefault();
  const postcode = els.postcodeInput.value.trim().toUpperCase();
  const plan = els.planSelect.value;

  if (!postcode) {
    els.postcodeError.textContent = "Invalid postcode. Please enter a valid UK postcode.";
    els.postcodeError.classList.remove("hidden");
    return;
  }

  els.saveSettings.disabled = true;
  els.saveSettings.querySelector("span").textContent = "Saving...";
  try {
    await fetchRegionCode(postcode);
    state.postcode = postcode;
    state.plan = plan;
    localStorage.setItem(STORAGE_KEYS.postcode, postcode);
    localStorage.setItem(STORAGE_KEYS.plan, plan);
    els.settingsDialog.close();
    render();
    await refreshAll();
  } catch {
    els.postcodeError.textContent = "Invalid postcode. Please enter a valid UK postcode.";
    els.postcodeError.classList.remove("hidden");
  } finally {
    els.saveSettings.disabled = false;
    els.saveSettings.querySelector("span").textContent = "Save";
  }
}

async function refreshAll() {
  if (!state.postcode || !state.plan) {
    render();
    return;
  }

  state.rates.electricity = { today: null, tomorrow: null, error: null, loading: true };
  state.rates.gas = { today: null, tomorrow: null, error: null, loading: true };
  render();

  const planPromise = fetchPlanFullName(state.plan);
  const electricityPromise = fetchTariff("electricity", state.postcode, state.plan);
  const gasPromise = fetchTariff("gas", state.postcode, state.plan);

  try {
    const planInfo = await planPromise;
    state.planFullName = planInfo.fullName;
    state.planDisplayName = planInfo.displayName;
  } catch {
    state.planFullName = null;
    state.planDisplayName = null;
  }

  const [electricity, gas] = await Promise.allSettled([electricityPromise, gasPromise]);
  applyTariffResult("electricity", electricity);
  applyTariffResult("gas", gas);
  render();
}

function applyTariffResult(type, result) {
  state.rates[type].loading = false;
  if (result.status === "fulfilled") {
    state.rates[type].today = result.value.today;
    state.rates[type].tomorrow = result.value.tomorrow;
    state.rates[type].error = null;
    notifyIfTomorrowRateChanged(type, result.value.tomorrow);
  } else {
    state.rates[type].today = null;
    state.rates[type].tomorrow = null;
    state.rates[type].error = `Failed to load ${type} tariff. ${result.reason?.message || ""}`.trim();
  }
}

async function fetchPlanFullName(plan) {
  const response = await getJson(`${BASE_API_URL}products/${encodeURIComponent(plan.toUpperCase())}/`);
  return {
    fullName: response.full_name || null,
    displayName: response.display_name || null
  };
}

async function fetchTrimmedPlanName(plan) {
  try {
    const info = await fetchPlanFullName(plan);
    return trimPlanName(info.fullName, info.displayName) || plan;
  } catch {
    return plan;
  }
}

async function fetchTariff(type, postcode, plan) {
  const region = await fetchRegionCode(postcode);
  const planCode = plan.toUpperCase();
  const tariffPrefix = type === "electricity" ? "E-1R" : "G-1R";
  const resource = type === "electricity" ? "electricity-tariffs" : "gas-tariffs";
  const tariffCode = `${tariffPrefix}-${planCode}-${region}`;
  const url = `${BASE_API_URL}products/${planCode}/${resource}/${tariffCode}/standard-unit-rates/`;
  const data = await getJson(url);
  const results = Array.isArray(data.results) ? data.results : [];
  const sorted = results
    .slice()
    .sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from))
    .slice(0, 5);

  const todayKey = dateKeyForUk(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKeyForUk(tomorrow);

  const output = { today: null, tomorrow: null };
  for (const item of sorted) {
    const fromKey = dateKeyForUk(new Date(item.valid_from));
    if (output.today === null && fromKey === todayKey) {
      output.today = Number(item.value_inc_vat);
    } else if (output.tomorrow === null && fromKey === tomorrowKey) {
      output.tomorrow = Number(item.value_inc_vat);
    }
  }
  return output;
}

async function fetchRegionCode(postcode) {
  const url = `${BASE_API_URL}industry/grid-supply-points/?postcode=${encodeURIComponent(postcode)}`;
  const data = await getJson(url);
  const results = Array.isArray(data.results) ? data.results : [];
  if (!results.length) {
    throw new Error("No result found for postcode");
  }

  const rawRegionCode = results[0].group_id;
  if (!rawRegionCode) {
    throw new Error("Missing region code");
  }
  return String(rawRegionCode).replace(/^_+|_+$/g, "").toUpperCase();
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function notifyIfTomorrowRateChanged(type, tomorrowRate) {
  if (tomorrowRate === null || Number.isNaN(tomorrowRate)) {
    return;
  }

  const key = type === "electricity" ? STORAGE_KEYS.electricityTomorrowRate : STORAGE_KEYS.gasTomorrowRate;
  const previous = Number(localStorage.getItem(key));
  if (previous === tomorrowRate) {
    return;
  }

  localStorage.setItem(key, String(tomorrowRate));
  sendNotification(tomorrowRate, type);
}

async function sendNotification(price, type) {
  if (!("Notification" in window)) {
    return;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission === "granted") {
    new Notification(`Tomorrow ${type} tariff available!`, {
      body: `Tomorrow price is ${price.toFixed(2)}p/kWh.`
    });
  }
}

function trimPlanName(fullName, displayName) {
  if (!fullName) {
    return null;
  }
  if (displayName && fullName.includes(displayName)) {
    return fullName.replace(displayName, "").replace(/^[\s:-]+|[\s:-]+$/g, "");
  }
  return fullName;
}

function dateKeyForUk(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function render() {
  const hasSetup = Boolean(state.postcode && state.plan);
  const anyLoading = state.rates.electricity.loading || state.rates.gas.loading;
  els.loadingState.classList.toggle("hidden", !anyLoading);
  els.setupMessage.classList.toggle("hidden", hasSetup);
  els.rateDashboard.classList.toggle("hidden", !hasSetup);
  els.refreshButton.disabled = anyLoading;

  els.planName.textContent = trimPlanName(state.planFullName, state.planDisplayName) || `Plan Code: ${state.plan.toUpperCase()}`;
  els.postcodeDisplay.textContent = `Postcode: ${state.postcode}`;

  renderRate("electricity", els.electricityToday, els.electricityTodayMissing, "today");
  renderRate("electricity", els.electricityTomorrow, els.electricityTomorrowMissing, "tomorrow");
  renderRate("gas", els.gasToday, els.gasTodayMissing, "today");
  renderRate("gas", els.gasTomorrow, els.gasTomorrowMissing, "tomorrow");

  renderError(els.electricityError, state.rates.electricity.error);
  renderError(els.gasError, state.rates.gas.error);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderRate(type, valueEl, missingEl, period) {
  const value = state.rates[type][period];
  const line = valueEl.closest(".rate-line");
  const hasValue = value !== null && !Number.isNaN(value);
  line.classList.toggle("hidden", !hasValue);
  missingEl.classList.toggle("hidden", hasValue);
  if (hasValue) {
    valueEl.textContent = value.toFixed(2);
  }
}

function renderError(el, message) {
  el.classList.toggle("hidden", !message);
  el.textContent = message || "";
}
