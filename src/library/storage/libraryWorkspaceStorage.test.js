import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryWorkspaceKey, loadLibraryWorkspace, normalizeWorkspace } from './libraryWorkspaceStorage.js';
import { createLibraryWorkspacePersistence } from './libraryWorkspacePersistence.js';

const profile = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('v9 organization roundtrips with normalized profile, favorites and category memberships', () => {
  const storage = memoryStorage(), persistence = createLibraryWorkspacePersistence(storage);
  persistence.load(profile);
  const workspace = normalizeWorkspace({ version: 9, profileAddress: profile.toUpperCase().replace('0X', '0x'), favorites: ['a', 'a'], folders: [
    { id: 'folder', name: ' Art ', assetIds: ['a', 'a'], public: true, createdAt: 1, updatedAt: 2 },
  ] }, profile);
  assert.equal(persistence.save(workspace).ok, true);
  const { raw, workspace: loaded } = loadLibraryWorkspace(storage, profile);
  assert.equal(raw, storage.getItem(libraryWorkspaceKey(profile)));
  assert.deepEqual(loaded, workspace);
  assert.deepEqual(loaded.favorites, ['a']);
  assert.deepEqual(loaded.folders, [{ id: 'folder', name: 'Art', assetIds: ['a'], public: true, createdAt: 1, updatedAt: 2 }]);
});

test('invalid stored image selection never broadens a category back to the whole asset', () => {
  const workspace = { version: 9, profileAddress: profile, folders: [{ id: 'one', name: 'Chosen', assetIds: ['asset'],
    imageSelections: [{ assetId: 'asset', url: 'javascript:invalid' }] }] };
  const raw = JSON.stringify(workspace), key = libraryWorkspaceKey(profile);
  const storage = memoryStorage({ [key]: raw });
  const persistence = createLibraryWorkspacePersistence(storage);
  assert.ok(persistence.load(profile).persistenceError);
  assert.equal(storage.getItem(key), raw);
  assert.equal(persistence.save(workspace).ok, false);
});

test('missing current record is empty without writing; malformed, unsupported and wrong-profile records throw', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadLibraryWorkspace(storage, profile).workspace.folders, []);
  assert.equal(storage.values.size, 0);
  for (const raw of ['', '{bad json', 'null', ...[1,2,3,4,5,6,7,8,10].map(version => JSON.stringify({ version, profileAddress: profile })),
    JSON.stringify({ version: 9, profileAddress: '0x1111111111111111111111111111111111111111' })]) {
    storage.values.set(libraryWorkspaceKey(profile), raw);
    assert.throws(() => loadLibraryWorkspace(storage, profile));
    assert.equal(storage.getItem(libraryWorkspaceKey(profile)), raw);
  }
  assert.throws(() => loadLibraryWorkspace(null, profile), /unavailable/);
});

test('the reader touches only the current key and returns its exact conflict token', () => {
  const key = libraryWorkspaceKey(profile), reads = [];
  const raw = JSON.stringify({ version: 9, profileAddress: profile, favorites: ['current'], folders: [] });
  const loaded = loadLibraryWorkspace({ getItem(name) { reads.push(name); return raw; } }, profile);
  assert.deepEqual(reads, [key]); assert.equal(loaded.raw, raw);
  assert.deepEqual(loaded.workspace.favorites, ['current']);
});

test('v9 table and canvas content remain normalized without version conversion', () => {
  const current = normalizeWorkspace({ version: 9, profileAddress: profile, favorites: [], folders: [],
    tables: { placements: [{ id: 'table:one', tableId: 'archive', stableAssetId: 'asset:one',
      rect: { x: .2, y: .3, width: .25, height: .4 }, crop: { x: .5, y: .4, zoom: 1.5 }, layer: 0 }] },
    canvas: { objects: [{ id: 'canvas:artwork:one', kind: 'framed-artwork', stableAssetId: '42:0x1111111111111111111111111111111111111111:0x01', visitorVisible: true, locked: true,
      placement: { column: 4, row: 5 }, span: { columns: 4, rows: 4 }, presentationOrder: 99,
      presentation: { fit: 'cover', frame: 'heavy', mat: 'light', background: 'neutral' } }] },
  }, profile);
  const storage = memoryStorage(), persistence = createLibraryWorkspacePersistence(storage); persistence.load(profile);
  assert.equal(persistence.save(current).ok, true);
  const loaded = loadLibraryWorkspace(storage, profile).workspace;
  assert.deepEqual(loaded.tables, current.tables);
  assert.equal(loaded.canvas.objects.length, 1); assert.equal(loaded.canvas.objects[0].presentationOrder, 0); assert.equal(loaded.canvas.objects[0].locked, true);
});

test('v9 category organization removes malformed references and assigns unmentioned categories to root', () => {
  const current = normalizeWorkspace({
    version: 9, profileAddress: profile, favorites: [],
    folders: [
      { id: 'one', name: 'One', assetIds: [], createdAt: 1, updatedAt: 1 },
      { id: 'two', name: 'Two', assetIds: [], createdAt: 1, updatedAt: 1 },
      { id: 'three', name: 'Three', assetIds: [], createdAt: 1, updatedAt: 1 },
    ],
    categoryOrganization: {
      rootCategoryIds: ['one', 'missing', 'one'],
      sections: [
        { id: 'archive', name: ' Archive ', categoryIds: ['two', 'missing', 'two'] },
        { id: 'archive', name: 'Duplicate', categoryIds: ['three'] },
      ],
    },
    canvas: { launchers: [], objects: [] }, tables: { placements: [] },
  }, profile);
  assert.deepEqual(current.categoryOrganization, {
    rootCategoryIds: ['one', 'three'],
    sections: [{ id: 'archive', name: 'Archive', categoryIds: ['two'] }],
  });
});
