'use strict';

// Ergebnis-Synchronisation:
//   1) football-data.org (kostenloser API-Key, Live-Ergebnisse, alle 2 Minuten)
//   2) openfootball worldcup.json (ohne Key, ca. täglich aktualisiert) als Fallback
const { db, setSetting, getSetting } = require('./db');

const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';
const OF_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

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

function mapFdStatus(status) {
  switch (status) {
    case 'FINISHED': return 'FINISHED';
    case 'IN_PLAY':
    case 'PAUSED': return 'LIVE';
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED': return 'CANCELLED';
    default: return 'SCHEDULED'; // SCHEDULED, TIMED
  }
}

async function syncFootballData(apiKey) {
  const res = await fetch(FD_URL, { headers: { 'X-Auth-Token': apiKey } });
  if (!res.ok) throw new Error(`football-data.org antwortete mit HTTP ${res.status}`);
  const data = await res.json();
  let count = 0;
  for (const m of data.matches || []) {
    if (!m.homeTeam?.name || !m.awayTeam?.name) continue; // Platzhalter (z. B. "Winner Group A") überspringen
    upsertStmt.run(
      `fd:${m.id}`,
      m.homeTeam.name,
      m.awayTeam.name,
      m.utcDate,
      m.stage || null,
      m.group ? m.group.replace(/^GROUP_/, 'Gruppe ') : null,
      m.venue || null,
      mapFdStatus(m.status),
      m.score?.fullTime?.home ?? null,
      m.score?.fullTime?.away ?? null
    );
    count++;
  }
  return { source: 'football-data.org', count };
}

// openfootball: "13:00 UTC-6" / "18:00 UTC+2" -> ISO-Zeit in UTC
function parseOfKickoff(date, time) {
  if (!date) return null;
  if (!time) return `${date}T12:00:00Z`;
  const m = time.match(/^(\d{1,2}):(\d{2})(?:\s*UTC([+-]\d{1,2})(?::?(\d{2}))?)?/);
  if (!m) return `${date}T12:00:00Z`;
  const [, hh, mm, offH, offM] = m;
  let offset = 'Z';
  if (offH) {
    const sign = offH.startsWith('-') ? '-' : '+';
    offset = `${sign}${String(Math.abs(parseInt(offH, 10))).padStart(2, '0')}:${offM || '00'}`;
  }
  return new Date(`${date}T${hh.padStart(2, '0')}:${mm}:00${offset}`).toISOString();
}

function ofTeamName(team) {
  if (!team) return null;
  if (typeof team === 'string') return team;
  return team.name || team.code || null;
}

function ofScore(m) {
  if (m.score && Array.isArray(m.score.ft)) return [m.score.ft[0], m.score.ft[1]];
  if (Number.isInteger(m.score1) && Number.isInteger(m.score2)) return [m.score1, m.score2];
  return [null, null];
}

async function syncOpenFootball() {
  const res = await fetch(OF_URL);
  if (!res.ok) throw new Error(`openfootball antwortete mit HTTP ${res.status}`);
  const data = await res.json();
  let count = 0;
  for (const m of data.matches || []) {
    const home = ofTeamName(m.team1);
    const away = ofTeamName(m.team2);
    const kickoff = parseOfKickoff(m.date, m.time);
    if (!home || !away || !kickoff) continue;
    const [hs, as] = ofScore(m);
    const extId = m.num != null
      ? `of:${m.num}`
      : `of:${m.date}:${home}:${away}`;
    upsertStmt.run(
      extId, home, away, kickoff,
      m.round || null,
      m.group || null,
      m.ground || null,
      hs !== null ? 'FINISHED' : 'SCHEDULED',
      hs, as
    );
    count++;
  }
  return { source: 'openfootball', count };
}

async function syncOnce() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  try {
    const result = apiKey ? await syncFootballData(apiKey) : await syncOpenFootball();
    setSetting('last_sync', new Date().toISOString());
    setSetting('last_sync_source', result.source);
    setSetting('last_sync_error', '');
    console.log(`[sync] ${result.count} Spiele von ${result.source} aktualisiert`);
    return result;
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
