'use strict';

// Hilfslogik für den Supabase-Sync (separat, damit testbar).

const STATUS_RANK = { SCHEDULED: 0, LIVE: 1, FINISHED: 2, CANCELLED: 2 };
const KICKOFF_LOOKAHEAD_MS = 7 * 60 * 1000;   // Anstoß in den nächsten 7 Min
const POST_KICKOFF_MS = 150 * 60 * 1000;      // bis ~2,5 h nach Anstoß

// Eingehende Quelle mit dem DB-Stand zusammenführen: kein Score-Verlust,
// kein Status-Downgrade. So überschreibt der volle Abgleich (mit ggf.
// verzögerten/null-Werten) keine bereits bekannten Live-/Endstände.
function mergeRow(incoming, prev) {
  if (!prev) return incoming;
  const out = { ...incoming };
  const inHasScore = incoming.home_score != null && incoming.away_score != null;
  const prevHasScore = prev.home_score != null && prev.away_score != null;
  if (!inHasScore && prevHasScore) {
    out.home_score = prev.home_score;
    out.away_score = prev.away_score;
  }
  if ((STATUS_RANK[incoming.status] ?? 0) < (STATUS_RANK[prev.status] ?? 0)) {
    out.status = prev.status;
  }
  return out;
}

// Lohnt sich der 30-s-Live-Takt? Zeitbasiert, da Gratis-Quellen den Status
// verzögert melden: ein angepfiffenes (noch nicht beendetes) Spiel zählt.
function worthLivePolling(matches, now = Date.now()) {
  return matches.some((m) => {
    if (m.status === 'FINISHED' || m.status === 'CANCELLED') return false;
    const dt = new Date(m.kickoff_utc).getTime() - now;
    return dt <= KICKOFF_LOOKAHEAD_MS && dt >= -POST_KICKOFF_MS;
  });
}

module.exports = { mergeRow, worthLivePolling, STATUS_RANK, KICKOFF_LOOKAHEAD_MS, POST_KICKOFF_MS };
