import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertReviewedLuksoWalletModule, narrowLuksoWalletImportsPlugin } from './luksoWalletImports.js';

test('wallet optimization requires the reviewed SDK source and version', async () => {
  const file = 'dist/chunk-4NQ3FIAB.js';
  const code = await readFile(new URL(`../node_modules/@lukso/up-modal/${file}`, import.meta.url), 'utf8');
  assert.doesNotThrow(() => assertReviewedLuksoWalletModule({ version: '0.21.11', file, code }));
  for (const changed of [{ version: '0.22.0', file, code }, { version: '0.21.11', file, code: code + '\nchanged' }]) {
    assert.throws(() => assertReviewedLuksoWalletModule(changed), /review required/);
  }
});

test('wallet optimization leaves application and nested dependency imports alone', async () => {
  const plugin = narrowLuksoWalletImportsPlugin();
  for (const importer of ['/app/src/wallet.js', '/app/node_modules/@lukso/up-modal/node_modules/@wagmi/connectors/dist/baseAccount.js']) {
    assert.equal(await plugin.resolveDynamicImport('viem', importer), null);
  }
});

test('wallet optimization fails if expected SDK imports are no longer encountered', () => {
  const plugin = narrowLuksoWalletImportsPlugin();
  plugin.buildStart();
  assert.throws(() => plugin.generateBundle(), /was not optimized/);
});
