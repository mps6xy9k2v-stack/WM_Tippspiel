'use strict';

// Synchronisiert die WM-Spiele/-Ergebnisse nach Supabase.
// Läuft als GitHub Action (siehe .github/workflows/sync-results.yml).
//
// Benötigte Umgebungsvariablen:
//   SUPABASE_URL              z. B. https://abcdefgh.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY Service-Role-Key (geheim halten!)
//   FOOTBALL_DATA_API_KEY     optional – mit Key Live-Daten, ohne openfootball

const { fetchMatches } = require('../src/fetch-matches');
const { findLegacyMatch } = require('../src/match-merge');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${path}: HTTP ${res.status} – ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.');
    process.exit(1);
  }

  const { source, matches } = await fetchMatches(process.env.FOOTBALL_DATA_API_KEY);
  if (!matches.length) {
    console.log(`Keine Spiele von ${source} erhalten – nichts zu tun.`);
    return;
  }

  const existing = await rest('matches?select=ext_id,kickoff_utc,home_team,away_team,manual_override');
  const knownIds = new Set(existing.map((e) => e.ext_id));
  const skip = new Set(existing.filter((e) => e.manual_override).map((e) => e.ext_id));

  // Beim Quellenwechsel vorhandene Spiele wiedererkennen statt duplizieren:
  // die alte Zeile bekommt die neue ext_id (Tipps folgen per ON UPDATE CASCADE).
  let renamed = 0;
  for (const m of matches) {
    if (knownIds.has(m.ext_id)) continue;
    const legacy = findLegacyMatch(existing, m);
    if (legacy) {
      await rest(`matches?ext_id=eq.${encodeURIComponent(legacy.ext_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ext_id: m.ext_id }),
      });
      legacy.ext_id = m.ext_id;
      knownIds.add(m.ext_id);
      renamed++;
    }
  }
  if (renamed) console.log(`${renamed} Spiele von der alten Datenquelle übernommen.`);

  const rows = matches.filter((m) => !skip.has(m.ext_id));

  if (rows.length) {
    await rest('matches?on_conflict=ext_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    });
  }
  const skipped = matches.length - rows.length;
  console.log(`${rows.length} Spiele von ${source} nach Supabase synchronisiert` +
    (skipped ? ` (${skipped} manuell gepflegte übersprungen)` : ''));
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
