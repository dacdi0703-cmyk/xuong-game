const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");

const db = new Database(path.join(__dirname, "data", "xuonggame.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  url_slug TEXT UNIQUE NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#F2B84B',
  is_dev INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  last_name_change TEXT,
  last_url_change TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  link TEXT NOT NULL,
  thumbnail_color TEXT DEFAULT '#F2B84B',
  dev_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | flagged
  flag_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  addressee_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(requester_id, addressee_id)
);
`);

// --- Seed the admin account securely ---
// Username defaults to PanAd (just a name, harmless to default).
// Password is NEVER hardcoded. It must come from the ADMIN_PASSWORD env var.
// If it's missing, we generate a random one-time password and print it once,
// so the app still boots but nobody ships a guessable default.
function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "PanAd";
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return;

  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(6).toString("hex");
    generated = true;
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `INSERT INTO users (username, password_hash, display_name, url_slug, avatar_color, is_dev, is_admin)
     VALUES (?, ?, ?, ?, '#38BDF8', 1, 1)`
  ).run(username, hash, username, username.toLowerCase());

  if (generated) {
    console.log("=".repeat(60));
    console.log(`Chua dat ADMIN_PASSWORD, da tao mat khau tam cho '${username}':`);
    console.log(`  ${password}`);
    console.log("Hay dang nhap va doi ngay, hoac dat bien moi truong ADMIN_PASSWORD roi khoi dong lai.");
    console.log("=".repeat(60));
  } else {
    console.log(`Da tao tai khoan admin '${username}' tu ADMIN_PASSWORD trong .env`);
  }
}

seedAdmin();

module.exports = db;
