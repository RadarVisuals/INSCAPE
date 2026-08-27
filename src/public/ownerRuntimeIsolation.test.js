import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveOwnerAuthoringEnabled } from './publicAccess.js';
import {
  createOwnerRuntimeLoader,
  loadOwnerRuntimeWhenAuthorized,
} from './ownerRuntimeLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const OWNER_RUNTIME_PAIRINGS = Object.freeze({
  SYSTEM_WORKFLOW: './OwnerSystemWorkflowShell.jsx',
});

function selectedRuntimePair(source) {
  const selection = source.match(/OWNER_RUNTIME_SELECTION\s*=\s*'([^']+)'/u)?.[1];
  const modulePath = source.match(/import\('([^']+)'\)/u)?.[1];
  if (!Object.hasOwn(OWNER_RUNTIME_PAIRINGS, selection)
      || OWNER_RUNTIME_PAIRINGS[selection] !== modulePath) {
    throw new TypeError(`Unsupported or mismatched owner runtime pairing: ${String(selection)} + ${String(modulePath)}`);
  }
  return { selection, modulePath };
}

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
    resolve(here, 'OwnerSystemWorkflowShell.jsx'),
    resolve(here, '../library/state/useLibraryStore.js'),
    resolve(here, '../signals/state/useSignalStore.js')
  ]) assert.equal(graph.has(forbidden), false, `${forbidden} is statically reachable from App`);

  const loaderSource = readFileSync(resolve(here, 'ownerRuntimeLoader.js'), 'utf8');
  const selectedSource = readFileSync(resolve(here, 'ownerRuntimeSelected.js'), 'utf8');
  const selected = selectedRuntimePair(selectedSource);
  assert.deepEqual(selected, { selection: 'SYSTEM_WORKFLOW', modulePath: './OwnerSystemWorkflowShell.jsx' });
  assert.doesNotMatch(`${loaderSource}\n${selectedSource}`, /Owner(?:Modul8r|Lattice)Shell|ModuleGridShell|MODUL8R|LATTICE|LEGACY/u);
});

test('build selector accepts only the System Workflow runtime pairing', () => {
  assert.deepEqual(selectedRuntimePair("export const OWNER_RUNTIME_SELECTION = 'SYSTEM_WORKFLOW';\nconst load = () => import('./OwnerSystemWorkflowShell.jsx');"),
    { selection: 'SYSTEM_WORKFLOW', modulePath: './OwnerSystemWorkflowShell.jsx' });
  assert.throws(() => selectedRuntimePair("const OWNER_RUNTIME_SELECTION = 'MODUL8R'; import('./OwnerModul8rShell.jsx')"), /mismatched/);
  assert.throws(() => selectedRuntimePair("const OWNER_RUNTIME_SELECTION = 'SYSTEM_WORKFLOW'; import('./OwnerLatticeShell.jsx')"), /mismatched/);
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

test('profile-keyed owner subtree resets without relying on an App remount', () => {
  const boundarySource = readFileSync(resolve(here, 'OwnerRuntimeBoundary.jsx'), 'utf8');
  assert.match(boundarySource, /ownerRuntimeProfileKey/);
  assert.match(boundarySource, /workspace && workspace === viewed/);
  assert.match(boundarySource, /<OwnerRuntimeErrorBoundary key=\{profileKey\}>/);
  assert.match(boundarySource, /<SelectedOwnerRuntime[\s\S]*key=\{profileKey\}/);
  assert.doesNotMatch(readFileSync(resolve(here, '../App.jsx'), 'utf8'), /key=\{.*Profile.*\}[^\n]*OwnerRuntimeBoundary/);
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
