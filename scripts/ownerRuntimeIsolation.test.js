import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOwnerRuntimeGraph, createOwnerRuntimeGraph, STANDALONE_WALLET_SOURCE } from './ownerRuntimeIsolation.js';

function chunk(fileName, { entry = false, imports = [], modules = {} } = {}) {
  return { type: 'chunk', fileName, isEntry: entry, imports, modules, code: fileName };
}

test('production graph accepts owner modules reachable only through a dynamic chunk', () => {
  const graph = createOwnerRuntimeGraph({
    'entry.js': chunk('entry.js', { entry: true }),
    'wallet.js': chunk('wallet.js', { modules: { [`/repo/${STANDALONE_WALLET_SOURCE}`]: {} } }),
    'system-workflow.js': chunk('system-workflow.js', { modules: { 'C:\\repo\\src\\public\\OwnerSystemWorkflowShell.jsx': {} } })
  });
  assert.deepEqual(graph.leaks, []);
  assert.equal(graph.ownerChunks[0].file, 'system-workflow.js');
  assert.doesNotThrow(() => assertOwnerRuntimeGraph(graph));
});

test('wallet identity survives a merged chunk name and Windows module paths', () => {
  const graph = createOwnerRuntimeGraph({
    'entry.js': chunk('entry.js', { entry: true }),
    'owner.js': chunk('owner.js', { modules: { '/repo/src/public/OwnerSystemWorkflowShell.jsx': {} } }),
    'chains-abc.js': chunk('chains-abc.js', { modules: {
      'C:\\repo\\src\\wallet\\standaloneWalletSession.js': {}, '/repo/node_modules/viem/chains.js': {},
    } }),
  });
  assert.deepEqual(graph.standaloneWallet, { source: STANDALONE_WALLET_SOURCE, file: 'chains-abc.js' });
  assert.doesNotThrow(() => assertOwnerRuntimeGraph(graph));
});

test('wallet absence, ambiguity and static loading fail independently of owner isolation', () => {
  const bundle = {
    'entry.js': chunk('entry.js', { entry: true }),
    'owner.js': chunk('owner.js', { modules: { '/repo/src/public/OwnerSystemWorkflowShell.jsx': {} } }),
  };
  assert.throws(() => assertOwnerRuntimeGraph(createOwnerRuntimeGraph(bundle)), /missing the standalone wallet source/);
  const wallet = (file) => chunk(file, { modules: { [`/repo/${STANDALONE_WALLET_SOURCE}`]: {} } });
  bundle['wallet.js'] = wallet('wallet.js');
  bundle['duplicate.js'] = wallet('duplicate.js');
  assert.throws(() => createOwnerRuntimeGraph(bundle), /multiple standalone wallet source/);
  delete bundle['duplicate.js'];
  bundle['entry.js'].imports = ['shared.js'];
  bundle['shared.js'] = chunk('shared.js', { imports: ['wallet.js'] });
  assert.throws(() => assertOwnerRuntimeGraph(createOwnerRuntimeGraph(bundle)), /Standalone wallet runtime leaked.*entry\.js -> wallet\.js/);
});

test('production graph rejects owner modules in the initial static entry closure', () => {
  const graph = createOwnerRuntimeGraph({
    'entry.js': chunk('entry.js', { entry: true, imports: ['owner.js'] }),
    'owner.js': chunk('owner.js', { modules: { '/repo/src/signals/state/useSignalStore.js': {} } })
  });
  assert.throws(() => assertOwnerRuntimeGraph(graph), /entry\.js -> owner\.js/);
});

test('Reception readers cannot pull the editor or owner Library through a shared chunk', () => {
  for (const reader of ['reception/OwnerReception', 'profileDocument/components/ProfileOverview']) {
    const graph = createOwnerRuntimeGraph({
      'entry.js': chunk('entry.js', { entry: true }),
      'about.js': chunk('about.js', { imports: ['shared.js'], modules: { ['/repo/src/' + reader + '.jsx']: {} } }),
      'shared.js': chunk('shared.js', { imports: ['editor.js'] }),
      'editor.js': chunk('editor.js', { modules: { '/repo/src/reception/ReceptionEditor.jsx': {} } }),
    });
    assert.throws(() => assertOwnerRuntimeGraph(graph), /about\.js -> editor\.js/);
  }
});
