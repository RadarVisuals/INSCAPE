import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOwnerRuntimeGraph, createOwnerRuntimeGraph } from './ownerRuntimeIsolation.js';

function chunk(fileName, { entry = false, imports = [], modules = {} } = {}) {
  return { type: 'chunk', fileName, isEntry: entry, imports, modules, code: fileName };
}

test('production graph accepts owner modules reachable only through a dynamic chunk', () => {
  const graph = createOwnerRuntimeGraph({
    'entry.js': chunk('entry.js', { entry: true }),
    'lattice.js': chunk('lattice.js', { modules: { 'C:\\repo\\src\\public\\OwnerLatticeShell.jsx': {} } })
  });
  assert.deepEqual(graph.leaks, []);
  assert.equal(graph.ownerChunks[0].file, 'lattice.js');
  assert.doesNotThrow(() => assertOwnerRuntimeGraph(graph));
});

test('production graph rejects owner modules in the initial static entry closure', () => {
  const graph = createOwnerRuntimeGraph({
    'entry.js': chunk('entry.js', { entry: true, imports: ['owner.js'] }),
    'owner.js': chunk('owner.js', { modules: { '/repo/src/signals/state/useSignalStore.js': {} } })
  });
  assert.throws(() => assertOwnerRuntimeGraph(graph), /entry\.js -> owner\.js/);
});
