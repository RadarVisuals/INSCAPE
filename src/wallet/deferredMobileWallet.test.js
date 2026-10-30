import test from 'node:test';
import assert from 'node:assert/strict';
import { deferMobileWallet, connectMobileOnDemand } from './deferredMobileWallet.js';

test('mobile setup stays dormant until provider acquisition and initializes once', async () => {
  let loads = 0, setups = 0;
  const provider = {};
  const connector = deferMobileWallet(() => () => ({
    id: 'walletConnect',
    async getProvider() { loads++; return provider; },
    async setup() { setups++; },
  }))({})({});
  connector.setup();
  assert.equal(loads, 0);
  assert.deepEqual(await Promise.all([connector.getProvider(), connector.getProvider()]), [provider, provider]);
  assert.equal(setups, 1);
});

test('mobile tap reserves navigation synchronously and cleans up after connection or failure', async () => {
  const previous = globalThis.window;
  try {
    for (const fail of [false, true]) {
      const events = [], calls = [], listeners = new Map();
      const tab = { location: {}, close() { calls.push('close'); } };
      globalThis.window = { open() { calls.push('open'); return tab; } };
      const provider = { on(name, fn) { listeners.set(name, fn); }, off(name) { listeners.delete(name); } };
      const view = { dispatchEvent(event) { events.push(event.type); }, _cancelConnectionWatch() {} };
      const connector = {
        rdns: 'walletConnect',
        async getProvider() { calls.push('provider'); return provider; },
        async connect() {
          listeners.get('display_uri')('wc:test');
          if (fail) throw new Error('cancelled');
        },
      };
      await connectMobileOnDemand(view, connector, uri => `mobile:${uri}`);
      assert.deepEqual(calls.slice(0, 2), ['open', 'provider']);
      assert.equal(tab.location.href, 'mobile:wc:test');
      assert.deepEqual(events, [fail ? 'on-error' : 'on-connect']);
      assert.equal(calls.includes('close'), fail);
      assert.equal(listeners.size, 0);
      assert.equal(view.isConnecting, false);
    }
  } finally { globalThis.window = previous; }
});

test('blocked mobile popup does not acquire a provider', async () => {
  const previous = globalThis.window;
  try {
    globalThis.window = { open: () => null };
    await connectMobileOnDemand({}, { getProvider() { assert.fail('Must remain unloaded'); } }, value => value);
  } finally { globalThis.window = previous; }
});
