import assert from 'node:assert/strict';
import test from 'node:test';
import { createMiniAppWalletSession } from './miniAppWalletSession.js';

const A = `0x${'1'.repeat(40)}`, B = `0x${'2'.repeat(40)}`;
function walletFixture() {
  const calls = [], listeners = new Set();
  let state = { provider: { request: async request => { calls.push(request); return 'signed'; } },
    publicClient: { request: async () => '0x10' }, accounts: [A], chainId: '0x2a', isWalletConnected: true, authorityLifecycleStatus: 'complete' };
  return { calls, listeners, getState: () => state, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    update(change) { state = { ...state, ...change }; listeners.forEach(fn => fn()); } };
}
const sign = account => ({ method: 'personal_sign', params: ['0x1234', account] });

test('apps receive public context without a grant; a grant belongs only to its originating app', async () => {
  const walletStore = walletFixture();
  const first = createMiniAppWalletSession({ walletStore, profileAddress: B });
  const second = createMiniAppWalletSession({ walletStore, profileAddress: B });
  assert.deepEqual(first.getState().contextAccounts, [B]);
  assert.deepEqual(first.getState().accounts, []);
  await assert.rejects(first.request(sign(A)), { code: 4100 });
  first.connect();
  assert.deepEqual(first.getState().accounts, [A]);
  assert.deepEqual(second.getState().accounts, []);
  await assert.rejects(second.request(sign(A)), { code: 4100 });
  await assert.rejects(first.request(sign(B)), { code: 4100 });
  assert.equal(await first.request(sign(A)), 'signed');
  assert.equal(walletStore.calls.length, 1);
  first.dispose(); second.dispose(); assert.equal(walletStore.listeners.size, 0);
});

test('account, provider, unsupported chain, and pending-authority changes revoke grants', () => {
  for (const change of [{ accounts: [B] }, { provider: {} }, { chainId: '0x1' }, { authorityLifecycleStatus: 'pending' }, { isWalletConnected: false }]) {
    const walletStore = walletFixture();
    const app = createMiniAppWalletSession({ walletStore, profileAddress: A }); app.connect();
    walletStore.update(change); assert.equal(app.getState().connected, false);
    walletStore.update({ accounts: [A], chainId: '0x2a', isWalletConnected: true, authorityLifecycleStatus: 'complete' });
    assert.equal(app.getState().connected, false); app.dispose();
  }
});

test('closing or disconnecting during a pending request discards its result without retrying', async () => {
  for (const end of ['disconnect', 'dispose']) {
    const walletStore = walletFixture(); let resolve;
    walletStore.getState().provider.request = request => { walletStore.calls.push(request); return new Promise(done => { resolve = done; }); };
    const first = createMiniAppWalletSession({ walletStore, profileAddress: A }); first.connect();
    const second = createMiniAppWalletSession({ walletStore, profileAddress: A }); second.connect();
    const pending = first.request(sign(A));
    await assert.rejects(second.request(sign(A)), { code: -32002 });
    first[end](); resolve('late signature');
    await assert.rejects(pending, { code: 4900 }); assert.equal(walletStore.calls.length, 1);
    first.dispose(); second.dispose();
  }
});

test('unrecognized wallet permissions, wrong senders/chains, and oversized messages never reach the wallet', async () => {
  const walletStore = walletFixture(); const app = createMiniAppWalletSession({ walletStore, profileAddress: A }); app.connect();
  for (const method of ['wallet_requestPermissions', 'wallet_switchEthereumChain', 'eth_sendRawTransaction', 'eth_sign']) {
    await assert.rejects(app.request({ method }), { code: 4200 });
  }
  await assert.rejects(app.request({ method: 'eth_sendTransaction', params: [{ from: B }] }), { code: 4100 });
  await assert.rejects(app.request({ method: 'eth_sendTransaction', params: [{ from: A, chainId: 1 }] }), { code: 4901 });
  await assert.rejects(app.request({ method: 'personal_sign', params: ['x'.repeat(140000), A] }), { code: -32602 });
  assert.equal(await app.request({ method: 'eth_blockNumber' }), '0x10');
  assert.equal(walletStore.calls.length, 0); app.dispose();
});
