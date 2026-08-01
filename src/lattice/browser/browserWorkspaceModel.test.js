import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BROWSER_FILING_FILTERS,
  categoryDialogInitialName,
  clampBrowserPosition,
  clampBrowserSize,
  filterBrowserAssets,
  initialBrowserPosition,
  initialBrowserSize,
  resizeBrowserAroundCenter,
  resizeBrowserByKey,
  searchBrowserCategoryAssets,
} from './browserWorkspaceModel.js';

test('browser sizing is centered, clamped, responsive and keyboard adjustable', () => {
  assert.deepEqual(initialBrowserSize({ width: 1440, height: 900 }), { width: 1040, height: 680 });
  assert.deepEqual(initialBrowserSize({ width: 600, height: 500 }), { width: 580, height: 480 });
  assert.deepEqual(resizeBrowserAroundCenter({ width: 800, height: 500 }, { x: 50, y: 25 }, { width: 1200, height: 800 }), { width: 900, height: 550 });
  assert.deepEqual(clampBrowserSize({ width: 5000, height: 5000 }, { width: 1200, height: 800 }), { width: 1180, height: 780 });
  assert.deepEqual(clampBrowserSize({ width: 1, height: 500 }, { width: 1200, height: 800 }), { width: 360, height: 500 });
  assert.deepEqual(resizeBrowserByKey({ width: 800, height: 500 }, 'ArrowRight', { width: 1200, height: 800 }), { width: 824, height: 500 });
  assert.equal(resizeBrowserByKey({ width: 800, height: 500 }, 'Enter', { width: 1200, height: 800 }), null);
});

test('legacy index filtering keeps filing and tokenized search independent', () => {
  const assets = [
    { stableAssetId: 'asset:a', title: 'Portrait Study', mediaType: 'image' },
    { stableAssetId: 'asset:b', title: 'Quiet Motion', mediaType: 'video' },
    { stableAssetId: 'asset:c', title: null, mediaType: 'image' },
  ];
  const categories = [{ assetIds: ['asset:a'] }];
  assert.deepEqual(filterBrowserAssets(assets, categories, { filing: BROWSER_FILING_FILTERS.SORTED }).map((asset) => asset.stableAssetId), ['asset:a']);
  assert.deepEqual(filterBrowserAssets(assets, categories, { filing: BROWSER_FILING_FILTERS.UNSORTED }).map((asset) => asset.stableAssetId), ['asset:b', 'asset:c']);
  assert.deepEqual(filterBrowserAssets(assets, categories, { favorites: ['asset:b'], filing: BROWSER_FILING_FILTERS.FAVORITES }).map((asset) => asset.stableAssetId), ['asset:b']);
  assert.deepEqual(filterBrowserAssets(assets, categories, { query: 'portrait study' }).map((asset) => asset.stableAssetId), ['asset:a']);
});

test('browser position starts centered and keeps the complete rack inside the viewport', () => {
  const viewport = { width: 1440, height: 900 };
  const size = initialBrowserSize(viewport);
  assert.deepEqual(initialBrowserPosition(size, viewport), { left: 200, top: 110 });
  assert.deepEqual(clampBrowserPosition({ left: -200, top: 2000 }, size, viewport), { left: 10, top: 210 });
  assert.deepEqual(clampBrowserPosition({ left: 50, top: 50 }, { width: 580, height: 480 }, { width: 600, height: 500 }), { left: 10, top: 10 });
});

test('read-only Favorite filtering never mutates the provided membership', () => {
  const favorites = ['asset:a'];
  const before = [...favorites];
  filterBrowserAssets([{ stableAssetId: 'asset:a' }], [], {
    favorites,
    filing: BROWSER_FILING_FILTERS.FAVORITES,
  });
  assert.deepEqual(favorites, before);
});

test('category dialogs reset create text and always use the current rename target', () => {
  const categoryA = { id: 'a', name: 'Category A' };
  const categoryB = { id: 'b', name: 'Category B' };
  assert.equal(categoryDialogInitialName({ type: 'create' }), '');
  assert.equal(categoryDialogInitialName({ category: categoryA, type: 'rename' }), 'Category A');
  assert.equal(categoryDialogInitialName({ type: 'create' }), '');
  assert.equal(categoryDialogInitialName({ category: categoryB, type: 'rename' }), 'Category B');
});

test('Categories asset search never inherits legacy Index-only filing', () => {
  const assets = [
    { stableAssetId: 'asset:a', title: 'Filed Image', mediaType: 'image' },
    { stableAssetId: 'asset:b', title: 'Unfiled Video', mediaType: 'video' },
  ];
  assert.deepEqual(searchBrowserCategoryAssets(assets, '').map((asset) => asset.stableAssetId), ['asset:a', 'asset:b']);
  assert.deepEqual(searchBrowserCategoryAssets(assets, 'video').map((asset) => asset.stableAssetId), ['asset:b']);
});
