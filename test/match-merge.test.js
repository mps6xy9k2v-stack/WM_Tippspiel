'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { findLegacyMatch } = require('../src/match-merge');

const incoming = {
  ext_id: 'fd:12345',
  home_team: 'Mexico',
  away_team: 'South Africa',
  kickoff_utc: '2026-06-11T19:00:00Z',
};

test('Spiel der alten Quelle wird über Datum + Teamname wiedererkannt', () => {
  const existing = [{
    ext_id: 'of:2026-06-11:Mexico:South Africa',
    home_team: 'Mexico', away_team: 'South Africa',
    kickoff_utc: '2026-06-11T18:00:00.000Z', // leicht andere Uhrzeit, gleicher Tag
    manual_override: false,
  }];
  assert.strictEqual(findLegacyMatch(existing, incoming), existing[0]);
});

test('ein Teamname reicht (Quellen schreiben Namen unterschiedlich)', () => {
  const existing = [{
    ext_id: 'of:1', home_team: 'Mexiko', away_team: 'South Africa',
    kickoff_utc: '2026-06-11T19:00:00Z', manual_override: false,
  }];
  assert.strictEqual(findLegacyMatch(existing, incoming), existing[0]);
});

test('gleiche Quelle wird nie umgehängt', () => {
  const existing = [{
    ext_id: 'fd:99', home_team: 'Mexico', away_team: 'South Africa',
    kickoff_utc: '2026-06-11T19:00:00Z', manual_override: false,
  }];
  assert.strictEqual(findLegacyMatch(existing, incoming), null);
});

test('manuell angelegte Spiele werden nie umgehängt', () => {
  const existing = [{
    ext_id: 'manual:1', home_team: 'Mexico', away_team: 'South Africa',
    kickoff_utc: '2026-06-11T19:00:00Z', manual_override: true,
  }];
  assert.strictEqual(findLegacyMatch(existing, incoming), null);
});

test('anderer Tag oder andere Teams ergeben keinen Treffer', () => {
  const existing = [
    { ext_id: 'of:1', home_team: 'Mexico', away_team: 'South Africa', kickoff_utc: '2026-06-12T19:00:00Z', manual_override: false },
    { ext_id: 'of:2', home_team: 'Canada', away_team: 'Qatar', kickoff_utc: '2026-06-11T19:00:00Z', manual_override: false },
  ];
  assert.strictEqual(findLegacyMatch(existing, incoming), null);
});
