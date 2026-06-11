'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseOfKickoff } = require('../src/fetch-matches');

test('openfootball-Zeit mit negativem UTC-Offset wird korrekt umgerechnet', () => {
  assert.strictEqual(parseOfKickoff('2026-06-11', '13:00 UTC-6'), '2026-06-11T19:00:00.000Z');
});

test('openfootball-Zeit mit positivem UTC-Offset wird korrekt umgerechnet', () => {
  assert.strictEqual(parseOfKickoff('2026-06-12', '18:00 UTC+2'), '2026-06-12T16:00:00.000Z');
});

test('Zeit ohne Offset wird als UTC interpretiert', () => {
  assert.strictEqual(parseOfKickoff('2026-06-12', '18:00'), '2026-06-12T18:00:00.000Z');
});

test('fehlende Zeit ergibt 12:00 UTC als Platzhalter', () => {
  assert.strictEqual(parseOfKickoff('2026-06-12', null), '2026-06-12T12:00:00Z');
});
