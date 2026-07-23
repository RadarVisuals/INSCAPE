import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialCategoryBrowserRect,
  makeJustifiedAssetRows,
  normalizeAssetRatio,
  resizeCategoryBrowserByKey,
  resizeCategoryBrowserRect
} from './categoryAssetBrowserModel.js';

test('justified rows preserve native ratios and leave the final partial row at target height', () => {
  const assets = [{ id: 'portrait', ratio: .5 }, { id: 'square', ratio: 1 }, { id: 'landscape', ratio: 2 }, { id: 'last', ratio: 1 }];
  const rows = makeJustifiedAssetRows(assets, 600, 190, 8);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].incomplete, false);
  assert.ok(Math.abs(rows[0].assets.reduce((sum, asset) => sum + asset.ratio * rows[0].height, 0) + 16 - 600) < .001);
  assert.deepEqual(rows[0].assets.map((asset) => asset.id), ['portrait', 'square', 'landscape']);
  assert.equal(rows[1].height, 190);
  assert.equal(rows[1].incomplete, true);
  assert.equal(normalizeAssetRatio(0), 1);
});

test('browser geometry initializes inside the viewport and resizes on a forty pixel grid', () => {
  const initial = initialCategoryBrowserRect({ width: 1280, height: 720 });
  assert.deepEqual(initial, { left: 244, top: 20, width: 1016, height: 680 });
  assert.deepEqual(resizeCategoryBrowserRect({ ...initial, width: 600, height: 400 }, { x: 63, y: -55 }, { width: 1280, height: 720 }), { ...initial, width: 680, height: 360 });
  assert.equal(resizeCategoryBrowserByKey({ ...initial, width: 600 }, 'ArrowRight', { width: 1280, height: 720 }).width, 640);
  assert.equal(resizeCategoryBrowserByKey(initial, 'Enter', { width: 1280, height: 720 }), null);
});
