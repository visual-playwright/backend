require("dotenv").config();
const mysql = require("mysql2/promise");
const { loadRaw, cleanLegacyPlaceholders } = require("../services/templateService");

const TITLES = {
  "R-01": "Login",
  "R-02": "Create",
  "R-03": "Update",
  "R-04": "Delete",
  "R-05": "Logout",
};

async function main() {
  // Buat database bila belum ada (koneksi tanpa database dulu)
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  const admin = await mysql.createConnection({
    host: DB_HOST, user: DB_USER, password: DB_PASSWORD,
    port: DB_PORT ? Number(DB_PORT) : 3306,
  });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  const Template = require("../models/Template");
  // Placeholder PROJECT_ID/MODEL dibersihkan saat seed (keputusan: dibuang total)
  for (const [id, title] of Object.entries(TITLES)) {
    const raw = loadRaw(id);
    await Template.upsert(id, title, cleanLegacyPlaceholders(raw));
    console.log(`seeded ${id}`);
  }
  const db = require("../../config/db");
  const [n] = await db.query("SELECT COUNT(*) c FROM templates");
  console.log("templates:", n[0].c);

  // Seed admin web app (login tunggal, tanpa logout)
  const bcrypt = require("bcryptjs");
  const AppUser = require("../models/AppUser");
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASS || "admin123";
  if (!process.env.ADMIN_PASS) console.log("PERINGATAN: ADMIN_PASS kosong, pakai default admin123 — ganti di .env");
  await AppUser.upsertAdmin(adminUser, await bcrypt.hash(adminPass, 10));
  console.log("admin:", adminUser);
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed gagal:", e.message);
  process.exit(1);
});
