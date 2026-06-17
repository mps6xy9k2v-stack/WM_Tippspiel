'use strict';

// Synchronisiert die WM-Spiele/-Ergebnisse nach Supabase.
// Läuft als GitHub Action (siehe .github/workflows/sync-results.yml).
//
// Ablauf je Lauf:
//   1) Voller Abgleich (alle Spiele, Quellenwechsel-Erkennung, Upsert).
//   2) Mit football-data.org-Key UND laufenden/bald startenden Spielen:
//      ~4,5 Minuten lang alle 30 s nur die Live-Spiele nachziehen, damit
//      Tore möglichst zeitnah in der Datenbank landen. Der nächste
//      Cron-Lauf (alle 5 Min) übernimmt anschließend nahtlos.
//
// Benötigte Umgebungsvariablen:
//   SUPABASE_URL              z. B. https://abcdefgh.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY Service-Role-Key (sb_secret_... oder legacy JWT)
//   FOOTBALL_DATA_API_KEY     optional – mit Key Live-Daten, ohne openfootball

const { createClient } = require('@supabase/supabase-js');
const { fetchMatches } = require('../src/fetch-matches');
const { findLegacyMatch } = require('../src/match-merge');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

const LIVE_INTERVAL_MS = Number(process.env.LIVE_INTERVAL_MS) || 30 * 1000;   // alle 30 s während Live-Spielen
const LIVE_WINDOW_MS = Number(process.env.LIVE_WINDOW_MS) || 270 * 1000;      // höchstens ~4,5 Min pro Lauf (nächster Cron übernimmt)
const KICKOFF_LOOKAHEAD_MS = 7 * 60 * 1000; // Anstoß in den nächsten 7 Min -> schon mitloopen

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Läuft gerade ein Spiel oder pfeift gleich an? Dann lohnt sich der 30-s-Takt.
function liveOrImminent(matches) {
  const now = Date.now();
  return matches.some((m) => m.status === 'LIVE' ||
    (m.status === 'SCHEDULED' && (() => {
      const dt = new Date(m.kickoff_utc).getTime() - now;
      return dt <= KICKOFF_LOOKAHEAD_MS && dt > -60 * 1000;
    })()));
}

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
    .select('ext_id,kickoff_utc,home_team,away_team,manual_override');
  if (selErr) throw new Error(`SELECT matches: ${selErr.message}`);
  console.log(`Schritt 2 OK: ${existing.length} vorhandene Einträge`);

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
      legacy.ext_id = m.ext_id;
      knownIds.add(m.ext_id);
      renamed++;
    }
  }
  if (renamed) console.log(`${renamed} Spiele von der alten Datenquelle übernommen.`);

  const rows = matches.filter((m) => !skip.has(m.ext_id));
  if (rows.length) {
    const { error: upsErr } = await supabase.from('matches').upsert(rows, { onConflict: 'ext_id' });
    if (upsErr) throw new Error(`UPSERT matches: ${upsErr.message}`);
  }
  const skipped = matches.length - rows.length;
  console.log(`✓ ${rows.length} Spiele von ${source} nach Supabase synchronisiert` +
    (skipped ? ` (${skipped} manuell gepflegte übersprungen)` : ''));

  // ----- 2) Live-Schleife (nur mit echter Live-Quelle) -----
  if (!API_KEY) {
    console.log('Kein FOOTBALL_DATA_API_KEY – ohne Live-Quelle keine 30-s-Schleife.');
    return;
  }
  if (!liveOrImminent(matches)) {
    console.log('Keine laufenden/bald startenden Spiele – Lauf beendet.');
    return;
  }

  console.log('Live-Spiele erkannt: aktualisiere jetzt alle 30 s …');
  const deadline = Date.now() + LIVE_WINDOW_MS;
  const active = new Set(); // Spiele, die wir live gesehen haben (für den Endstand-Write)
  let ticks = 0;

  while (Date.now() < deadline) {
    await sleep(LIVE_INTERVAL_MS);
    let latest;
    try {
      latest = (await fetchMatches(API_KEY)).matches;
    } catch (err) {
      console.warn(`Live-Abruf übersprungen: ${err.message}`);
      continue;
    }

    // Relevant: aktuell live ODER vorher live (um den Endstand noch zu schreiben)
    const relevant = latest.filter((m) => {
      if (m.status === 'LIVE') { active.add(m.ext_id); return true; }
      return active.has(m.ext_id);
    });
    const writeRows = relevant.filter((m) => !skip.has(m.ext_id));
    if (writeRows.length) {
      const { error } = await supabase.from('matches').upsert(writeRows, { onConflict: 'ext_id' });
      if (error) { console.warn(`Live-Upsert-Fehler: ${error.message}`); continue; }
    }
    // Beendete aus der Beobachtung nehmen (Endstand wurde gerade geschrieben)
    for (const m of relevant) {
      if (m.status === 'FINISHED' || m.status === 'CANCELLED') active.delete(m.ext_id);
    }
    ticks++;
    const liveNow = latest.filter((m) => m.status === 'LIVE').length;
    console.log(`[live ${ticks}] ${liveNow} live, ${writeRows.length} aktualisiert`);

    // Nichts mehr live und kein Anstoß in Sicht -> früher beenden
    if (active.size === 0 && !liveOrImminent(latest)) {
      console.log('Keine Live-Spiele mehr – Schleife beendet.');
      break;
    }
  }
  console.log('Live-Schleife beendet, nächster Cron-Lauf übernimmt.');
})().catch((err) => {
  console.error('FEHLER:', err.message);
  if (err.cause) console.error('Ursache:', err.cause?.message || err.cause);
  process.exit(1);
});
