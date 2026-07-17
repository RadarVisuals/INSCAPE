import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from './libraryWorkspace.js';
import { getMissingLibraryViewAssetIds, selectLibraryViewAssets } from './selectLibraryViewAssets.js';

const assets = [
  { id: 'a', name: 'Orange Signal', description: '', collectionName: 'Underneath', contractAddress: '0x1', tokenId: null, creators: [], attributes: [] },
  { id: 'b', name: 'Purple Keeper', description: '', collectionName: 'Underneath', contractAddress: '0x2', tokenId: null, creators: [], attributes: [] },
  { id: 'c', name: 'Outside Work', description: '', collectionName: 'Other', contractAddress: '0x3', tokenId: null, creators: [], attributes: [] }
];

test('folder filtering and local search never leak assets from outside the folder', () => {
  const workspace = { ...createEmptyWorkspace('0xprofile'), folders: [
    { id: 'folder', name: 'Curated', assetIds: ['a', 'b', 'missing'], createdAt: 0, updatedAt: 0 }
  ] };
  const view = { type: 'folder', id: 'folder' };

  assert.deepEqual(selectLibraryViewAssets(assets, workspace, view).map((asset) => asset.id), ['a', 'b']);
  assert.deepEqual(selectLibraryViewAssets(assets, workspace, view, 'purple').map((asset) => asset.id), ['b']);
  assert.deepEqual(selectLibraryViewAssets(assets, workspace, view, 'outside'), []);
  assert.deepEqual(getMissingLibraryViewAssetIds(assets, workspace, view), ['missing']);
});
