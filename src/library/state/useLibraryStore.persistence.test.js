import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { loadLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';
import { chillwhalesProfileRepository } from '../data/chillwhalesProfileRepository.js';
import { flushLibraryWorkspace, resetLibraryStoreForTests, useLibraryStore } from './useLibraryStore.js';

const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const OTHER_PROFILE = '0x2222222222222222222222222222222222222222';
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

test('switching installed profiles isolates each Library workspace', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  useLibraryStore.getState().createFolder('First profile only');
  useLibraryStore.getState().selectAsset('first-profile-asset');

  assert.equal(useLibraryStore.getState().setProfileAddress(OTHER_PROFILE), true);
  assert.equal(useLibraryStore.getState().profileAddress, OTHER_PROFILE);
  assert.equal(useLibraryStore.getState().workspace.profileAddress, OTHER_PROFILE);
  assert.deepEqual(useLibraryStore.getState().workspace.folders, []);
  assert.equal(useLibraryStore.getState().selectedAssetId, null);

  assert.equal(useLibraryStore.getState().setProfileAddress(PROFILE), true);
  assert.equal(useLibraryStore.getState().workspace.folders[0].name, 'First profile only');
});

test('discarding a broken visual asset removes only its transient index record', () => {
  const storage = memoryStorage();
  resetLibraryStoreForTests(PROFILE, storage);
  const stableAssetId = '42:0x1111111111111111111111111111111111111111:contract';
  const workspace = { ...createEmptyWorkspace(PROFILE), favorites: [stableAssetId] };
  useLibraryStore.setState({
    assets: [{ id: stableAssetId, ownerAddress: PROFILE,
      contractAddress: '0x1111111111111111111111111111111111111111', imageUrl: 'https://broken.example/image.webp' }],
    selectedAssetId: stableAssetId,
    workspace
  });

  assert.equal(useLibraryStore.getState().discardUnavailableAsset(stableAssetId), true);
  assert.deepEqual(useLibraryStore.getState().assets, []);
  assert.equal(useLibraryStore.getState().selectedAssetId, null);
  assert.deepEqual(useLibraryStore.getState().workspace, workspace);
});

test('late asset batches cannot write the outgoing or incoming profile cache after generation changes', async () => {
  const operations = [];
  const values = new Map();
  const storage = {
    getItem(key) { operations.push({ method: 'getItem', key }); return values.get(key) ?? null; },
    setItem(key, value) { operations.push({ method: 'setItem', key }); values.set(key, value); },
  };
  let releaseBatch;
  const batchReady = new Promise((resolve) => { releaseBatch = resolve; });
  const originalLoad = chillwhalesProfileRepository.loadProfileAssets;
  chillwhalesProfileRepository.loadProfileAssets = async function* lateProfileAssets(profileAddress) {
    await batchReady;
    yield {
      assets: [{ id: `42:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:contract`, chainId: 42,
        ownerAddress: profileAddress, contractAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', tokenId: null,
        imageUrl: 'https://assets.example/late.webp' }],
      unresolvedAssetIds: [], resolved: 1, total: 1, failures: 0, complete: true,
    };
  };

  try {
    resetLibraryStoreForTests(PROFILE, storage);
    const pending = useLibraryStore.getState().load();
    await delay(0);
    assert.equal(useLibraryStore.getState().setProfileAddress(OTHER_PROFILE), true);
    operations.length = 0;
    releaseBatch();
    await pending;
    assert.deepEqual(useLibraryStore.getState().assets, []);
    assert.equal(operations.some(({ method, key }) => method === 'setItem'
      && key.startsWith('inscape.library-assets.v1:')), false);
  } finally {
    chillwhalesProfileRepository.loadProfileAssets = originalLoad;
    resetLibraryStoreForTests(PROFILE, memoryStorage());
  }
});
