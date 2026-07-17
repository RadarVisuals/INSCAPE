import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace, createFolder, deleteFolder, renameFolder, setFolderAsset, toggleFavorite } from './libraryWorkspace.js';

test('folders create, rename, add/remove references, and delete without touching favorites', () => {
  let workspace = createEmptyWorkspace('0xprofile');
  workspace = createFolder(workspace, '1/1 Art', 10);
  const id = workspace.folders[0].id;
  workspace = setFolderAsset(workspace, id, 'asset-a', true, 20);
  workspace = setFolderAsset(workspace, id, 'asset-a', true, 30);
  assert.deepEqual(workspace.folders[0].assetIds, ['asset-a']);
  workspace = renameFolder(workspace, id, 'Collected Art', 40);
  assert.equal(workspace.folders[0].name, 'Collected Art');
  workspace = toggleFavorite(workspace, 'asset-b');
  workspace = setFolderAsset(workspace, id, 'asset-a', false, 50);
  workspace = deleteFolder(workspace, id);
  assert.deepEqual(workspace.folders, []);
  assert.deepEqual(workspace.favorites, ['asset-b']);
});
