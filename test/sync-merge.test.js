'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { mergeRow, worthLivePolling } = require('../src/sync-merge');

test('voller Abgleich überschreibt bekannten Live-Stand nicht mit null', () => {
  const incoming = { ext_id: 'fd:1', status: 'SCHEDULED', home_score: null, away_score: null };
  const prev = { status: 'LIVE', home_score: 1, away_score: 0 };
  const out = mergeRow(incoming, prev);
  assert.strictEqual(out.home_score, 1);
  assert.strictEqual(out.away_score, 0);
  assert.strictEqual(out.status, 'LIVE'); // kein Downgrade LIVE -> SCHEDULED
});

test('echter Endstand der Quelle gewinnt (FINISHED überschreibt LIVE)', () => {
  const incoming = { status: 'FINISHED', home_score: 2, away_score: 1 };
  const prev = { status: 'LIVE', home_score: 2, away_score: 0 };
  const out = mergeRow(incoming, prev);
  assert.strictEqual(out.status, 'FINISHED');
  assert.strictEqual(out.away_score, 1);
});

test('ohne Vorzustand bleibt der eingehende Datensatz unverändert', () => {
  const incoming = { status: 'SCHEDULED', home_score: null, away_score: null };
  assert.deepStrictEqual(mergeRow(incoming, undefined), incoming);
});

test('FINISHED wird nicht auf SCHEDULED zurückgesetzt', () => {
  const out = mergeRow({ status: 'SCHEDULED', home_score: null, away_score: null }, { status: 'FINISHED', home_score: 3, away_score: 1 });
  assert.strictEqual(out.status, 'FINISHED');
  assert.strictEqual(out.home_score, 3);
});

test('worthLivePolling: angepfiffenes, nicht beendetes Spiel zählt', () => {
  const now = Date.parse('2026-06-17T20:00:00Z');
  const matches = [{ status: 'SCHEDULED', kickoff_utc: '2026-06-17T19:50:00Z' }]; // vor 10 Min angepfiffen
  assert.strictEqual(worthLivePolling(matches, now), true);
});

test('worthLivePolling: lange vorbei oder beendet zählt nicht', () => {
  const now = Date.parse('2026-06-17T23:00:00Z');
  assert.strictEqual(worthLivePolling([{ status: 'SCHEDULED', kickoff_utc: '2026-06-17T19:00:00Z' }], now), false);
  assert.strictEqual(worthLivePolling([{ status: 'FINISHED', kickoff_utc: '2026-06-17T22:30:00Z' }], now), false);
});

test('worthLivePolling: Anstoß in 5 Min zählt schon', () => {
  const now = Date.parse('2026-06-17T19:55:00Z');
  assert.strictEqual(worthLivePolling([{ status: 'SCHEDULED', kickoff_utc: '2026-06-17T20:00:00Z' }], now), true);
});
