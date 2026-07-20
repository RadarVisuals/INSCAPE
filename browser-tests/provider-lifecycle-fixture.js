import { createWalletProviderLifecycle } from '../src/store/walletProviderLifecycle.js';

function provider(initial = {}) {
  const listeners = new Map();
  const fixture = {
    accounts: initial.accounts || ['0x1111111111111111111111111111111111111111'],
    contextAccounts: initial.contextAccounts || ['0x1111111111111111111111111111111111111111'],
    chainId: initial.chainId || '0x2a', attach: {}, remove: {}, requests: [],
    on(event, listener) { fixture.attach[event] = (fixture.attach[event] || 0) + 1; const set = listeners.get(event) || new Set(); set.add(listener); listeners.set(event, set); },
    removeListener(event, listener) { fixture.remove[event] = (fixture.remove[event] || 0) + 1; listeners.get(event)?.delete(listener); },
    request: async ({ method }) => {
      fixture.requests.push(method);
      if (method === 'eth_accounts') return fixture.accounts;
      if (method === 'eth_chainId') return fixture.chainId;
      if (method === 'up_contextAccounts') return fixture.contextAccounts;
      throw new Error(`Unexpected ${method}`);
    },
    emit(event, value) { for (const listener of [...(listeners.get(event) || [])]) listener(value); },
    callbacks(event) { return [...(listeners.get(event) || [])]; }
  };
  return fixture;
}

let state = {};
const get = () => ({
  _failClosedProviderContext(error = null) { state = { ...state, chainId: null, accounts: [], contextAccounts: [], owner: false, error: error?.code || null }; },
  async _applyAuthoritativeProviderContext(context) {
    if (context.isCurrent()) state = { ...state, provider: context.provider, chainId: context.chainId,
      accounts: context.accounts, contextAccounts: context.contextAccounts, owner: context.accounts[0] === context.contextAccounts[0], error: null };
  }
});
const set = (update) => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
const manager = createWalletProviderLifecycle({ get, set, createProvider: provider,
  normalizeChainId: (value) => typeof value === 'number' ? `0x${value.toString(16)}` : String(value).toLowerCase(), supportedChainId: '0x2a' });
const firstProvider = provider();

window.__providerFixture = {
  firstProvider,
  state: () => state,
  mount: (target = firstProvider) => manager.initialize({ provider: target, handshakeTimeoutMs: 50 }),
  unmount: () => manager.dispose(),
  createProvider: provider,
  replace: (target) => manager.initialize({ provider: target, handshakeTimeoutMs: 50 })
};
