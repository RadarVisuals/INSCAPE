import test from 'node:test';
import assert from 'node:assert/strict';
import { clampGalleryCamera, createGalleryLayout, GALLERY_MINIMUM_SCREENS } from './galleryLayout.js';

const artwork = (id, order, placement = { column: 0, row: 0 }, span = { columns: 4, rows: 4 }) => ({
  id, presentationOrder: order, placement, span
});

test('gallery layout is deterministic, ordered, and at least three screens wide', () => {
  const viewport = { width: 1200, height: 800 };
  const source = [artwork('b', 2), artwork('a', 1, { column: 8, row: 3 }, { columns: 6, rows: 8 })];
  const first = createGalleryLayout(source, viewport);
  const second = createGalleryLayout([...source].reverse(), viewport);
  assert.deepEqual(first, second);
  assert.deepEqual(first.items.map((item) => item.object.id), ['a', 'b']);
  assert.ok(first.worldWidth >= viewport.width * GALLERY_MINIMUM_SCREENS);
});

test('gallery frames remain on the wall above the floor horizon', () => {
  const layout = createGalleryLayout([artwork('large', 0, { column: 0, row: 99 }, { columns: 12, rows: 12 })], { width: 900, height: 600 });
  const item = layout.items[0];
  assert.ok(item.top >= 106);
  assert.ok(item.top + item.height <= layout.horizon - 28);
});

test('gallery camera is clamped to the authored world', () => {
  assert.equal(clampGalleryCamera(-20, 900), 0);
  assert.equal(clampGalleryCamera(240, 900), 240);
  assert.equal(clampGalleryCamera(1200, 900), 900);
});
