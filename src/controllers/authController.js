const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AppUser = require("../models/AppUser");

// Login tunggal web app (tanpa register, tanpa logout — sesi menetap).
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username dan password wajib diisi" });
    }
    const user = await AppUser.findByUsername(username);
    if (!user) return res.status(401).json({ message: "Username atau password salah" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "Username atau password salah" });
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server belum dikonfigurasi" });
    }
    const token = jwt.sign({ sub: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ message: "Login berhasil", data: { token, username: user.username } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Login gagal" });
  }
}

module.exports = { login };
