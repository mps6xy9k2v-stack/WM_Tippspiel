'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'tippspiel.sqlite'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS matches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ext_id          TEXT UNIQUE,
    home_team       TEXT NOT NULL,
    away_team       TEXT NOT NULL,
    kickoff_utc     TEXT NOT NULL,
    stage           TEXT,
    group_name      TEXT,
    venue           TEXT,
    status          TEXT NOT NULL DEFAULT 'SCHEDULED',
    home_score      INTEGER,
    away_score      INTEGER,
    manual_override INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tips (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    home_tip   INTEGER NOT NULL,
    away_tip   INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, match_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches (kickoff_utc);
  CREATE INDEX IF NOT EXISTS idx_tips_match ON tips (match_id);
`);

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

// Stabiles Session-Secret über Neustarts hinweg
function getSessionSecret() {
  let secret = process.env.SESSION_SECRET || getSetting('session_secret');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    setSetting('session_secret', secret);
  }
  return secret;
}

module.exports = { db, getSetting, setSetting, getSessionSecret, DATA_DIR };
