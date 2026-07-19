import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { loadLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';
import { resetLibraryStoreForTests, useLibraryStore } from './useLibraryStore.js';

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
