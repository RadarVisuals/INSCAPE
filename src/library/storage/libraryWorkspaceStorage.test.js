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

test('Phase 1 data migrates to v2 without changing favorites, folder names, or multi-folder memberships', () => {
  const phaseOne = { version: 1, profileAddress: profile, favorites: ['asset-a', 'asset-b'], folders: [
    { id: 'one', name: 'One / Ones', assetIds: ['asset-a', 'asset-c'], createdAt: 1, updatedAt: 2 },
    { id: 'friends', name: 'Works by Friends', assetIds: ['asset-a', 'asset-d'], createdAt: 3, updatedAt: 4 }
  ] };
  const storage = memoryStorage({ [libraryWorkspaceKey(profile, 1)]: JSON.stringify(phaseOne) });
  const migrated = loadLibraryWorkspace(storage, profile);

  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.favorites, phaseOne.favorites);
  assert.deepEqual(migrated.folders, phaseOne.folders);
  assert.deepEqual(migrated.canvas.launchers, []);
  assert.ok(storage.values.has(libraryWorkspaceKey(profile)));
});

test('pinned launcher identity and placement persist across a reload', () => {
  const storage = memoryStorage();
  const workspace = normalizeWorkspace({ version: 2, profileAddress: profile, favorites: [], folders: [
    { id: 'archive', name: 'Archive', assetIds: ['asset-a'], createdAt: 1, updatedAt: 2 }
  ], canvas: { launchers: [{ id: 'ignored-input-id', viewType: 'folder', folderId: 'archive', position: { column: 3, row: 4 }, windowPosition: { column: 1, row: 2 } }] } }, profile);

  saveLibraryWorkspace(storage, workspace);
  assert.deepEqual(loadLibraryWorkspace(storage, profile).canvas.launchers, [{
    id: 'library:folder:archive', viewType: 'folder', folderId: 'archive', position: { column: 3, row: 4 }, windowPosition: { column: 1, row: 2 }
  }]);
});
