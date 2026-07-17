import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryWorkspaceKey, loadLibraryWorkspace, normalizeWorkspace, saveLibraryWorkspace } from './libraryWorkspaceStorage.js';

const profile = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('workspace storage persists only normalized versioned organization', () => {
  const storage = memoryStorage();
  const workspace = normalizeWorkspace({ version: 1, profileAddress: profile.toUpperCase().replace('0X', '0x'), favorites: ['a', 'a'], folders: [
    { id: 'folder', name: ' Art ', assetIds: ['a', 'a'], createdAt: 1, updatedAt: 2 }
  ] }, profile);
  assert.equal(saveLibraryWorkspace(storage, workspace), true);
  assert.deepEqual(loadLibraryWorkspace(storage, profile), { ...workspace, favorites: ['a'], folders: [{ ...workspace.folders[0], assetIds: ['a'] }] });
});

test('malformed and wrong-profile storage recovers to an empty workspace', () => {
  const malformed = memoryStorage({ [libraryWorkspaceKey(profile)]: '{bad json' });
  assert.deepEqual(loadLibraryWorkspace(malformed, profile).folders, []);
  const wrong = normalizeWorkspace({ version: 1, profileAddress: '0x1111111111111111111111111111111111111111', favorites: ['x'], folders: [] }, profile);
  assert.deepEqual(wrong.favorites, []);
});
