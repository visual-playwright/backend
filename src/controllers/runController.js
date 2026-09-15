const Run = require("../models/Run");
const { renderTemplate } = require("../services/templateService");
const { buildResultName, isValidScenario } = require("../utils/naming");

async function create(req, res) {
  try {
    const { domain, url, username, password, scenario_id } = req.body;
    if (!domain || !url || !username || !password || !scenario_id) {
      return res.status(400).json({ message: "domain, url, username, password, scenario_id wajib diisi" });
    }
    if (!isValidScenario(scenario_id)) {
      return res.status(400).json({ message: "scenario_id harus R-01 sampai R-05" });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ message: "URL tidak valid" });
    }

    const preview = renderTemplate(scenario_id, { domain, url, username, password });
    const resultName = buildResultName(domain, scenario_id, new Date());
    const runId = await Run.create({
      result_name: resultName,
      domain: domain.toLowerCase(),
      url,
      username,
      password,
      scenario_id,
      rendered_prompt: preview,
    });
    // Jalan async via worker; frontend polling GET /runs/:id.
    // Password tidak dikembalikan ke client.
    require("../services/runnerService").enqueue(runId);
    res.status(201).json({ message: "Run berhasil dibuat", data: { run_id: runId, result_name: resultName } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal membuat run" });
  }
}

async function list(req, res) {
  try {
    const rows = await Run.list({ domain: req.query.domain, scenario: req.query.scenario });
    res.json({ message: "Berhasil mengambil runs", data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal mengambil runs" });
  }
}

async function detail(req, res) {
  try {
    const run = await Run.findWithSteps(req.params.id);
    if (!run) return res.status(404).json({ message: "Run tidak ditemukan" });
    res.json({ message: "Berhasil mengambil run", data: run });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal mengambil run" });
  }
}

async function remove(req, res) {
  try {
    const ok = await Run.remove(req.params.id);
    if (!ok) {
      return res.status(404).json({ message: "Run tidak ditemukan atau sedang berjalan" });
    }
    const fs = require("fs");
    const path = require("path");
    fs.rm(path.join(__dirname, "../../storage/runs", req.params.id), { recursive: true, force: true }, () => {});
    res.json({ message: "Run berhasil dihapus" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal menghapus run" });
  }
}

module.exports = { create, list, detail, remove };
