import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { chillwhalesProfileRepository } from '../data/chillwhalesProfileRepository.js';
import { createLuksoRpcProfileRepository, luksoRpcProfileRepository } from '../data/luksoRpcProfileRepository.js';
import { loadLibraryAssetCache, saveLibraryAssetCache } from '../storage/libraryAssetCache.js';
import { resetLibraryStoreForTests, useLibraryStore } from './useLibraryStore.js';

const PROFILE = '0x84841412e9f66e360c6da5f9dba11b8e88d87ea8';
const OTHER_PROFILE = '0x4444444444444444444444444444444444444444';
const KNOWN_CONTRACT = '0x1111111111111111111111111111111111111111';
const NEW_CONTRACT = '0x2222222222222222222222222222222222222222';
const success = (result) => ({ status: 'success', result });
const failure = () => ({ status: 'failure', error: new Error('RPC unavailable') });
const knownAsset = (profileAddress = PROFILE) => ({
  id: `42:${KNOWN_CONTRACT}:contract`, chainId: 42, contractAddress: KNOWN_CONTRACT,
  ownerAddress: profileAddress, tokenId: null, standard: 'LSP7', name: 'Previously known',
  imageUrl: 'https://assets.example/known.webp', fieldProvenance: {},
});
const memoryStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const originalIndexer = chillwhalesProfileRepository.loadProfileAssets;
const originalRpc = luksoRpcProfileRepository.loadProfileAssets;

beforeEach(() => {
  chillwhalesProfileRepository.loadProfileAssets = async function* () { throw new Error('Indexer unavailable'); };
});
afterEach(() => {
  chillwhalesProfileRepository.loadProfileAssets = originalIndexer;
  luksoRpcProfileRepository.loadProfileAssets = originalRpc;
  resetLibraryStoreForTests(PROFILE, memoryStorage());
});

function seedKnownInventory(storage, profileAddress = PROFILE) {
  const asset = knownAsset(profileAddress);
  saveLibraryAssetCache(storage, profileAddress, [asset]);
  resetLibraryStoreForTests(profileAddress, storage);
  useLibraryStore.setState({ assets: loadLibraryAssetCache(storage, profileAddress), error: null, liveError: null });
  return asset;
}

function installRpc({ supports = false, holding = failure(), contracts = [KNOWN_CONTRACT], gate } = {}) {
  const repository = createLuksoRpcProfileRepository({
    discoverContracts: async () => { await gate; return contracts; },
    client: {
      async multicall({ contracts: calls }) {
        if (calls[0].functionName === 'supportsInterface') return calls.map((_call, index) =>
          supports ? success(index % 2 === 1) : failure());
        return calls.map(() => holding);
      },
      async readContract() { return '0x'; },
    },
  });
  luksoRpcProfileRepository.loadProfileAssets = repository.loadProfileAssets;
}

test('forced refresh keeps cached inventory through interface/holding failure and replaces it after a verified empty retry', async (t) => {
  for (const supports of [false, true]) await t.test(supports ? 'holding failure' : 'interface failure', async () => {
    const storage = memoryStorage();
    const known = seedKnownInventory(storage);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    installRpc({ supports, gate });
    const pending = useLibraryStore.getState().load({ forceLive: true });
    assert.deepEqual(useLibraryStore.getState().assets, [known], 'refresh must not clear visible inventory');
    assert.deepEqual(loadLibraryAssetCache(storage, PROFILE), [known]);
    release(); await pending;
    assert.equal(useLibraryStore.getState().status, 'partial');
    assert.match(useLibraryStore.getState().liveError, /holdings could not be verified/u);
    assert.equal(useLibraryStore.getState().progress.failures, 1);
    assert.deepEqual(useLibraryStore.getState().assets, [known]);
    assert.deepEqual(loadLibraryAssetCache(storage, PROFILE), [known]);

    installRpc({ supports: true, holding: success(0n) });
    await useLibraryStore.getState().load({ forceLive: true });
    assert.equal(useLibraryStore.getState().status, 'ready');
    assert.equal(useLibraryStore.getState().error, null);
    assert.equal(useLibraryStore.getState().liveError, null);
    assert.deepEqual(useLibraryStore.getState().assets, []);
    assert.deepEqual(loadLibraryAssetCache(storage, PROFILE), []);
  });
});

test('failed discovery without cache ends in error, not a ready empty Library', async () => {
  resetLibraryStoreForTests(PROFILE, memoryStorage());
  installRpc();
  await useLibraryStore.getState().load();
  assert.equal(useLibraryStore.getState().status, 'error');
  assert.match(useLibraryStore.getState().error, /holdings could not be verified/u);
  assert.equal(useLibraryStore.getState().progress.failures, 1);
  assert.deepEqual(useLibraryStore.getState().assets, []);
});

test('mixed RPC success merges verified additions without deleting known assets or reporting ready', async () => {
  const storage = memoryStorage();
  const known = seedKnownInventory(storage);
  const metadataKey = '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e';
  const repository = createLuksoRpcProfileRepository({
    discoverContracts: async () => [KNOWN_CONTRACT, NEW_CONTRACT],
    client: {
      async multicall({ contracts }) {
        return contracts[0].functionName === 'supportsInterface'
          ? [failure(), failure(), success(false), success(true)] : [success(1n)];
      },
      async readContract({ args }) { return args[0] === metadataKey
        ? encodeDataSourceWithHash({ method: 'keccak256(bytes)', data: `0x${'0'.repeat(64)}` }, 'https://assets.example/metadata.json') : '0x'; },
    },
    fetchImpl: async () => Response.json({ LSP4Metadata: {
      name: 'New verified asset', images: [{ url: 'https://assets.example/new.webp' }],
    } }),
  });
  luksoRpcProfileRepository.loadProfileAssets = repository.loadProfileAssets;
  await useLibraryStore.getState().load({ forceLive: true });
  assert.equal(useLibraryStore.getState().status, 'partial');
  const expectedIds = [known.id, `42:${NEW_CONTRACT}:contract`];
  assert.deepEqual(useLibraryStore.getState().assets.map(({ id }) => id), expectedIds);
  assert.deepEqual(loadLibraryAssetCache(storage, PROFILE).map(({ id }) => id), expectedIds);
});

test('a completed metadata pass with failures preserves cached cards and reports partial', async () => {
  const storage = memoryStorage();
  const known = seedKnownInventory(storage);
  installRpc({ supports: true, holding: success(1n) });
  await useLibraryStore.getState().load({ forceLive: true });
  assert.equal(useLibraryStore.getState().status, 'partial');
  assert.match(useLibraryStore.getState().liveError, /assets could not be loaded/u);
  assert.deepEqual(useLibraryStore.getState().assets, [known]);
  assert.deepEqual(loadLibraryAssetCache(storage, PROFILE), [known]);
});

test('a late failed RPC response cannot change either profile inventory after a switch', async () => {
  const storage = memoryStorage();
  const known = seedKnownInventory(storage);
  const other = knownAsset(OTHER_PROFILE);
  saveLibraryAssetCache(storage, OTHER_PROFILE, [other]);
  let release; let started;
  const gate = new Promise((resolve) => { release = resolve; });
  const didStart = new Promise((resolve) => { started = resolve; });
  const repository = createLuksoRpcProfileRepository({
    discoverContracts: async () => [KNOWN_CONTRACT],
    client: { async multicall() { started(); await gate; return [failure(), failure()]; } },
  });
  luksoRpcProfileRepository.loadProfileAssets = repository.loadProfileAssets;
  const pending = useLibraryStore.getState().load({ forceLive: true });
  await didStart;
  useLibraryStore.getState().setProfileAddress(OTHER_PROFILE);
  release(); await pending;
  assert.equal(useLibraryStore.getState().status, 'idle');
  assert.equal(useLibraryStore.getState().liveError, null);
  assert.deepEqual(useLibraryStore.getState().assets, [other]);
  assert.deepEqual(loadLibraryAssetCache(storage, PROFILE), [known]);
  assert.deepEqual(loadLibraryAssetCache(storage, OTHER_PROFILE), [other]);
});
