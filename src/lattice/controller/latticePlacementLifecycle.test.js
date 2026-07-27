import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLACEMENT_LAYER_DIRECTIONS,
  movePlacementLayer,
  placementLayerAvailability,
  removePlacement,
  replacePlacementAsset,
} from './latticePlacementLifecycle.js';

const ASSET_A = '42:0x1111111111111111111111111111111111111111:0x01';
const ASSET_B = '42:0x2222222222222222222222222222222222222222:0x02';
const placements = Object.freeze([
  Object.freeze({ id: 'a', stableAssetId: ASSET_A, layer: 0, navigationOrder: 2, crop: null, x: 0.1 }),
  Object.freeze({ id: 'b', stableAssetId: ASSET_A, layer: 1, navigationOrder: 0, crop: { x: 0.2, y: 0.7, zoom: 2 }, x: 0.2 }),
  Object.freeze({ id: 'c', stableAssetId: ASSET_A, layer: 2, navigationOrder: 1, crop: null, x: 0.3 }),
]);

test('removal affects only the selected placement without mutating source order', () => {
  const result = removePlacement(placements, 'b');
  assert.deepEqual(result.map(({ id }) => id), ['a', 'c']);
  assert.deepEqual(result.map(({ navigationOrder }) => navigationOrder), [2, 1]);
  assert.equal(placements.length, 3);
  assert.throws(() => removePlacement(placements, 'missing'), /existing placement ID/);
});

test('replacement preserves the presentation slot and clears only asset-specific crop', () => {
  const result = replacePlacementAsset(placements, 'b', ASSET_B);
  const replacement = result[1];
  assert.deepEqual(replacement, { ...placements[1], stableAssetId: ASSET_B, crop: null });
  assert.equal(result[0].stableAssetId, ASSET_A);
  assert.equal(placements[1].crop.zoom, 2);
  assert.throws(() => replacePlacementAsset(placements, 'b', 'not-an-asset'), /canonical stable asset ID/);
});

test('one-step layer movement normalizes visual layers without changing DOM or navigation order', () => {
  const forward = movePlacementLayer(placements, 'a', PLACEMENT_LAYER_DIRECTIONS.FORWARD);
  assert.deepEqual(forward.map(({ id }) => id), ['a', 'b', 'c']);
  assert.deepEqual(forward.map(({ layer }) => layer), [1, 0, 2]);
  assert.deepEqual(forward.map(({ navigationOrder }) => navigationOrder), [2, 0, 1]);
  const backward = movePlacementLayer(forward, 'a', PLACEMENT_LAYER_DIRECTIONS.BACKWARD);
  assert.deepEqual(backward.map(({ layer }) => layer), [0, 1, 2]);
  assert.deepEqual(placementLayerAvailability(placements, 'a'), { backward: false, forward: true });
  assert.deepEqual(placementLayerAvailability(placements, 'c'), { backward: true, forward: false });
});

test('boundary layer moves are inert clones and invalid directions fail closed', () => {
  const result = movePlacementLayer(placements, 'a', PLACEMENT_LAYER_DIRECTIONS.BACKWARD);
  assert.deepEqual(result, placements);
  assert.notEqual(result, placements);
  assert.throws(() => movePlacementLayer(placements, 'a', 'FRONT'), /canonical direction/);
});
