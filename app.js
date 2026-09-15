const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const templateRoutes = require("./src/routes/templateRoutes");
const runRoutes = require("./src/routes/runRoutes");
const reportRoutes = require("./src/routes/reportRoutes");
const authRoutes = require("./src/routes/authRoutes");
const publicRoutes = require("./src/routes/publicRoutes");
const requireAuth = require("./src/middlewares/requireAuth");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Screenshot hasil run (DB hanya simpan path)
app.use("/storage", express.static(path.join(__dirname, "storage")));

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/auth", authRoutes);
app.use("/public", publicRoutes);
app.use("/templates", requireAuth, templateRoutes);
app.use("/runs", requireAuth, runRoutes);
app.use("/reports", requireAuth, reportRoutes);

// 404 handler (fix dari webMikobot)
app.use((req, res) => res.status(404).json({ message: "Endpoint tidak ditemukan" }));

// Global error handler (fix dari webMikobot)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Terjadi kesalahan pada server" });
});

const PORT = process.env.PORT || 5002;
if (require.main === module) {
  app.listen(PORT, () => console.log(`✅ AutoQA server running on http://localhost:${PORT}`));
}

module.exports = app;
