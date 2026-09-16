const db = require("../../config/db");
const { toISOZ } = require("../utils/time");

// Active-Record raw SQL (pola webMikobot/src/models/User.js)
async function list() {
  const [rows] = await db.query("SELECT id, title, updated_at FROM templates ORDER BY id ASC");
  return (rows || []).map((r) => ({ ...r, updated_at: toISOZ(r.updated_at) }));
}

async function findById(id) {
  const [rows] = await db.query("SELECT * FROM templates WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) return null;
  return { ...rows[0], updated_at: toISOZ(rows[0].updated_at) };
}

async function updateContent(id, content) {
  const [r] = await db.query("UPDATE templates SET content_md = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?", [content, id]);
  return r.affectedRows > 0;
}

async function upsert(id, title, content) {
  await db.query(
    "INSERT INTO templates (id, title, content_md, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE title = VALUES(title), content_md = VALUES(content_md), updated_at = UTC_TIMESTAMP()",
    [id, title, content]
  );
}

module.exports = { list, findById, updateContent, upsert };
