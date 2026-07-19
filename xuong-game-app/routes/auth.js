const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAuth, SECRET } = require("../middleware/auth");

const router = express.Router();

function toPublicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    urlSlug: u.url_slug,
    avatarColor: u.avatar_color,
    isDev: !!u.is_dev,
    isAdmin: !!u.is_admin,
  };
}

router.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Cần nhập tên đăng nhập và mật khẩu." });
  if (password.length < 6) return res.status(400).json({ error: "Mật khẩu cần ít nhất 6 ký tự." });

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return res.status(409).json({ error: "Tên đăng nhập đã tồn tại." });

  const hash = bcrypt.hashSync(password, 10);
  const slug = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const info = db
    .prepare(`INSERT INTO users (username, password_hash, display_name, url_slug) VALUES (?, ?, ?, ?)`)
    .run(username, hash, username, slug || "user" + Date.now());

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = jwt.sign({ id: user.id, isAdmin: !!user.is_admin }, SECRET, { expiresIn: "30d" });
  res.json({ token, user: toPublicUser(user) });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu." });
  }
  const token = jwt.sign({ id: user.id, isAdmin: !!user.is_admin }, SECRET, { expiresIn: "30d" });
  res.json({ token, user: toPublicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  res.json({ user: toPublicUser(user) });
});

router.patch("/me", requireAuth, (req, res) => {
  const { displayName, urlSlug, avatarColor } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const now = new Date();
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

  if (displayName && displayName !== user.display_name) {
    if (user.last_name_change && now - new Date(user.last_name_change) < ONE_MONTH) {
      return res.status(429).json({ error: "Chỉ được đổi tên hiển thị 1 lần / tháng." });
    }
    db.prepare("UPDATE users SET display_name = ?, last_name_change = ? WHERE id = ?").run(displayName, now.toISOString(), user.id);
  }

  if (urlSlug && urlSlug !== user.url_slug) {
    if (user.last_url_change && now - new Date(user.last_url_change) < ONE_MONTH) {
      return res.status(429).json({ error: "Chỉ được đổi URL 1 lần / tháng." });
    }
    const taken = db.prepare("SELECT id FROM users WHERE url_slug = ? AND id != ?").get(urlSlug, user.id);
    if (taken) return res.status(409).json({ error: "URL này đã có người dùng." });
    db.prepare("UPDATE users SET url_slug = ?, last_url_change = ? WHERE id = ?").run(urlSlug, now.toISOString(), user.id);
  }

  if (avatarColor) {
    db.prepare("UPDATE users SET avatar_color = ? WHERE id = ?").run(avatarColor, user.id);
  }

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  res.json({ user: toPublicUser(updated) });
});

module.exports = { router, toPublicUser };
