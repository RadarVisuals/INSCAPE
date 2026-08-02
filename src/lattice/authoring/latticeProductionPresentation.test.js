import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import { resolveArtworkMatPreset } from '../rendering/latticeMat.js';
import {
  createLatticeProductionPresentationCandidate,
  latticeProductionPlacementPresentation,
  normalizeLatticeProductionPresentation,
} from './latticeProductionPresentation.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = () => ({
  id: 'placement-1', stableAssetId: ASSET, column: 2, row: 3, columnSpan: 6, rowSpan: 4,
  layer: 7, navigationOrder: 3, crop: { x: 0.2, y: 0.7, zoom: 1.5 }, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 2, mirrorX: true, mirrorY: false },
});

function draftWithPlacement() {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].placements = [placement()];
  return draft;
}

function candidate(draft, presentation, expectedPlacement = structuredClone(draft.tables[4].placements[0])) {
  return createLatticeProductionPresentationCandidate(draft, {
    expectedPlacement, placementId: 'placement-1', presentation, tableId: 'table-05',
  });
}

test('presentation candidate accepts independent frame, preset mat, custom mat, backing, and transparency values', () => {
  const draft = draftWithPlacement();
  const expected = structuredClone(draft.tables[4].placements[0]);
  const presentation = {
    frameId: 'CAPTION',
    mat: { enabled: true, color: '#A1B2C3', inset: { top: 0.12, right: 0.13, bottom: 0.14, left: 0.15 } },
    backing: { enabled: true, color: '#C9C6BD' },
    transparencyMode: 'PRESERVE_ALPHA',
  };
  const accepted = candidate(draft, presentation);
  assert.deepEqual(latticeProductionPlacementPresentation(accepted.tables[4].placements[0]), {
    ...presentation, mat: { ...presentation.mat, color: '#a1b2c3' }, backing: { ...presentation.backing, color: '#c9c6bd' },
  });
  const unrelated = structuredClone(accepted.tables[4].placements[0]);
  delete unrelated.frameId; delete unrelated.mat; delete unrelated.backing; delete unrelated.transparencyMode;
  const expectedUnrelated = structuredClone(expected);
  delete expectedUnrelated.frameId; delete expectedUnrelated.mat; delete expectedUnrelated.backing; delete expectedUnrelated.transparencyMode;
  assert.deepEqual(unrelated, expectedUnrelated);
  assert.deepEqual(draft.tables[4].placements[0], expected);

  const preset = { ...latticeProductionPlacementPresentation(expected), mat: resolveArtworkMatPreset('DOSSIER') };
  assert.deepEqual(candidate(draft, preset).tables[4].placements[0].mat, resolveArtworkMatPreset('DOSSIER'));
});

test('exact accepted presentation is a no-op', () => {
  const draft = draftWithPlacement();
  assert.equal(candidate(draft, latticeProductionPlacementPresentation(draft.tables[4].placements[0])), null);
});

test('presentation candidate rejects stale, missing, private, and locked canonical targets', () => {
  const draft = draftWithPlacement();
  const next = { ...latticeProductionPlacementPresentation(draft.tables[4].placements[0]), frameId: 'DOSSIER' };
  assert.throws(() => candidate(draft, next, { ...placement(), row: 8 }), { code: 'LATTICE_PRESENTATION_PLACEMENT_STALE' });
  assert.throws(() => createLatticeProductionPresentationCandidate(draft, {
    expectedPlacement: placement(), placementId: 'missing', presentation: next, tableId: 'table-05',
  }), { code: 'LATTICE_PRESENTATION_PLACEMENT_UNKNOWN' });
  assert.throws(() => createLatticeProductionPresentationCandidate(draft, {
    expectedPlacement: placement(), placementId: 'placement-1', presentation: next, tableId: 'missing',
  }), { code: 'LATTICE_PRESENTATION_TABLE_UNKNOWN' });
  const privatePlacement = draftWithPlacement(); privatePlacement.tables[4].placements[0].visibility = 'PRIVATE';
  assert.throws(() => candidate(privatePlacement, next), { code: 'LATTICE_PRESENTATION_PLACEMENT_PRIVATE' });
  const privateTable = draftWithPlacement(); privateTable.tables[4].visibility = 'PRIVATE';
  assert.throws(() => candidate(privateTable, next), { code: 'LATTICE_PRESENTATION_TABLE_PRIVATE' });
  const locked = draftWithPlacement(); locked.tables[4].placements[0].locked = true;
  assert.throws(() => candidate(locked, next), { code: 'LATTICE_PRESENTATION_PLACEMENT_LOCKED' });
});

test('presentation normalization rejects invalid IDs, colors, and every invalid inset class', () => {
  const valid = latticeProductionPlacementPresentation(placement());
  assert.throws(() => normalizeLatticeProductionPresentation({ ...valid, frameId: 'THIN' }), { code: 'LATTICE_PRESENTATION_FRAME_INVALID' });
  assert.throws(() => normalizeLatticeProductionPresentation({ ...valid, transparencyMode: 'TRANSPARENT' }), { code: 'LATTICE_PRESENTATION_TRANSPARENCY_INVALID' });
  assert.throws(() => normalizeLatticeProductionPresentation({ ...valid, mat: { ...valid.mat, color: '#fff' } }), { code: 'LATTICE_PRESENTATION_COLOR_INVALID' });
  assert.throws(() => normalizeLatticeProductionPresentation({ ...valid, backing: { enabled: true, color: 'red' } }), { code: 'LATTICE_PRESENTATION_COLOR_INVALID' });
  for (const amount of [Number.NaN, Infinity, -0.01, 0.451]) {
    assert.throws(() => normalizeLatticeProductionPresentation({ ...valid, mat: { ...valid.mat, inset: { ...valid.mat.inset, top: amount } } }),
      { code: 'LATTICE_PRESENTATION_MAT_INSET_INVALID' });
  }
  assert.throws(() => normalizeLatticeProductionPresentation({ ...valid, mat: {
    ...valid.mat, inset: { top: 0.6, right: 0, bottom: 0.4, left: 0 },
  } }), { code: 'LATTICE_PRESENTATION_MAT_INSET_SUM_INVALID' });
});
