import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SYSTEM_WORKFLOW_DRAFT_VERSION,
  SYSTEM_WORKFLOW_LIMITS,
  createEmptySystemWorkflowDraft,
  createSystemWorkflowGridId,
  validateSystemWorkflowDraft,
} from './systemWorkflowDraft.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const createDraft = () => createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home-uuid' });
const placement = (id, order) => ({
  id, stableAssetId: ASSET, column: 0, row: 0, columnSpan: 1, rowSpan: 1,
  layer: order, navigationOrder: order, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

function draftWithPlacementCounts(counts) {
  const draft = createDraft();
  draft.grids = counts.map((count, gridIndex) => ({
    ...structuredClone(draft.grids[0]),
    id: `grid:g-${gridIndex}`,
    title: gridIndex === 0 ? 'HOME' : `GRID ${gridIndex + 1}`,
    placements: Array.from({ length: count }, (_, placementIndex) => placement(
      `p-${gridIndex}-${placementIndex}`,
      placementIndex,
    )),
  }));
  return draft;
}

test('draft v4 starts with one ordered public HOME Grid and no fixed topology', () => {
  const draft = createDraft();
  assert.equal(draft.draftVersion, SYSTEM_WORKFLOW_DRAFT_VERSION);
  assert.deepEqual(draft.artboard, { aspectWidth: 16, aspectHeight: 9 });
  assert.deepEqual(draft.geometry, { columns: 32, rows: 18 });
  assert.deepEqual(draft.appearance, {
    surfaceId: 'mist', menuSurfaceId: 'mist', dossierSurfaceId: 'paper',
    guideMode: 'LINES', guideSize: 1, guideColor: '#6f746f',
  });
  assert.deepEqual(draft.grids, [{
    id: 'grid:home-uuid', title: 'HOME', subtitle: '', visibility: 'PUBLIC',
    labelVisible: true, labelAnchor: 'top-left', labelOffset: { column: 0, row: 0 }, placements: [],
  }]);
  assert.equal(Object.hasOwn(draft, 'tables'), false);
  assert.equal(Object.hasOwn(draft.grids[0], 'coordinate'), false);
  assert.equal(Object.hasOwn(draft.grids[0], 'gridState'), false);
  assert.equal(validateSystemWorkflowDraft(draft).valid, true);
});

test('validation is exact and rejects legacy or malformed contract fields', () => {
  for (const mutate of [
    (draft) => { draft.draftVersion = 3; },
    (draft) => { draft.tables = []; },
    (draft) => { draft.grids[0].coordinate = { x: 0, y: 0 }; },
    (draft) => { draft.grids[0].gridState = 'ACTIVE'; },
    (draft) => { draft.appearance.guideMode = 'GRID'; },
    (draft) => { draft.appearance.guideSize = 0; },
    (draft) => { draft.grids = []; },
  ]) {
    const draft = createDraft();
    mutate(draft);
    assert.equal(validateSystemWorkflowDraft(draft).valid, false);
  }
});

test('Grid IDs use bounded injected randomness and never timestamp fallback', () => {
  assert.equal(createSystemWorkflowGridId([], { generateId: () => 'uuid-one' }), 'grid:uuid-one');
  assert.equal(createSystemWorkflowGridId(['grid:repeat'], {
    generateId: (attempt) => attempt === 1 ? 'repeat' : 'fresh',
  }), 'grid:fresh');
  assert.throws(
    () => createSystemWorkflowGridId([], { generateId: () => 'bad value' }),
    { code: 'SYSTEM_WORKFLOW_ID_CANDIDATE_INVALID' },
  );
});

test('draft validation enforces the 24 Grid safety ceiling and stable unique IDs', () => {
  const draft = createDraft();
  while (draft.grids.length < SYSTEM_WORKFLOW_LIMITS.maxGrids) {
    const index = draft.grids.length;
    draft.grids.push({
      ...structuredClone(draft.grids[0]),
      id: `grid:grid-${index}`,
      title: `GRID ${index + 1}`,
      visibility: 'PRIVATE',
    });
  }
  assert.equal(validateSystemWorkflowDraft(draft).valid, true);
  draft.grids.push({ ...structuredClone(draft.grids.at(-1)), id: 'grid:overflow' });
  assert.equal(validateSystemWorkflowDraft(draft).valid, false);
  draft.grids.pop();
  draft.grids[1].id = draft.grids[0].id;
  assert.equal(validateSystemWorkflowDraft(draft).valid, false);
});

test('draft validation enforces the exact 200 placement-per-Grid boundary', () => {
  assert.equal(validateSystemWorkflowDraft(draftWithPlacementCounts([200])).valid, true);
  assert.ok(validateSystemWorkflowDraft(draftWithPlacementCounts([201])).errors
    .some(({ code }) => code === 'invalid_placements'));
});

test('the 1000 asset-reference limit counts every placement and an optional asset avatar', () => {
  assert.equal(validateSystemWorkflowDraft(draftWithPlacementCounts([200, 200, 200, 200, 200])).valid, true);
  assert.ok(validateSystemWorkflowDraft(draftWithPlacementCounts([200, 200, 200, 200, 200, 1])).errors
    .some(({ code }) => code === 'too_many_asset_references'));

  const withAvatarAtLimit = draftWithPlacementCounts([200, 200, 200, 200, 199]);
  withAvatarAtLimit.identityPresentation.avatar = {
    mode: 'inscape', stableAssetId: ASSET, shape: 'square',
  };
  assert.equal(validateSystemWorkflowDraft(withAvatarAtLimit).valid, true);

  const withAvatarOverLimit = draftWithPlacementCounts([200, 200, 200, 200, 200]);
  withAvatarOverLimit.identityPresentation.avatar = {
    mode: 'inscape', stableAssetId: ASSET, shape: 'square',
  };
  assert.ok(validateSystemWorkflowDraft(withAvatarOverLimit).errors
    .some(({ code }) => code === 'too_many_asset_references'));
});

test('draft validation accepts exactly 512 KiB and rejects limit plus one byte', () => {
  const draft = draftWithPlacementCounts([200, 200, 200, 200, 200]);
  const encoder = new TextEncoder();
  let remaining = SYSTEM_WORKFLOW_LIMITS.maxJsonBytes - encoder.encode(JSON.stringify(draft)).byteLength;
  assert.ok(remaining >= 0, 'the canonical short-ID fixture must fit below the byte ceiling');
  for (const grid of draft.grids) {
    for (const entry of grid.placements) {
      const amount = Math.min(remaining, SYSTEM_WORKFLOW_LIMITS.maxIdLength - entry.id.length);
      entry.id += 'x'.repeat(amount);
      remaining -= amount;
      if (remaining === 0) break;
    }
    if (remaining === 0) break;
  }
  assert.equal(remaining, 0, 'ID capacity must reach the exact byte ceiling');
  assert.equal(encoder.encode(JSON.stringify(draft)).byteLength, SYSTEM_WORKFLOW_LIMITS.maxJsonBytes);
  assert.equal(validateSystemWorkflowDraft(draft).valid, true);
  const plusOne = structuredClone(draft);
  const target = plusOne.grids.flatMap(({ placements }) => placements).find(({ id }) => id.length < 200);
  assert.ok(target);
  target.id += 'x';
  assert.equal(encoder.encode(JSON.stringify(plusOne)).byteLength, SYSTEM_WORKFLOW_LIMITS.maxJsonBytes + 1);
  assert.ok(validateSystemWorkflowDraft(plusOne).errors.some(({ code }) => code === 'draft_too_large'));
});
