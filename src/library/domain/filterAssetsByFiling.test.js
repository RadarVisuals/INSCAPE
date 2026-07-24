import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_FILING_FILTER, filterAssetsByFiling } from './filterAssetsByFiling.js';

const assets = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
const folders = [
  { id: 'a', assetIds: ['one', 'two'] },
  { id: 'b', assetIds: ['two', 'missing'] }
];

test('filing filters use membership across every folder without duplicating assets', () => {
  assert.deepEqual(filterAssetsByFiling(assets, folders, ASSET_FILING_FILTER.ALL), assets);
  assert.deepEqual(filterAssetsByFiling(assets, folders, ASSET_FILING_FILTER.FILED).map(({ id }) => id), ['one', 'two']);
  assert.deepEqual(filterAssetsByFiling(assets, folders, ASSET_FILING_FILTER.UNFILED).map(({ id }) => id), ['three']);
});

test('an empty folder collection leaves every asset unfiled', () => {
  assert.deepEqual(filterAssetsByFiling(assets, [], ASSET_FILING_FILTER.FILED), []);
  assert.deepEqual(filterAssetsByFiling(assets, [], ASSET_FILING_FILTER.UNFILED), assets);
});
