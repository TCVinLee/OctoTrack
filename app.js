const BASE_API_URL = "https://api.octopus.energy/v1/";
const FLEXIBLE_PLAN = "VAR-22-11-01";
const STORAGE_KEYS = {
  postcode: "postcode",
  plan: "plan",
  showGas: "showGas",
  historyDays: "historyDays",
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

const storedHistoryDays = Number(localStorage.getItem(STORAGE_KEYS.historyDays));
const state = {
  postcode: localStorage.getItem(STORAGE_KEYS.postcode) || "",
  plan: localStorage.getItem(STORAGE_KEYS.plan) || "",
  showGas: localStorage.getItem(STORAGE_KEYS.showGas) !== "false",
  historyDays: storedHistoryDays === 14 ? 14 : 7,
  planFullName: null,
  planDisplayName: null,
  rates: {
    electricity: { today: null, tomorrow: null, error: null, loading: false },
    gas: { today: null, tomorrow: null, error: null, loading: false }
  },
  history: { records: [], error: null, loading: false },
  flexible: { rate: null, error: null, loading: false }
};

const els = {};
let historyChart = null;

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  setupEvents();
  populatePlanOptions();
  render();
  loadAllPlanNames();

  if (state.postcode && state.plan) {
    refreshAll();
  }

  if (window.lucide) window.lucide.createIcons();
});

function cacheElements() {
  Object.assign(els, {
    menuButton: document.querySelector("#menuButton"),
    menuPopover: document.querySelector("#menuPopover"),
    menuScrim: document.querySelector("#menuScrim"),
    openSettings: document.querySelector("#openSettings"),
    openDisclaimer: document.querySelector("#openDisclaimer"),
    setupSettingsButton: document.querySelector("#setupSettingsButton"),
    appShell: document.querySelector("#appShell"),
    settingsDialog: document.querySelector("#settingsDialog"),
    disclaimerDialog: document.querySelector("#disclaimerDialog"),
    settingsForm: document.querySelector("#settingsForm"),
    postcodeInput: document.querySelector("#postcodeInput"),
    postcodeError: document.querySelector("#postcodeError"),
    planSelect: document.querySelector("#planSelect"),
    showGasInput: document.querySelector("#showGasInput"),
    showGasLabel: document.querySelector("#showGasLabel"),
    saveSettings: document.querySelector("#saveSettings"),
    loadingState: document.querySelector("#loadingState"),
    electricityError: document.querySelector("#electricityError"),
    gasError: document.querySelector("#gasError"),
    setupMessage: document.querySelector("#setupMessage"),
    rateDashboard: document.querySelector("#rateDashboard"),
    gasCard: document.querySelector("#gasCard"),
    planName: document.querySelector("#planName"),
    postcodeDisplay: document.querySelector("#postcodeDisplay"),
    electricityToday: document.querySelector("#electricityToday"),
    electricityTomorrow: document.querySelector("#electricityTomorrow"),
    electricityTodayMissing: document.querySelector("#electricityTodayMissing"),
    electricityTomorrowMissing: document.querySelector("#electricityTomorrowMissing"),
    electricityTrend: document.querySelector("#electricityTrend"),
    gasToday: document.querySelector("#gasToday"),
    gasTomorrow: document.querySelector("#gasTomorrow"),
    gasTodayMissing: document.querySelector("#gasTodayMissing"),
    gasTomorrowMissing: document.querySelector("#gasTomorrowMissing"),
    gasTrend: document.querySelector("#gasTrend"),
    currentElectricityRate: document.querySelector("#currentElectricityRate"),
    flexibleRate: document.querySelector("#flexibleRate"),
    flexibleComparisonResult: document.querySelector("#flexibleComparisonResult"),
    historyCaption: document.querySelector("#historyCaption"),
    historyChart: document.querySelector("#historyChart"),
    historyLoading: document.querySelector("#historyLoading"),
    historyEmpty: document.querySelector("#historyEmpty"),
    historyOptions: [...document.querySelectorAll(".history-option")],
    refreshButton: document.querySelector("#refreshButton")
  });
}

function setupEvents() {
  els.menuButton.addEventListener("click", () => setMenuOpen(true));
  els.menuScrim.addEventListener("click", () => setMenuOpen(false));
  els.openSettings.addEventListener("click", openSettingsFromMenu);
  els.setupSettingsButton.addEventListener("click", openSettingsFromMenu);
  els.openDisclaimer.addEventListener("click", () => {
    setMenuOpen(false);
    els.disclaimerDialog.showModal();
  });
  els.refreshButton.addEventListener("click", refreshAll);
  els.showGasInput.addEventListener("change", () => {
    state.showGas = els.showGasInput.checked;
    localStorage.setItem(STORAGE_KEYS.showGas, String(state.showGas));
    render();
    if (state.postcode && state.plan && state.showGas && !state.rates.gas.today) refreshAll();
  });
  els.historyOptions.forEach((button) => {
    button.addEventListener("click", () => {
      const days = Number(button.dataset.days);
      if (days !== 7 && days !== 14) return;
      state.historyDays = days;
      localStorage.setItem(STORAGE_KEYS.historyDays, String(days));
      renderHistoryControls();
      if (state.postcode && state.plan) loadHistory();
    });
  });
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
  els.appShell.classList.toggle("menu-open", open);
}

function openSettingsFromMenu() {
  setMenuOpen(false);
  openSettingsDialog();
}

function openSettingsDialog() {
  els.postcodeInput.value = state.postcode;
  els.planSelect.value = state.plan || AVAILABLE_PLANS[0];
  els.showGasInput.checked = state.showGas;
  els.postcodeError.classList.add("hidden");
  els.settingsDialog.showModal();
}

function populatePlanOptions(planNameMap = {}) {
  els.planSelect.innerHTML = "";
  for (const code of AVAILABLE_PLANS) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = planNameMap[code] ? `${planNameMap[code]} (${code})` : `Loading... (${code})`;
    els.planSelect.append(option);
  }
  els.planSelect.value = state.plan || AVAILABLE_PLANS[0];
}

async function loadAllPlanNames() {
  const entries = await Promise.all(AVAILABLE_PLANS.map(async (code) => [code, await fetchTrimmedPlanName(code)]));
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
    state.showGas = els.showGasInput.checked;
    localStorage.setItem(STORAGE_KEYS.postcode, postcode);
    localStorage.setItem(STORAGE_KEYS.plan, plan);
    localStorage.setItem(STORAGE_KEYS.showGas, String(state.showGas));
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
  state.rates.gas = { today: null, tomorrow: null, error: null, loading: state.showGas };
  state.history = { records: [], error: null, loading: true };
  state.flexible = { rate: null, error: null, loading: true };
  render();

  const planPromise = fetchPlanFullName(state.plan);
  const electricityPromise = fetchTariff("electricity", state.postcode, state.plan);
  const gasPromise = state.showGas ? fetchTariff("gas", state.postcode, state.plan) : null;
  const historyPromise = fetchHistory(state.postcode, state.plan, state.historyDays);
  const flexiblePromise = fetchFlexibleRate(state.postcode);

  try {
    const planInfo = await planPromise;
    state.planFullName = planInfo.fullName;
    state.planDisplayName = planInfo.displayName;
  } catch {
    state.planFullName = null;
    state.planDisplayName = null;
  }

  const [electricity, gas, history, flexible] = await Promise.all([
    Promise.allSettled([electricityPromise]),
    gasPromise ? Promise.allSettled([gasPromise]) : Promise.resolve([{ status: "skipped" }]),
    Promise.allSettled([historyPromise]),
    Promise.allSettled([flexiblePromise])
  ]);

  applyTariffResult("electricity", electricity[0]);
  if (state.showGas) applyTariffResult("gas", gas[0]);
  applyHistoryResult(history[0]);
  applyFlexibleResult(flexible[0]);
  render();
}

async function loadHistory() {
  if (!state.postcode || !state.plan) return;
  state.history.loading = true;
  state.history.error = null;
  renderHistoryControls();
  try {
    state.history.records = await fetchHistory(state.postcode, state.plan, state.historyDays);
  } catch (error) {
    state.history.records = [];
    state.history.error = error.message || "Could not load historic data";
  } finally {
    state.history.loading = false;
    renderHistoryControls();
    renderHistoryChart();
  }
}

function applyTariffResult(type, result) {
  state.rates[type].loading = false;
  if (result.status === "fulfilled") {
    state.rates[type].today = result.value.today;
    state.rates[type].tomorrow = result.value.tomorrow;
    state.rates[type].error = null;
    notifyIfTomorrowRateChanged(type, result.value.tomorrow);
  } else if (result.status !== "skipped") {
    state.rates[type].today = null;
    state.rates[type].tomorrow = null;
    state.rates[type].error = `Failed to load ${type} tariff. ${result.reason?.message || ""}`.trim();
  }
}

function applyHistoryResult(result) {
  state.history.loading = false;
  if (result.status === "fulfilled") {
    state.history.records = result.value;
    state.history.error = null;
  } else {
    state.history.records = [];
    state.history.error = result.reason?.message || "Could not load historic data";
  }
}

function applyFlexibleResult(result) {
  state.flexible.loading = false;
  if (result.status === "fulfilled") {
    state.flexible.rate = result.value;
    state.flexible.error = null;
  } else {
    state.flexible.rate = null;
    state.flexible.error = result.reason?.message || "Flexible price unavailable";
  }
}

async function fetchPlanFullName(plan) {
  const response = await getJson(`${BASE_API_URL}products/${encodeURIComponent(plan.toUpperCase())}/`);
  return { fullName: response.full_name || null, displayName: response.display_name || null };
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
  const data = await fetchTariffResults(type, postcode, plan);
  return findTodayAndTomorrow(data.results);
}

async function fetchHistory(postcode, plan, days) {
  const data = await fetchTariffResults("electricity", postcode, plan, {
    period_from: new Date(Date.now() - days * 86400000).toISOString(),
    period_to: new Date().toISOString()
  });
  return normalizeRecords(data.results).sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));
}

async function fetchTariffResults(type, postcode, plan, query = {}) {
  const region = await fetchRegionCode(postcode);
  const planCode = plan.toUpperCase();
  const tariffPrefix = type === "electricity" ? "E-1R" : "G-1R";
  const resource = type === "electricity" ? "electricity-tariffs" : "gas-tariffs";
  const tariffCode = `${tariffPrefix}-${planCode}-${region}`;
  const url = `${BASE_API_URL}products/${planCode}/${resource}/${tariffCode}/standard-unit-rates/`;
  return getJson(`${url}${toQueryString(query)}`);
}

async function fetchFlexibleRate(postcode) {
  const region = await fetchRegionCode(postcode);
  const tariffCode = `E-1R-${FLEXIBLE_PLAN}-${region}`;
  const url = `${BASE_API_URL}products/${FLEXIBLE_PLAN}/electricity-tariffs/${tariffCode}/standard-unit-rates/`;
  const data = await getJson(url);
  const records = normalizeRecords(data.results)
    .filter((item) => item.payment_method === "DIRECT_DEBIT")
    .sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from));
  const latest = records[0];
  if (!latest) throw new Error("No DIRECT_DEBIT flexible rate found");
  return Number(latest.value_inc_vat);
}

function findTodayAndTomorrow(results) {
  const sorted = normalizeRecords(results).sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from));
  const todayKey = dateKeyForUk(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKeyForUk(tomorrow);
  const output = { today: null, tomorrow: null };

  for (const item of sorted) {
    const fromKey = dateKeyForUk(new Date(item.valid_from));
    if (output.today === null && fromKey === todayKey) output.today = Number(item.value_inc_vat);
    if (output.tomorrow === null && fromKey === tomorrowKey) output.tomorrow = Number(item.value_inc_vat);
    if (output.today !== null && output.tomorrow !== null) break;
  }
  return output;
}

function normalizeRecords(results) {
  return Array.isArray(results) ? results.filter((item) => item.valid_from && item.value_inc_vat !== undefined) : [];
}

function toQueryString(query) {
  const entries = Object.entries(query);
  return entries.length ? `?${new URLSearchParams(query).toString()}` : "";
}

async function fetchRegionCode(postcode) {
  const url = `${BASE_API_URL}industry/grid-supply-points/?postcode=${encodeURIComponent(postcode)}`;
  const data = await getJson(url);
  const results = Array.isArray(data.results) ? data.results : [];
  if (!results.length) throw new Error("No result found for postcode");
  const rawRegionCode = results[0].group_id;
  if (!rawRegionCode) throw new Error("Missing region code");
  return String(rawRegionCode).replace(/^_+|_+$/g, "").toUpperCase();
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function notifyIfTomorrowRateChanged(type, tomorrowRate) {
  if (tomorrowRate === null || Number.isNaN(tomorrowRate)) return;
  const key = type === "electricity" ? STORAGE_KEYS.electricityTomorrowRate : STORAGE_KEYS.gasTomorrowRate;
  const previous = Number(localStorage.getItem(key));
  if (previous === tomorrowRate) return;
  localStorage.setItem(key, String(tomorrowRate));
  sendNotification(tomorrowRate, type);
}

async function sendNotification(price, type) {
  if (!("Notification" in window)) return;
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission === "granted") {
    new Notification(`Tomorrow ${type} tariff available!`, { body: `Tomorrow price is ${price.toFixed(2)}p/kWh.` });
  }
}

function trimPlanName(fullName, displayName) {
  if (!fullName) return null;
  if (displayName && fullName.includes(displayName)) return fullName.replace(displayName, "").replace(/^[\s:-]+|[\s:-]+$/g, "");
  return fullName;
}

function dateKeyForUk(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function render() {
  const hasSetup = Boolean(state.postcode && state.plan);
  const anyLoading = state.rates.electricity.loading || state.rates.gas.loading;
  els.appShell.classList.toggle("is-configured", hasSetup);
  els.appShell.classList.toggle("is-loading", anyLoading);
  els.loadingState.classList.toggle("hidden", !anyLoading);
  els.setupMessage.classList.toggle("hidden", hasSetup);
  els.rateDashboard.classList.toggle("hidden", !hasSetup);
  els.gasCard.classList.toggle("hidden", !state.showGas);
  els.refreshButton.disabled = anyLoading;
  els.refreshButton.querySelector("span").textContent = anyLoading ? "Updating rates..." : "Refresh rates";
  els.showGasInput.checked = state.showGas;
  els.showGasLabel.textContent = state.showGas ? "Display Gas tariff" : "Gas tariff hidden";

  els.planName.textContent = trimPlanName(state.planFullName, state.planDisplayName) || `Plan Code: ${state.plan.toUpperCase()}`;
  els.postcodeDisplay.textContent = `Postcode: ${state.postcode}`;
  renderRate("electricity", els.electricityToday, els.electricityTodayMissing, "today");
  renderRate("electricity", els.electricityTomorrow, els.electricityTomorrowMissing, "tomorrow");
  renderRate("gas", els.gasToday, els.gasTodayMissing, "today");
  renderRate("gas", els.gasTomorrow, els.gasTomorrowMissing, "tomorrow");
  renderTrend("electricity", els.electricityTrend);
  renderTrend("gas", els.gasTrend);
  renderFlexibleComparison();
  renderHistoryControls();
  renderHistoryChart();
  renderError(els.electricityError, state.rates.electricity.error);
  renderError(els.gasError, state.rates.gas.error);
  if (window.lucide) window.lucide.createIcons();
}

function renderRate(type, valueEl, missingEl, period) {
  const value = state.rates[type][period];
  const line = valueEl.closest(".rate-line");
  const hasValue = value !== null && !Number.isNaN(value);
  line.classList.toggle("hidden", !hasValue);
  missingEl.classList.toggle("hidden", hasValue);
  if (hasValue) valueEl.textContent = value.toFixed(2);
}

function renderTrend(type, element) {
  const today = state.rates[type].today;
  const tomorrow = state.rates[type].tomorrow;
  if (today === null || tomorrow === null || Number.isNaN(today) || Number.isNaN(tomorrow)) {
    element.classList.add("hidden");
    return;
  }
  const difference = tomorrow - today;
  if (difference === 0) {
    element.textContent = "Tomorrow is unchanged";
    element.className = "rate-trend neutral";
  } else if (difference > 0) {
    element.textContent = `Tomorrow is ${difference.toFixed(2)}p higher ↑`;
    element.className = "rate-trend higher";
  } else {
    element.textContent = `Tomorrow is ${Math.abs(difference).toFixed(2)}p lower ↓`;
    element.className = "rate-trend lower";
  }
}

function renderFlexibleComparison() {
  const current = state.rates.electricity.today;
  const flexible = state.flexible.rate;
  els.currentElectricityRate.textContent = current === null ? "--" : current.toFixed(2);
  els.flexibleRate.textContent = flexible === null ? "--" : flexible.toFixed(2);
  els.flexibleComparisonResult.className = "comparison-result";
  if (current === null || flexible === null || Number.isNaN(current) || Number.isNaN(flexible)) {
    els.flexibleComparisonResult.textContent = state.flexible.loading ? "Comparing with Flexible Octopus..." : "Flexible price comparison unavailable.";
    return;
  }
  const percentage = Math.abs(current - flexible) / flexible * 100;
  if (current < flexible) {
    els.flexibleComparisonResult.textContent = `Your tariff is ${percentage.toFixed(1)}% cheaper than Flexible today.`;
    els.flexibleComparisonResult.classList.add("cheaper");
  } else if (current > flexible) {
    els.flexibleComparisonResult.textContent = `Your tariff is ${percentage.toFixed(1)}% more expensive than Flexible today.`;
    els.flexibleComparisonResult.classList.add("more-expensive");
  } else {
    els.flexibleComparisonResult.textContent = "Your tariff matches Flexible today.";
    els.flexibleComparisonResult.classList.add("neutral");
  }
}

function renderHistoryControls() {
  els.historyCaption.textContent = `Past ${state.historyDays} days`;
  els.historyOptions.forEach((button) => button.classList.toggle("active", Number(button.dataset.days) === state.historyDays));
  els.historyLoading.classList.toggle("hidden", !state.history.loading);
  els.historyEmpty.classList.toggle("hidden", state.history.loading || state.history.records.length > 0);
}

function renderHistoryChart() {
  if (!window.Chart || !els.historyChart || !state.history.records.length) {
    if (historyChart) historyChart.destroy();
    historyChart = null;
    return;
  }
  if (historyChart) historyChart.destroy();
  const labels = state.history.records.map((item) => new Date(item.valid_from).toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
  const rates = state.history.records.map((item) => Number(item.value_inc_vat));
  const flexible = rates.map(() => state.flexible.rate);
  historyChart = new Chart(els.historyChart, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Electricity tariff", data: rates, borderColor: "#66ffcc", backgroundColor: "rgba(102, 255, 204, 0.12)", fill: true, tension: 0.3, pointRadius: 2 },
        { label: "Flexible Octopus", data: flexible, borderColor: "#ffa62b", borderDash: [7, 5], pointRadius: 0, fill: false, tension: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${Number(context.raw).toFixed(2)}p/kWh` } } },
      scales: {
        x: { ticks: { color: "rgba(255,255,255,0.65)", maxTicksLimit: 8 }, grid: { display: false } },
        y: { ticks: { color: "rgba(255,255,255,0.65)", callback: (value) => `${value}p` }, grid: { color: "rgba(255,255,255,0.06)" } }
      }
    }
  });
}

function renderError(element, message) {
  element.classList.toggle("hidden", !message);
  element.textContent = message || "";
}
