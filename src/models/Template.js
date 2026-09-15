const db = require("../../config/db");

// Active-Record raw SQL (pola webMikobot/src/models/User.js)
async function list() {
  const [rows] = await db.query("SELECT id, title, updated_at FROM templates ORDER BY id ASC");
  return rows;
}

async function findById(id) {
  const [rows] = await db.query("SELECT * FROM templates WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function updateContent(id, content) {
  const [r] = await db.query("UPDATE templates SET content_md = ?, updated_at = NOW() WHERE id = ?", [content, id]);
  return r.affectedRows > 0;
}

async function upsert(id, title, content) {
  await db.query(
    "INSERT INTO templates (id, title, content_md, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE title = VALUES(title), content_md = VALUES(content_md), updated_at = NOW()",
    [id, title, content]
  );
}

module.exports = { list, findById, updateContent, upsert };
