import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import { createLatticeProductionLayerReorderCandidate, latticeProductionLayerTopologySnapshot } from './latticeProductionLayer.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (id, layer) => ({
  id, stableAssetId: ASSET, column: 0, row: 0, columnSpan: 2, rowSpan: 2, layer, navigationOrder: layer,
  crop: null, frameId: 'NONE', mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

test('arbitrary reorder preserves sparse canonical layer values and all non-layer fields', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('a', 2), placement('b', 9), placement('c', 20)];
  const before = structuredClone(draft);
  const result = createLatticeProductionLayerReorderCandidate(draft, {
    expectedPlacements: latticeProductionLayerTopologySnapshot(draft.tables[4]),
    orderedPlacementIds: ['c', 'a', 'b'], tableId: 'table-05',
  });
  assert.deepEqual(result.tables[4].placements.map(({ id, layer }) => ({ id, layer })), [
    { id: 'a', layer: 9 }, { id: 'b', layer: 20 }, { id: 'c', layer: 2 },
  ]);
  assert.deepEqual(before.tables[4].placements.map(({ layer }) => layer), [2, 9, 20]);
});

test('reorder rejects stale, incomplete, duplicate, and locked topology', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement('a', 0), placement('b', 1)];
  const expectedPlacements = latticeProductionLayerTopologySnapshot(draft.tables[4]);
  assert.throws(() => createLatticeProductionLayerReorderCandidate(draft, {
    expectedPlacements, orderedPlacementIds: ['a', 'a'], tableId: 'table-05',
  }), { code: 'LATTICE_LAYER_ORDER_INVALID' });
  draft.tables[4].placements[1].locked = true;
  assert.throws(() => createLatticeProductionLayerReorderCandidate(draft, {
    expectedPlacements: latticeProductionLayerTopologySnapshot(draft.tables[4]),
    orderedPlacementIds: ['b', 'a'], tableId: 'table-05',
  }), { code: 'LATTICE_LAYER_PLACEMENT_LOCKED' });
});
