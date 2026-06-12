'use strict';

// Synchronisiert die WM-Spiele/-Ergebnisse nach Supabase.
// Läuft als GitHub Action (siehe .github/workflows/sync-results.yml).
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

(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log('Schritt 1: Spieldaten abrufen …');
  const { source, matches } = await fetchMatches(process.env.FOOTBALL_DATA_API_KEY);
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
      const { error } = await supabase
        .from('matches')
        .update({ ext_id: m.ext_id })
        .eq('ext_id', legacy.ext_id);
      if (error) throw new Error(`PATCH ext_id: ${error.message}`);
      legacy.ext_id = m.ext_id;
      knownIds.add(m.ext_id);
      renamed++;
    }
  }
  if (renamed) console.log(`${renamed} Spiele von der alten Datenquelle übernommen.`);

  const rows = matches.filter((m) => !skip.has(m.ext_id));
  if (rows.length) {
    const { error: upsErr } = await supabase
      .from('matches')
      .upsert(rows, { onConflict: 'ext_id' });
    if (upsErr) throw new Error(`UPSERT matches: ${upsErr.message}`);
  }

  const skipped = matches.length - rows.length;
  console.log(`✓ ${rows.length} Spiele von ${source} nach Supabase synchronisiert` +
    (skipped ? ` (${skipped} manuell gepflegte übersprungen)` : ''));
})().catch((err) => {
  console.error('FEHLER:', err.message);
  if (err.cause) console.error('Ursache:', err.cause?.message || err.cause);
  process.exit(1);
});
