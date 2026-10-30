import test from 'node:test';
import assert from 'node:assert/strict';
import { excludeUnsupportedWalletConnectorsPlugin, UNSUPPORTED_WALLET_CONNECTOR_MODULES } from './unsupportedWalletConnectors.js';

test('production build excludes only the unsupported Base Account dependency', () => {
  const plugin = excludeUnsupportedWalletConnectorsPlugin();
  assert.equal(plugin.apply, 'build');
  assert.equal(plugin.enforce, 'pre');
  assert.deepEqual(UNSUPPORTED_WALLET_CONNECTOR_MODULES, ['@base-org/account']);
  const virtualId = plugin.resolveId('@base-org/account');
  assert.match(virtualId, /^\0inscape-/u);
  assert.equal(plugin.resolveId('@walletconnect/ethereum-provider'), null);
  assert.equal(plugin.resolveId('@lukso/up-provider'), null);
  assert.match(plugin.load(virtualId), /not supported by INSCAPE/u);
  assert.equal(plugin.load('\0unrelated'), null);
});
