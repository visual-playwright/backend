const VALID_SCENARIOS = ["R-01", "R-02", "R-03", "R-04", "R-05"];

function isValidScenario(s) {
  return VALID_SCENARIOS.includes(s);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// result_{domain}_{r}_{YYYY-MM-DD}_{HH-mm} (WIB, dari waktu mulai run)
// Tanpa ekstensi — user tidak peduli format simpan internal (JSON).
function buildResultName(domain, scenarioId, date = new Date()) {
  const slug = String(domain).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `result_${slug}_${scenarioId}_${y}-${m}-${d}_${h}-${min}`;
}

module.exports = { VALID_SCENARIOS, isValidScenario, buildResultName };
