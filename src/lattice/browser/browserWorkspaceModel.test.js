import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BROWSER_FILING_FILTERS,
  categoryDialogInitialName,
  filterBrowserAssets,
  searchBrowserCategoryAssets,
} from './browserWorkspaceModel.js';

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
