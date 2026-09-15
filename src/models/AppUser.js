const db = require("../../config/db");
const { randomUUID } = require("crypto");

// Active-Record raw SQL (pola models lainnya)
async function findByUsername(username) {
  const [rows] = await db.query("SELECT * FROM app_users WHERE username = ? LIMIT 1", [username]);
  return rows[0] || null;
}

async function upsertAdmin(username, passwordHash) {
  await db.query(
    "INSERT INTO app_users (id, username, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
    [randomUUID(), username, passwordHash]
  );
}

module.exports = { findByUsername, upsertAdmin };
