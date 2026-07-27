const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'family-planner.db');

const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4A90D9',
  avatar TEXT NOT NULL DEFAULT '🙂',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  date TEXT NOT NULL,             -- YYYY-MM-DD (first occurrence)
  start_time TEXT,                -- HH:MM (24h), null = all-day
  end_time TEXT,
  location TEXT,
  notes TEXT,
  recurrence TEXT NOT NULL DEFAULT 'none',  -- none | daily | weekly | monthly
  recurrence_until TEXT,          -- YYYY-MM-DD inclusive, null = forever
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  meal_type TEXT NOT NULL,        -- breakfast | lunch | dinner | snack
  title TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, meal_type)
);

CREATE TABLE IF NOT EXISTS chores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🧹',
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',  -- JSON array, 0=Sunday
  points INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chore_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chore_id INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(chore_id, date)
);

CREATE TABLE IF NOT EXISTS lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'todo',  -- grocery | todo
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  added_by TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed default lists on first run so the Lists tab is never empty.
const listCount = db.prepare('SELECT COUNT(*) AS n FROM lists').get().n;
if (listCount === 0) {
  const ins = db.prepare('INSERT INTO lists (name, type) VALUES (?, ?)');
  ins.run('Groceries', 'grocery');
  ins.run('To-Do', 'todo');
}

module.exports = db;
