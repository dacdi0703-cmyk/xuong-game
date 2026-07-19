const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const PALETTE = ["#6C63FF", "#F2B84B", "#4ADE80", "#E8637A", "#38BDF8"];
const rndColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];

function withDev(game) {
  const dev = db.prepare("SELECT id, display_name, is_dev FROM users WHERE id = ?").get(game.dev_id);
  return {
    id: game.id,
    title: game.title,
    category: game.category,
    description: game.description,
    link: game.link,
    color: game.thumbnail_color,
    status: game.status,
    flagReason: game.flag_reason,
    dev: dev ? { id: dev.id, name: dev.display_name, isDev: !!dev.is_dev } : null,
  };
}

// Public: list games. Admins (with ?all=1) see pending/flagged too.
router.get("/", (req, res) => {
  let rows;
  const isAdminReq = req.query.all === "1";
  if (isAdminReq) {
    rows = db.prepare("SELECT * FROM games ORDER BY created_at DESC").all();
  } else {
    rows = db.prepare("SELECT * FROM games WHERE status = 'approved' ORDER BY created_at DESC").all();
  }
  res.json({ games: rows.map(withDev) });
});

// Submit a new game -> goes to the admin review queue as "pending"
router.post("/", requireAuth, (req, res) => {
  const { title, category, description, link } = req.body || {};
  if (!title || !category || !link) return res.status(400).json({ error: "Thiếu tên game, thể loại hoặc link tải." });
  if (!/^https?:\/\//i.test(link)) return res.status(400).json({ error: "Link tải không hợp lệ." });

  const info = db
    .prepare(`INSERT INTO games (title, category, description, link, thumbnail_color, dev_id, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`)
    .run(title, category, description || "", link, rndColor(), req.user.id);

  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(info.lastInsertRowid);
  res.json({ game: withDev(game) });
});

// Report a game as suspected copyright violation / other issue
router.post("/:id/report", requireAuth, (req, res) => {
  const game = db.prepare("SELECT * FROM games WHERE id = ?").get(req.params.id);
  if (!game) return res.status(404).json({ error: "Không tìm thấy game." });
  db.prepare("UPDATE games SET status = 'flagged', flag_reason = ? WHERE id = ?").run(
    "Người dùng báo cáo game này để quản trị viên xem xét.",
    game.id
  );
  res.json({ ok: true });
});

// Admin: approve
router.post("/:id/approve", requireAuth, requireAdmin, (req, res) => {
  db.prepare("UPDATE games SET status = 'approved', flag_reason = NULL WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Admin: reassign which user is credited as the developer
router.post("/:id/reassign", requireAuth, requireAdmin, (req, res) => {
  const { devId } = req.body || {};
  const dev = db.prepare("SELECT id FROM users WHERE id = ?").get(devId);
  if (!dev) return res.status(404).json({ error: "Không tìm thấy người dùng." });
  db.prepare("UPDATE games SET dev_id = ? WHERE id = ?").run(devId, req.params.id);
  res.json({ ok: true });
});

// Admin: delete any game
router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  db.prepare("DELETE FROM games WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
