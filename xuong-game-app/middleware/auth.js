const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Chưa đăng nhập." });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "Chỉ quản trị viên mới thực hiện được thao tác này." });
  next();
}

module.exports = { requireAuth, requireAdmin, SECRET };
