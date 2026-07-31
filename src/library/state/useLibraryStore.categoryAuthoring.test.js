import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { loadLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';
import { createOwnerLatticeCategoryCommands } from '../../public/useOwnerLatticeBrowser.js';
import { flushLibraryWorkspace, resetLibraryStoreForTests, useLibraryStore } from './useLibraryStore.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const OTHER_PROFILE = '0x2222222222222222222222222222222222222222';
const ASSET_ID = '42:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:contract';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const memoryStorage = () => {
  const values = new Map(); const writes = [];
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { writes.push(key); values.set(key, value); },
    values,
    writes,
  };
};

test('owner category boundary creates private, renames, changes visibility, and deletes only organization', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  const preservedAssets = [{ id: ASSET_ID }];
  const preservedCanvas = { launchers: [], objects: [{ id: 'legacy-object', stableAssetId: ASSET_ID }] };
  const preservedTables = { placements: [{ id: 'canonical-placement', stableAssetId: ASSET_ID }] };
  useLibraryStore.setState({ assets: preservedAssets, workspace: {
    ...createEmptyWorkspace(PROFILE), canvas: preservedCanvas, tables: preservedTables,
  } });
  const commands = createOwnerLatticeCategoryCommands(PROFILE);

  const categoryId = commands.createCategory('  Exhibition  ');
  assert.ok(categoryId);
  assert.deepEqual(useLibraryStore.getState().workspace.folders[0], {
    id: categoryId, name: 'Exhibition', assetIds: [], public: false,
    createdAt: useLibraryStore.getState().workspace.folders[0].createdAt,
    updatedAt: useLibraryStore.getState().workspace.folders[0].updatedAt,
  });
  assert.equal(commands.renameCategory(categoryId, 'Archive'), true);
  assert.equal(commands.setCategoryPublic(categoryId, true), true);
  assert.equal(commands.setCategoryAsset(categoryId, ASSET_ID, true), true);
  assert.equal(commands.deleteCategory(categoryId), true);
  assert.deepEqual(useLibraryStore.getState().workspace.folders, []);
  assert.equal(useLibraryStore.getState().assets, preservedAssets);
  assert.equal(useLibraryStore.getState().workspace.canvas, preservedCanvas);
  assert.equal(useLibraryStore.getState().workspace.tables, preservedTables);
  assert.equal(flushLibraryWorkspace(), true);
  assert.deepEqual(loadLibraryWorkspace(storage, PROFILE).folders, []);
});
test('membership add/remove is stable-ID based and repeated commands perform no additional writes', async () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  const commands = createOwnerLatticeCategoryCommands(PROFILE);
  const categoryId = commands.createCategory('Membership');
  assert.equal(commands.setCategoryAsset(categoryId, ASSET_ID, true), true);
  assert.equal(flushLibraryWorkspace(), true);
  storage.writes.length = 0;

  assert.equal(commands.setCategoryAsset(categoryId, ASSET_ID, true), false);
  await delay(220);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(useLibraryStore.getState().workspace.folders[0].assetIds, [ASSET_ID]);
  assert.equal(commands.setCategoryAsset(categoryId, ASSET_ID, false), true);
  assert.deepEqual(useLibraryStore.getState().workspace.folders[0].assetIds, []);
  assert.equal(commands.setCategoryAsset(categoryId, ASSET_ID, false), false);
});

test('invalid input, cancellation, and stale captured callbacks produce zero writes', async () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  const captured = createOwnerLatticeCategoryCommands(PROFILE);
  assert.equal(captured.createCategory('   '), null);
  assert.equal(captured.renameCategory('missing', '  '), false);
  await delay(220);
  assert.deepEqual(storage.writes, []);

  assert.equal(useLibraryStore.getState().setProfileAddress(OTHER_PROFILE), true);
  storage.writes.length = 0;
  assert.equal(captured.createCategory('Must not cross profiles'), null);
  assert.equal(captured.setCategoryAsset('missing', ASSET_ID, true), false);
  await delay(220);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(useLibraryStore.getState().workspace.folders, []);
  assert.deepEqual(loadLibraryWorkspace(storage, PROFILE).folders, []);
});
