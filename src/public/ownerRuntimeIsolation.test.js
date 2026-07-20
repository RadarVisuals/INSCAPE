import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveOwnerAuthoringEnabled } from './publicAccess.js';
import { createOwnerRuntimeLoader, loadOwnerRuntimeWhenAuthorized } from './ownerRuntimeLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';

function staticImportGraph(entry) {
  const visited = new Set();
  function visit(filename) {
    const full = resolve(filename);
    if (visited.has(full)) return;
    visited.add(full);
    const source = readFileSync(full, 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"](\.[^'\"]+)['\"]/g)) {
      const target = resolve(dirname(full), match[1]);
      const candidates = /\.[cm]?[jt]sx?$/.test(target) ? [target] : [`${target}.js`, `${target}.jsx`, resolve(target, 'index.js')];
      const next = candidates.find((candidate) => { try { readFileSync(candidate); return true; } catch { return false; } });
      if (next) visit(next);
    }
  }
  visit(entry);
  return visited;
}

test('cold application entry cannot statically reach the owner shell or Library and Signals stores', () => {
  const graph = staticImportGraph(resolve(here, '../App.jsx'));
  for (const forbidden of [
    resolve(here, 'ModuleGridShell.jsx'),
    resolve(here, '../library/state/useLibraryStore.js'),
    resolve(here, '../signals/state/useSignalStore.js')
  ]) assert.equal(graph.has(forbidden), false, `${forbidden} is statically reachable from App`);

  const loaderSource = readFileSync(resolve(here, 'ownerRuntimeLoader.js'), 'utf8');
  assert.match(loaderSource, /import\('\.\/ModuleGridShell\.jsx'\)/);
  assert.doesNotMatch(loaderSource, /from\s+['\"]\.\/ModuleGridShell\.jsx['\"]/);
});

test('cold visitor authority states perform no owner persistence operations and never request the owner chunk', async () => {
  const operations = [];
  const priorWindow = globalThis.window;
  globalThis.window = { localStorage: {
    getItem(key) { operations.push(['get', key]); return null; },
    setItem(key) { operations.push(['set', key]); },
    removeItem(key) { operations.push(['remove', key]); }
  } };
  try {
    const coldRuntime = await import(`./ownerRuntimeLoader.js?cold-visitor=${Date.now()}`);
    const coldStore = await import(`../store/useStore.js?cold-visitor=${Date.now()}`);
    let imports = 0;
    const loader = coldRuntime.createOwnerRuntimeLoader(async () => { imports += 1; return { default: () => null }; });
    const matching = { verifiedOwnerProfileAddress: PROFILE_A, workspaceProfileAddress: PROFILE_A, viewedProfileAddress: PROFILE_A };
    const visitorStates = [
      { ...matching, ownershipVerified: undefined },
      { ...matching, ownershipVerified: false },
      { ...matching, ownershipVerified: true, viewedProfileAddress: PROFILE_B },
      { ...matching, ownershipVerified: true, verifiedOwnerProfileAddress: PROFILE_B }
    ];
    for (const state of visitorStates) {
      const authorized = resolveOwnerAuthoringEnabled(state);
      assert.equal(coldRuntime.loadOwnerRuntimeWhenAuthorized(authorized, loader), null);
    }
    assert.equal(imports, 0);
    assert.deepEqual(operations, []);
    coldStore.useStore.getState().loadActorPresets();
    assert.deepEqual(operations, [['get', 'underneath.actor-presets.v1']]);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

test('verified matching authority loads the owner runtime once and authority loss fails closed', async () => {
  let imports = 0;
  const module = { default: () => null };
  const loader = createOwnerRuntimeLoader(async () => { imports += 1; return module; });
  const matching = { ownershipVerified: true, verifiedOwnerProfileAddress: PROFILE_A,
    workspaceProfileAddress: PROFILE_A, viewedProfileAddress: PROFILE_A };
  const first = loadOwnerRuntimeWhenAuthorized(resolveOwnerAuthoringEnabled(matching), loader);
  const second = loadOwnerRuntimeWhenAuthorized(resolveOwnerAuthoringEnabled(matching), loader);
  assert.strictEqual(first, second);
  assert.strictEqual(await first, module);
  assert.equal(imports, 1);
  assert.equal(loadOwnerRuntimeWhenAuthorized(false, loader), null);
  assert.equal(imports, 1);
});

test('owner loading failure stays in a controlled owner-only boundary', async () => {
  const failure = new Error('owner chunk unavailable');
  const loader = createOwnerRuntimeLoader(async () => { throw failure; });
  await assert.rejects(loadOwnerRuntimeWhenAuthorized(true, loader), failure);
  assert.equal(loadOwnerRuntimeWhenAuthorized(false, loader), null);

  const boundarySource = readFileSync(resolve(here, 'OwnerRuntimeBoundary.jsx'), 'utf8');
  assert.match(boundarySource, /if \(ownerAuthoringEnabled !== true\) return null/);
  assert.match(boundarySource, /role="alert">The owner workspace could not be loaded/);
  assert.doesNotMatch(boundarySource, /PublishedProfileBoundary|localStorage|useLibraryStore|useSignalStore/);
});
