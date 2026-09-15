const jwt = require("jsonwebtoken");

// Guard route API (pola webMikobot authMiddleware, dipakai di semua /runs /templates /reports)
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token tidak valid" });
  }
}

module.exports = requireAuth;
