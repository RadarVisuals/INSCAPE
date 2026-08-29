import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { analyzeProductionBuild, assertNoProhibitedProductionArtifacts, assertSafeOutputDirectory, checkProductionBudgets, pruneProductionAuthoringAssets,
  assertProductionFontContract, diagnosticsEnvironmentPlugin, productionBuildHygienePlugin, PRODUCTION_BUDGETS, UNUSED_PUBLIC_PATHS } from './productionBuild.js';
import { ownerRuntimeIsolationPlugin } from './ownerRuntimeIsolation.js';
import { excludeUnsupportedWalletConnectorsPlugin } from './unsupportedWalletConnectors.js';

const removeTree = (path) => rm(path, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });

const graph = (leaks = []) => ({ ownerModules: ['/src/public/OwnerSystemWorkflowShell.jsx'], entries: [{ file: 'assets/app-a.js' }],
  ownerChunks: [{ file: 'assets/system-workflow-a.js', modules: ['/src/public/OwnerSystemWorkflowShell.jsx'] }], leaks });

async function fixture(root, suffix = 'a') {
  await mkdir(resolve(root, '.vite'), { recursive: true }); await mkdir(resolve(root, 'assets'), { recursive: true });
  const manifest = {
    'index.html': { file: `assets/app-${suffix}.js`, isEntry: true, imports: ['_shared.js'], css: [`assets/app-${suffix}.css`] },
    '_shared.js': { file: `assets/shared-${suffix}.js` },
    '_standalone-wallet.js': { file: `assets/wallet-${suffix}.js`, name: 'standaloneWalletSession', isDynamicEntry: true,
      imports: ['_shared.js'], dynamicImports: ['_wallet-icon.js'] },
    '_wallet-icon.js': { file: `assets/wallet-icon-${suffix}.js` },
    'src/public/OwnerSystemWorkflowShell.jsx': { file: `assets/system-workflow-${suffix}.js`, isDynamicEntry: true, imports: ['_shared.js'], css: [`assets/system-workflow-${suffix}.css`] },
  };
  await writeFile(resolve(root, '.vite/manifest.json'), JSON.stringify(manifest));
  await writeFile(resolve(root, 'owner-runtime-graph.json'), JSON.stringify(graph()));
  for (const file of [`app-${suffix}.js`, `shared-${suffix}.js`, `wallet-${suffix}.js`, `wallet-icon-${suffix}.js`,
    `system-workflow-${suffix}.js`, `app-${suffix}.css`, `system-workflow-${suffix}.css`])
    await writeFile(resolve(root, 'assets', file), file.repeat(3));
  await writeFile(resolve(root, 'assets/public.webp'), 'asset');
}

test('manifest classification survives hashed filename changes and current synthetic output passes', async () => {
  const roots = [resolve(tmpdir(), `underneath-budget-a-${process.pid}`), resolve(tmpdir(), `underneath-budget-b-${process.pid}`)];
  try {
    await fixture(roots[0], 'hash-one'); await fixture(roots[1], 'hash-two');
    const first = await analyzeProductionBuild(roots[0]); const second = await analyzeProductionBuild(roots[1]);
    assert.equal(first.initialJavaScript.length, 2); assert.equal(first.ownerJavaScript.length, 1);
    assert.equal(first.standaloneWalletJavaScript.length, 2);
    assert.ok(first.standaloneWalletJavaScript.every(({ file }) => file.includes('wallet')));
    assert.deepEqual(first.totals, second.totals); assert.equal(checkProductionBudgets(first), true);
  } finally { await Promise.all(roots.map(removeTree)); }
});

test('manifest classification accepts Vite internal owner facade keys after a nested lazy split', async () => {
  const root = resolve(tmpdir(), `underneath-budget-owner-facade-${process.pid}`);
  try {
    await fixture(root, 'facade');
    const manifestPath = resolve(root, '.vite/manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest['_OwnerSystemWorkflowShell-facade.js'] = manifest['src/public/OwnerSystemWorkflowShell.jsx'];
    delete manifest['src/public/OwnerSystemWorkflowShell.jsx'];
    await writeFile(manifestPath, JSON.stringify(manifest));
    const report = await analyzeProductionBuild(root);
    assert.equal(report.ownerJavaScript.length, 1);
    assert.equal(report.ownerJavaScript[0].file, 'assets/system-workflow-facade.js');
  } finally { await removeTree(root); }
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

test('measured Phase 4B allowances retain exact production budget boundaries', () => {
  assert.deepEqual(PRODUCTION_BUDGETS, {
    initialJavaScript: { raw: 1_303_524, gzip: 379_811 },
    ownerJavaScript: { raw: 378_237, gzip: 114_888 },
    standaloneWalletJavaScript: { raw: 4_400_000, gzip: 1_200_000 },
    initialCss: { raw: 51_807, gzip: 10_301 },
    ownerCss: { raw: 143_870, gzip: 21_140 },
    coreJavaScript: { raw: 2_076_709, gzip: 620_158 },
    publicAssets: { raw: 15_200_000 },
    largestPublicAsset: { raw: 2_700_000 },
  });

  const totals = Object.fromEntries(Object.entries(PRODUCTION_BUDGETS).map(([name, limits]) =>
    [name, { ...limits }]));
  assert.equal(checkProductionBudgets({ totals, ownerRuntimeGraph: graph() }), true);

  for (const [measurement, limit] of Object.entries(PRODUCTION_BUDGETS.initialJavaScript)) {
    const over = structuredClone(totals);
    over.initialJavaScript[measurement] = limit + 1;
    assert.throws(() => checkProductionBudgets({ totals: over, ownerRuntimeGraph: graph() }),
      new RegExp(`initialJavaScript\\.${measurement}: .* \\(\\+1 bytes\\)`));
  }
  for (const [measurement, limit] of Object.entries(PRODUCTION_BUDGETS.coreJavaScript)) {
    const over = structuredClone(totals);
    over.coreJavaScript[measurement] = limit + 1;
    assert.throws(() => checkProductionBudgets({ totals: over, ownerRuntimeGraph: graph() }),
      new RegExp(`coreJavaScript\\.${measurement}: .* \\(\\+1 bytes\\)`));
  }
  for (const [measurement, limit] of Object.entries(PRODUCTION_BUDGETS.initialCss)) {
    const over = structuredClone(totals);
    over.initialCss[measurement] = limit + 1;
    assert.throws(() => checkProductionBudgets({ totals: over, ownerRuntimeGraph: graph() }),
      new RegExp(`initialCss\\.${measurement}: .* \\(\\+1 bytes\\)`));
  }
  for (const category of ['ownerJavaScript', 'ownerCss']) {
    for (const [measurement, limit] of Object.entries(PRODUCTION_BUDGETS[category])) {
      const over = structuredClone(totals);
      over[category][measurement] = limit + 1;
      assert.throws(() => checkProductionBudgets({ totals: over, ownerRuntimeGraph: graph() }),
        new RegExp(`${category}\\.${measurement}: .* \\(\\+1 bytes\\)`));
    }
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
  } finally { await removeTree(root); }
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
  } finally { await removeTree(base); }
});

test('artifact hygiene rejects representative lock and temporary files with actionable paths', async () => {
  const root = resolve(tmpdir(), `underneath-hygiene-rejected-${process.pid}`);
  try {
    await mkdir(resolve(root, 'assets'), { recursive: true });
    await writeFile(resolve(root, 'assets/example.afdesign~lock~'), 'synthetic lock fixture');
    await writeFile(resolve(root, 'assets/render.webp.tmp'), 'synthetic temporary fixture');
    await assert.rejects(() => assertNoProhibitedProductionArtifacts(root), (error) => {
      assert.match(error.message, /Production artifact hygiene failed/);
      assert.match(error.message, /assets\/example\.afdesign~lock~: editor lock file/);
      assert.match(error.message, /assets\/render\.webp\.tmp: editor swap, backup, or temporary file/);
      return true;
    });
  } finally { await removeTree(root); }
});

test('artifact hygiene accepts ordinary intended production assets', async () => {
  const root = resolve(tmpdir(), `underneath-hygiene-accepted-${process.pid}`);
  try {
    await mkdir(resolve(root, 'assets'), { recursive: true });
    await writeFile(resolve(root, 'assets/public.webp'), 'ordinary intended asset');
    assert.equal(await assertNoProhibitedProductionArtifacts(root), true);
  } finally { await removeTree(root); }
});

test('authoring pruning rejects a path that escapes the verified output directory', async () => {
  const root = resolve(tmpdir(), `underneath-prune-escape-${process.pid}`);
  try {
    await mkdir(resolve(root, 'active'), { recursive: true });
    await assert.rejects(() => pruneProductionAuthoringAssets(resolve(root, 'active'), {
      projectRoot: process.cwd(), paths: ['../outside.txt']
    }), /outside verified output directory/);
  } finally { await removeTree(root); }
});

test('the two historical public lock paths cannot survive artifact hygiene', async () => {
  const root = resolve(tmpdir(), `underneath-hygiene-historical-${process.pid}`);
  const historicalPaths = [
    'assets/actors/abyssal_eye/full multi eye purple.afdesign~lock~',
    'assets/actors/skull_reaper/position.afdesign~lock~'
  ];
  try {
    for (const path of historicalPaths) {
      await mkdir(resolve(root, path, '..'), { recursive: true });
      await writeFile(resolve(root, path), 'synthetic historical-path fixture');
    }
    await assert.rejects(() => assertNoProhibitedProductionArtifacts(root), (error) => {
      for (const path of historicalPaths) assert.match(error.message, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    });
  } finally { await removeTree(root); }
});

test('production pruning excludes development-only prototype assets', () => {
  for (const path of ['assets/PFP', 'assets/prototype', 'assets/ratio']) assert.ok(UNUSED_PUBLIC_PATHS.includes(path), path);
});

test('manifest classification recognizes the sole System Workflow production owner entry', async () => {
  const root = resolve(tmpdir(), `underneath-budget-system-workflow-${process.pid}`);
  try {
    await fixture(root, 'system-workflow');
    const report = await analyzeProductionBuild(root);
    assert.equal(report.ownerJavaScript[0].file, 'assets/system-workflow-system-workflow.js');
  } finally { await removeTree(root); }
});

test('production pruning excludes unused font sources without removing active bundled fonts', () => {
  for (const path of ['assets/brand/fonts', 'assets/fonts/Sora/static',
    'assets/fonts/IBM_Plex_Sans_Condensed/IBMPlexSansCondensed-Medium.ttf']) {
    assert.ok(UNUSED_PUBLIC_PATHS.includes(path), path);
  }
  for (const path of ['assets/fonts/Sora/Sora-VariableFont_wght.ttf',
    'assets/fonts/IBM_Plex_Sans_Condensed/IBMPlexSansCondensed-Regular.ttf']) {
    assert.ok(!UNUSED_PUBLIC_PATHS.includes(path), path);
  }
});

test('fresh production CSS and copied font assets are limited to Sora and IBM Plex Sans Condensed', async () => {
  const root = resolve(tmpdir(), `inscape-font-contract-${process.pid}`);
  try {
    await mkdir(resolve(root, 'assets/fonts/Sora'), { recursive: true });
    await mkdir(resolve(root, 'assets/fonts/IBM_Plex_Sans_Condensed'), { recursive: true });
    await writeFile(resolve(root, 'assets/index.css'), '@font-face{font-family:"Inscape Sora";src:url("/assets/fonts/Sora/Sora-VariableFont_wght.ttf")}@font-face{font-family:"Inscape IBM Plex Sans Condensed";src:url("/assets/fonts/IBM_Plex_Sans_Condensed/IBMPlexSansCondensed-Regular.ttf")}');
    for (const file of ['assets/fonts/Sora/OFL.txt', 'assets/fonts/Sora/Sora-VariableFont_wght.ttf',
      'assets/fonts/IBM_Plex_Sans_Condensed/OFL.txt', 'assets/fonts/IBM_Plex_Sans_Condensed/IBMPlexSansCondensed-Regular.ttf']) {
      await writeFile(resolve(root, file), 'fixture');
    }
    assert.equal(await assertProductionFontContract(root), true);
    await writeFile(resolve(root, 'assets/legacy.css'), '.legacy{font-family:Geist,system-ui}');
    await assert.rejects(() => assertProductionFontContract(root), /legacy font/);
  } finally { await removeTree(root); }
});

test('an alternate-outDir production build writes reports there and strips diagnostics', async () => {
  const project = process.cwd(); const alternate = resolve(tmpdir(), `underneath-phase1c2h-build-${process.pid}`);
  try {
    await mkdir(resolve(alternate, 'assets/patterns'), { recursive: true });
    await writeFile(resolve(alternate, 'owner-runtime-graph.json'), 'stale');
    await writeFile(resolve(alternate, 'bundle-report.json'), 'stale');
    const [{ build }, { default: react }] = await Promise.all([import('vite'), import('@vitejs/plugin-react')]);
    await build({ configFile: false, root: project, logLevel: 'silent', plugins: [diagnosticsEnvironmentPlugin(), react(),
      excludeUnsupportedWalletConnectorsPlugin(), ownerRuntimeIsolationPlugin(), productionBuildHygienePlugin()],
      build: { outDir: alternate, emptyOutDir: true, manifest: true } });
    const report = JSON.parse(await readFile(resolve(alternate, 'bundle-report.json'), 'utf8'));
    const netlifyHeaders = await readFile(resolve(alternate, '_headers'), 'utf8');
    assert.equal(report.ownerRuntimeGraph.leaks.length, 0); assert.ok(report.initialJavaScript.length);
    assert.match(netlifyHeaders, /Content-Security-Policy: default-src 'self'/u);
    assert.match(netlifyHeaders, /frame-ancestors 'self' https:\/\/universaleverything\.io/u);
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
      assert.doesNotMatch(javascript, /@coinbase\/cdp-sdk|brotli_wasm|axios/iu, `${name}: unsupported Base dependency`);
    }
  } finally {
    await removeTree(alternate);
  }
});
