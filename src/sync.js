'use strict';

// Ergebnis-Synchronisation für den lokalen Server:
//   1) football-data.org (kostenloser API-Key, Live-Ergebnisse, alle 2 Minuten)
//   2) openfootball worldcup.json (ohne Key, ca. täglich aktualisiert) als Fallback
const { db, setSetting, getSetting } = require('./db');
const { fetchMatches } = require('./fetch-matches');
const { findLegacyMatch } = require('./match-merge');

const upsertStmt = db.prepare(`
  INSERT INTO matches (ext_id, home_team, away_team, kickoff_utc, stage, group_name, venue, status, home_score, away_score)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ext_id) DO UPDATE SET
    home_team  = excluded.home_team,
    away_team  = excluded.away_team,
    kickoff_utc = excluded.kickoff_utc,
    stage      = excluded.stage,
    group_name = excluded.group_name,
    venue      = COALESCE(excluded.venue, matches.venue),
    status     = excluded.status,
    home_score = excluded.home_score,
    away_score = excluded.away_score
  WHERE matches.manual_override = 0
`);

async function syncOnce() {
  try {
    const { source, matches } = await fetchMatches(process.env.FOOTBALL_DATA_API_KEY);
    // Beim Quellenwechsel vorhandene Spiele wiedererkennen statt duplizieren:
    // die alte Zeile bekommt die neue ext_id, Tipps (über matches.id) bleiben erhalten.
    const existing = db.prepare(
      'SELECT id, ext_id, kickoff_utc, home_team, away_team, manual_override FROM matches WHERE ext_id IS NOT NULL'
    ).all();
    const knownIds = new Set(existing.map((e) => e.ext_id));
    for (const m of matches) {
      if (!knownIds.has(m.ext_id)) {
        const legacy = findLegacyMatch(existing, m);
        if (legacy) {
          db.prepare('UPDATE matches SET ext_id = ? WHERE id = ?').run(m.ext_id, legacy.id);
          legacy.ext_id = m.ext_id;
          knownIds.add(m.ext_id);
        }
      }
      upsertStmt.run(
        m.ext_id, m.home_team, m.away_team, m.kickoff_utc,
        m.stage, m.group_name, m.venue, m.status, m.home_score, m.away_score
      );
    }
    setSetting('last_sync', new Date().toISOString());
    setSetting('last_sync_source', source);
    setSetting('last_sync_error', '');
    console.log(`[sync] ${matches.length} Spiele von ${source} aktualisiert`);
    return { source, count: matches.length };
  } catch (err) {
    setSetting('last_sync_error', err.message);
    console.error(`[sync] Fehler: ${err.message}`);
    throw err;
  }
}

function startScheduler() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  // football-data.org erlaubt 10 Anfragen/Minute – alle 2 Minuten ist großzügig im Limit.
  // openfootball wird nur ~täglich aktualisiert, daher reicht dort alle 30 Minuten.
  const intervalMs = apiKey ? 2 * 60 * 1000 : 30 * 60 * 1000;
  syncOnce().catch(() => {});
  const timer = setInterval(() => syncOnce().catch(() => {}), intervalMs);
  timer.unref();
  console.log(`[sync] Quelle: ${apiKey ? 'football-data.org (Live)' : 'openfootball (Fallback, ohne API-Key)'}, Intervall: ${intervalMs / 60000} min`);
}

function syncStatus() {
  return {
    source: process.env.FOOTBALL_DATA_API_KEY ? 'football-data.org' : 'openfootball',
    live: Boolean(process.env.FOOTBALL_DATA_API_KEY),
    lastSync: getSetting('last_sync'),
    lastError: getSetting('last_sync_error') || null,
  };
}

module.exports = { syncOnce, startScheduler, syncStatus };
