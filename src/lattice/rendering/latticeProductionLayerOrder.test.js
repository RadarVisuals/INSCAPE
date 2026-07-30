import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareLatticeProductionLayers,
  createLatticeProductionLayerRanks,
  orderedLatticeProductionLayers,
} from './latticeProductionLayerOrder.js';

test('canonical layer ordering is sparse-safe and uses placement ID only as a deterministic tie-breaker', () => {
  const placements = [
    { id: 'placement-max', layer: Number.MAX_SAFE_INTEGER },
    { id: 'placement-b', layer: 0 },
    { id: 'placement-a', layer: 0 },
    { id: 'placement-gap', layer: 9000 },
  ];
  assert.deepEqual(orderedLatticeProductionLayers(placements).map(({ id }) => id), [
    'placement-a', 'placement-b', 'placement-gap', 'placement-max',
  ]);
  assert.deepEqual(placements.map(({ id }) => id), [
    'placement-max', 'placement-b', 'placement-a', 'placement-gap',
  ]);
  assert.ok(compareLatticeProductionLayers(placements[1], placements[0]) < 0);
});

test('render-only ranks stay dense without changing or exposing canonical layer values', () => {
  const placements = [
    { id: 'placement-front', layer: Number.MAX_SAFE_INTEGER },
    { id: 'placement-back', layer: 0 },
    { id: 'placement-middle', layer: 4_000_000_000 },
  ];
  const ranks = createLatticeProductionLayerRanks(placements);
  assert.deepEqual([...ranks], [
    ['placement-back', 0], ['placement-middle', 1], ['placement-front', 2],
  ]);
  assert.deepEqual(placements.map(({ layer }) => layer), [Number.MAX_SAFE_INTEGER, 0, 4_000_000_000]);
});
