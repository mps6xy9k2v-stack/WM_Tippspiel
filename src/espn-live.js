'use strict';

// Inoffizielle, kostenlose ESPN-Schnittstelle für Live-Ergebnisse (kein Key nötig).
// Wird in der Live-Schleife des Supabase-Syncs genutzt, weil der kostenlose
// football-data.org-Tarif während des Spiels nur verzögerte Stände liefert.

const ESPN_URL = process.env.ESPN_URL ||
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// Teamnamen vereinheitlichen, damit ESPN-Namen zu unseren (football-data /
// openfootball) passen. Akzente/Sonderzeichen raus, dann bekannte Synonyme.
function normTeam(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

const TEAM_ALIASES = {
  unitedstates: 'usa', us: 'usa', usmnt: 'usa',
  korearepublic: 'southkorea', republicofkorea: 'southkorea', koreasouth: 'southkorea', southkorea: 'southkorea',
  iranislamicrepublicof: 'iran', islamicrepublicofiran: 'iran', iriran: 'iran',
  czechia: 'czechrepublic',
  turkiye: 'turkey',
  bosniaandherzegovina: 'bosniaherzegovina', bosniaherzegovina: 'bosniaherzegovina',
  caboverde: 'capeverde',
  cotedivoire: 'ivorycoast',
  congodr: 'drcongo', democraticrepublicofthecongo: 'drcongo', drcongo: 'drcongo',
  northmacedonia: 'northmacedonia',
};

function canonTeam(name) {
  const n = normTeam(name);
  return TEAM_ALIASES[n] || n;
}

function mapEspnState(state) {
  if (state === 'in') return 'LIVE';
  if (state === 'post') return 'FINISHED';
  return 'SCHEDULED'; // 'pre'
}

function toInt(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

// Holt die aktuellen ESPN-Events und gibt nur laufende/beendete normalisiert zurück.
async function fetchEspnLive() {
  const res = await fetch(ESPN_URL, { headers: { 'User-Agent': 'wm-tippspiel/1.0' } });
  if (!res.ok) throw new Error(`ESPN antwortete mit HTTP ${res.status}`);
  const data = await res.json();
  const events = [];
  for (const ev of data.events || []) {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp) continue;
    const state = (comp.status && comp.status.type && comp.status.type.state) ||
                  (ev.status && ev.status.type && ev.status.type.state);
    const status = mapEspnState(state);
    if (status === 'SCHEDULED') continue; // nur Live/Beendet interessieren uns
    const competitors = comp.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;
    const homeName = (home.team && (home.team.displayName || home.team.name || home.team.location)) || '';
    const awayName = (away.team && (away.team.displayName || away.team.name || away.team.location)) || '';
    if (!homeName || !awayName) continue;
    events.push({
      date: (ev.date || '').slice(0, 10),
      home: canonTeam(homeName),
      away: canonTeam(awayName),
      home_score: toInt(home.score),
      away_score: toInt(away.score),
      status,
    });
  }
  return events;
}

// Ordnet ESPN-Events unseren DB-Spielen zu (per UTC-Datum ±1 Tag + Teamnamen).
// dbMatches: [{ ext_id, home_team, away_team, kickoff_utc, manual_override }]
// -> Updates [{ ext_id, home_score, away_score, status }]
function matchEspnToDb(events, dbMatches) {
  const byDate = new Map();
  for (const m of dbMatches) {
    if (m.manual_override) continue;
    const d = new Date(m.kickoff_utc).toISOString().slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push({ ext_id: m.ext_id, h: canonTeam(m.home_team), a: canonTeam(m.away_team) });
  }

  const updates = [];
  const used = new Set();
  for (const ev of events) {
    const cands = [];
    for (const offset of [0, -1, 1]) {
      const dd = new Date(ev.date + 'T12:00:00Z');
      if (Number.isNaN(dd.getTime())) continue;
      dd.setUTCDate(dd.getUTCDate() + offset);
      const key = dd.toISOString().slice(0, 10);
      if (byDate.has(key)) cands.push(...byDate.get(key));
    }
    const found = cands.find((m) =>
      !used.has(m.ext_id) && m.h !== m.a &&
      (m.h === ev.home || m.h === ev.away) &&
      (m.a === ev.home || m.a === ev.away));
    if (!found) continue;
    used.add(found.ext_id);
    const homeIsHome = found.h === ev.home;
    updates.push({
      ext_id: found.ext_id,
      home_score: homeIsHome ? ev.home_score : ev.away_score,
      away_score: homeIsHome ? ev.away_score : ev.home_score,
      status: ev.status,
    });
  }
  return updates;
}

module.exports = { fetchEspnLive, matchEspnToDb, canonTeam };
