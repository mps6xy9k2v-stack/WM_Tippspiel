'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('./db');
const { calcPoints } = require('./scoring');
const { syncOnce, syncStatus } = require('./sync');

const router = express.Router();

function currentUser(req) {
  if (!req.session?.userId) return null;
  return db.prepare('SELECT id, name, is_admin FROM users WHERE id = ?').get(req.session.userId) || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Nur für Admins' });
    next();
  });
}

// ---------- Auth ----------

router.post('/register', (req, res) => {
  const name = (req.body.name || '').trim();
  const password = req.body.password || '';
  if (name.length < 2 || name.length > 30) {
    return res.status(400).json({ error: 'Name muss 2–30 Zeichen lang sein' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Passwort muss mindestens 4 Zeichen haben' });
  }
  const exists = db.prepare('SELECT 1 FROM users WHERE name = ?').get(name);
  if (exists) return res.status(409).json({ error: 'Name ist schon vergeben' });

  // Erste registrierte Person wird automatisch Admin
  const isFirst = !db.prepare('SELECT 1 FROM users LIMIT 1').get();
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, password_hash, is_admin) VALUES (?, ?, ?)')
    .run(name, hash, isFirst ? 1 : 0);
  req.session.userId = Number(info.lastInsertRowid);
  res.json({ id: req.session.userId, name, is_admin: isFirst ? 1 : 0 });
});

router.post('/login', (req, res) => {
  const name = (req.body.name || '').trim();
  const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Name oder Passwort falsch' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, is_admin: user.is_admin });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: currentUser(req) });
});

// ---------- Spiele & Tipps ----------

router.get('/matches', (req, res) => {
  const user = currentUser(req);
  const now = new Date().toISOString();
  const matches = db.prepare('SELECT * FROM matches ORDER BY kickoff_utc, id').all();
  const allTips = db.prepare(`
    SELECT t.match_id, t.user_id, t.home_tip, t.away_tip, u.name AS user_name
    FROM tips t JOIN users u ON u.id = t.user_id
  `).all();
  const tipsByMatch = new Map();
  for (const t of allTips) {
    if (!tipsByMatch.has(t.match_id)) tipsByMatch.set(t.match_id, []);
    tipsByMatch.get(t.match_id).push(t);
  }

  const result = matches.map((m) => {
    const started = m.kickoff_utc <= now;
    const tips = tipsByMatch.get(m.id) || [];
    const myTip = user ? tips.find((t) => t.user_id === user.id) : null;
    return {
      id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      kickoff_utc: m.kickoff_utc,
      stage: m.stage,
      group_name: m.group_name,
      venue: m.venue,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      started,
      tip_count: tips.length,
      my_tip: myTip ? { home: myTip.home_tip, away: myTip.away_tip } : null,
      // Tipps der anderen erst ab Anpfiff sichtbar – vorher kann niemand abschreiben
      all_tips: started
        ? tips.map((t) => ({
            user: t.user_name,
            home: t.home_tip,
            away: t.away_tip,
            points: calcPoints(t.home_tip, t.away_tip, m.home_score, m.away_score),
          }))
        : null,
    };
  });
  res.json({ matches: result });
});

router.post('/tips', requireAuth, (req, res) => {
  const matchId = Number(req.body.match_id);
  const home = Number(req.body.home);
  const away = Number(req.body.away);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
    return res.status(400).json({ error: 'Bitte gültige Tore (0–99) eingeben' });
  }
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) return res.status(404).json({ error: 'Spiel nicht gefunden' });
  if (match.kickoff_utc <= new Date().toISOString()) {
    return res.status(403).json({ error: 'Das Spiel hat schon begonnen – Tipp gesperrt' });
  }
  db.prepare(`
    INSERT INTO tips (user_id, match_id, home_tip, away_tip, updated_at)
    VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id, match_id) DO UPDATE SET
      home_tip = excluded.home_tip,
      away_tip = excluded.away_tip,
      updated_at = excluded.updated_at
  `).run(req.user.id, matchId, home, away);
  res.json({ ok: true });
});

// ---------- Rangliste ----------

router.get('/leaderboard', (req, res) => {
  const users = db.prepare('SELECT id, name FROM users ORDER BY name').all();
  const rows = db.prepare(`
    SELECT t.user_id, t.home_tip, t.away_tip, m.home_score, m.away_score
    FROM tips t
    JOIN matches m ON m.id = t.match_id
    WHERE m.status = 'FINISHED' AND m.home_score IS NOT NULL
  `).all();

  const stats = new Map(users.map((u) => [u.id, {
    name: u.name, points: 0, exact: 0, diff: 0, tendency: 0, tipped: 0,
  }]));
  for (const r of rows) {
    const s = stats.get(r.user_id);
    if (!s) continue;
    const p = calcPoints(r.home_tip, r.away_tip, r.home_score, r.away_score);
    s.tipped++;
    s.points += p;
    if (p === 4) s.exact++;
    else if (p === 3) s.diff++;
    else if (p === 2) s.tendency++;
  }
  const leaderboard = [...stats.values()].sort(
    (a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name)
  );
  res.json({ leaderboard });
});

// ---------- Sync & Admin ----------

router.get('/sync/status', (req, res) => res.json(syncStatus()));

router.post('/admin/sync', requireAdmin, async (req, res) => {
  try {
    res.json(await syncOnce());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/admin/matches', requireAdmin, (req, res) => {
  const { home_team, away_team, kickoff_utc, stage, group_name } = req.body;
  if (!home_team || !away_team || !kickoff_utc || Number.isNaN(Date.parse(kickoff_utc))) {
    return res.status(400).json({ error: 'home_team, away_team und gültiges kickoff_utc sind Pflicht' });
  }
  const info = db.prepare(`
    INSERT INTO matches (home_team, away_team, kickoff_utc, stage, group_name, manual_override)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(home_team.trim(), away_team.trim(), new Date(kickoff_utc).toISOString(), stage || null, group_name || null);
  res.json({ id: Number(info.lastInsertRowid) });
});

router.put('/admin/matches/:id', requireAdmin, (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(req.params.id));
  if (!match) return res.status(404).json({ error: 'Spiel nicht gefunden' });
  const hs = req.body.home_score === null || req.body.home_score === '' ? null : Number(req.body.home_score);
  const as = req.body.away_score === null || req.body.away_score === '' ? null : Number(req.body.away_score);
  if ((hs !== null && !Number.isInteger(hs)) || (as !== null && !Number.isInteger(as))) {
    return res.status(400).json({ error: 'Ungültiges Ergebnis' });
  }
  const status = ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'].includes(req.body.status)
    ? req.body.status
    : match.status;
  // Manuell gesetzte Ergebnisse werden vom Auto-Sync nicht mehr überschrieben
  db.prepare(`
    UPDATE matches SET home_score = ?, away_score = ?, status = ?, manual_override = 1 WHERE id = ?
  `).run(hs, as, status, match.id);
  res.json({ ok: true });
});

module.exports = router;
