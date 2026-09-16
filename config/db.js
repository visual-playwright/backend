const mysql = require("mysql2/promise");
require("dotenv").config();

// MySQL pool (pola webMikobot/config/db.js)
// Kontrak waktu UTC: DATETIME di DB disimpan sebagai UTC wall-time
// (via UTC_TIMESTAMP), driver parse sebagai UTC agar `new Date()`
// di frontend tidak selisih +7 jam (WIB) saat status RUNNING.
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: process.env.DB_TIMEZONE || "Z",
});

module.exports = db;
