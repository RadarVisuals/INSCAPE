import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import {
  createSystemWorkflowDropGeometry,
  createSystemWorkflowPlacementCandidate,
} from './systemWorkflowPlacement.js';
import {
  createSystemWorkflowGroupMovementCandidate,
  createSystemWorkflowGroupMovementRequest,
  createSystemWorkflowMovementCandidate,
  createSystemWorkflowMovementGesture,
  finishSystemWorkflowMovementGesture,
  nudgeSystemWorkflowPlacementGeometry,
  updateSystemWorkflowMovementGesture,
} from './systemWorkflowMovement.js';
import {
  SYSTEM_WORKFLOW_RESIZE_CORNERS,
  createSystemWorkflowGroupResizeCandidate,
  createSystemWorkflowResizeCandidate,
  createSystemWorkflowResizeGesture,
  finishSystemWorkflowResizeGesture,
  nudgeSystemWorkflowResizeGeometry,
  resizeSystemWorkflowGroupGeometries,
  systemWorkflowPlacementBoundaries,
  systemWorkflowTopBoundaryRemoveDock,
  updateSystemWorkflowResizeGesture,
} from './systemWorkflowResize.js';
import {
  createSystemWorkflowDuplicateCandidate,
  createSystemWorkflowGroupDuplicateCandidate,
} from './systemWorkflowDuplicate.js';
import {
  createSystemWorkflowGroupRemovalCandidate,
  createSystemWorkflowRemovalCandidate,
} from './systemWorkflowRemoval.js';
import {
  createSystemWorkflowLayerReorderCandidate,
  systemWorkflowLayerTopologySnapshot,
} from './systemWorkflowLayer.js';
import {
  createSystemWorkflowCropCandidate,
  createSystemWorkflowCropPanGesture,
  createSystemWorkflowCropSession,
  finishSystemWorkflowCropPanGesture,
  nudgeSystemWorkflowCrop,
  reframeSystemWorkflowCropForMask,
  setSystemWorkflowCropZoom,
  systemWorkflowCropMask,
  updateSystemWorkflowCropPanGesture,
} from './systemWorkflowCrop.js';
import { projectCroppedMediaRectangle } from '../lattice/rendering/latticeCrop.js';
import {
  createSystemWorkflowPresentationCandidate,
  systemWorkflowPlacementPresentation,
} from './systemWorkflowPresentation.js';
import {
  SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS,
  createSystemWorkflowGroupTransformCandidate,
  createSystemWorkflowTransformCandidate,
  projectSystemWorkflowImageRenderRectangle,
  projectSystemWorkflowTransform,
  transformSystemWorkflowGroupGeometries,
  unprojectSystemWorkflowCrop,
} from './systemWorkflowTransform.js';
import {
  SYSTEM_WORKFLOW_MARQUEE_SELECTION_MODES,
  resolveSystemWorkflowMarqueeSelection,
  systemWorkflowMarqueeIntersects,
  systemWorkflowMarqueeRectangle,
} from './systemWorkflowMarqueeSelection.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const MEDIA = Object.freeze({ stableAssetId: ASSET, width: 1600, height: 900 });
const FIELD = Object.freeze({ cellSize: 40, width: 1280, height: 720, left: 0, top: 0 });
const createDraft = () => createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
const placement = (id, layer = 0, overrides = {}) => ({
  id, stableAssetId: ASSET, column: 2, row: 2, columnSpan: 4, rowSpan: 4,
  layer, navigationOrder: layer, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  ...overrides,
});

test('placement creation retains canonical fit, pointer drop, IDs, bounds, and immutable input', () => {
  assert.deepEqual(createSystemWorkflowDropGeometry(
    3,
    2,
    { x: 260, y: 140 },
    { left: 100, top: 50, width: 320, height: 180, cellSize: 10 },
  ), { column: 10, row: 5, columnSpan: 12, rowSpan: 8 });
  assert.deepEqual(createSystemWorkflowDropGeometry(
    3,
    2,
    { x: 260, y: 140 },
    { left: 100, top: 50, width: 320, height: 180, cellSize: 10, snapStep: 4 },
  ), { column: 12, row: 4, columnSpan: 12, rowSpan: 8 });
  assert.deepEqual(createSystemWorkflowDropGeometry(
    3,
    2,
    { x: 263, y: 143 },
    { left: 100, top: 50, width: 320, height: 180, cellSize: 10, snapStep: 1 / 9 },
  ), { column: 10 + 3 / 9, row: 5 + 3 / 9, columnSpan: 12, rowSpan: 8 });
  const draft = createDraft();
  const before = structuredClone(draft);
  const candidate = createSystemWorkflowPlacementCandidate(draft, {
    destination: { column: 20, row: 10, columnSpan: 12, rowSpan: 8 },
    generatePlacementId: () => 'placement-a',
    gridId: 'grid:home',
    nativeHeight: 2,
    nativeWidth: 3,
    stableAssetId: ASSET,
  });
  assert.deepEqual(candidate.grids[0].placements[0], {
    id: 'placement-a', stableAssetId: ASSET, column: 20, row: 10, columnSpan: 12, rowSpan: 8,
    layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
    visibility: 'PUBLIC', locked: false,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  });
  assert.deepEqual(draft, before);
  assert.throws(() => createSystemWorkflowPlacementCandidate(draft, {
    destination: { column: 4095, row: 4095, columnSpan: 2, rowSpan: 2 },
    generatePlacementId: () => 'placement-b', gridId: 'grid:home', stableAssetId: ASSET,
  }), { code: 'SYSTEM_WORKFLOW_PLACEMENT_DROP_GEOMETRY_INVALID' });
});

test('single and group movement retain stale, lock, shared-delta, span, bounds, and no-op rules', () => {
  const draft = createDraft();
  draft.grids[0].placements = [
    placement('a'),
    placement('b', 1, { column: 10, row: 10, columnSpan: 3, rowSpan: 3 }),
  ];
  const request = createSystemWorkflowGroupMovementRequest(
    draft.grids[0].placements,
    { column: 2, row: 1 },
    'grid:home',
  );
  const moved = createSystemWorkflowGroupMovementCandidate(draft, request);
  assert.deepEqual(moved.grids[0].placements.map(({ column, row }) => ({ column, row })), [
    { column: 4, row: 3 }, { column: 12, row: 11 },
  ]);
  const fractionalRequest = createSystemWorkflowGroupMovementRequest(
    draft.grids[0].placements,
    { column: 5 / 9, row: -2 / 9 },
    'grid:home',
  );
  const fractionallyMoved = createSystemWorkflowGroupMovementCandidate(draft, fractionalRequest);
  assert.deepEqual(fractionallyMoved.grids[0].placements.map(({ column, row }) => ({ column, row })), [
    { column: 2 + 5 / 9, row: 2 - 2 / 9 },
    { column: 10 + 5 / 9, row: 10 - 2 / 9 },
  ]);
  const first = draft.grids[0].placements[0];
  assert.equal(createSystemWorkflowMovementCandidate(draft, {
    destination: { column: 2, row: 2, columnSpan: 4, rowSpan: 4 },
    expectedStartGeometry: { column: 2, row: 2, columnSpan: 4, rowSpan: 4 },
    gridId: 'grid:home', placementId: first.id,
  }), null);
  const locked = structuredClone(draft);
  locked.grids[0].placements[1].locked = true;
  assert.throws(() => createSystemWorkflowGroupMovementCandidate(locked, request), {
    code: 'SYSTEM_WORKFLOW_MOVEMENT_PLACEMENT_LOCKED',
  });
  assert.throws(() => createSystemWorkflowMovementCandidate(draft, {
    destination: { column: 4, row: 4, columnSpan: 5, rowSpan: 4 },
    expectedStartGeometry: { column: 2, row: 2, columnSpan: 4, rowSpan: 4 },
    gridId: 'grid:home', placementId: first.id,
  }), { code: 'SYSTEM_WORKFLOW_MOVEMENT_SPAN_CHANGED' });
});

test('movement gestures, completion, cancellation, nudging, and bounds produce canonical geometry', () => {
  const entry = placement('move', 0, {
    column: 10, row: 5, columnSpan: 12, rowSpan: 7,
  });
  const start = createSystemWorkflowMovementGesture(entry, FIELD, { x: 500, y: 300 });
  assert.deepEqual(start.grabOffset, { column: 2.5, row: 2.5 });
  const click = updateSystemWorkflowMovementGesture(start, { x: 506, y: 307 }, FIELD);
  assert.equal(click.activated, false);
  assert.deepEqual(finishSystemWorkflowMovementGesture(click), {
    committed: false,
    geometry: { column: 10, row: 5, columnSpan: 12, rowSpan: 7 },
  });
  const moved = updateSystemWorkflowMovementGesture(start, { x: 580, y: 380 }, FIELD);
  assert.deepEqual(moved.previewGeometry, {
    column: 12, row: 7, columnSpan: 12, rowSpan: 7,
  });
  assert.deepEqual(finishSystemWorkflowMovementGesture(moved), {
    committed: true,
    geometry: { column: 12, row: 7, columnSpan: 12, rowSpan: 7 },
  });
  assert.deepEqual(finishSystemWorkflowMovementGesture(moved, { cancelled: true }), {
    committed: false,
    geometry: { column: 10, row: 5, columnSpan: 12, rowSpan: 7 },
  });
  assert.deepEqual(updateSystemWorkflowMovementGesture(
    start, { x: 650, y: 420 }, { ...FIELD, snapStep: 4 },
  ).previewGeometry, { column: 12, row: 8, columnSpan: 12, rowSpan: 7 });
  assert.deepEqual(updateSystemWorkflowMovementGesture(
    start, { x: 506, y: 314 }, { ...FIELD, snapStep: 1 / 9 }, 0,
  ).previewGeometry, { column: 10 + 1 / 9, row: 5 + 3 / 9, columnSpan: 12, rowSpan: 7 });
  assert.deepEqual(updateSystemWorkflowMovementGesture(
    start, { x: 1000000000, y: -1000000000 }, FIELD,
  ).previewGeometry, { column: 4084, row: -4096, columnSpan: 12, rowSpan: 7 });
  assert.deepEqual(nudgeSystemWorkflowPlacementGeometry(entry, { column: -1, row: 1 }), {
    column: 9, row: 6, columnSpan: 12, rowSpan: 7,
  });
  assert.equal(nudgeSystemWorkflowPlacementGeometry(
    { ...entry, column: -4096 }, { column: -1, row: 0 },
  ), null);
  assert.equal(nudgeSystemWorkflowPlacementGeometry(
    { ...entry, row: 4089 }, { column: 0, row: 1 },
  ), null);
});

test('single and group resize preserve corner semantics and the opposite anchor', () => {
  const draft = createDraft();
  const entries = [
    placement('a'),
    placement('b', 1, { column: 8, row: 6, columnSpan: 2, rowSpan: 2 }),
  ];
  draft.grids[0].placements = entries;
  const resized = createSystemWorkflowResizeCandidate(draft, {
    corner: 'nw',
    destination: { column: 0, row: 0, columnSpan: 6, rowSpan: 6 },
    expectedPlacement: structuredClone(entries[0]),
    gridId: 'grid:home',
    placementId: 'a',
  });
  assert.deepEqual(resized.grids[0].placements[0], {
    ...entries[0], column: 0, row: 0, columnSpan: 6, rowSpan: 6,
  });
  assert.throws(() => createSystemWorkflowResizeCandidate(draft, {
    corner: 'nw',
    destination: { column: 0, row: 0, columnSpan: 5, rowSpan: 6 },
    expectedPlacement: entries[0], gridId: 'grid:home', placementId: 'a',
  }), { code: 'SYSTEM_WORKFLOW_RESIZE_ANCHOR_CHANGED' });

  const destinations = resizeSystemWorkflowGroupGeometries(entries, {
    column: 0, row: 0, columnSpan: 10, rowSpan: 8,
  });
  const grouped = createSystemWorkflowGroupResizeCandidate(draft, {
    corner: 'nw', destinations, expectedPlacements: structuredClone(entries),
    gridId: 'grid:home', placementIds: ['a', 'b'],
  });
  assert.deepEqual(grouped.grids[0].placements.map(({ column, row, columnSpan, rowSpan }) => ({
    column, row, columnSpan, rowSpan,
  })), destinations.map(({ destination }) => destination));
});

test('resize gestures and nudges preserve every opposite anchor and all grid bounds', () => {
  const entry = placement('resize', 0, {
    column: 10, row: 5, columnSpan: 8, rowSpan: 6,
  });
  const cornerPoints = {
    nw: { x: 400, y: 200 }, ne: { x: 720, y: 200 },
    se: { x: 720, y: 440 }, sw: { x: 400, y: 440 },
  };
  const expectedAnchors = { nw: [18, 11], ne: [10, 11], se: [10, 5], sw: [18, 5] };
  for (const corner of SYSTEM_WORKFLOW_RESIZE_CORNERS) {
    const start = createSystemWorkflowResizeGesture(entry, corner, FIELD, cornerPoints[corner]);
    const updated = updateSystemWorkflowResizeGesture(start, {
      x: cornerPoints[corner].x + (corner.includes('w') ? -80 : 80),
      y: cornerPoints[corner].y + (corner.includes('n') ? -40 : 40),
    }, FIELD);
    const next = updated.previewGeometry;
    assert.deepEqual([
      corner.includes('w') ? next.column + next.columnSpan : next.column,
      corner.includes('n') ? next.row + next.rowSpan : next.row,
    ], expectedAnchors[corner]);
    assert.equal(finishSystemWorkflowResizeGesture(updated).committed, true);
  }

  const start = createSystemWorkflowResizeGesture(entry, 'nw', FIELD, cornerPoints.nw);
  const click = updateSystemWorkflowResizeGesture(start, { x: 406, y: 207 }, FIELD);
  assert.equal(click.activated, false);
  assert.equal(finishSystemWorkflowResizeGesture(click).committed, false);
  const snapped = updateSystemWorkflowResizeGesture(start, { x: 339, y: 139 }, FIELD);
  assert.deepEqual(snapped.previewGeometry, {
    column: 8, row: 3, columnSpan: 10, rowSpan: 8,
  });
  assert.deepEqual(finishSystemWorkflowResizeGesture(snapped, { cancelled: true }), {
    committed: false,
    geometry: { column: 10, row: 5, columnSpan: 8, rowSpan: 6 },
  });
  assert.deepEqual(updateSystemWorkflowResizeGesture(
    start, { x: 319, y: 119 }, { ...FIELD, snapStep: 2 },
  ).previewGeometry, { column: 8, row: 2, columnSpan: 10, rowSpan: 9 });
  const fineStep = 5 / 9;
  const fineSnapped = updateSystemWorkflowResizeGesture(
    start, { x: 347, y: 151 }, { ...FIELD, snapStep: fineStep }, 0,
  ).previewGeometry;
  assert.equal(Math.abs(fineSnapped.column / fineStep - Math.round(fineSnapped.column / fineStep)) < 1e-9, true);
  assert.equal(Math.abs(fineSnapped.row / fineStep - Math.round(fineSnapped.row / fineStep)) < 1e-9, true);
  assert.deepEqual(updateSystemWorkflowResizeGesture(
    start, { x: 395, y: 195 }, { ...FIELD, snapStep: 1 / 9 }, 0,
  ).previewGeometry, {
    column: 10 - 1 / 9, row: 5 - 1 / 9,
    columnSpan: 8 + 1 / 9, rowSpan: 6 + 1 / 9,
  });
  assert.deepEqual(updateSystemWorkflowResizeGesture(
    start, { x: 10000, y: 10000 }, FIELD,
  ).previewGeometry, { column: 17, row: 10, columnSpan: 1, rowSpan: 1 });
  assert.deepEqual(updateSystemWorkflowResizeGesture(
    start, { x: -1000000000, y: -1000000000 }, FIELD,
  ).previewGeometry, { column: -494, row: -501, columnSpan: 512, rowSpan: 512 });
  assert.deepEqual(nudgeSystemWorkflowResizeGeometry(entry, 'se', { column: 1, row: -1 }), {
    column: 10, row: 5, columnSpan: 9, rowSpan: 5,
  });
  assert.equal(nudgeSystemWorkflowResizeGeometry(
    { ...entry, column: -4096, columnSpan: 1 }, 'nw', { column: -1, row: 0 },
  ), null);
});

test('crop resize preserves ratio, opposite anchor, and canonical bounds', () => {
  const entry = placement('ratio-resize', 0, { column: 10, row: 5, columnSpan: 8, rowSpan: 4 });
  const start = createSystemWorkflowResizeGesture(entry, 'nw', FIELD, { x: 400, y: 200 });
  const resized = updateSystemWorkflowResizeGesture(
    start,
    { x: 320, y: 195 },
    FIELD,
    undefined,
    { preserveRatio: true },
  ).previewGeometry;
  assert.deepEqual(resized, { column: 8, row: 4, columnSpan: 10, rowSpan: 5 });
  assert.deepEqual(
    [resized.column + resized.columnSpan, resized.row + resized.rowSpan],
    [18, 9],
  );
  const bounded = updateSystemWorkflowResizeGesture(
    start,
    { x: -1000000000, y: -1000000000 },
    FIELD,
    undefined,
    { preserveRatio: true },
  ).previewGeometry;
  assert.deepEqual(bounded, { column: -494, row: -247, columnSpan: 512, rowSpan: 256 });
});

test('placement boundaries and top remove-dock bounds cover every edge', () => {
  const boundaryCases = [
    [{ column: 15, row: -4096, columnSpan: 1, rowSpan: 1 }, { top: true, right: false, bottom: false, left: false }],
    [{ column: 15, row: 4095, columnSpan: 1, rowSpan: 1 }, { top: false, right: false, bottom: true, left: false }],
    [{ column: -4096, row: 8, columnSpan: 1, rowSpan: 1 }, { top: false, right: false, bottom: false, left: true }],
    [{ column: 4095, row: 8, columnSpan: 1, rowSpan: 1 }, { top: false, right: true, bottom: false, left: false }],
    [{ column: 14, row: 8, columnSpan: 1, rowSpan: 1 }, { top: false, right: false, bottom: false, left: false }],
  ];
  for (const [geometry, expected] of boundaryCases) {
    assert.deepEqual(systemWorkflowPlacementBoundaries(placement('edge', 0, geometry)), expected);
  }
  assert.deepEqual(systemWorkflowTopBoundaryRemoveDock(
    placement('dock', 0, { column: 15, row: -4096, columnSpan: 1, rowSpan: 1 }), 40,
  ), { side: 'left', maximumWidth: 164431 });
  assert.deepEqual(systemWorkflowTopBoundaryRemoveDock(
    placement('dock', 0, { column: 4095, row: -4096, columnSpan: 1, rowSpan: 1 }), 40,
  ), { side: 'left', maximumWidth: 327631 });
  assert.deepEqual(systemWorkflowTopBoundaryRemoveDock(
    placement('dock', 0, { column: -4096, row: -4096, columnSpan: 512, rowSpan: 1 }), 40,
  ), { side: 'right', maximumWidth: 307191 });
  assert.deepEqual(systemWorkflowTopBoundaryRemoveDock(
    placement('dock', 0, { column: 15, row: -4095, columnSpan: 1, rowSpan: 1 }), 40,
  ), { side: null, maximumWidth: null });
});

test('crop, presentation, and transform retain separate canonical authorities', () => {
  const draft = createDraft();
  draft.grids[0].placements = [placement('a', 0, { columnSpan: 8, rowSpan: 8 })];
  const expected = structuredClone(draft.grids[0].placements[0]);
  const session = createSystemWorkflowCropSession(expected, MEDIA);
  assert.deepEqual(session.previewCrop, { x: 0.5, y: 0.5, zoom: 1 });
  assert.deepEqual(systemWorkflowCropMask(expected), session.mask);
  const cropped = createSystemWorkflowCropCandidate(draft, {
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    expectedMedia: MEDIA,
    expectedPlacement: expected,
    gridId: 'grid:home', media: MEDIA, placementId: 'a',
  });
  assert.deepEqual(cropped.grids[0].placements[0].crop, { x: 0.5, y: 0.5, zoom: 1 });
  assert.throws(() => createSystemWorkflowCropCandidate(draft, {
    crop: { x: 0.5, y: 0.5, zoom: 2 }, expectedMedia: MEDIA,
    expectedPlacement: expected, gridId: 'grid:home',
    media: { ...MEDIA, width: 900 }, placementId: 'a',
  }), { code: 'SYSTEM_WORKFLOW_CROP_MEDIA_STALE' });
  assert.throws(() => createSystemWorkflowCropCandidate(draft, {
    crop: { x: 0.5, y: 0.5, zoom: 2 }, expectedMedia: MEDIA,
    expectedPlacement: expected, gridId: 'grid:home',
    media: { ...MEDIA, stableAssetId: '42:0x3333333333333333333333333333333333333333:0x02' },
    placementId: 'a',
  }), { code: 'SYSTEM_WORKFLOW_CROP_MEDIA_STALE' });
  assert.throws(() => createSystemWorkflowCropCandidate(draft, {
    crop: { x: 0, y: 0, zoom: 1 }, expectedMedia: MEDIA,
    expectedPlacement: expected, gridId: 'grid:home', media: MEDIA, placementId: 'a',
  }), { code: 'SYSTEM_WORKFLOW_CROP_COVERAGE_INVALID' });

  const presentation = {
    ...systemWorkflowPlacementPresentation(expected),
    frameId: 'DOSSIER',
    mat: { enabled: true, color: '#A1B2C3', inset: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 } },
  };
  const presented = createSystemWorkflowPresentationCandidate(draft, {
    expectedPlacement: expected, gridId: 'grid:home', placementId: 'a', presentation,
  });
  assert.equal(presented.grids[0].placements[0].mat.color, '#a1b2c3');

  const transformed = createSystemWorkflowTransformCandidate(draft, {
    expectedPlacement: expected,
    gridId: 'grid:home',
    operation: SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.ROTATE,
    placementId: 'a',
  });
  assert.equal(transformed.grids[0].placements[0].transform.quarterTurns, 1);
  assert.deepEqual(projectSystemWorkflowTransform(
    { quarterTurns: 1, mirrorX: true, mirrorY: false },
    { width: 600, height: 400 },
    { x: 0.2, y: 0.7, zoom: 1.5 },
  ), {
    crop: { x: 0.7, y: 0.2, zoom: 1.5 },
    css: 'scale(-1, 1) rotate(90deg)',
    dimensions: { width: 400, height: 600 },
    swapped: true,
  });
  assert.deepEqual(projectSystemWorkflowImageRenderRectangle(
    { left: 1, top: 2, width: 8, height: 5 },
    { swapped: true },
  ), { left: 2.5, top: 0.5, width: 5, height: 8 });
  assert.deepEqual(projectSystemWorkflowImageRenderRectangle(
    { left: 1, top: 2, width: 8, height: 5 },
    { swapped: false },
  ), { left: 1, top: 2, width: 8, height: 5 });
  const remappingCases = [
    [{ quarterTurns: 0, mirrorX: false, mirrorY: false }, { x: 0.2, y: 0.7 }],
    [{ quarterTurns: 1, mirrorX: false, mirrorY: false }, { x: 1 - 0.7, y: 0.2 }],
    [{ quarterTurns: 2, mirrorX: false, mirrorY: false }, { x: 1 - 0.2, y: 1 - 0.7 }],
    [{ quarterTurns: 3, mirrorX: false, mirrorY: false }, { x: 0.7, y: 0.8 }],
    [{ quarterTurns: 0, mirrorX: true, mirrorY: false }, { x: 0.8, y: 0.7 }],
    [{ quarterTurns: 0, mirrorX: false, mirrorY: true }, { x: 0.2, y: 1 - 0.7 }],
  ];
  for (const [transform, focus] of remappingCases) {
    const projection = projectSystemWorkflowTransform(
      transform,
      { width: 600, height: 400 },
      { x: 0.2, y: 0.7, zoom: 1.5 },
    );
    assert.deepEqual({ x: projection.crop.x, y: projection.crop.y }, focus);
    const roundTrip = unprojectSystemWorkflowCrop(transform, projection.crop);
    assert.ok(Math.abs(roundTrip.x - 0.2) < 1e-12);
    assert.ok(Math.abs(roundTrip.y - 0.7) < 1e-12);
    assert.equal(roundTrip.zoom, 1.5);
  }
});

test('crop pan, dead-zone, cancellation, nudging, and zoom limits produce bounded focus', () => {
  const entry = placement('crop', 0, {
    column: 4, row: 3, columnSpan: 8, rowSpan: 8,
  });
  const portrait = { stableAssetId: ASSET, width: 900, height: 1600 };
  const session = createSystemWorkflowCropSession(
    entry,
    portrait,
    { left: 0, top: 0, width: 320, height: 320 },
  );
  const start = createSystemWorkflowCropPanGesture(session, { x: 100, y: 100 });
  const click = updateSystemWorkflowCropPanGesture(start, { x: 106, y: 107 });
  assert.equal(click.activated, false);
  const moved = updateSystemWorkflowCropPanGesture(start, { x: 100, y: 180 });
  assert.equal(moved.activated, true);
  assert.equal(moved.previewCrop.y, 0.359375);
  assert.deepEqual(finishSystemWorkflowCropPanGesture(moved), {
    changed: true, crop: moved.previewCrop,
  });
  assert.deepEqual(finishSystemWorkflowCropPanGesture(moved, { cancelled: true }), {
    changed: false, crop: start.startCrop,
  });
  const bounded = updateSystemWorkflowCropPanGesture(start, { x: -10000, y: 10000 });
  assert.ok(bounded.previewCrop.x <= 1 && bounded.previewCrop.y >= 0);

  const nudged = nudgeSystemWorkflowCrop(
    session.previewCrop, session.media, session.mask, { x: 0.01, y: -0.05 },
  );
  assert.equal(nudged.x, 0.5);
  assert.ok(nudged.y < 0.5);
  assert.equal(setSystemWorkflowCropZoom(nudged, session.media, session.mask, -1).zoom, 1);
  assert.equal(setSystemWorkflowCropZoom(nudged, session.media, session.mask, 99).zoom, 4);

  const reframed = reframeSystemWorkflowCropForMask(
    { x: 0.5, y: 0.5, zoom: 2 },
    { stableAssetId: ASSET, width: 100, height: 100 },
    { left: 0, top: 0, width: 4, height: 4 },
    { left: 0, top: 0, width: 6, height: 4 },
    { renderedScale: 0.08 },
  );
  assert.ok(Math.abs(reframed.zoom - (4 / 3)) < 1e-12);
  assert.equal(reframed.x, 0.625);
  assert.equal(reframed.y, 0.5);

  const previousRectangle = projectCroppedMediaRectangle(
    { left: 0, top: 0, width: 4, height: 4 },
    { width: 100, height: 100 },
    { x: 0.5, y: 0.5, zoom: 2 },
  );
  const liveReframe = reframeSystemWorkflowCropForMask(
    { x: 0.5, y: 0.5, zoom: 2 },
    { stableAssetId: ASSET, width: 100, height: 100 },
    { left: 0, top: 0, width: 4, height: 4 },
    { left: 0, top: 0, width: 6, height: 4 },
    { originDelta: { x: -2, y: 0 }, renderedScale: 0.08 },
  );
  const liveRectangle = projectCroppedMediaRectangle(
    { left: 0, top: 0, width: 6, height: 4 },
    { width: 100, height: 100 },
    liveReframe,
  );
  assert.deepEqual({
    left: 10 + previousRectangle.left,
    top: 3 + previousRectangle.top,
    width: previousRectangle.width,
    height: previousRectangle.height,
  }, {
    left: 8 + liveRectangle.left,
    top: 3 + liveRectangle.top,
    width: liveRectangle.width,
    height: liveRectangle.height,
  });
});

test('group duplicate, transform, and removal remain atomic and snapshot guarded', () => {
  const draft = createDraft();
  const entries = [placement('a'), placement('b', 1, { column: 8, row: 8 })];
  draft.grids[0].placements = entries;
  const ids = ['copy-a', 'copy-b'];
  const duplicated = createSystemWorkflowGroupDuplicateCandidate(draft, {
    expectedPlacements: structuredClone(entries),
    generatePlacementId: () => ids.shift(),
    gridId: 'grid:home', placementIds: ['a', 'b'],
  });
  assert.deepEqual(duplicated.placementIds, ['copy-a', 'copy-b']);
  assert.equal(duplicated.draft.grids[0].placements.length, 4);
  const transformed = createSystemWorkflowGroupTransformCandidate(draft, {
    expectedPlacements: structuredClone(entries),
    gridId: 'grid:home',
    operation: SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_VERTICAL,
    placementIds: ['a', 'b'],
  });
  assert.deepEqual(transformed.grids[0].placements.map(({ row, transform }) => ({ row, mirrorY: transform.mirrorY })), [
    { row: 8, mirrorY: true }, { row: 2, mirrorY: true },
  ]);
  const removed = createSystemWorkflowGroupRemovalCandidate(draft, {
    expectedPlacements: structuredClone(entries), gridId: 'grid:home', placementIds: ['a', 'b'],
  });
  assert.equal(removed.grids[0].placements.length, 0);
  const locked = structuredClone(draft);
  locked.grids[0].placements[1].locked = true;
  assert.throws(() => createSystemWorkflowGroupTransformCandidate(locked, {
    expectedPlacements: structuredClone(locked.grids[0].placements),
    gridId: 'grid:home', operation: SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.ROTATE,
    placementIds: ['a', 'b'],
  }), { code: 'SYSTEM_WORKFLOW_TRANSFORM_PLACEMENT_LOCKED' });
});

test('group rotate and mirrors transform placement geometry around shared bounds', () => {
  const entries = [
    placement('left', 0, { column: 2, row: 3, columnSpan: 4, rowSpan: 2 }),
    placement('right', 1, { column: 10, row: 6, columnSpan: 2, rowSpan: 3 }),
  ];
  assert.deepEqual(transformSystemWorkflowGroupGeometries(
    entries,
    SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_HORIZONTAL,
  ).map(({ destination }) => destination), [
    { column: 8, row: 3, columnSpan: 4, rowSpan: 2 },
    { column: 2, row: 6, columnSpan: 2, rowSpan: 3 },
  ]);
  assert.deepEqual(transformSystemWorkflowGroupGeometries(
    entries,
    SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.MIRROR_VERTICAL,
  ).map(({ destination }) => destination), [
    { column: 2, row: 7, columnSpan: 4, rowSpan: 2 },
    { column: 10, row: 3, columnSpan: 2, rowSpan: 3 },
  ]);
  assert.deepEqual(transformSystemWorkflowGroupGeometries(
    entries,
    SYSTEM_WORKFLOW_TRANSFORM_OPERATIONS.ROTATE,
  ).map(({ destination }) => destination), [
    { column: 4, row: 7, columnSpan: 2, rowSpan: 4 },
    { column: 7, row: 1, columnSpan: 3, rowSpan: 2 },
  ]);
});

test('single and group duplicate fail before exceeding the 200 placement boundary', () => {
  const draft = createDraft();
  draft.grids[0].placements = Array.from({ length: 200 }, (_, index) => placement(
    `p-${index}`,
    index,
    { column: index % 28, row: index % 14 },
  ));
  const before = structuredClone(draft);
  assert.throws(() => createSystemWorkflowDuplicateCandidate(draft, {
    expectedPlacement: draft.grids[0].placements[0],
    generatePlacementId: () => 'overflow', gridId: 'grid:home', placementId: 'p-0',
  }));
  assert.throws(() => createSystemWorkflowGroupDuplicateCandidate(draft, {
    expectedPlacements: structuredClone(draft.grids[0].placements.slice(0, 2)),
    generatePlacementId: () => 'overflow-group', gridId: 'grid:home', placementIds: ['p-0', 'p-1'],
  }));
  assert.deepEqual(draft, before);
});

test('arbitrary layer reorder rejects a locked peer and every stale full topology', () => {
  const draft = createDraft();
  draft.grids[0].placements = [placement('a', 2), placement('b', 9), placement('c', 20)];
  const expectedPlacements = systemWorkflowLayerTopologySnapshot(draft.grids[0]);
  const reordered = createSystemWorkflowLayerReorderCandidate(draft, {
    expectedPlacements, gridId: 'grid:home', orderedPlacementIds: ['c', 'a', 'b'],
  });
  assert.deepEqual(reordered.grids[0].placements.map(({ id, layer }) => ({ id, layer })), [
    { id: 'a', layer: 9 }, { id: 'b', layer: 20 }, { id: 'c', layer: 2 },
  ]);
  const locked = structuredClone(draft);
  locked.grids[0].placements[1].locked = true;
  assert.throws(() => createSystemWorkflowLayerReorderCandidate(locked, {
    expectedPlacements: systemWorkflowLayerTopologySnapshot(locked.grids[0]),
    gridId: 'grid:home', orderedPlacementIds: ['c', 'a', 'b'],
  }), { code: 'SYSTEM_WORKFLOW_LAYER_PLACEMENT_LOCKED' });
  const stale = structuredClone(draft);
  stale.grids[0].placements[1].crop = { x: 0.5, y: 0.5, zoom: 1 };
  assert.throws(() => createSystemWorkflowLayerReorderCandidate(stale, {
    expectedPlacements, gridId: 'grid:home', orderedPlacementIds: ['c', 'a', 'b'],
  }), { code: 'SYSTEM_WORKFLOW_LAYER_TOPOLOGY_STALE' });
});

test('topology-free marquee rules are mechanically retained without Grid topology', () => {
  const rectangle = systemWorkflowMarqueeRectangle({ x: 90, y: 70 }, { x: 20, y: 10 });
  assert.deepEqual(rectangle, { left: 20, top: 10, width: 70, height: 60 });
  assert.equal(systemWorkflowMarqueeIntersects(rectangle, { left: 0, top: 0, width: 30, height: 30 }), true);
  assert.deepEqual(resolveSystemWorkflowMarqueeSelection(
    ['a', 'b'], ['b', 'c'], SYSTEM_WORKFLOW_MARQUEE_SELECTION_MODES.TOGGLE,
  ), ['a', 'c']);
});

test('single removal still requires the complete canonical placement snapshot', () => {
  const draft = createDraft();
  draft.grids[0].placements = [placement('a')];
  assert.throws(() => createSystemWorkflowRemovalCandidate(draft, {
    expectedPlacement: { ...draft.grids[0].placements[0], column: 3 },
    gridId: 'grid:home', placementId: 'a',
  }), { code: 'SYSTEM_WORKFLOW_REMOVAL_PLACEMENT_STALE' });
});
