import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import {
  LATTICE_PRODUCTION_TRANSFORM_OPERATIONS,
  createLatticeProductionGroupTransformCandidate,
  createLatticeProductionTransformCandidate,
  projectLatticeProductionTransform,
} from './latticeProductionTransform.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = () => ({
  id: 'placement-1', stableAssetId: ASSET, column: 2, row: 3, columnSpan: 6, rowSpan: 4,
  layer: 0, navigationOrder: 0, crop: { x: 0.2, y: 0.7, zoom: 1.5 }, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

test('transform candidates rotate and mirror only the selected unlocked public placement', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement()];
  const expectedPlacement = structuredClone(draft.tables[4].placements[0]);
  const rotated = createLatticeProductionTransformCandidate(draft, {
    expectedPlacement, operation: LATTICE_PRODUCTION_TRANSFORM_OPERATIONS.ROTATE,
    placementId: 'placement-1', tableId: 'table-05',
  });
  assert.equal(rotated.tables[4].placements[0].transform.quarterTurns, 1);
  const mirrored = createLatticeProductionTransformCandidate(rotated, {
    expectedPlacement: rotated.tables[4].placements[0],
    operation: LATTICE_PRODUCTION_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL,
    placementId: 'placement-1', tableId: 'table-05',
  });
  assert.equal(mirrored.tables[4].placements[0].transform.mirrorX, true);
  assert.deepEqual(draft.tables[4].placements[0], expectedPlacement);
  assert.throws(() => createLatticeProductionTransformCandidate(draft, {
    expectedPlacement: { ...expectedPlacement, row: 9 },
    operation: LATTICE_PRODUCTION_TRANSFORM_OPERATIONS.ROTATE,
    placementId: 'placement-1', tableId: 'table-05',
  }), { code: 'LATTICE_TRANSFORM_STALE_PLACEMENT' });
});

test('render transform swaps dimensions and maps authored crop focus', () => {
  assert.deepEqual(projectLatticeProductionTransform(placement().transform, { width: 600, height: 400 }, placement().crop), {
    crop: { x: 0.2, y: 0.7, zoom: 1.5 }, css: 'scale(1, 1) rotate(0deg)',
    dimensions: { width: 600, height: 400 }, swapped: false,
  });
  assert.deepEqual(projectLatticeProductionTransform(
    { quarterTurns: 1, mirrorX: true, mirrorY: false }, { width: 600, height: 400 }, placement().crop,
  ), {
    crop: { x: 0.7, y: 0.2, zoom: 1.5 }, css: 'scale(-1, 1) rotate(90deg)',
    dimensions: { width: 400, height: 600 }, swapped: true,
  });
});

test('group transform is atomic and rejects a stale or locked member', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const first = placement();
  const second = { ...placement(), id: 'placement-2', layer: 1, navigationOrder: 1 };
  draft.tables[4].placements = [first, second];
  const request = {
    expectedPlacements: structuredClone([first, second]),
    operation: LATTICE_PRODUCTION_TRANSFORM_OPERATIONS.MIRROR_VERTICAL,
    placementIds: [first.id, second.id], tableId: 'table-05',
  };
  const candidate = createLatticeProductionGroupTransformCandidate(draft, request);
  assert.deepEqual(candidate.tables[4].placements.map(({ transform }) => transform.mirrorY), [true, true]);
  assert.deepEqual(draft.tables[4].placements.map(({ transform }) => transform.mirrorY), [false, false]);
  const locked = structuredClone(draft); locked.tables[4].placements[1].locked = true;
  assert.throws(() => createLatticeProductionGroupTransformCandidate(locked, {
    ...request, expectedPlacements: structuredClone(locked.tables[4].placements),
  }), { code: 'LATTICE_TRANSFORM_PLACEMENT_LOCKED' });
  assert.equal(locked.tables[4].placements[0].transform.mirrorY, false);
});
