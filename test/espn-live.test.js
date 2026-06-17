'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { matchEspnToDb, canonTeam } = require('../src/espn-live');

const db = [
  { ext_id: 'fd:1', home_team: 'USA', away_team: 'Paraguay', kickoff_utc: '2026-06-17T19:00:00Z', manual_override: false },
  { ext_id: 'fd:2', home_team: 'Germany', away_team: 'Ivory Coast', kickoff_utc: '2026-06-17T22:00:00Z', manual_override: false },
  { ext_id: 'manual:9', home_team: 'USA', away_team: 'Paraguay', kickoff_utc: '2026-06-17T19:00:00Z', manual_override: true },
];

test('ordnet ESPN-Event per Teamname dem richtigen Spiel zu', () => {
  const events = [{ date: '2026-06-17', home: canonTeam('United States'), away: canonTeam('Paraguay'), home_score: 2, away_score: 0, status: 'LIVE' }];
  const u = matchEspnToDb(events, db);
  assert.deepStrictEqual(u, [{ ext_id: 'fd:1', home_score: 2, away_score: 0, status: 'LIVE' }]);
});

test('Score folgt dem Team, nicht der Position (Heim/Auswärts vertauscht)', () => {
  // ESPN listet Paraguay als "home" -> Stand muss zu unserem Heim (USA) passen
  const events = [{ date: '2026-06-17', home: canonTeam('Paraguay'), away: canonTeam('United States'), home_score: 0, away_score: 3, status: 'LIVE' }];
  const u = matchEspnToDb(events, db);
  assert.deepStrictEqual(u, [{ ext_id: 'fd:1', home_score: 3, away_score: 0, status: 'LIVE' }]);
});

test('Synonyme/Akzente werden erkannt (Côte d’Ivoire = Ivory Coast)', () => {
  const events = [{ date: '2026-06-17', home: canonTeam('Germany'), away: canonTeam("Côte d'Ivoire"), home_score: 1, away_score: 1, status: 'LIVE' }];
  const u = matchEspnToDb(events, db);
  assert.deepStrictEqual(u, [{ ext_id: 'fd:2', home_score: 1, away_score: 1, status: 'LIVE' }]);
});

test('manuell gepflegte Spiele werden nie überschrieben', () => {
  const onlyManual = [db[2]];
  const events = [{ date: '2026-06-17', home: canonTeam('USA'), away: canonTeam('Paraguay'), home_score: 5, away_score: 0, status: 'LIVE' }];
  assert.deepStrictEqual(matchEspnToDb(events, onlyManual), []);
});

test('Datumstoleranz ±1 Tag (Zeitzonen-Verschiebung)', () => {
  const events = [{ date: '2026-06-18', home: canonTeam('USA'), away: canonTeam('Paraguay'), home_score: 1, away_score: 0, status: 'FINISHED' }];
  const u = matchEspnToDb(events, db);
  assert.deepStrictEqual(u, [{ ext_id: 'fd:1', home_score: 1, away_score: 0, status: 'FINISHED' }]);
});

test('kein Treffer ohne passende Teams', () => {
  const events = [{ date: '2026-06-17', home: canonTeam('Spain'), away: canonTeam('Japan'), home_score: 1, away_score: 0, status: 'LIVE' }];
  assert.deepStrictEqual(matchEspnToDb(events, db), []);
});
