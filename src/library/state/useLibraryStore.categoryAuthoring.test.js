import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { loadLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';
import { createOwnerLatticeCategoryCommands } from '../../public/useOwnerLatticeBrowser.js';
import { flushLibraryWorkspace, resetLibraryStoreForTests, useLibraryStore } from './useLibraryStore.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const OTHER_PROFILE = '0x2222222222222222222222222222222222222222';
const ASSET_ID = '42:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:contract';
const SECOND_ASSET_ID = '42:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:contract';
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

test('section commands persist profile-scoped category organization and return categories to root on delete', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  const commands = createOwnerLatticeCategoryCommands(PROFILE);
  const firstId = commands.createCategory('First'); const secondId = commands.createCategory('Second');
  const archiveId = commands.createSection('Archive'); const currentId = commands.createSection('Current');
  assert.ok(archiveId); assert.ok(currentId);
  assert.equal(commands.moveCategory(secondId, archiveId), true);
  assert.equal(commands.moveCategory(firstId, archiveId, secondId), true);
  assert.equal(commands.renameSection(archiveId, 'Past'), true);
  assert.equal(commands.moveSection(currentId, archiveId), true);
  assert.equal(commands.deleteSection(archiveId), true);
  assert.equal(flushLibraryWorkspace(), true);
  assert.deepEqual(loadLibraryWorkspace(storage, PROFILE).categoryOrganization, {
    rootCategoryIds: [firstId, secondId],
    sections: [{ id: currentId, name: 'Current', categoryIds: [] }],
  });
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
  assert.equal(captured.createSection('Must not cross profiles'), null);
  await delay(220);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(useLibraryStore.getState().workspace.folders, []);
  assert.deepEqual(loadLibraryWorkspace(storage, PROFILE).folders, []);
});

test('bulk category membership validates the canonical asset set and schedules one idempotent save', async () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  useLibraryStore.setState({ assets: [{ id: ASSET_ID }, { id: SECOND_ASSET_ID }] });
  const commands = createOwnerLatticeCategoryCommands(PROFILE);
  const categoryId = commands.createCategory('Bulk');
  flushLibraryWorkspace(); storage.writes.length = 0;
  assert.equal(commands.setCategoryAssets(categoryId, [ASSET_ID, SECOND_ASSET_ID, ASSET_ID], true), true);
  await delay(220);
  assert.equal(storage.writes.length, 1);
  assert.deepEqual(useLibraryStore.getState().workspace.folders[0].assetIds, [ASSET_ID, SECOND_ASSET_ID]);
  storage.writes.length = 0;
  assert.equal(commands.setCategoryAssets(categoryId, [ASSET_ID, SECOND_ASSET_ID], true), false);
  assert.equal(commands.setCategoryAssets(categoryId, [ASSET_ID, 'missing'], false), false);
  await delay(220);
  assert.deepEqual(storage.writes, []);
});

test('bulk category membership accepts a created-only stable ID explicitly supplied by the relationship projection', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  useLibraryStore.setState({ assets: [{ id: ASSET_ID }] });
  const commands = createOwnerLatticeCategoryCommands(PROFILE);
  const categoryId = commands.createCategory('Created works');
  assert.equal(commands.setCategoryAssets(categoryId, [SECOND_ASSET_ID], true, [SECOND_ASSET_ID]), true);
  assert.deepEqual(useLibraryStore.getState().workspace.folders[0].assetIds, [SECOND_ASSET_ID]);
  assert.equal(commands.setCategoryAssets(categoryId, ['not-canonical'], true, [SECOND_ASSET_ID]), false);
});
