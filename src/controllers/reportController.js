const Run = require("../models/Run");

// Hasil run result_{domain}_{r}_{date}_{time} untuk ditampilkan di web
async function detail(req, res) {
  try {
    const run = await Run.findWithSteps(req.params.id);
    if (!run) return res.status(404).json({ message: "Report tidak ditemukan" });
    const { steps, ...meta } = run;
    res.json({
      result_name: meta.result_name,
      domain: meta.domain,
      scenario_id: meta.scenario_id,
      url: meta.url,
      total_steps: meta.total_steps,
      steps_passed: meta.steps_passed,
      executable_rate: meta.executable_rate,
      goal_achieved: meta.goal_achieved,
      dynamic_reasoning_count: meta.dynamic_reasoning_count,
      entity_name: meta.entity_name,
      data_contoh: meta.data_contoh,
      token_input: meta.token_input,
      token_output: meta.token_output,
      token_reasoning: meta.token_reasoning,
      token_total: meta.token_total,
      cost_usd: meta.cost_usd,
      started_at: meta.started_at,
      finished_at: meta.finished_at,
      steps: steps || [],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal mengambil report" });
  }
}

module.exports = { detail };
