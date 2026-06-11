'use strict';

// Holt die WM-Spieldaten von einer der beiden Quellen und normalisiert sie.
// Wird sowohl vom lokalen Server (src/sync.js) als auch vom
// Supabase-Sync der GitHub Action (scripts/sync-supabase.js) genutzt.

const FD_URL = 'https://api.football-data.org/v4/competitions/WC/matches';
const OF_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

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

async function fetchFootballData(apiKey) {
  const res = await fetch(FD_URL, { headers: { 'X-Auth-Token': apiKey } });
  if (!res.ok) throw new Error(`football-data.org antwortete mit HTTP ${res.status}`);
  const data = await res.json();
  const matches = [];
  for (const m of data.matches || []) {
    if (!m.homeTeam?.name || !m.awayTeam?.name) continue; // Platzhalter (z. B. "Winner Group A") überspringen
    matches.push({
      ext_id: `fd:${m.id}`,
      home_team: m.homeTeam.name,
      away_team: m.awayTeam.name,
      kickoff_utc: m.utcDate,
      stage: m.stage || null,
      group_name: m.group ? m.group.replace(/^GROUP_/, 'Gruppe ') : null,
      venue: m.venue || null,
      status: mapFdStatus(m.status),
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
    });
  }
  return { source: 'football-data.org', matches };
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

async function fetchOpenFootball() {
  const res = await fetch(OF_URL);
  if (!res.ok) throw new Error(`openfootball antwortete mit HTTP ${res.status}`);
  const data = await res.json();
  const matches = [];
  for (const m of data.matches || []) {
    const home = ofTeamName(m.team1);
    const away = ofTeamName(m.team2);
    const kickoff = parseOfKickoff(m.date, m.time);
    if (!home || !away || !kickoff) continue;
    const [hs, as] = ofScore(m);
    matches.push({
      ext_id: m.num != null ? `of:${m.num}` : `of:${m.date}:${home}:${away}`,
      home_team: home,
      away_team: away,
      kickoff_utc: kickoff,
      stage: m.round || null,
      group_name: m.group || null,
      venue: m.ground || null,
      status: hs !== null ? 'FINISHED' : 'SCHEDULED',
      home_score: hs,
      away_score: as,
    });
  }
  return { source: 'openfootball', matches };
}

// Nimmt football-data.org, wenn ein API-Key gesetzt ist, sonst openfootball
async function fetchMatches(apiKey) {
  return apiKey ? fetchFootballData(apiKey) : fetchOpenFootball();
}

module.exports = { fetchMatches, fetchFootballData, fetchOpenFootball, parseOfKickoff };
