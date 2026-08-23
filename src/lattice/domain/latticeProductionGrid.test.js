import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LATTICE_PRODUCTION_GRID_STATES,
  LATTICE_PRODUCTION_VISIBILITY,
  createEmptyLatticeProductionDraft,
} from './latticeProductionDraft.js';
import {
  LATTICE_PRODUCTION_GRID_ACTIVATION_ORDER,
  createLatticeProductionGridActivationCandidate,
  createLatticeProductionGridDeactivationCandidate,
  createLatticeProductionGridRenameCandidate,
  createLatticeProductionGridVisibilityCandidate,
  describeLatticeProductionGridDeactivation,
  projectLatticeProductionActiveGrids,
} from './latticeProductionGrid.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (visibility = LATTICE_PRODUCTION_VISIBILITY.PUBLIC) => ({
  id: `placement-${visibility.toLowerCase()}`, stableAssetId: ASSET,
  column: 0, row: 0, columnSpan: 4, rowSpan: 4, layer: 0, navigationOrder: 0,
  crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, visibility, locked: false,
});

test('active Grid projection and activation use one bounded deterministic topology without mutating input', () => {
  const initial = createEmptyLatticeProductionDraft(PROFILE);
  const before = structuredClone(initial);
  assert.deepEqual(projectLatticeProductionActiveGrids(initial).map(({ id }) => id), ['table-05']);
  let candidate = initial;
  for (const expectedId of LATTICE_PRODUCTION_GRID_ACTIVATION_ORDER.slice(1)) {
    candidate = createLatticeProductionGridActivationCandidate(candidate);
    const active = projectLatticeProductionActiveGrids(candidate);
    assert.equal(active.at(-1).id, expectedId);
    assert.equal(active.at(-1).visibility, LATTICE_PRODUCTION_VISIBILITY.PRIVATE);
  }
  assert.deepEqual(initial, before);
  assert.equal(projectLatticeProductionActiveGrids(candidate).length, 9);
  assert.throws(() => createLatticeProductionGridActivationCandidate(candidate),
    ({ code }) => code === 'LATTICE_GRID_LIMIT_REACHED');
});

test('rename and visibility operate only on active Grids and return detached validated candidates', () => {
  const initial = createEmptyLatticeProductionDraft(PROFILE);
  const renamed = createLatticeProductionGridRenameCandidate(initial, { gridId: 'table-05', name: '  MY   HOME  ' });
  assert.equal(renamed.tables[4].title, 'MY HOME');
  assert.equal(initial.tables[4].title, 'HOME');
  const privateHome = createLatticeProductionGridVisibilityCandidate(renamed,
    { gridId: 'table-05', visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE });
  assert.equal(privateHome.tables[4].visibility, LATTICE_PRODUCTION_VISIBILITY.PRIVATE);
  assert.throws(() => createLatticeProductionGridRenameCandidate(initial, { gridId: 'table-05', name: '  ' }),
    ({ code }) => code === 'LATTICE_GRID_NAME_INVALID');
  assert.throws(() => createLatticeProductionGridRenameCandidate(initial, { gridId: 'table-06', name: 'NO' }),
    ({ code }) => code === 'LATTICE_GRID_UNUSED');
  assert.throws(() => createLatticeProductionGridVisibilityCandidate(initial, { gridId: 'missing', visibility: 'PUBLIC' }),
    ({ code }) => code === 'LATTICE_GRID_UNKNOWN');
});

test('deactivation describes exact impact, rejects stale confirmation and resets one non-HOME slot atomically', () => {
  const draft = createLatticeProductionGridActivationCandidate(createEmptyLatticeProductionDraft(PROFILE));
  const grid = draft.tables.find(({ id }) => id === 'table-06');
  grid.placements = [placement(), { ...placement(LATTICE_PRODUCTION_VISIBILITY.PRIVATE), id: 'placement-private', layer: 1, navigationOrder: 1 }];
  const impact = describeLatticeProductionGridDeactivation(draft, { gridId: grid.id });
  assert.deepEqual(impact, {
    gridId: 'table-06', gridFingerprint: JSON.stringify(grid), gridTitle: 'GRID 02', placementCount: 2,
    privatePlacementCount: 1, publicPlacementCount: 1,
  });
  assert.throws(() => createLatticeProductionGridDeactivationCandidate(draft, {
    gridId: grid.id, expectedImpact: { ...impact, placementCount: 1 },
  }), ({ code }) => code === 'LATTICE_GRID_DEACTIVATION_STALE');
  const replaced = structuredClone(draft);
  replaced.tables.find(({ id }) => id === grid.id).placements[0].stableAssetId =
    '42:0x3333333333333333333333333333333333333333:0x01';
  assert.throws(() => createLatticeProductionGridDeactivationCandidate(replaced, {
    gridId: grid.id, expectedImpact: impact,
  }), ({ code }) => code === 'LATTICE_GRID_DEACTIVATION_STALE');
  const candidate = createLatticeProductionGridDeactivationCandidate(draft, { gridId: grid.id, expectedImpact: impact });
  const reset = candidate.tables.find(({ id }) => id === grid.id);
  assert.deepEqual(reset, {
    id: 'table-06', coordinate: { x: 1, y: 0 }, gridState: LATTICE_PRODUCTION_GRID_STATES.UNUSED,
    title: '', subtitle: '', labelVisible: true, labelAnchor: 'top-left',
    labelOffset: { column: 0, row: 0 }, visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE, placements: [],
  });
  assert.equal(draft.tables.find(({ id }) => id === grid.id).placements.length, 2);
  assert.throws(() => createLatticeProductionGridDeactivationCandidate(draft, {
    gridId: 'table-05', expectedImpact: describeLatticeProductionGridDeactivation(draft, { gridId: 'table-05' }),
  }), ({ code }) => code === 'LATTICE_GRID_HOME_REQUIRED');
});
