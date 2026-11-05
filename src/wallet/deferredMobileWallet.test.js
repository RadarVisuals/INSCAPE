import test from 'node:test';
import assert from 'node:assert/strict';
import { deferMobileWallet, prepareMobileWalletOnDemand } from './deferredMobileWallet.js';

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

test('mobile tap reserves navigation before preparation and leaves approval to the SDK', async () => {
  const previous = globalThis.window;
  try {
    const calls = [], tab = { close() { calls.push('close'); } };
    globalThis.window = { open() { calls.push('open'); return tab; } };
    const view = { isConnected: true, walletConnectConnector: { rdns: 'walletConnect' },
      async prewarmWalletConnectUri() { calls.push('prepare'); },
      dispatchEvent() { assert.fail('SDK must own connection events'); } };
    assert.equal(await prepareMobileWalletOnDemand(view), tab);
    assert.deepEqual(calls, ['open', 'prepare']);
    assert.equal(view.isConnecting, true);
    assert.equal(view.connectingRdns, 'walletConnect');
    assert.equal(await prepareMobileWalletOnDemand(view), null, 'Repeated taps stay dormant');
    assert.deepEqual(calls, ['open', 'prepare']);
  } finally { globalThis.window = previous; }
});

test('blocked mobile popup does not acquire a provider', async () => {
  const previous = globalThis.window;
  try {
    globalThis.window = { open: () => null };
    assert.equal(await prepareMobileWalletOnDemand({ prewarmWalletConnectUri() { assert.fail('Must remain unloaded'); } }), null);
  } finally { globalThis.window = previous; }
});

test('pending or prepared pairings are not replaced by another preparation', async () => {
  const previous = globalThis.window;
  try {
    const tab = {};
    globalThis.window = { open: () => tab };
    for (const pending of [{ _pendingWalletConnect: Promise.resolve() }, { prewarmConnectPromise: Promise.resolve() }]) {
      assert.equal(await prepareMobileWalletOnDemand({ isConnected: true, ...pending,
        prewarmWalletConnectUri() { assert.fail('Would replace the pending pairing'); } }), tab);
    }
  } finally { globalThis.window = previous; }
});

test('failed provider download closes the reserved tab and permits retry', async () => {
  const previous = globalThis.window;
  try {
    let closed = 0;
    const events = [], tab = { close() { closed++; } };
    globalThis.window = { open: () => tab };
    const view = { isConnected: true, async prewarmWalletConnectUri() { throw new Error('download failed'); },
      dispatchEvent(event) { events.push(event.type); } };
    assert.equal(await prepareMobileWalletOnDemand(view), null);
    assert.equal(closed, 1);
    assert.equal(view.isConnecting, false);
    assert.deepEqual(events, ['on-error']);
    view.prewarmWalletConnectUri = async () => {};
    assert.equal(await prepareMobileWalletOnDemand(view), tab);
  } finally { globalThis.window = previous; }
});

test('closing during preparation cleans a late listener and suppresses events', async () => {
  const previous = globalThis.window;
  try {
    let finish, closed = 0, removed = 0;
    const handler = () => {};
    globalThis.window = { open: () => ({ close() { closed++; } }) };
    const view = { isConnected: true, async prewarmWalletConnectUri() {
      await new Promise(resolve => { finish = resolve; });
      view.prewarmResult = { handler, provider: { off(event, listener) {
        assert.equal(event, 'display_uri'); assert.equal(listener, handler); removed++;
      } } };
      view.prewarmConnectPromise = Promise.reject(new Error('removed'));
    }, dispatchEvent() { assert.fail('Removed view cannot dispatch'); } };
    const preparing = prepareMobileWalletOnDemand(view);
    view.isConnected = false;
    finish();
    assert.equal(await preparing, null);
    assert.equal(closed, 1);
    assert.equal(removed, 1);
    assert.equal(view.prewarmConnectPromise, null);
  } finally { globalThis.window = previous; }
});
