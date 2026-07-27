import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCropFocusGesture,
  finishCropFocusGesture,
  nudgeCropFocus,
  restoreNativePlacement,
  setCropZoom,
  squareCropPlacement,
  updateCropFocusGesture,
} from './latticePlacementCrop.js';

const artboard = { width: 1600, height: 900 };
const portraitMedia = { width: 200, height: 400 };
const portrait = { id: 'portrait', x: 0.2, y: 0.1, width: 0.2, height: 0.4, crop: null };
const mask = { left: 320, top: 180, width: 320, height: 320 };

test('square crop is the largest centered square inside current visible artwork', () => {
  assert.deepEqual(squareCropPlacement(portrait, artboard), {
    bounds: { x: 0.2, y: 0.12222222222222223, width: 0.2, height: 0.35555555555555557 },
    crop: { x: 0.5, y: 0.5, zoom: 1 },
  });
});

test('removing crop restores centered native proportion without expanding its mask', () => {
  assert.deepEqual(restoreNativePlacement(
    { ...portrait, x: 0.2, y: 0.2, width: 0.2, height: 320 / 900 },
    portraitMedia,
    artboard,
  ), { x: 0.25, y: 0.2, width: 0.1, height: 320 / 900 });
});

test('dragging media beneath the fixed mask updates focus opposite pointer movement', () => {
  const start = createCropFocusGesture({ ...portrait, crop: { x: 0.5, y: 0.5, zoom: 1 } }, portraitMedia, mask, { x: 100, y: 100 });
  const moved = updateCropFocusGesture(start, { x: 100, y: 180 }, 10);
  assert.equal(moved.activated, true);
  assert.deepEqual(moved.previewCrop, { x: 0.5, y: 0.375, zoom: 1 });
  assert.deepEqual(finishCropFocusGesture(moved), { committed: true, crop: { x: 0.5, y: 0.375, zoom: 1 } });
});

test('dead zone and Escape preserve the exact starting crop', () => {
  const start = createCropFocusGesture({ ...portrait, crop: { x: 0.5, y: 0.6, zoom: 1 } }, portraitMedia, mask, { x: 0, y: 0 });
  const click = updateCropFocusGesture(start, { x: 3, y: 4 }, 10);
  assert.deepEqual(finishCropFocusGesture(click), { committed: false, crop: { x: 0.5, y: 0.6, zoom: 1 } });
  const moved = updateCropFocusGesture(start, { x: 0, y: -100 }, 10);
  assert.deepEqual(finishCropFocusGesture(moved, { cancelled: true }), {
    committed: false, crop: { x: 0.5, y: 0.6, zoom: 1 },
  });
});

test('keyboard focus and zoom remain bounded without revealing empty space', () => {
  assert.deepEqual(nudgeCropFocus({ x: 0.5, y: 0.5, zoom: 1 }, portraitMedia, mask, { x: 0, y: 0.5 }), {
    x: 0.5, y: 0.75, zoom: 1,
  });
  assert.deepEqual(setCropZoom({ x: 0.5, y: 0.75, zoom: 1 }, portraitMedia, mask, 2), {
    x: 0.5, y: 0.75, zoom: 2,
  });
});

test('crop geometry rejects missing projected or native dimensions', () => {
  assert.throws(() => squareCropPlacement(portrait, { width: 0, height: 900 }), /projected artboard/);
  assert.throws(() => restoreNativePlacement(portrait, { width: 0, height: 400 }, artboard), /native media/);
});
