import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { analyzeProductionBuild, assertSafeOutputDirectory, checkProductionBudgets, pruneProductionAuthoringAssets,
  diagnosticsEnvironmentPlugin, productionBuildHygienePlugin, PRODUCTION_BUDGETS } from './productionBuild.js';
import { ownerRuntimeIsolationPlugin } from './ownerRuntimeIsolation.js';

const graph = (leaks = []) => ({ ownerModules: ['/src/public/ModuleGridShell.jsx'], entries: [{ file: 'assets/app-a.js' }],
  ownerChunks: [{ file: 'assets/owner-a.js', modules: ['/src/public/ModuleGridShell.jsx'] }], leaks });

async function fixture(root, suffix = 'a') {
  await mkdir(resolve(root, '.vite'), { recursive: true }); await mkdir(resolve(root, 'assets'), { recursive: true });
  const manifest = {
    'index.html': { file: `assets/app-${suffix}.js`, isEntry: true, imports: ['_shared.js'], css: [`assets/app-${suffix}.css`] },
    '_shared.js': { file: `assets/shared-${suffix}.js` },
    'src/public/ModuleGridShell.jsx': { file: `assets/owner-${suffix}.js`, isDynamicEntry: true, imports: ['_shared.js'], css: [`assets/owner-${suffix}.css`] }
  };
  await writeFile(resolve(root, '.vite/manifest.json'), JSON.stringify(manifest));
  await writeFile(resolve(root, 'owner-runtime-graph.json'), JSON.stringify(graph()));
  for (const file of [`app-${suffix}.js`, `shared-${suffix}.js`, `owner-${suffix}.js`, `app-${suffix}.css`, `owner-${suffix}.css`])
    await writeFile(resolve(root, 'assets', file), file.repeat(3));
  await writeFile(resolve(root, 'assets/public.webp'), 'asset');
}

test('manifest classification survives hashed filename changes and current synthetic output passes', async () => {
  const roots = [resolve(tmpdir(), `underneath-budget-a-${process.pid}`), resolve(tmpdir(), `underneath-budget-b-${process.pid}`)];
  try {
    await fixture(roots[0], 'hash-one'); await fixture(roots[1], 'hash-two');
    const first = await analyzeProductionBuild(roots[0]); const second = await analyzeProductionBuild(roots[1]);
    assert.equal(first.initialJavaScript.length, 2); assert.equal(first.ownerJavaScript.length, 1);
    assert.deepEqual(first.totals, second.totals); assert.equal(checkProductionBudgets(first), true);
  } finally { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); }
});

test('each independent budget category reports an actionable overage', () => {
  for (const [name, limits] of Object.entries(PRODUCTION_BUDGETS)) {
    const totals = Object.fromEntries(Object.entries(PRODUCTION_BUDGETS).map(([key, value]) =>
      [key, Object.fromEntries(Object.keys(value).map((measurement) => [measurement, 0]))]));
    const measurement = Object.keys(limits)[0]; totals[name][measurement] = limits[measurement] + 7;
    assert.throws(() => checkProductionBudgets({ totals, ownerRuntimeGraph: graph() }),
      new RegExp(`${name}\\.${measurement}: .* \\d+ \\(\\+7 bytes\\)`));
  }
});

test('owner leakage fails independently of byte budgets', () => {
  const totals = Object.fromEntries(Object.entries(PRODUCTION_BUDGETS).map(([key, value]) =>
    [key, Object.fromEntries(Object.keys(value).map((measurement) => [measurement, 0]))]));
  assert.throws(() => checkProductionBudgets({ totals, ownerRuntimeGraph: graph([{ entry: 'app.js', ownerChunk: 'owner.js' }]) }),
    /Owner runtime leaked/);
});

test('missing manifest and graph inputs fail clearly', async () => {
  const root = resolve(tmpdir(), `underneath-budget-missing-${process.pid}`);
  try {
    await mkdir(root, { recursive: true });
    await assert.rejects(() => analyzeProductionBuild(root), /missing or invalid Vite manifest/);
    await mkdir(resolve(root, '.vite'), { recursive: true }); await writeFile(resolve(root, '.vite/manifest.json'), '{}');
    await assert.rejects(() => analyzeProductionBuild(root), /missing or invalid owner runtime graph/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('output validation rejects roots, profiles and unrelated directories', () => {
  const project = resolve(process.cwd());
  assert.throws(() => assertSafeOutputDirectory(project, project), /unsafe/);
  assert.throws(() => assertSafeOutputDirectory(project, resolve(project, '..', 'unrelated-output')), /inside the project or system temporary/);
  assert.doesNotThrow(() => assertSafeOutputDirectory(project, resolve(project, '.alternate-output')));
});

test('authoring pruning touches only the active verified output directory', async () => {
  const base = resolve(tmpdir(), `underneath-prune-${process.pid}`); const active = resolve(base, 'active'); const normal = resolve(base, 'dist');
  try {
    await mkdir(resolve(active, 'assets/patterns'), { recursive: true }); await mkdir(resolve(normal, 'assets/patterns'), { recursive: true });
    await writeFile(resolve(active, 'assets/patterns/stale.txt'), 'active'); await writeFile(resolve(normal, 'assets/patterns/sentinel.txt'), 'normal');
    assertSafeOutputDirectory(process.cwd(), active); await pruneProductionAuthoringAssets(active);
    await assert.rejects(() => readFile(resolve(active, 'assets/patterns/stale.txt')));
    assert.equal(await readFile(resolve(normal, 'assets/patterns/sentinel.txt'), 'utf8'), 'normal');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('an alternate-outDir production build writes reports there and strips diagnostics', async () => {
  const project = process.cwd(); const alternate = resolve(tmpdir(), `underneath-phase1c2h-build-${process.pid}`);
  try {
    await mkdir(resolve(alternate, 'assets/patterns'), { recursive: true });
    await writeFile(resolve(alternate, 'owner-runtime-graph.json'), 'stale');
    await writeFile(resolve(alternate, 'bundle-report.json'), 'stale');
    const [{ build }, { default: react }] = await Promise.all([import('vite'), import('@vitejs/plugin-react')]);
    await build({ configFile: false, root: project, logLevel: 'silent', plugins: [diagnosticsEnvironmentPlugin(), react(), ownerRuntimeIsolationPlugin(), productionBuildHygienePlugin()],
      build: { outDir: alternate, emptyOutDir: true, manifest: true } });
    const report = JSON.parse(await readFile(resolve(alternate, 'bundle-report.json'), 'utf8'));
    assert.equal(report.ownerRuntimeGraph.leaks.length, 0); assert.ok(report.initialJavaScript.length);
    await assert.rejects(() => readFile(resolve(alternate, 'assets/patterns')));
    const javascriptNames = (await readdir(resolve(alternate, 'assets'))).filter((name) => name.endsWith('.js'));
    for (const name of javascriptNames) {
      const javascript = await readFile(resolve(alternate, 'assets', name), 'utf8');
      assert.doesNotMatch(javascript, /(?:window|globalThis)\s*(?:\.\s*(?:use)?walletstore|\[\s*['"](?:use)?walletstore['"]\s*\])\s*=/iu, `${name}: mutable wallet-store global`);
      const diagnosticMatches = javascript.match(/useWalletStore|\[UP Wallet\]|wallet-session|\[wallet-metadata\] query|wallet-permissions|__UNDERNEATH_ENGINE__/gu) || [];
      assert.deepEqual(diagnosticMatches, [], `${name}: ${diagnosticMatches.join(', ')}`);
      assert.doesNotMatch(javascript, /Real-Time Gothic Reaction|Metadata queried successfully|activeAccount/u, `${name}: verbose session diagnostic`);
      assert.doesNotMatch(javascript, /Rig Loader: Locating Stage Assets|Dynamic asset payload cached|Connecting WebSocket to watch updates|Reconnecting stream/u,
        `${name}: verbose engine/provider diagnostic`);
    }
  } finally {
    await rm(alternate, { recursive: true, force: true });
  }
});
