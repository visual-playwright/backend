const fs = require("fs");
const path = require("path");

// 1 run = 1 file prompting-r{x}.md ; pilihan file = skenario (tanpa variabel skenario di isi)
const SCENARIO_FILES = {
  "R-01": "prompting-r1.md",
  "R-02": "prompting-r2.md",
  "R-03": "prompting-r3.md",
  "R-04": "prompting-r4.md",
  "R-05": "prompting-r5.md",
};

function loadRaw(scenarioId) {
  const file = SCENARIO_FILES[scenarioId];
  if (!file) throw new Error("Skenario tidak dikenal");
  return fs.readFileSync(path.join(__dirname, "../../templates", file), "utf8");
}

// Bersihkan placeholder lama yang sudah dibuang (PROJECT_ID, MODEL_NAME)
function cleanLegacyPlaceholders(md) {
  return md
    .replace(/\{\{PROJECT_ID\}\}/g, "-")
    .replace(/\{\{MODEL_NAME\}\}/g, "muse-spark-1.3-free");
}

// Satu prompt gabungan: template md + nilai template-chat (pola manual ditempel jadi satu konteks)
function renderTemplate(scenarioId, { domain, url, username, password }) {
  let md = loadRaw(scenarioId);
  md = cleanLegacyPlaceholders(md);
  md = md
    .replace(/\{\{APP_DOMAIN\}\}/g, domain)
    .replace(/\{\{URL\}\}/g, url)
    .replace(/\{\{USERNAME\}\}/g, username)
    .replace(/\{\{PASSWORD\}\}/g, password);
  return md;
}

module.exports = { SCENARIO_FILES, loadRaw, cleanLegacyPlaceholders, renderTemplate };
