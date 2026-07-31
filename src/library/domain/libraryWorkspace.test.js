import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyWorkspace,
  createFolder,
  deleteFolder,
  isProtectedLibraryView,
  renameFolder,
  resetCanvasLayout,
  setFolderAsset,
  setFolderAssets,
  setFolderPublic,
  toggleFavorite
} from './libraryWorkspace.js';

test('folders create, rename, add/remove references, and delete without touching favorites', () => {
  let workspace = createEmptyWorkspace('0xprofile');
  workspace = createFolder(workspace, '1/1 Art', 10);
  const id = workspace.folders[0].id;
  workspace = setFolderAsset(workspace, id, 'asset-a', true, 20);
  const afterAdd = workspace;
  workspace = setFolderAsset(workspace, id, 'asset-a', true, 30);
  assert.equal(workspace, afterAdd);
  assert.deepEqual(workspace.folders[0].assetIds, ['asset-a']);
  workspace = renameFolder(workspace, id, 'Collected Art', 40);
  assert.equal(workspace.folders[0].name, 'Collected Art');
  workspace = toggleFavorite(workspace, 'asset-b');
  workspace = setFolderAsset(workspace, id, 'asset-a', false, 50);
  workspace = deleteFolder(workspace, id);
  assert.deepEqual(workspace.folders, []);
  assert.deepEqual(workspace.favorites, ['asset-b']);
});

test('bulk folder membership is atomic, deduplicated, and idempotent', () => {
  let workspace = createFolder(createEmptyWorkspace('0xprofile'), 'Bulk', 10);
  const id = workspace.folders[0].id;
  workspace = setFolderAssets(workspace, id, ['a', 'b', 'a'], true, 20);
  assert.deepEqual(workspace.folders[0].assetIds, ['a', 'b']);
  const stable = workspace;
  assert.equal(setFolderAssets(workspace, id, ['a', 'b'], true, 30), stable);
  workspace = setFolderAssets(workspace, id, ['a'], false, 40);
  assert.deepEqual(workspace.folders[0].assetIds, ['b']);
});

test('protected system views cannot be renamed or deleted', () => {
  const workspace = createEmptyWorkspace('0xprofile');
  assert.equal(isProtectedLibraryView({ type: 'all' }), true);
  assert.equal(isProtectedLibraryView({ type: 'favorites' }), true);
  assert.equal(renameFolder(workspace, 'all', 'Renamed'), workspace);
  assert.equal(deleteFolder(workspace, 'favorites'), workspace);
});

test('Reset Layout retires legacy launchers without deleting organization or Gallery objects', () => {
  let workspace = createFolder(createEmptyWorkspace('0xprofile'), 'Exhibition', 10);
  const folderId = workspace.folders[0].id;
  workspace = toggleFavorite(setFolderAsset(workspace, folderId, 'asset-a', true, 20), 'asset-b');
  workspace = { ...workspace, canvas: { ...workspace.canvas, launchers: [{ id: 'library:folder:legacy' }] } };
  workspace = { ...workspace, canvas: { ...workspace.canvas, objects: [{ id: 'gallery-object', placement: { column: 9, row: 2 } }] } };
  const organization = structuredClone({ favorites: workspace.favorites, folders: workspace.folders });

  const reset = resetCanvasLayout(workspace);
  assert.deepEqual({ favorites: reset.favorites, folders: reset.folders }, organization);
  assert.deepEqual(reset.canvas.launchers, []);
  assert.deepEqual(reset.canvas.objects, workspace.canvas.objects);
});

test('folder publication is independent from asset membership', () => {
  let workspace = createFolder(createEmptyWorkspace('0xprofile'), 'Public archive', 10);
  const id = workspace.folders[0].id;
  workspace = setFolderAsset(workspace, id, 'asset-a', true, 20);
  workspace = setFolderPublic(workspace, id, true, 30);
  assert.equal(workspace.folders[0].public, true);
  assert.deepEqual(workspace.folders[0].assetIds, ['asset-a']);
  assert.equal(workspace.canvas.launchers.length, 0);
  workspace = setFolderPublic(workspace, id, false, 40);
  assert.equal(workspace.folders[0].public, false);
});

