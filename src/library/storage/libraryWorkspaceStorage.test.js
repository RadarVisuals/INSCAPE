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

test('Phase 1 data migrates to v7 without changing favorites, folder names, or multi-folder memberships', () => {
  const phaseOne = { version: 1, profileAddress: profile, favorites: ['asset-a', 'asset-b'], folders: [
    { id: 'one', name: 'One / Ones', assetIds: ['asset-a', 'asset-c'], createdAt: 1, updatedAt: 2 },
    { id: 'friends', name: 'Works by Friends', assetIds: ['asset-a', 'asset-d'], createdAt: 3, updatedAt: 4 }
  ] };
  const storage = memoryStorage({ [libraryWorkspaceKey(profile, 1)]: JSON.stringify(phaseOne) });
  const migrated = loadLibraryWorkspace(storage, profile);

  assert.equal(migrated.version, 7);
  assert.deepEqual(migrated.favorites, phaseOne.favorites);
  assert.deepEqual(migrated.folders, phaseOne.folders.map((folder) => ({ ...folder, public: false })));
  assert.deepEqual(migrated.canvas.launchers, []);
  assert.deepEqual(migrated.canvas.objects, []);
  assert.ok(storage.values.has(libraryWorkspaceKey(profile)));
});

test('retired launcher records are discarded across a reload', () => {
  const storage = memoryStorage();
  const workspace = normalizeWorkspace({ version: 3, profileAddress: profile, favorites: [], folders: [
    { id: 'archive', name: 'Archive', assetIds: ['asset-a'], createdAt: 1, updatedAt: 2 }
  ], canvas: { launchers: [{ id: 'ignored-input-id', viewType: 'folder', folderId: 'archive', visitorVisible: false, position: { column: 3, row: 4 }, windowPosition: { column: 1, row: 2 } }] } }, profile);

  saveLibraryWorkspace(storage, workspace);
  assert.deepEqual(loadLibraryWorkspace(storage, profile).canvas.launchers, []);
});

test('v2 pinned spaces migrate folder publication before launcher records are discarded', () => {
  const phaseTwo = { version: 2, profileAddress: profile, favorites: [], folders: [
    { id: 'existing', name: 'Existing', assetIds: ['asset-a'], createdAt: 1, updatedAt: 2 }
  ], canvas: { launchers: [{ id: 'ignored', viewType: 'folder', folderId: 'existing', position: { column: 3, row: 4 }, windowPosition: null }] } };
  const storage = memoryStorage({ [libraryWorkspaceKey(profile, 2)]: JSON.stringify(phaseTwo) });
  const migrated = loadLibraryWorkspace(storage, profile);
  assert.equal(migrated.version, 7);
  assert.equal(migrated.folders[0].public, true);
  assert.deepEqual(migrated.canvas.launchers, []);
  assert.ok(storage.values.has(libraryWorkspaceKey(profile)));
});

test('v4 and v5 launcher presentation is retired without affecting folders', () => {
  const base = normalizeWorkspace({ version: 4, profileAddress: profile, favorites: [], folders: [{ id: 'a', name: 'A', assetIds: [], createdAt: 0, updatedAt: 0 }], canvas: { launchers: [{ viewType: 'folder', folderId: 'a', visitorVisible: true }] } }, profile);
  assert.equal(base.folders[0].public, true);
  assert.deepEqual(base.canvas.launchers, []);
  const current = normalizeWorkspace({ ...base, version: 5, canvas: { launchers: [{ viewType: 'folder', folderId: 'a', startOpen: true }] } }, profile);
  assert.deepEqual(current.canvas.launchers, []);
});

test('v5 workspaces migrate purely to an empty canvas-object collection and v6 objects normalize into v7', () => {
  const v5 = { version: 5, profileAddress: profile, favorites: ['kept'], folders: [], canvas: { launchers: [] } };
  const migrated = normalizeWorkspace(v5, profile);
  assert.equal(migrated.version, 7); assert.deepEqual(migrated.favorites, ['kept']); assert.deepEqual(migrated.canvas.objects, []);
  const current = normalizeWorkspace({ ...v5, version: 6, canvas: { launchers: [], objects: [{
    id: 'canvas:artwork:one', kind: 'framed-artwork', stableAssetId: '42:0x1111111111111111111111111111111111111111:0x01', visitorVisible: true, locked: true,
    placement: { column: 4, row: 5 }, span: { columns: 4, rows: 4 }, presentationOrder: 99,
    presentation: { fit: 'cover', frame: 'heavy', mat: 'light', background: 'neutral' }
  }] } }, profile);
  assert.equal(current.canvas.objects.length, 1); assert.equal(current.canvas.objects[0].presentationOrder, 0); assert.equal(current.canvas.objects[0].locked, true);
});
