'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { calcPoints } = require('../src/scoring');

test('exaktes Ergebnis gibt 4 Punkte', () => {
  assert.strictEqual(calcPoints(2, 1, 2, 1), 4);
  assert.strictEqual(calcPoints(0, 0, 0, 0), 4);
});

test('richtige Tordifferenz gibt 3 Punkte', () => {
  assert.strictEqual(calcPoints(2, 1, 3, 2), 3);
  assert.strictEqual(calcPoints(1, 1, 2, 2), 3); // falsches Remis-Ergebnis, gleiche Differenz
});

test('richtige Tendenz gibt 2 Punkte', () => {
  assert.strictEqual(calcPoints(2, 0, 1, 0), 2);
  assert.strictEqual(calcPoints(0, 1, 0, 3), 2);
});

test('falsche Tendenz gibt 0 Punkte', () => {
  assert.strictEqual(calcPoints(2, 1, 1, 2), 0);
  assert.strictEqual(calcPoints(1, 1, 2, 1), 0);
  assert.strictEqual(calcPoints(2, 1, 1, 1), 0);
});

test('ohne Ergebnis gibt es null (keine Wertung)', () => {
  assert.strictEqual(calcPoints(2, 1, null, null), null);
});
