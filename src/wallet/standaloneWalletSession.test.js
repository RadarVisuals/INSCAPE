import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sessionSource = readFileSync(new URL('./standaloneWalletSession.js', import.meta.url), 'utf8');

test('standalone wallet sessions restore persisted UP connections before initial synchronization', () => {
  const reconnectIndex = sessionSource.indexOf('await reconnect(connector.wagmiConfig)');
  const watchIndex = sessionSource.indexOf('const stopWatching = watchConnection');
  const initialSyncIndex = sessionSource.indexOf('await syncConnection(getConnection(connector.wagmiConfig))');

  assert.ok(reconnectIndex >= 0, 'persisted Wagmi connections must be reconnected after refresh');
  assert.ok(watchIndex > reconnectIndex, 'connection watching must start after the reconnect attempt');
  assert.ok(initialSyncIndex > watchIndex, 'the restored connection must be synchronized into the wallet store');
});

test('connecting and reconnecting remain pending instead of flashing a settled context error', () => {
  assert.match(sessionSource, /connection\?\.status === 'connecting' \|\| connection\?\.status === 'reconnecting'/);
  const transitionIndex = sessionSource.indexOf('beginWalletTransition?.()');
  const disconnectedIndex = sessionSource.indexOf("connection?.status !== 'connected'");
  assert.ok(transitionIndex >= 0 && transitionIndex < disconnectedIndex,
    'transitional connector states must be handled before settled disconnection');
});

test('standalone sign-in repairs Universal Profile extension readiness before opening the modal', () => {
  const readinessIndex = sessionSource.indexOf('await ensureUniversalProfileExtensionConnector');
  const modalIndex = sessionSource.indexOf('connector.showSignInModal()');

  assert.ok(readinessIndex >= 0, 'sign-in must check the EIP-6963 connector before opening');
  assert.ok(modalIndex > readinessIndex, 'the modal must read the repaired Wagmi connector list');
  assert.match(sessionSource, /if \(showSignInPromise\) return showSignInPromise/,
    'rapid repeated sign-in clicks must share one readiness operation');
});
