const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function toPublic(u) {
  return { id: u.id, displayName: u.display_name, avatarColor: u.avatar_color, isDev: !!u.is_dev };
}

// List: accepted friends + incoming pending requests
router.get("/", requireAuth, (req, res) => {
  const uid = req.user.id;

  const accepted = db
    .prepare(
      `SELECT u.* FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'`
    )
    .all(uid, uid, uid);

  const incoming = db
    .prepare(`SELECT u.* FROM friendships f JOIN users u ON u.id = f.requester_id WHERE f.addressee_id = ? AND f.status = 'pending'`)
    .all(uid);

  res.json({ friends: accepted.map(toPublic), requests: incoming.map(toPublic) });
});

// Send a friend request
router.post("/request", requireAuth, (req, res) => {
  const { userId } = req.body || {};
  if (!userId || Number(userId) === req.user.id) return res.status(400).json({ error: "Người dùng không hợp lệ." });
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!target) return res.status(404).json({ error: "Không tìm thấy người dùng." });

  try {
    db.prepare(`INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`).run(req.user.id, userId);
  } catch {
    return res.status(409).json({ error: "Đã gửi lời mời trước đó." });
  }
  res.json({ ok: true });
});

router.post("/accept", requireAuth, (req, res) => {
  const { userId } = req.body || {};
  const r = db
    .prepare(`UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`)
    .run(userId, req.user.id);
  if (r.changes === 0) return res.status(404).json({ error: "Không tìm thấy lời mời." });
  res.json({ ok: true });
});

router.post("/decline", requireAuth, (req, res) => {
  const { userId } = req.body || {};
  db.prepare(`DELETE FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'`).run(userId, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
