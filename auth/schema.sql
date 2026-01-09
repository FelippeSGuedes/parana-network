-- Schema for auth SQLite (kept for reference)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  profile JSON,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
