'use strict';

// Erkennt ein bereits gespeichertes Spiel wieder, wenn die Datenquelle
// gewechselt wird (openfootball <-> football-data.org) und sich dadurch die
// ext_id ändert. Ohne das würden beim Quellenwechsel alle Spiele dupliziert
// und die gespeicherten Tipps hingen an den alten Einträgen.
//
// Heuristik: gleiches UTC-Datum + mindestens ein gleicher Teamname.
// Das ist eindeutig, weil ein Team höchstens einmal pro Tag spielt.

const normName = (s) => (s || '').toLowerCase().trim();
const utcDate = (iso) => new Date(iso).toISOString().slice(0, 10);

function findLegacyMatch(existing, incoming) {
  const prefix = incoming.ext_id.split(':')[0] + ':';
  const date = utcDate(incoming.kickoff_utc);
  return existing.find((e) =>
    !e.ext_id.startsWith(prefix) &&
    !e.manual_override &&
    utcDate(e.kickoff_utc) === date &&
    (normName(e.home_team) === normName(incoming.home_team) ||
     normName(e.away_team) === normName(incoming.away_team))) || null;
}

module.exports = { findLegacyMatch };
