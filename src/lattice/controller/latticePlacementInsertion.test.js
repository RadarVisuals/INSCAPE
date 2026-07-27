import assert from 'node:assert/strict';
import test from 'node:test';

import { CANONICAL_LATTICE_ARTBOARD } from '../domain/latticeProfile.js';
import {
  createPlacementAtAnchor,
  normalizedInsertionAnchor,
} from './latticePlacementInsertion.js';

const ASSET = '42:0x1111111111111111111111111111111111111111:0x01';
const existing = [
  { id: 'a', layer: 4, navigationOrder: 7 },
  { id: 'b', layer: 1, navigationOrder: 2 },
];

test('pointer coordinates project into a clamped normalized authored-artboard anchor', () => {
  const artboard = { left: -100, top: 50, width: 1000, height: 500 };
  assert.deepEqual(normalizedInsertionAnchor({ x: 400, y: 300 }, artboard), { x: 0.5, y: 0.5 });
  assert.deepEqual(normalizedInsertionAnchor({ x: -500, y: 900 }, artboard), { x: 0, y: 1 });
  assert.throws(() => normalizedInsertionAnchor({ x: NaN, y: 0 }, artboard), /finite pointer/);
});

test('placement creation centers native-ratio geometry on the normalized anchor', () => {
  const placement = createPlacementAtAnchor({
    anchor: { x: 0.5, y: 0.5 },
    artboard: CANONICAL_LATTICE_ARTBOARD,
    media: { width: 2000, height: 1000 },
    placementId: 'inserted-1',
    placements: existing,
    preferredWidth: 0.24,
    stableAssetId: ASSET,
  });
  assert.equal(placement.width, 0.24);
  assert.equal(placement.height, 0.24 * (16 / 9) * 0.5);
  assert.equal(placement.x + placement.width / 2, 0.5);
  assert.equal(placement.y + placement.height / 2, 0.5);
  assert.equal(placement.layer, 5);
  assert.equal(placement.navigationOrder, 8);
  assert.equal(placement.crop, null);
});

test('edge insertion clamps the complete placement while preserving its ratio', () => {
  const placement = createPlacementAtAnchor({
    anchor: { x: 1, y: 1 }, artboard: CANONICAL_LATTICE_ARTBOARD,
    media: { width: 1000, height: 2000 }, placementId: 'inserted-edge',
    placements: [], preferredWidth: 0.4, stableAssetId: ASSET,
  });
  assert.equal(placement.x + placement.width, 1);
  assert.equal(placement.y + placement.height, 1);
  assert.equal((placement.width / placement.height) * (16 / 9), 0.5);
});

test('creation accepts repeat assets but rejects duplicate placement IDs and invalid contracts', () => {
  const first = createPlacementAtAnchor({
    anchor: { x: 0.5, y: 0.5 }, artboard: CANONICAL_LATTICE_ARTBOARD,
    media: { width: 1, height: 1 }, placementId: 'repeat', placements: [], stableAssetId: ASSET,
  });
  const repeatedAsset = createPlacementAtAnchor({
    anchor: { x: 0.6, y: 0.6 }, artboard: CANONICAL_LATTICE_ARTBOARD,
    media: { width: 1, height: 1 }, placementId: 'repeat-2', placements: [first], stableAssetId: ASSET,
  });
  assert.equal(repeatedAsset.stableAssetId, ASSET);
  assert.throws(() => createPlacementAtAnchor({
    anchor: { x: 0.5, y: 0.5 }, artboard: CANONICAL_LATTICE_ARTBOARD,
    media: { width: 1, height: 1 }, placementId: 'repeat', placements: [first], stableAssetId: ASSET,
  }), /unique placement ID/);
  assert.throws(() => createPlacementAtAnchor({
    anchor: { x: 0.5, y: 0.5 }, artboard: CANONICAL_LATTICE_ARTBOARD,
    media: { width: 1, height: 1 }, placementId: 'bad-asset', placements: [], stableAssetId: 'invalid',
  }), /canonical stable asset ID/);
});
