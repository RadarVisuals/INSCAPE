import assert from 'node:assert/strict';
import test from 'node:test';
import {
  interpolateOwnerShellSystemFocusCrop,
  ownerShellSystemFocusTransitionProgress,
} from './ownerShellSystemFocusArtworkMotion.js';

test('focus crop follows the complete viewer transition without a frozen head or tail', () => {
  const samples = Array.from({ length: 11 }, (_, index) =>
    ownerShellSystemFocusTransitionProgress(index / 10));
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 1);
  assert.ok(samples[1] > 0, 'crop movement starts with the viewer movement');
  assert.ok(samples.at(-2) < 1, 'crop movement remains live until the viewer endpoint');
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(samples[index] > samples[index - 1], 'the crop timeline is strictly monotone');
  }
});

test('opening and closing crop projections retain exact reversible endpoints', () => {
  const authored = { x: 0.2, y: 0.75, zoom: 2.4 };
  const native = { x: 0.5, y: 0.5, zoom: 1 };
  assert.deepEqual(interpolateOwnerShellSystemFocusCrop(authored, native, 0), authored);
  assert.deepEqual(interpolateOwnerShellSystemFocusCrop(authored, native, 1), native);
  assert.deepEqual(interpolateOwnerShellSystemFocusCrop(native, authored, 0), native);
  assert.deepEqual(interpolateOwnerShellSystemFocusCrop(native, authored, 1), authored);
});

test('focus transition progress clamps safely outside its normalized interval', () => {
  assert.equal(ownerShellSystemFocusTransitionProgress(-1), 0);
  assert.equal(ownerShellSystemFocusTransitionProgress(2), 1);
});
