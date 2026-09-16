const db = require("../../config/db");
const { randomUUID } = require("crypto");
const { normalizeRunRow, normalizeStepRow } = require("../utils/time");

async function create({ result_name, domain, url, username, password, scenario_id, rendered_prompt }) {
  const id = randomUUID();
  await db.query(
    "INSERT INTO runs (id, result_name, domain, url, username, password, scenario_id, status, rendered_prompt, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, UTC_TIMESTAMP())",
    [id, result_name, domain, url, username, password, scenario_id, rendered_prompt]
  );
  return id;
}

async function list({ domain, scenario }) {
  let sql = "SELECT id, result_name, domain, scenario_id, status, total_steps, steps_passed, executable_rate, goal_achieved, token_total, cost_usd, started_at, finished_at, (SELECT screenshot_path FROM run_steps WHERE run_id = runs.id AND screenshot_path IS NOT NULL ORDER BY no DESC LIMIT 1) AS latest_screenshot FROM runs WHERE 1=1";
  const params = [];
  if (domain) {
    sql += " AND domain = ?";
    params.push(domain.toLowerCase());
  }
  if (scenario) {
    sql += " AND scenario_id = ?";
    params.push(scenario);
  }
  sql += " ORDER BY started_at DESC LIMIT 200";
  const [rows] = await db.query(sql, params);
  // Jangan bocorkan username/password di list
  return rows.map(normalizeRunRow);
}

async function saveSession(id, sessionId) {
  await db.query("UPDATE runs SET opencode_session = ? WHERE id = ?", [sessionId, id]);
}

async function addUsage(id, usage) {
  if (!usage) return;
  await db.query(
    "UPDATE runs SET token_input = token_input + ?, token_output = token_output + ?, token_reasoning = token_reasoning + ?, token_total = token_total + ?, cost_usd = cost_usd + ? WHERE id = ?",
    [usage.input || 0, usage.output || 0, usage.reasoning || 0, (usage.input || 0) + (usage.output || 0) + (usage.reasoning || 0), usage.cost || 0, id]
  );
}

async function findWithSteps(id) {
  const [runs] = await db.query(
    "SELECT id, result_name, domain, url, scenario_id, status, total_steps, steps_passed, executable_rate, goal_achieved, dynamic_reasoning_count, entity_name, data_contoh, opencode_session, token_input, token_output, token_reasoning, token_total, cost_usd, started_at, finished_at FROM runs WHERE id = ? LIMIT 1",
    [id]
  );
  if (!runs.length) return null;
  const [steps] = await db.query(
    "SELECT no, instruction, visual_element, status, dynamic_reasoning, notes, screenshot_path, created_at FROM run_steps WHERE run_id = ? ORDER BY no ASC",
    [id]
  );
  const run = normalizeRunRow({ ...runs[0] });
  run.steps = (steps || []).map(normalizeStepRow);
  return run;
}

// Untuk worker saja (berisi password + rendered_prompt, jangan expose via API)
async function findForWorker(id) {
  const [runs] = await db.query("SELECT * FROM runs WHERE id = ? LIMIT 1", [id]);
  return runs[0] || null;
}

async function markRunning(id) {
  await db.query("UPDATE runs SET status = 'RUNNING' WHERE id = ?", [id]);
}

async function finish(id, { status, total_steps, steps_passed, executable_rate, goal_achieved, dynamic_reasoning_count, entity_name, data_contoh }) {
  await db.query(
    "UPDATE runs SET status = ?, total_steps = ?, steps_passed = ?, executable_rate = ?, goal_achieved = ?, dynamic_reasoning_count = ?, entity_name = ?, data_contoh = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?",
    [status, total_steps, steps_passed, executable_rate, goal_achieved, dynamic_reasoning_count, entity_name || null, data_contoh || null, id]
  );
}

async function remove(id) {
  const [r] = await db.query("DELETE FROM runs WHERE id = ? AND status IN ('QUEUED','DONE','FAILED')", [id]);
  return r.affectedRows > 0;
}

module.exports = { create, list, findWithSteps, findForWorker, markRunning, finish, saveSession, addUsage, remove };
