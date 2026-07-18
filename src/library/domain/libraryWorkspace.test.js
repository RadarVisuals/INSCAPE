import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyWorkspace,
  createFolder,
  deleteFolder,
  getPinnedLauncher,
  isProtectedLibraryView,
  pinLibraryView,
  renameFolder,
  resetCanvasLayout,
  setFolderAsset,
  setLauncherPosition,
  setLauncherStartOpen,
  setLauncherVisitorVisibility,
  toggleFavorite,
  unpinLibraryView
} from './libraryWorkspace.js';

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

test('pinning and unpinning preserve membership and use a stable launcher identity', () => {
  let workspace = createFolder(createEmptyWorkspace('0xprofile'), 'Archive', 10);
  const folderId = workspace.folders[0].id;
  workspace = setFolderAsset(workspace, folderId, 'asset-a', true, 20);
  workspace = setFolderAsset(workspace, folderId, 'asset-b', true, 30);
  const organization = structuredClone({ favorites: workspace.favorites, folders: workspace.folders });

  workspace = pinLibraryView(workspace, { type: 'folder', id: folderId });
  assert.equal(getPinnedLauncher(workspace, { type: 'folder', id: folderId }).visitorVisible, false);
  workspace = setLauncherVisitorVisibility(workspace, getPinnedLauncher(workspace, { type: 'folder', id: folderId }).id, true);
  const firstId = getPinnedLauncher(workspace, { type: 'folder', id: folderId }).id;
  workspace = unpinLibraryView(workspace, { type: 'folder', id: folderId });
  workspace = pinLibraryView(workspace, { type: 'folder', id: folderId });

  assert.equal(getPinnedLauncher(workspace, { type: 'folder', id: folderId }).id, firstId);
  assert.equal(getPinnedLauncher(workspace, { type: 'folder', id: folderId }).visitorVisible, false, 'repinning is private');
  assert.deepEqual({ favorites: workspace.favorites, folders: workspace.folders }, organization);
});

test('Favorites can be pinned but protected system views cannot be renamed, deleted, or pinned as All Assets', () => {
  let workspace = createEmptyWorkspace('0xprofile');
  workspace = pinLibraryView(workspace, { type: 'favorites', id: null });
  workspace = pinLibraryView(workspace, { type: 'all', id: null });

  assert.equal(workspace.canvas.launchers.length, 1);
  assert.equal(workspace.canvas.launchers[0].id, 'library:favorites');
  assert.equal(workspace.canvas.launchers[0].visitorVisible, false);
  assert.equal(isProtectedLibraryView({ type: 'all' }), true);
  assert.equal(isProtectedLibraryView({ type: 'favorites' }), true);
  assert.equal(renameFolder(workspace, 'all', 'Renamed'), workspace);
  assert.equal(deleteFolder(workspace, 'favorites'), workspace);
});

test('Reset Layout clears placement without deleting library organization or pins', () => {
  let workspace = createFolder(createEmptyWorkspace('0xprofile'), 'Exhibition', 10);
  const folderId = workspace.folders[0].id;
  workspace = toggleFavorite(setFolderAsset(workspace, folderId, 'asset-a', true, 20), 'asset-b');
  workspace = pinLibraryView(workspace, { type: 'folder', id: folderId });
  const launcherId = workspace.canvas.launchers[0].id;
  workspace = setLauncherPosition(workspace, launcherId, { column: 4, row: 5 });
  workspace = setLauncherVisitorVisibility(workspace, launcherId, true);
  const organization = structuredClone({ favorites: workspace.favorites, folders: workspace.folders });

  const reset = resetCanvasLayout(workspace);
  assert.deepEqual({ favorites: reset.favorites, folders: reset.folders }, organization);
  assert.equal(reset.canvas.launchers.length, 1);
  assert.equal(reset.canvas.launchers[0].position, null);
  assert.equal(reset.canvas.launchers[0].visitorVisible, true);
});

test('visitor visibility toggles only pinned presentation state', () => {
  let workspace = createFolder(createEmptyWorkspace('0xprofile'), 'Private desk', 10);
  const folderId = workspace.folders[0].id;
  workspace = setFolderAsset(workspace, folderId, 'asset-a', true, 20);
  workspace = pinLibraryView(workspace, { type: 'folder', id: folderId });
  const launcher = workspace.canvas.launchers[0];
  workspace = setLauncherPosition(workspace, launcher.id, { column: 2, row: 3 });
  const before = structuredClone({ folders: workspace.folders, favorites: workspace.favorites, position: workspace.canvas.launchers[0].position });
  workspace = setLauncherVisitorVisibility(workspace, launcher.id, true);
  assert.equal(workspace.canvas.launchers[0].visitorVisible, true);
  assert.deepEqual({ folders: workspace.folders, favorites: workspace.favorites, position: workspace.canvas.launchers[0].position }, before);
  assert.equal(setLauncherVisitorVisibility(workspace, 'not-pinned', true), workspace);
  workspace = unpinLibraryView(workspace, { type: 'folder', id: folderId });
  assert.equal(workspace.canvas.launchers.length, 0);
});

test('visitor start-open is authored independently from runtime and organization', () => {
  let workspace = createFolder(createEmptyWorkspace('0xprofile'), 'Opening exhibition', 10);
  const folderId = workspace.folders[0].id;
  workspace = pinLibraryView(workspace, { type: 'folder', id: folderId });
  const launcher = workspace.canvas.launchers[0];
  const organization = structuredClone(workspace.folders);
  workspace = setLauncherStartOpen(workspace, launcher.id, true, { column: 2, row: 3, columnSpan: 10, rowSpan: 8 });
  assert.equal(workspace.canvas.launchers[0].startOpen, true);
  assert.deepEqual(workspace.canvas.launchers[0].windowGeometry, { column: 2, row: 3, columnSpan: 10, rowSpan: 8 });
  workspace = setLauncherStartOpen(workspace, launcher.id, true, { column: 2, row: 3, columnSpan: 0, rowSpan: 8 });
  assert.deepEqual(workspace.canvas.launchers[0].windowGeometry, { column: 2, row: 3, columnSpan: 10, rowSpan: 8 });
  assert.deepEqual(workspace.folders, organization);
  assert.equal(setLauncherStartOpen(workspace, 'missing', false), workspace);
});
