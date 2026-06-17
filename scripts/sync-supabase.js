'use strict';

// Synchronisiert die WM-Spiele/-Ergebnisse nach Supabase.
// Läuft als GitHub Action (siehe .github/workflows/sync-results.yml).
//
// Ablauf je Lauf:
//   1) Voller Abgleich (Spielplan + Ergebnisse) von football-data.org bzw.
//      openfootball. Bekannte Stände werden dabei NICHT mit null überschrieben
//      und der Status nicht herabgestuft (LIVE/FINISHED bleibt erhalten).
//   2) Läuft (oder startet gleich) ein Spiel, wird ~55 Min lang alle 30 s die
//      kostenlose ESPN-Quelle abgefragt und der Live-Stand den passenden
//      Spielen zugeordnet. So gibt es Live-Ergebnisse ohne Bezahl-API.
//
// Benötigte Umgebungsvariablen:
//   SUPABASE_URL              z. B. https://abcdefgh.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY Service-Role-Key (sb_secret_... oder legacy JWT)
//   FOOTBALL_DATA_API_KEY     optional – sonst Spielplan von openfootball

const { createClient } = require('@supabase/supabase-js');
const { fetchMatches } = require('../src/fetch-matches');
const { findLegacyMatch } = require('../src/match-merge');
const { fetchEspnLive, matchEspnToDb } = require('../src/espn-live');
const { mergeRow, worthLivePolling } = require('../src/sync-merge');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

const LIVE_INTERVAL_MS = Number(process.env.LIVE_INTERVAL_MS) || 30 * 1000;     // alle 30 s
const LIVE_WINDOW_MS = Number(process.env.LIVE_WINDOW_MS) || 55 * 60 * 1000;    // bis ~55 Min pro Lauf

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ----- 1) Voller Abgleich -----
  console.log('Schritt 1: Spieldaten abrufen …');
  const { source, matches } = await fetchMatches(API_KEY);
  console.log(`Schritt 1 OK: ${matches.length} Spiele von ${source}`);

  console.log('Schritt 2: Vorhandene Supabase-Einträge abfragen …');
  const { data: existing, error: selErr } = await supabase
    .from('matches')
    .select('ext_id,kickoff_utc,home_team,away_team,manual_override,home_score,away_score,status');
  if (selErr) throw new Error(`SELECT matches: ${selErr.message}`);
  console.log(`Schritt 2 OK: ${existing.length} vorhandene Einträge`);

  const prevById = new Map(existing.map((e) => [e.ext_id, e]));
  const knownIds = new Set(existing.map((e) => e.ext_id));
  const skip = new Set(existing.filter((e) => e.manual_override).map((e) => e.ext_id));

  // Beim Quellenwechsel vorhandene Spiele wiedererkennen statt duplizieren
  let renamed = 0;
  for (const m of matches) {
    if (knownIds.has(m.ext_id)) continue;
    const legacy = findLegacyMatch(existing, m);
    if (legacy) {
      const { error } = await supabase.from('matches').update({ ext_id: m.ext_id }).eq('ext_id', legacy.ext_id);
      if (error) throw new Error(`PATCH ext_id: ${error.message}`);
      prevById.set(m.ext_id, legacy);
      legacy.ext_id = m.ext_id;
      knownIds.add(m.ext_id);
      renamed++;
    }
  }
  if (renamed) console.log(`${renamed} Spiele von der alten Datenquelle übernommen.`);

  const rows = matches
    .filter((m) => !skip.has(m.ext_id))
    .map((m) => mergeRow(m, prevById.get(m.ext_id)));
  if (rows.length) {
    const { error: upsErr } = await supabase.from('matches').upsert(rows, { onConflict: 'ext_id' });
    if (upsErr) throw new Error(`UPSERT matches: ${upsErr.message}`);
  }
  const skipped = matches.length - rows.length;
  console.log(`✓ ${rows.length} Spiele von ${source} nach Supabase synchronisiert` +
    (skipped ? ` (${skipped} manuell gepflegte übersprungen)` : ''));

  // ----- 2) Live-Schleife über ESPN (kostenlos, kein Key) -----
  if (!worthLivePolling(matches)) {
    console.log('Keine laufenden/bald startenden Spiele – Lauf beendet.');
    return;
  }

  // Identitäts-Liste für die Zuordnung der ESPN-Events
  const { data: dbMatches } = await supabase
    .from('matches')
    .select('ext_id,home_team,away_team,kickoff_utc,manual_override');

  console.log('Live-Fenster aktiv: ESPN alle 30 s abfragen …');
  const deadline = Date.now() + LIVE_WINDOW_MS;
  let ticks = 0;
  while (Date.now() < deadline) {
    await sleep(LIVE_INTERVAL_MS);
    let events;
    try {
      events = await fetchEspnLive();
    } catch (err) {
      console.warn(`ESPN-Abruf übersprungen: ${err.message}`);
      continue;
    }
    const updates = matchEspnToDb(events, dbMatches || []);
    let written = 0;
    for (const u of updates) {
      const { error } = await supabase
        .from('matches')
        .update({ home_score: u.home_score, away_score: u.away_score, status: u.status })
        .eq('ext_id', u.ext_id)
        .eq('manual_override', false);
      if (error) { console.warn(`Live-Update-Fehler (${u.ext_id}): ${error.message}`); continue; }
      written++;
    }
    ticks++;
    const liveCount = events.filter((e) => e.status === 'LIVE').length;
    console.log(`[live ${ticks}] ESPN: ${liveCount} live, ${updates.length} zugeordnet, ${written} aktualisiert`);

    if (liveCount === 0 && !worthLivePolling(matches)) {
      console.log('Keine Live-Spiele mehr – Schleife beendet.');
      break;
    }
  }
  console.log('Live-Schleife beendet, nächster Lauf übernimmt.');
})().catch((err) => {
  console.error('FEHLER:', err.message);
  if (err.cause) console.error('Ursache:', err.cause?.message || err.cause);
  process.exit(1);
});
