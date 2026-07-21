import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { loadLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';
import { flushLibraryWorkspace, resetLibraryStoreForTests, useLibraryStore } from './useLibraryStore.js';

const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const memoryStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};

test('a pending Library save cannot overwrite an immediately restored workspace', async () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  useLibraryStore.getState().createFolder('Pending old folder');
  const restored = { ...createEmptyWorkspace(PROFILE), favorites: ['restored-asset'] };

  assert.equal(useLibraryStore.getState().replaceWorkspace(restored), true);
  await delay(220);
  assert.deepEqual(loadLibraryWorkspace(storage, PROFILE), restored);
  assert.deepEqual(useLibraryStore.getState().workspace, restored);

  resetLibraryStoreForTests(PROFILE, storage);
  assert.deepEqual(useLibraryStore.getState().workspace, restored);
});

test('failed immediate Library persistence preserves current state', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('storage denied'); } };
  resetLibraryStoreForTests(PROFILE, storage);
  const before = useLibraryStore.getState().workspace;
  const replacement = { ...before, favorites: ['not-committed'] };
  assert.equal(useLibraryStore.getState().replaceWorkspace(replacement), false);
  assert.deepEqual(useLibraryStore.getState().workspace, before);
  resetLibraryStoreForTests(PROFILE, memoryStorage());
});

test('Library draft flushing persists the latest workspace immediately and reports failure', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  useLibraryStore.getState().createFolder('Flush me');
  assert.equal(flushLibraryWorkspace(), true);
  assert.equal(loadLibraryWorkspace(storage, PROFILE).folders.some((folder) => folder.name === 'Flush me'), true);

  resetLibraryStoreForTests(PROFILE, { getItem: () => null, setItem: () => { throw new Error('quota'); } });
  assert.equal(flushLibraryWorkspace(), false);
  resetLibraryStoreForTests(PROFILE, memoryStorage());
});

test('rack folder authoring persists names and public projection state through the existing workspace record', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  const folderId = useLibraryStore.getState().createFolder('Draft room');
  useLibraryStore.getState().renameFolder(folderId, 'Public room');
  useLibraryStore.getState().setFolderAsset(folderId, 'asset:owned:1', true);
  useLibraryStore.getState().setFolderVisitorVisibility(folderId, true);
  assert.equal(flushLibraryWorkspace(), true);

  const stored = loadLibraryWorkspace(storage, PROFILE);
  assert.equal(stored.folders.find((folder) => folder.id === folderId)?.name, 'Public room');
  assert.deepEqual(stored.folders.find((folder) => folder.id === folderId)?.assetIds, ['asset:owned:1']);
  assert.equal(stored.canvas.launchers.find((launcher) => launcher.folderId === folderId)?.visitorVisible, true);
  resetLibraryStoreForTests(PROFILE, memoryStorage());
});

test('deleting a public rack folder removes its organization and launcher but never its Library asset', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  const asset = { id: 'asset:owned:delete-safety', name: 'Still owned' };
  useLibraryStore.setState({ assets: [asset] });
  const folderId = useLibraryStore.getState().createFolder('Temporary room');
  useLibraryStore.getState().setFolderAsset(folderId, asset.id, true);
  useLibraryStore.getState().setFolderVisitorVisibility(folderId, true);

  useLibraryStore.getState().deleteFolder(folderId);
  assert.equal(flushLibraryWorkspace(), true);
  const stored = loadLibraryWorkspace(storage, PROFILE);
  assert.equal(stored.folders.some((folder) => folder.id === folderId), false);
  assert.equal(stored.canvas.launchers.some((launcher) => launcher.folderId === folderId), false);
  assert.deepEqual(useLibraryStore.getState().assets, [asset]);
  resetLibraryStoreForTests(PROFILE, memoryStorage());
});
