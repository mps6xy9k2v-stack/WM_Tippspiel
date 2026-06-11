'use strict';

// Klassische Tippspiel-Punkteregeln (wie z. B. bei Kicktipp üblich):
//   4 Punkte – exaktes Ergebnis
//   3 Punkte – richtige Tordifferenz (bei Unentschieden: richtiges Remis, falsche Tore)
//   2 Punkte – richtige Tendenz (Sieger richtig, Differenz falsch)
//   0 Punkte – sonst
const POINTS = { EXACT: 4, DIFF: 3, TENDENCY: 2, NONE: 0 };

function calcPoints(homeTip, awayTip, homeScore, awayScore) {
  if (homeScore === null || homeScore === undefined ||
      awayScore === null || awayScore === undefined) {
    return null;
  }
  if (homeTip === homeScore && awayTip === awayScore) return POINTS.EXACT;
  if (homeTip - awayTip === homeScore - awayScore) return POINTS.DIFF;
  if (Math.sign(homeTip - awayTip) === Math.sign(homeScore - awayScore)) return POINTS.TENDENCY;
  return POINTS.NONE;
}

module.exports = { calcPoints, POINTS };
