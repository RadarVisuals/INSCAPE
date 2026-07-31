import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import { projectCroppedMediaRectangle } from '../rendering/latticeCrop.js';
import {
  createLatticeProductionCropCandidate,
  createLatticeProductionCropPanGesture,
  createLatticeProductionCropSession,
  finishLatticeProductionCropPanGesture,
  latticeProductionCropMask,
  nudgeLatticeProductionCrop,
  setLatticeProductionCropZoom,
  updateLatticeProductionCropPanGesture,
} from './latticeProductionCrop.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const media = (overrides = {}) => ({ stableAssetId: ASSET, width: 1600, height: 900, ...overrides });
const placement = (overrides = {}) => ({
  id: 'placement-crop', stableAssetId: ASSET, column: 4, row: 3, columnSpan: 8, rowSpan: 8,
  layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, ...overrides,
});

test('null, existing, portrait, landscape, square, and transparent media share centered cover semantics', () => {
  const mask = latticeProductionCropMask(placement());
  for (const dimensions of [{ width: 900, height: 1600 }, { width: 1600, height: 900 }, { width: 800, height: 800 }]) {
    const session = createLatticeProductionCropSession(placement(), media(dimensions));
    assert.deepEqual(session.previewCrop, { x: 0.5, y: 0.5, zoom: 1 });
    const rectangle = projectCroppedMediaRectangle(mask, dimensions, session.previewCrop);
    assert.ok(rectangle.left <= mask.left && rectangle.top <= mask.top);
    assert.ok(rectangle.left + rectangle.width >= mask.left + mask.width);
    assert.ok(rectangle.top + rectangle.height >= mask.top + mask.height);
  }
  const existing = createLatticeProductionCropSession(placement({
    crop: { x: 0.1, y: 0.8, zoom: 2 }, transparencyMode: 'PRESERVE_ALPHA',
  }), media());
  assert.deepEqual(existing.startCrop, { x: 0.1, y: 0.8, zoom: 2 });
  assert.equal(existing.dirty, false);
});

test('pointer pan uses a dead zone, moves focus opposite the dragged image, clamps coverage, and cancels exactly', () => {
  const session = createLatticeProductionCropSession(
    placement(),
    media({ width: 900, height: 1600 }),
    { left: 0, top: 0, width: 320, height: 320 },
  );
  const start = createLatticeProductionCropPanGesture(session, { x: 100, y: 100 });
  const click = updateLatticeProductionCropPanGesture(start, { x: 106, y: 107 });
  assert.equal(click.activated, false);
  const moved = updateLatticeProductionCropPanGesture(start, { x: 100, y: 180 });
  assert.equal(moved.activated, true);
  assert.equal(moved.previewCrop.y, 0.359375);
  assert.deepEqual(finishLatticeProductionCropPanGesture(moved, { cancelled: true }), {
    changed: false, crop: start.startCrop,
  });
  const bounded = updateLatticeProductionCropPanGesture(start, { x: -10000, y: 10000 });
  assert.ok(bounded.previewCrop.x <= 1 && bounded.previewCrop.y >= 0);
});

test('keyboard pan and explicit zoom stay within one-through-four cover bounds', () => {
  const session = createLatticeProductionCropSession(placement(), media({ width: 900, height: 1600 }));
  const nudged = nudgeLatticeProductionCrop(session.previewCrop, session.media, session.mask, { x: 0.01, y: -0.05 });
  assert.equal(nudged.x, 0.5);
  assert.ok(nudged.y < 0.5);
  assert.equal(setLatticeProductionCropZoom(nudged, session.media, session.mask, 99).zoom, 4);
  assert.equal(setLatticeProductionCropZoom(nudged, session.media, session.mask, -1).zoom, 1);
});

test('completed crop changes only crop and validates the complete expected placement and media snapshot', () => {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  const expected = placement();
  draft.tables[4].placements = [expected];
  const before = structuredClone(draft);
  const request = {
    crop: { x: 0.5, y: 0.5, zoom: 1 }, expectedMedia: media(), expectedPlacement: structuredClone(expected),
    media: media(), placementId: expected.id, tableId: 'table-05',
  };
  const candidate = createLatticeProductionCropCandidate(draft, request);
  assert.deepEqual(candidate.tables[4].placements[0], { ...expected, crop: request.crop });
  assert.deepEqual(draft, before);
  assert.equal(createLatticeProductionCropCandidate(candidate, {
    ...request, expectedPlacement: structuredClone(candidate.tables[4].placements[0]),
  }), null);
  const legacyFocus = placement({ crop: { x: 0, y: 1, zoom: 1 } });
  const legacyDraft = createEmptyLatticeProductionDraft(PROFILE);
  legacyDraft.tables[4].placements = [legacyFocus];
  assert.equal(createLatticeProductionCropCandidate(legacyDraft, {
    ...request,
    crop: structuredClone(legacyFocus.crop),
    expectedPlacement: structuredClone(legacyFocus),
    placementId: legacyFocus.id,
  }), null);
  const native = createLatticeProductionCropCandidate(candidate, {
    ...request, crop: null, expectedPlacement: structuredClone(candidate.tables[4].placements[0]),
  });
  assert.equal(native.tables[4].placements[0].crop, null);
});

test('stale placement, authority, media, dimensions, invalid values, and uncovered candidates fail closed', () => {
  const base = createEmptyLatticeProductionDraft(PROFILE);
  const expected = placement({ crop: { x: 0.5, y: 0.5, zoom: 1 } });
  base.tables[4].placements = [expected];
  const common = {
    crop: { x: 0.5, y: 0.5, zoom: 2 }, expectedMedia: media(), expectedPlacement: structuredClone(expected),
    media: media(), placementId: expected.id, tableId: 'table-05',
  };
  assert.throws(() => createLatticeProductionCropCandidate(base, {
    ...common, expectedPlacement: { ...expected, column: 5 },
  }), { code: 'LATTICE_CROP_PLACEMENT_STALE' });
  for (const [name, mutate] of [
    ['starting crop', (value) => { value.crop.zoom = 2; }],
    ['geometry', (value) => { value.column = 5; }],
    ['layer', (value) => { value.layer = 3; }],
    ['navigation order', (value) => { value.navigationOrder = 4; }],
    ['mat', (value) => { value.mat.inset.left = 0.1; value.mat.enabled = true; }],
    ['visibility', (value) => { value.visibility = 'PRIVATE'; }],
    ['lock', (value) => { value.locked = true; }],
  ]) {
    const stale = structuredClone(base); mutate(stale.tables[4].placements[0]);
    assert.throws(() => createLatticeProductionCropCandidate(stale, common), {
      code: 'LATTICE_CROP_PLACEMENT_STALE',
    }, name);
  }
  for (const [name, mutate, code] of [
    ['private table', (draft) => { draft.tables[4].visibility = 'PRIVATE'; }, 'LATTICE_CROP_TABLE_PRIVATE'],
    ['private placement', (draft) => { draft.tables[4].placements[0].visibility = 'PRIVATE'; }, 'LATTICE_CROP_PLACEMENT_PRIVATE'],
    ['locked', (draft) => { draft.tables[4].placements[0].locked = true; }, 'LATTICE_CROP_PLACEMENT_LOCKED'],
  ]) {
    const draft = structuredClone(base); mutate(draft);
    assert.throws(() => createLatticeProductionCropCandidate(draft, {
      ...common, expectedPlacement: structuredClone(draft.tables[4].placements[0]),
    }), { code }, name);
  }
  assert.throws(() => createLatticeProductionCropCandidate(base, {
    ...common, media: media({ width: 900 }),
  }), { code: 'LATTICE_CROP_MEDIA_STALE' });
  assert.throws(() => createLatticeProductionCropCandidate(base, {
    ...common, crop: { x: 0.5, y: 0.5, zoom: 5 },
  }), { code: 'LATTICE_CROP_VALUE_INVALID' });
  assert.throws(() => createLatticeProductionCropCandidate(base, {
    ...common, crop: { x: 0, y: 0, zoom: 1 },
  }), { code: 'LATTICE_CROP_COVERAGE_INVALID' });
  assert.deepEqual(base.tables[4].placements[0], expected);
});
