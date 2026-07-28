import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BROWSER_FILING_FILTERS,
  categoryDialogInitialName,
  clampBrowserSize,
  filterBrowserAssets,
  initialBrowserSize,
  resizeBrowserAroundCenter,
  resizeBrowserByKey,
  searchBrowserCategoryAssets,
} from './browserWorkspaceModel.js';

test('browser sizing is centered, clamped, responsive and keyboard adjustable', () => {
  assert.deepEqual(initialBrowserSize({ width: 1440, height: 900 }), { width: 1040, height: 680 });
  assert.deepEqual(initialBrowserSize({ width: 600, height: 500 }), { width: 580, height: 480 });
  assert.deepEqual(resizeBrowserAroundCenter({ width: 800, height: 500 }, { x: 50, y: 25 }, { width: 1200, height: 800 }), { width: 900, height: 550 });
  assert.deepEqual(clampBrowserSize({ width: 5000, height: 5000 }, { width: 1200, height: 800 }), { width: 1104, height: 704 });
  assert.deepEqual(resizeBrowserByKey({ width: 800, height: 500 }, 'ArrowRight', { width: 1200, height: 800 }), { width: 824, height: 500 });
  assert.equal(resizeBrowserByKey({ width: 800, height: 500 }, 'Enter', { width: 1200, height: 800 }), null);
});

test('index filtering keeps filing, media and tokenized search independent', () => {
  const assets = [
    { stableAssetId: 'asset:a', title: 'Portrait Study', mediaType: 'image' },
    { stableAssetId: 'asset:b', title: 'Quiet Motion', mediaType: 'video' },
    { stableAssetId: 'asset:c', title: null, mediaType: 'image' },
  ];
  const categories = [{ assetIds: ['asset:a'] }];
  assert.deepEqual(filterBrowserAssets(assets, categories, { filing: BROWSER_FILING_FILTERS.SORTED }).map((asset) => asset.stableAssetId), ['asset:a']);
  assert.deepEqual(filterBrowserAssets(assets, categories, { filing: BROWSER_FILING_FILTERS.UNSORTED }).map((asset) => asset.stableAssetId), ['asset:b', 'asset:c']);
  assert.deepEqual(filterBrowserAssets(assets, categories, { mediaType: 'image', query: 'portrait study' }).map((asset) => asset.stableAssetId), ['asset:a']);
});

test('category dialogs reset create text and always use the current rename target', () => {
  const categoryA = { id: 'a', name: 'Category A' };
  const categoryB = { id: 'b', name: 'Category B' };
  assert.equal(categoryDialogInitialName({ type: 'create' }), '');
  assert.equal(categoryDialogInitialName({ category: categoryA, type: 'rename' }), 'Category A');
  assert.equal(categoryDialogInitialName({ type: 'create' }), '');
  assert.equal(categoryDialogInitialName({ category: categoryB, type: 'rename' }), 'Category B');
});

test('Categories asset search never inherits Index-only filing or media filters', () => {
  const assets = [
    { stableAssetId: 'asset:a', title: 'Filed Image', mediaType: 'image' },
    { stableAssetId: 'asset:b', title: 'Unfiled Video', mediaType: 'video' },
  ];
  assert.deepEqual(searchBrowserCategoryAssets(assets, '').map((asset) => asset.stableAssetId), ['asset:a', 'asset:b']);
  assert.deepEqual(searchBrowserCategoryAssets(assets, 'video').map((asset) => asset.stableAssetId), ['asset:b']);
});
