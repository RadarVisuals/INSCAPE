import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../domain/latticeProductionAdapter.js';
import {
  createLatticeProductionTableRenderModel,
  projectLatticeProductionArtwork,
  projectLatticeProductionLabel,
  projectLatticeProductionPlacement,
  projectLatticeProductionViewport,
} from './latticeProductionProjection.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const asset = {
  id: ASSET, chainId: 42, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8',
  name: 'Canonical work', description: '', collectionName: null,
  imageUrl: 'https://media.example/work.webp', imageWidth: 1600, imageHeight: 900,
  mediaType: 'image', creators: [], attributes: [],
};
const placement = {
  id: 'placement-a', stableAssetId: ASSET,
  column: 4, row: 3, columnSpan: 8, rowSpan: 6, layer: 7, navigationOrder: 0,
  crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
};

function publication() {
  const draft = createEmptyLatticeProductionDraft(PROFILE);
  draft.tables[4].title = 'Center archive';
  draft.tables[4].subtitle = 'One canonical table';
  draft.tables[4].placements = [structuredClone(placement)];
  return projectLatticeProductionPublication(draft, [asset], { lastPublished: '2026-07-29T12:00:00.000Z' });
}

test('renderer boundary accepts only a validated public publication and returns a detached frozen table', () => {
  const source = publication();
  const before = structuredClone(source);
  const model = createLatticeProductionTableRenderModel(source, 'table-05');
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.table.placements[0].asset.media), true);
  assert.notEqual(model.table, source.tables[4]);
  assert.deepEqual(source, before);
  assert.throws(() => createLatticeProductionTableRenderModel(createEmptyLatticeProductionDraft(PROFILE), 'table-05'));
  assert.throws(() => createLatticeProductionTableRenderModel(source, 'table-99'), /Unknown/);
});

test('32 by 18 projection uniformly contains the complete plane with square cells and centered letterboxing', () => {
  const model = createLatticeProductionTableRenderModel(publication(), 'table-05');
  assert.deepEqual(projectLatticeProductionViewport(model, { width: 1280, height: 720 }), {
    cellSize: 40, width: 1280, height: 720, left: 0, top: 0,
  });
  assert.deepEqual(projectLatticeProductionViewport(model, { width: 1000, height: 1000 }), {
    cellSize: 31.25, width: 1000, height: 562.5, left: 0, top: 218.75,
  });
  const wide = projectLatticeProductionViewport(model, { width: 1600, height: 600 });
  assert.equal(wide.cellSize, 100 / 3);
  assert.equal(wide.width, 3200 / 3);
  assert.equal(wide.height, 600);
  assert.ok(Math.abs(wide.left - (800 / 3)) < Number.EPSILON * 512);
  assert.equal(wide.top, 0);
  assert.throws(() => projectLatticeProductionViewport(model, { width: 0, height: 600 }), /positive viewport/);
});

test('placement, label, native ratio, crop, and mat projection share the same cell field', () => {
  const model = createLatticeProductionTableRenderModel(publication(), 'table-05');
  const field = projectLatticeProductionViewport(model, { width: 1280, height: 720 });
  assert.deepEqual(projectLatticeProductionPlacement(model.table.placements[0], field), {
    left: 160, top: 120, width: 320, height: 240,
  });
  assert.deepEqual(projectLatticeProductionLabel(model.table, field), {
    left: 40, top: 40, transform: 'translate(0%, 0%)',
  });
  const native = projectLatticeProductionArtwork(model.table.placements[0], field, { width: 1600, height: 900 });
  assert.deepEqual(native.imageRectangle, { left: 160, top: 150, width: 320, height: 180 });

  const croppedPlacement = { ...model.table.placements[0], crop: { x: 0.5, y: 0.5, zoom: 1 } };
  const cropped = projectLatticeProductionArtwork(croppedPlacement, field, { width: 900, height: 1600 });
  assert.equal(cropped.imageRectangle.width, 320);
  assert.ok(cropped.imageRectangle.height > cropped.mediaOpeningRectangle.height);

  const mattedPlacement = {
    ...model.table.placements[0],
    mat: { enabled: true, color: '#d8d4ca', inset: { top: 0.1, right: 0.2, bottom: 0.3, left: 0.1 } },
  };
  const matted = projectLatticeProductionArtwork(mattedPlacement, field, { width: 100, height: 100 });
  assert.deepEqual(matted.backplateRectangle, { left: 160, top: 120, width: 320, height: 240 });
  assert.deepEqual({ ...matted.mediaOpeningRectangle, height: Math.round(matted.mediaOpeningRectangle.height) }, {
    left: 192, top: 144, width: 224, height: 144,
  });
});

test('resize changes projection only and never authored placement data', () => {
  const source = publication();
  const model = createLatticeProductionTableRenderModel(source, 'table-05');
  const authored = structuredClone(model.table.placements[0]);
  const first = projectLatticeProductionPlacement(model.table.placements[0], projectLatticeProductionViewport(model, { width: 1280, height: 720 }));
  const second = projectLatticeProductionPlacement(model.table.placements[0], projectLatticeProductionViewport(model, { width: 390, height: 844 }));
  assert.notDeepEqual(first, second);
  assert.deepEqual(model.table.placements[0], authored);
  assert.equal(first.width / first.height, second.width / second.height);
});
