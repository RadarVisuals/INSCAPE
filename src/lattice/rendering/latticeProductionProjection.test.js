import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectLatticeProductionArtwork,
  projectLatticeProductionPixelArtwork,
  projectLatticeProductionPlacement,
} from './latticeProductionProjection.js';

const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const placement = {
  id: 'placement-a', stableAssetId: ASSET,
  column: 4, row: 3, columnSpan: 8, rowSpan: 6, layer: 7, navigationOrder: 0,
  crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
};

test('placement, native ratio, crop, and mat projection share the same cell field', () => {
  const field = { cellSize: 40, width: 1280, height: 720, left: 0, top: 0 };
  assert.deepEqual(projectLatticeProductionPlacement(placement, field), {
    left: 160, top: 120, width: 320, height: 240,
  });
  const native = projectLatticeProductionArtwork(placement, field, { width: 1600, height: 900 });
  assert.deepEqual(native.imageRectangle, { left: 160, top: 150, width: 320, height: 180 });

  const croppedPlacement = { ...placement, crop: { x: 0.5, y: 0.5, zoom: 1 } };
  const cropped = projectLatticeProductionArtwork(croppedPlacement, field, { width: 900, height: 1600 });
  assert.equal(cropped.imageRectangle.width, 320);
  assert.ok(cropped.imageRectangle.height > cropped.mediaOpeningRectangle.height);
  assert.equal(cropped.imageRenderRectangle.left, cropped.mediaOpeningRectangle.left - 1);
  assert.equal(cropped.imageRenderRectangle.width, cropped.imageRectangle.width + 2);

  const mattedPlacement = {
    ...placement,
    mat: { enabled: true, color: '#d8d4ca', inset: { top: 0.1, right: 0.2, bottom: 0.3, left: 0.1 } },
  };
  const matted = projectLatticeProductionArtwork(mattedPlacement, field, { width: 100, height: 100 });
  assert.deepEqual(matted.backplateRectangle, { left: 160, top: 120, width: 320, height: 240 });
  assert.deepEqual({ ...matted.mediaOpeningRectangle, height: Math.round(matted.mediaOpeningRectangle.height) }, {
    left: 192, top: 144, width: 224, height: 144,
  });
});

test('fractional viewport full-bleed raster projection preserves canonical geometry through mirror and rotation', () => {
  const cellSize = Math.min(1308 / 32, 881 / 18);
  const field = { cellSize, width: 32 * cellSize, height: 18 * cellSize,
    left: (1308 - (32 * cellSize)) / 2, top: (881 - (18 * cellSize)) / 2 };
  const squarePlacement = {
    ...placement, column: 5 / 9, row: 10 / 9, columnSpan: 20 / 9, rowSpan: 20 / 9,
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    transform: { quarterTurns: 1, mirrorX: true, mirrorY: false },
  };
  const artwork = projectLatticeProductionPixelArtwork(squarePlacement, field, { width: 150, height: 150 });
  assert.equal(Number.isInteger(artwork.footprint.left), true);
  assert.equal(Number.isInteger(artwork.footprint.top), true);
  assert.deepEqual(artwork.imageRectangle, artwork.mediaOpeningRectangle);
  assert.equal(artwork.imageRenderRectangle.left, artwork.mediaOpeningRectangle.left - 1);
  assert.equal(artwork.imageRenderRectangle.top, artwork.mediaOpeningRectangle.top - 1);
  assert.equal(artwork.imageRenderRectangle.width, artwork.mediaOpeningRectangle.width + 2);
  assert.equal(artwork.imageRenderRectangle.height, artwork.mediaOpeningRectangle.height + 2);
  assert.equal(artwork.imageTransform, 'scale(-1, 1) rotate(90deg)');
});

test('resize changes projection only and never authored placement data', () => {
  const authored = structuredClone(placement);
  const first = projectLatticeProductionPlacement(placement,
    { cellSize: 40, width: 1280, height: 720, left: 0, top: 0 });
  const secondCell = 390 / 32;
  const second = projectLatticeProductionPlacement(placement,
    { cellSize: secondCell, width: 390, height: 18 * secondCell, left: 0, top: (844 - (18 * secondCell)) / 2 });
  assert.notDeepEqual(first, second);
  assert.deepEqual(placement, authored);
  assert.equal(first.width / first.height, second.width / second.height);
});
