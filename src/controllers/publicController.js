const db = require("../../config/db");
const { normalizeRunRow } = require("../utils/time");

// Sorotan publik: 1 run DONE terbaru yang punya screenshot.
// Tanpa username/password/rendered_prompt — aman dibuka tanpa auth.
async function latest(req, res) {
  try {
    const [rows] = await db.query(
      "SELECT id, result_name, domain, scenario_id, executable_rate, steps_passed, total_steps, goal_achieved, token_total, cost_usd, finished_at, (SELECT screenshot_path FROM run_steps WHERE run_id = runs.id AND screenshot_path IS NOT NULL ORDER BY no DESC LIMIT 1) AS latest_screenshot FROM runs WHERE status = 'DONE' ORDER BY finished_at DESC LIMIT 1"
    );
    const row = rows[0] ? normalizeRunRow({ ...rows[0] }) : null;
    if (!row || !row.latest_screenshot) {
      return res.json({ message: "Belum ada run publik", data: null });
    }
    const [steps] = await db.query(
      "SELECT no, screenshot_path FROM run_steps WHERE run_id = ? AND screenshot_path IS NOT NULL ORDER BY no DESC LIMIT 3",
      [row.id]
    );
    delete row.id;
    row.steps_preview = steps.reverse();
    res.json({ message: "Berhasil", data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal mengambil sorotan" });
  }
}

module.exports = { latest };
