const db = require("../../config/db");
const { randomUUID } = require("crypto");

async function add({ run_id, no, instruction, visual_element, status, dynamic_reasoning, notes, screenshot_path }) {
  const id = randomUUID();
  await db.query(
    "INSERT INTO run_steps (id, run_id, no, instruction, visual_element, status, dynamic_reasoning, notes, screenshot_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, run_id, no, instruction, visual_element, status, dynamic_reasoning, notes, screenshot_path]
  );
  return id;
}

module.exports = { add };
