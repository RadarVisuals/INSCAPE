import { createWalletProviderLifecycle } from '../src/store/walletProviderLifecycle.js';
import React, { StrictMode, useEffect, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';

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
const subscribers = new Set();
const publish = (next) => { state = next; for (const subscriber of subscribers) subscriber(); };
const subscribe = (subscriber) => { subscribers.add(subscriber); return () => subscribers.delete(subscriber); };
const get = () => ({
  _failClosedProviderContext(error = null) { publish({ ...state, chainId: null, accounts: [], contextAccounts: [], owner: false, error: error?.code || null }); },
  async _applyAuthoritativeProviderContext(context) {
    if (context.isCurrent()) publish({ ...state, provider: context.provider, chainId: context.chainId,
      accounts: context.accounts, contextAccounts: context.contextAccounts, owner: context.accounts[0] === context.contextAccounts[0], error: null });
  }
});
const set = (update) => publish({ ...state, ...(typeof update === 'function' ? update(state) : update) });
let factoryCalls = 0;
const createdProviders = [];
const createProvider = () => {
  factoryCalls += 1;
  const created = provider(); created.id = `provider-${factoryCalls}`; createdProviders.push(created);
  return created;
};
const manager = createWalletProviderLifecycle({ get, set, createProvider,
  normalizeChainId: (value) => typeof value === 'number' ? `0x${value.toString(16)}` : String(value).toLowerCase(), supportedChainId: '0x2a' });

function WalletOwningRoot() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => {
    manager.initialize({ handshakeTimeoutMs: 50 });
    return () => manager.scheduleRelease();
  }, []);
  return React.createElement('div', { 'data-provider-fixture': true,
    'data-owner-route': snapshot.owner === true ? 'true' : 'false' }, snapshot.owner ? 'Owner World' : 'Published World');
}

let reactRoot = createRoot(document.getElementById('provider-root'));
reactRoot.render(React.createElement(StrictMode, null, React.createElement(WalletOwningRoot)));

window.__providerFixture = {
  factoryCalls: () => factoryCalls,
  createdProviders,
  state: () => state,
  createProvider: provider,
  replace: (target) => manager.initialize({ provider: target, handshakeTimeoutMs: 50 }),
  unmountRoot: () => reactRoot.unmount(),
  dispose: () => manager.dispose()
};
