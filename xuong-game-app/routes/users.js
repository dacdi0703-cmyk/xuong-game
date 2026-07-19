const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function toPublic(u) {
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

// Admin: list all users
router.get("/", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  res.json({ users: rows.map(toPublic) });
});

// Admin: grant or revoke the verified-developer badge
router.post("/:id/toggle-dev", requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  db.prepare("UPDATE users SET is_dev = ? WHERE id = ?").run(user.is_dev ? 0 : 1, user.id);
  res.json({ ok: true, isDev: !user.is_dev });
});

// Public-ish: search users to add as friends (requires login)
router.get("/search", requireAuth, (req, res) => {
  const q = `%${(req.query.q || "").toLowerCase()}%`;
  const rows = db
    .prepare("SELECT * FROM users WHERE lower(display_name) LIKE ? AND id != ? LIMIT 20")
    .all(q, req.user.id);
  res.json({ users: rows.map(toPublic) });
});

module.exports = router;
