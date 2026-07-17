import test from 'node:test';
import assert from 'node:assert/strict';
import { getRenderResolution, MAX_RENDER_RESOLUTION } from './renderResolution.js';

test('render resolution preserves standard DPR and caps high-DPI displays', () => {
  assert.equal(getRenderResolution(1), 1);
  assert.equal(getRenderResolution(1.25), 1.25);
  assert.equal(getRenderResolution(2), MAX_RENDER_RESOLUTION);
  assert.equal(getRenderResolution(3), MAX_RENDER_RESOLUTION);
});

test('render resolution safely normalizes unavailable or invalid DPR values', () => {
  assert.equal(getRenderResolution(undefined), 1);
  assert.equal(getRenderResolution(0), 1);
  assert.equal(getRenderResolution(Number.NaN), 1);
});
