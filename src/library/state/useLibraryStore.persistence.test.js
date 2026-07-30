import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from '../domain/libraryWorkspace.js';
import { loadLibraryWorkspace } from '../storage/libraryWorkspaceStorage.js';
import { chillwhalesProfileRepository } from '../data/chillwhalesProfileRepository.js';
import { luksoEnvioAttributeRepository } from '../data/luksoEnvioAttributeRepository.js';
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

test('a successful library load enriches incomplete indexed token attributes through Envio', async () => {
  const storage = memoryStorage();
  const contract = '0x1111111111111111111111111111111111111111';
  const tokenId = `0x${'0'.repeat(63)}1`;
  const stableAssetId = `42:${contract}:${tokenId}`;
  const originalLoad = chillwhalesProfileRepository.loadProfileAssets;
  const originalEnrich = luksoEnvioAttributeRepository.enrich;
  chillwhalesProfileRepository.loadProfileAssets = async function* indexedToken() {
    yield { assets: [{ id: stableAssetId, chainId: 42, ownerAddress: PROFILE, contractAddress: contract,
      tokenId, standard: 'LSP8', imageUrl: 'https://assets.example/token.webp',
      attributes: [{ key: 'Performance Tier', value: 'Strike Unit', type: 'string' }],
      fieldProvenance: { attributes: { scope: 'tokenId', source: 'Chillwhales' } }, rawMetadata: {} }],
    unresolvedAssetIds: [], resolved: 1, total: 1, failures: 0, complete: true };
  };
  luksoEnvioAttributeRepository.enrich = async (ids) => {
    assert.deepEqual(ids, [stableAssetId]);
    return [{ id: stableAssetId, attributes: [
      { key: 'Performance Tier', value: 'Strike Unit', type: 'string' },
      { key: 'Rank', value: '281', type: 'number' }
    ] }];
  };
  try {
    resetLibraryStoreForTests(PROFILE, storage);
    await useLibraryStore.getState().load({ forceLive: true });
    assert.equal(useLibraryStore.getState().sourceMode, 'INDEXER+ENVIO');
    assert.deepEqual(useLibraryStore.getState().assets[0].attributes, [
      { key: 'Performance Tier', value: 'Strike Unit', type: 'string' },
      { key: 'Rank', value: '281', type: 'number' }
    ]);
  } finally {
    chillwhalesProfileRepository.loadProfileAssets = originalLoad;
    luksoEnvioAttributeRepository.enrich = originalEnrich;
    resetLibraryStoreForTests(PROFILE, memoryStorage());
  }
});

test('the first valid indexer batch paints before index completion and background Envio enrichment', async () => {
  const storage = memoryStorage();
  const contract = '0x1111111111111111111111111111111111111111';
  const tokenId = `0x${'0'.repeat(63)}1`;
  const stableAssetId = `42:${contract}:${tokenId}`;
  const originalLoad = chillwhalesProfileRepository.loadProfileAssets;
  const originalEnrich = luksoEnvioAttributeRepository.enrich;
  let releaseIndexer; let releaseEnrichment; let enrichmentStarted = false;
  const indexerGate = new Promise((resolve) => { releaseIndexer = resolve; });
  const enrichmentGate = new Promise((resolve) => { releaseEnrichment = resolve; });
  chillwhalesProfileRepository.loadProfileAssets = async function* progressiveToken() {
    const asset = { id: stableAssetId, chainId: 42, ownerAddress: PROFILE, contractAddress: contract,
      tokenId, standard: 'LSP8', imageUrl: 'https://assets.example/progressive.webp', attributes: [], rawMetadata: {} };
    yield { assets: [asset], unresolvedAssetIds: [], resolved: 1, total: 2, failures: 0, complete: false };
    await indexerGate;
    yield { assets: [asset], unresolvedAssetIds: [], resolved: 1, total: 1, failures: 0, complete: true };
  };
  luksoEnvioAttributeRepository.enrich = async () => {
    enrichmentStarted = true;
    await enrichmentGate;
    return [{ id: stableAssetId, attributes: [{ key: 'Rank', value: '281', type: 'number' }] }];
  };
  try {
    resetLibraryStoreForTests(PROFILE, storage);
    const pending = useLibraryStore.getState().load({ forceLive: true });
    await delay(0);
    assert.deepEqual(useLibraryStore.getState().assets.map(({ id }) => id), [stableAssetId]);
    assert.equal(useLibraryStore.getState().status, 'loading');
    assert.equal(enrichmentStarted, false);
    releaseIndexer();
    while (!enrichmentStarted) await delay(0);
    assert.deepEqual(useLibraryStore.getState().assets.map(({ id }) => id), [stableAssetId]);
    assert.deepEqual(useLibraryStore.getState().assets[0].attributes, []);
    releaseEnrichment();
    await pending;
    assert.deepEqual(useLibraryStore.getState().assets[0].attributes, [{ key: 'Rank', value: '281', type: 'number' }]);
  } finally {
    releaseIndexer?.(); releaseEnrichment?.();
    chillwhalesProfileRepository.loadProfileAssets = originalLoad;
    luksoEnvioAttributeRepository.enrich = originalEnrich;
    resetLibraryStoreForTests(PROFILE, memoryStorage());
  }
});
