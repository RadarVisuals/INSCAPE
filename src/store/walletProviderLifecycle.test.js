import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { ERC725 } from '@erc725/erc725.js';
import { resetWalletStoreForTests, useWalletStore } from './useWalletStore.js';
import { createWalletProviderLifecycle } from './walletProviderLifecycle.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const CONTROLLER_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const originalFetchData = ERC725.prototype.fetchData;
const originalGetPermissions = ERC725.prototype.getPermissions;

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function profileResult(name = 'Profile') {
  return { value: { LSP3Profile: { name, description: '', profileImage: [], backgroundImage: [], tags: [], links: [] } } };
}

function providerFixture({ accounts = [PROFILE_A], contextAccounts = [PROFILE_A], chainId = '0x2a', removable = 'removeListener' } = {}) {
  const listeners = new Map(); const attachmentCalls = new Map(); const removalCalls = new Map(); const requests = [];
  const provider = {
    accounts, contextAccounts, chainId, requests, attachmentCalls, removalCalls,
    on(event, listener) {
      attachmentCalls.set(event, (attachmentCalls.get(event) || 0) + 1);
      const entries = listeners.get(event) || new Set(); entries.add(listener); listeners.set(event, entries);
    },
    async request({ method }) {
      requests.push(method);
      if (method === 'eth_accounts') return [...provider.accounts];
      if (method === 'eth_chainId') return provider.chainId;
      if (method === 'up_contextAccounts') return [...provider.contextAccounts];
      throw new Error(`Unexpected method ${method}`);
    },
    emit(event, value) { for (const listener of [...(listeners.get(event) || [])]) listener(value); },
    listeners(event) { return [...(listeners.get(event) || [])]; }
  };
  if (removable) provider[removable] = (event, listener) => {
    removalCalls.set(event, (removalCalls.get(event) || 0) + 1); listeners.get(event)?.delete(listener);
  };
  return provider;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  ERC725.prototype.fetchData = originalFetchData;
  if (originalGetPermissions) ERC725.prototype.getPermissions = originalGetPermissions;
  else delete ERC725.prototype.getPermissions;
  resetWalletStoreForTests();
});

test('Strict Mode scheduled cleanup and immediate reacquire reuse one factory-created provider', async () => {
  let state = { publicationContextGeneration: 0 }; let factoryCalls = 0;
  const created = [];
  const set = (update) => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  const get = () => ({
    _failClosedProviderContext(error = null) { set({ chainId: null, accounts: [], contextAccounts: [], owner: false, error }); },
    async _applyAuthoritativeProviderContext(context) {
      if (context.isCurrent()) set({ provider: context.provider, chainId: context.chainId,
        accounts: context.accounts, contextAccounts: context.contextAccounts, owner: context.accounts[0] === context.contextAccounts[0] });
    }
  });
  const lifecycle = createWalletProviderLifecycle({ get, set,
    createProvider: () => { factoryCalls += 1; const next = providerFixture(); created.push(next); return next; },
    normalizeChainId: (value) => value, supportedChainId: '0x2a' });

  const firstReady = lifecycle.initialize();
  lifecycle.scheduleRelease();
  const secondReady = lifecycle.initialize();
  assert.equal(factoryCalls, 1);
  assert.strictEqual(lifecycle.getActive().provider, created[0]);
  assert.strictEqual(secondReady, firstReady);
  assert.equal(state.authorityLifecycleStatus, 'pending', 'reacquire preserves the in-flight lifecycle');
  await secondReady;
  for (const event of ['accountsChanged', 'chainChanged', 'contextAccountsChanged']) {
    assert.equal(created[0].attachmentCalls.get(event), 1); assert.equal(created[0].listeners(event).length, 1);
  }
  assert.equal(state.owner, true);
  assert.equal(state.authorityLifecycleStatus, 'complete');
  lifecycle.scheduleRelease();
  await Promise.resolve();
  assert.equal(lifecycle.getActive(), null);
  assert.equal(state.owner, false);
  for (const event of ['accountsChanged', 'chainChanged', 'contextAccountsChanged']) {
    assert.equal(created[0].removalCalls.get(event), 1); assert.equal(created[0].listeners(event).length, 0);
  }
});

test('initialization is idempotent, disposal owns all listeners, and remount installs one fresh set', async () => {
  ERC725.prototype.fetchData = async () => profileResult();
  const provider = providerFixture();
  const first = useWalletStore.getState().initWallet({ provider });
  const duplicate = useWalletStore.getState().initWallet({ provider });
  assert.strictEqual(first, duplicate); await first;
  for (const event of ['accountsChanged', 'chainChanged', 'contextAccountsChanged']) {
    assert.equal(provider.attachmentCalls.get(event), 1); assert.equal(provider.listeners(event).length, 1);
  }
  const report = useWalletStore.getState().disposeWallet();
  assert.equal(report.listenersRemoved, true); assert.equal(useWalletStore.getState().disposeWallet().disposed, true);
  for (const event of ['accountsChanged', 'chainChanged', 'contextAccountsChanged']) {
    assert.equal(provider.removalCalls.get(event), 1); assert.equal(provider.listeners(event).length, 0);
  }
  await useWalletStore.getState().initWallet({ provider });
  for (const event of ['accountsChanged', 'chainChanged', 'contextAccountsChanged']) {
    assert.equal(provider.attachmentCalls.get(event), 2); assert.equal(provider.listeners(event).length, 1);
  }
});

test('standalone context is accepted only through its explicit resolver and never queries iframe context', async () => {
  ERC725.prototype.fetchData = async () => profileResult('Standalone profile');
  const provider = providerFixture({ accounts: [PROFILE_A], contextAccounts: [PROFILE_B] });
  const resolverCalls = [];
  const resolved = await useWalletStore.getState().initWallet({
    provider,
    resolveContextAccounts: async (context) => {
      resolverCalls.push(context);
      return [context.accounts[0]];
    }
  });

  assert.equal(resolved, true);
  assert.equal(resolverCalls.length, 1);
  assert.equal(provider.requests.includes('up_contextAccounts'), false);
  assert.equal(provider.attachmentCalls.has('contextAccountsChanged'), false);
  assert.equal(useWalletStore.getState().hostProfileAddress.toLowerCase(), PROFILE_A);
  assert.equal(useWalletStore.getState().isHostProfileOwner, true);
});

test('standalone resolver rejection leaves all workspace authority closed', async () => {
  const provider = providerFixture({ accounts: [PROFILE_A] });
  const resolved = await useWalletStore.getState().initWallet({
    provider,
    resolveContextAccounts: async () => {
      throw Object.assign(new Error('Not a Universal Profile'), { code: 'NOT_A_UNIVERSAL_PROFILE' });
    }
  });

  assert.equal(resolved, false);
  assert.equal(provider.requests.includes('up_contextAccounts'), false);
  assert.equal(useWalletStore.getState().hostProfileAddress, null);
  assert.equal(useWalletStore.getState().isWalletConnected, false);
  assert.equal(useWalletStore.getState().isHostProfileOwner, false);
  assert.equal(useWalletStore.getState().initializationError.code, 'NOT_A_UNIVERSAL_PROFILE');
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
});

test('disconnected, provider-failure, and no-active disposal paths settle signed out', async () => {
  const disconnectedProvider = providerFixture({ accounts: [], contextAccounts: [] });
  assert.equal(await useWalletStore.getState().initWallet({ provider: disconnectedProvider }), true);
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  assert.equal(useWalletStore.getState().hostProfileAddress, null);
  assert.equal(useWalletStore.getState().isHostProfileOwner, false);

  useWalletStore.getState().disposeWallet();
  const failedProvider = providerFixture();
  failedProvider.request = async () => { throw new Error('provider unavailable'); };
  assert.equal(await useWalletStore.getState().initWallet({ provider: failedProvider }), false);
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  assert.equal(useWalletStore.getState().hostProfileAddress, null);

  useWalletStore.getState().disposeWallet();
  useWalletStore.getState().disposeWallet();
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  assert.equal(useWalletStore.getState().isWalletConnected, false);
});

test('authority completion does not wait for optional profile metadata', async () => {
  const metadata = deferred();
  ERC725.prototype.fetchData = () => metadata.promise;
  const provider = providerFixture();

  const initialized = await useWalletStore.getState().initWallet({ provider });
  assert.equal(initialized, true);
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  assert.equal(useWalletStore.getState().isProfileLoading, true);

  metadata.resolve(profileResult('Metadata arrived later'));
  await settle();
  assert.equal(useWalletStore.getState().profileMetadata.name, 'Metadata arrived later');
});

test('provider replacement and disposal make captured old callbacks generation-inert', async () => {
  ERC725.prototype.fetchData = async () => profileResult();
  const oldProvider = providerFixture(); const nextProvider = providerFixture({ accounts: [PROFILE_B], contextAccounts: [PROFILE_B] });
  await useWalletStore.getState().initWallet({ provider: oldProvider });
  const late = ['accountsChanged', 'chainChanged', 'contextAccountsChanged'].map((event) => oldProvider.listeners(event)[0]);
  useWalletStore.getState().scheduleWalletRelease();
  await useWalletStore.getState().initWallet({ provider: nextProvider });
  late[0]([PROFILE_A]); late[1]('0x1'); late[2]([PROFILE_A]); await settle();
  const state = useWalletStore.getState();
  assert.strictEqual(state.provider, nextProvider); assert.equal(state.hostProfileAddress.toLowerCase(), PROFILE_B);
  assert.equal(state.accounts[0].toLowerCase(), PROFILE_B); assert.equal(state.isHostProfileOwner, true);
});

test('off is used when removeListener is unavailable', async () => {
  ERC725.prototype.fetchData = async () => profileResult();
  const provider = providerFixture({ removable: 'off' });
  await useWalletStore.getState().initWallet({ provider });
  const report = useWalletStore.getState().disposeWallet();
  assert.equal(report.listenersRemoved, true);
  for (const event of ['accountsChanged', 'chainChanged', 'contextAccountsChanged']) {
    assert.equal(provider.removalCalls.get(event), 1); assert.equal(provider.listeners(event).length, 0);
  }
});

test('unsupported chain fails closed immediately and mainnet recovery re-queries without accountsChanged', async () => {
  ERC725.prototype.fetchData = async () => profileResult('Recovered');
  const provider = providerFixture(); await useWalletStore.getState().initWallet({ provider });
  provider.chainId = '0x1'; provider.emit('chainChanged', '0x1');
  assert.equal(useWalletStore.getState().walletClient, null); assert.equal(useWalletStore.getState().isHostProfileOwner, false);
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  await settle(); assert.equal(useWalletStore.getState().chainId, null);
  const before = provider.requests.length;
  provider.chainId = '0x2a'; provider.accounts = [PROFILE_B]; provider.contextAccounts = [PROFILE_B];
  provider.emit('chainChanged', '0x2a'); await settle();
  const recoveryRequests = provider.requests.slice(before);
  for (const method of ['eth_accounts', 'eth_chainId', 'up_contextAccounts']) assert.ok(recoveryRequests.includes(method));
  assert.equal(useWalletStore.getState().hostProfileAddress.toLowerCase(), PROFILE_B);
  assert.equal(useWalletStore.getState().isHostProfileOwner, true);
});

test('logout, login, and iframe context replacement rebuild clients and authority from queried state', async () => {
  ERC725.prototype.fetchData = async () => profileResult();
  const provider = providerFixture(); await useWalletStore.getState().initWallet({ provider });
  provider.accounts = []; provider.emit('accountsChanged', []); await settle();
  assert.equal(useWalletStore.getState().isWalletConnected, false); assert.equal(useWalletStore.getState().walletClient, null);
  provider.accounts = [PROFILE_B]; provider.contextAccounts = [PROFILE_B]; provider.emit('accountsChanged', [PROFILE_B]); await settle();
  assert.equal(useWalletStore.getState().walletClient.account.address.toLowerCase(), PROFILE_B);
  provider.contextAccounts = [PROFILE_A]; provider.emit('contextAccountsChanged', [PROFILE_A]);
  assert.equal(useWalletStore.getState().isHostProfileOwner, false); await settle();
  assert.equal(useWalletStore.getState().hostProfileAddress.toLowerCase(), PROFILE_A);
  assert.equal(useWalletStore.getState().isHostProfileOwner, false);
});

test('only the latest rapid recovery generation can commit', async () => {
  ERC725.prototype.fetchData = async () => profileResult();
  const provider = providerFixture(); await useWalletStore.getState().initWallet({ provider });
  const rounds = [];
  provider.request = ({ method }) => {
    if (method === 'eth_accounts') rounds.push({ accounts: deferred(), chain: deferred(), context: deferred() });
    const round = rounds.at(-1);
    if (method === 'eth_accounts') return round.accounts.promise;
    if (method === 'eth_chainId') return round.chain.promise;
    if (method === 'up_contextAccounts') return round.context.promise;
    throw new Error('unexpected request');
  };
  provider.emit('chainChanged', '0x1'); provider.emit('chainChanged', '0x2a'); provider.emit('chainChanged', '0x1');
  assert.equal(rounds.length, 1);
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  rounds[0].accounts.resolve([PROFILE_B]); rounds[0].chain.resolve('0x2a'); rounds[0].context.resolve([PROFILE_B]); await settle();
  assert.equal(useWalletStore.getState().chainId, null); assert.equal(useWalletStore.getState().isHostProfileOwner, false);
});

test('disposal during pending verification prevents a late ownership grant', async () => {
  const permission = deferred(); ERC725.prototype.getPermissions = () => permission.promise;
  ERC725.prototype.fetchData = async () => profileResult();
  const provider = providerFixture({ accounts: [CONTROLLER_A], contextAccounts: [PROFILE_A] });
  const initialization = useWalletStore.getState().initWallet({ provider }); await settle();
  useWalletStore.getState().disposeWallet(); permission.resolve({ SUPER_SETDATA: true }); await initialization;
  assert.equal(useWalletStore.getState().provider, null); assert.equal(useWalletStore.getState().isHostProfileOwner, false);
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
});

test('late A permission cannot settle the active B recovery generation', async () => {
  const permissionA = deferred(); const permissionB = deferred();
  ERC725.prototype.getPermissions = function (controller) {
    return controller.toLowerCase() === CONTROLLER_A ? permissionA.promise : permissionB.promise;
  };
  ERC725.prototype.fetchData = async () => profileResult();
  const provider = providerFixture({ accounts: [CONTROLLER_A], contextAccounts: [PROFILE_A] });
  const initializationA = useWalletStore.getState().initWallet({ provider });
  await settle();
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'pending');

  provider.accounts = ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'];
  provider.contextAccounts = [PROFILE_B];
  provider.emit('accountsChanged', provider.accounts);
  await settle();
  permissionA.resolve({ SUPER_SETDATA: true });
  await settle();
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'pending');
  assert.equal(useWalletStore.getState().isHostProfileOwner, false);

  permissionB.resolve({ SUPER_SETDATA: false });
  await initializationA;
  await settle();
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  assert.equal(useWalletStore.getState().hostProfileAddress.toLowerCase(), PROFILE_B);
  assert.equal(useWalletStore.getState().isHostProfileOwner, false);
});

test('a provider without removal remains generation-safe, reports its limitation, and reuses attachments', async () => {
  ERC725.prototype.fetchData = async () => profileResult();
  const provider = providerFixture({ removable: null }); await useWalletStore.getState().initWallet({ provider });
  const callback = provider.listeners('accountsChanged')[0]; const report = useWalletStore.getState().disposeWallet();
  assert.equal(report.listenersRemoved, false); assert.match(report.limitation, /no off\/removeListener/);
  callback([PROFILE_B]); await settle(); assert.equal(useWalletStore.getState().provider, null);
  provider.accounts = [PROFILE_B]; provider.contextAccounts = [PROFILE_B]; await useWalletStore.getState().initWallet({ provider });
  assert.equal(provider.attachmentCalls.get('accountsChanged'), 1);
  provider.emit('accountsChanged', [PROFILE_B]); await settle();
  assert.equal(useWalletStore.getState().hostProfileAddress.toLowerCase(), PROFILE_B);
});

test('handshake timeout stays closed and later authoritative events recover without a prompt', async () => {
  ERC725.prototype.fetchData = async () => profileResult('Late profile');
  const provider = providerFixture(); const pending = deferred(); provider.request = () => pending.promise;
  assert.equal(await useWalletStore.getState().initWallet({ provider, handshakeTimeoutMs: 5 }), false);
  assert.equal(useWalletStore.getState().walletClient, null);
  assert.equal(useWalletStore.getState().authorityLifecycleStatus, 'complete');
  provider.request = async ({ method }) => method === 'eth_accounts' ? [PROFILE_A]
    : method === 'eth_chainId' ? '0x2a' : [PROFILE_A];
  provider.emit('contextAccountsChanged', [PROFILE_A]); await settle();
  assert.equal(useWalletStore.getState().isHostProfileOwner, true);
  pending.resolve([PROFILE_B]); await settle();
  assert.equal(useWalletStore.getState().hostProfileAddress.toLowerCase(), PROFILE_A);
});
