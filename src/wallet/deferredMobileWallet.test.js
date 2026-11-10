import test from 'node:test';
import assert from 'node:assert/strict';
import { deferMobileWallet, prepareMobileWalletOnDemand, cancelMobileWalletPreparation } from './deferredMobileWallet.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let emit, approve, reject;
  const view = {
    isConnected: true, events: [], removed: 0,
    walletConnectConnector: { rdns: 'walletConnect' },
    dispatchEvent(event) { this.events.push(event.detail.error.message); },
    async prewarmWalletConnectUri() {
      this.prewarmUriPromise = new Promise(resolve => { emit = resolve; });
      this.prewarmConnectPromise = new Promise((resolve, fail) => { approve = resolve; reject = fail; });
      this.prewarmResult = { handler: () => {}, provider: { off: () => { this.removed++; } } };
    },
  };
  return { view, emit() { view.prewarmedDeepLink = 'io.universaleverything.universalprofiles://wallet-connect/test'; emit(view.prewarmedDeepLink); },
    approve: () => approve(), reject: () => reject(new Error('Pairing rejected')) };
}
test('mobile setup stays dormant until provider acquisition and initializes once', async () => {
  let loads = 0, setups = 0;
  const provider = {};
  const connector = deferMobileWallet(() => () => ({ id: 'walletConnect',
    async getProvider() { loads++; return provider; }, async setup() { setups++; },
  }))({})({});
  connector.setup();
  assert.equal(loads, 0);
  assert.deepEqual(await Promise.all([connector.getProvider(), connector.getProvider()]), [provider, provider]);
  assert.equal(setups, 1);
});
test('first tap prepares without a tab; a fresh tap passes the same ready pairing synchronously', async () => {
  const previous = globalThis.window;
  globalThis.window = { open() { assert.fail('Preparation must never open about:blank'); } };
  try {
    const probe = fixture(), { view } = probe;
    assert.equal(prepareMobileWalletOnDemand(view), false);
    assert.equal(view.isConnecting, true);
    assert.equal(prepareMobileWalletOnDemand(view), false);
    probe.emit();
    await tick();
    assert.equal(view.isConnecting, false);
    assert.equal(prepareMobileWalletOnDemand(view), true);
    assert.deepEqual(view.events, []);
    assert.equal(view.removed, 0);
    probe.approve();
  } finally { globalThis.window = previous; }
});
test('rejection before URI reports failure, cleans the listener and permits retry', async () => {
  const probe = fixture(), { view } = probe;
  prepareMobileWalletOnDemand(view);
  probe.reject();
  await tick();
  assert.deepEqual(view.events, ['Pairing rejected']);
  assert.equal(view.isConnecting, false);
  assert.equal(view.removed, 1);
  assert.equal(view.prewarmConnectPromise, null);
  assert.equal(prepareMobileWalletOnDemand(view), false);
  probe.emit();
  await tick();
  assert.equal(prepareMobileWalletOnDemand(view), true);
  probe.approve();
});
test('failed provider download releases busy state', async () => {
  const { view } = fixture();
  view.prewarmWalletConnectUri = async () => { throw new Error('download failed'); };
  assert.equal(prepareMobileWalletOnDemand(view), false);
  await tick();
  assert.equal(view.isConnecting, false);
  assert.deepEqual(view.events, ['download failed']);
});
test('URI timeout cleans up and permits retry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const probe = fixture(), { view } = probe;
  prepareMobileWalletOnDemand(view);
  await tick();
  context.mock.timers.tick(20000);
  await tick();
  assert.match(view.events[0], /could not be prepared/);
  assert.equal(view.isConnecting, false);
  assert.equal(view.removed, 1);
  prepareMobileWalletOnDemand(view);
  probe.emit();
  await tick();
  assert.equal(prepareMobileWalletOnDemand(view), true);
  probe.approve();
});
test('closing during download cleans the late listener and suppresses errors', async () => {
  const probe = fixture(), { view } = probe;
  let finish;
  const prepare = view.prewarmWalletConnectUri;
  view.prewarmWalletConnectUri = async () => {
    await new Promise(resolve => { finish = resolve; });
    await prepare.call(view);
  };
  prepareMobileWalletOnDemand(view);
  view.isConnected = false;
  cancelMobileWalletPreparation(view);
  await tick();
  finish();
  await tick();
  assert.equal(view.removed, 1);
  assert.equal(view.prewarmConnectPromise, null);
  assert.deepEqual(view.events, []);
  probe.reject();
  await tick();
});
test('pending SDK approval passes through without another preparation', () => {
  assert.equal(prepareMobileWalletOnDemand({ _pendingWalletConnect: Promise.resolve() }), true);
});
