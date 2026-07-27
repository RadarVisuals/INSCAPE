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
