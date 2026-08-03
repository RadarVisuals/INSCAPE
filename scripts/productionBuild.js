import { readFileSync } from 'node:fs';
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { assertOwnerRuntimeGraph } from './ownerRuntimeIsolation.js';

export const BUILD_REPORT_FILE = 'bundle-report.json';
export const GENERATED_BUILD_FILES = Object.freeze([BUILD_REPORT_FILE, 'owner-runtime-graph.json']);
export const UNUSED_PUBLIC_PATHS = Object.freeze([
  'assets/PFP',
  'assets/patterns',
  'assets/palettes',
  'assets/prototype',
  'assets/ratio',
  'assets/inscape-table-grid-arena-banner.png',
  'assets/inscape-table-grid-banner.png',
  'assets/inscape-table-grid-grunge-banner.png',
  'assets/inscape-table-grid-grunge-lit-banner.png',
  'assets/fonts/moon.webp',
  'assets/manifest.json',
  'assets/actors/abyssal_eye/full multi eye purple.afdesign',
  'assets/actors/skull_reaper/position.afdesign'
]);

const PROHIBITED_ARTIFACT_RULES = Object.freeze([
  Object.freeze({ label: 'editor lock file', pattern: /~lock~/iu }),
  Object.freeze({ label: 'editor swap, backup, or temporary file', pattern: /(?:\.sw[ponx]|\.bak|\.backup|\.tmp|\.temp|\.orig|\.rej|~)$/iu }),
  Object.freeze({ label: 'platform metadata file', pattern: /(?:^|\/)(?:\.DS_Store|Thumbs\.db|desktop\.ini|\.directory|\._[^/]+)$/iu }),
  Object.freeze({ label: 'credential-looking file', pattern: /(?:^|\/)(?:\.env(?:\.[^/]*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|credentials?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|passwords?(?:\.[^/]*)?|tokens?(?:\.[^/]*)?|[^/]+\.(?:pem|p12|pfx|key))$/iu })
]);

// Content fingerprints keep the two historical leaks detectable even if they
// are renamed. Never log or retain their workstation/editor metadata.
const PROHIBITED_ARTIFACT_SHA256 = new Set([
  '8a9b66f1e88c45f3bad9026061cb368090bf0e28b7a51a5ec815e961d2c65b50',
  '8e52629cdf832579ffddf6809aa4520fce75149cb6b20b329e822e6f28fe01e8'
]);

// Phase 1C2H baseline, recalibrated for the approved Gallery and hybrid Index runtime.
// Keep these byte limits deterministic and deliberately close to the measured build.
export const PRODUCTION_BUDGETS = Object.freeze({
  initialJavaScript: Object.freeze({ raw: 1_265_000, gzip: 370_000 }),
  // The universal owner RÄCK adds grouped authoring transactions, Layers,
  // reversible compact chrome, and runtime-only module controls. Keep the lazy
  // owner boundary close to the measured Windows build with modest CI margin.
  // Phase 8A extracts the already accepted production table renderer into a
  // shared owner/visitor chunk. The raw owner ceiling is unchanged; this small
  // gzip allowance accounts for the new compression boundary, not more owner code.
  // Phase 8A.3 shares the accepted identity projection and compact Profile Rail
  // with Visitor. Raw owner code remains below its existing ceiling; allow only
  // the measured gzip-boundary shift caused by that shared chunk.
  // Phase 8B adds only the lazy-module activation and explicit snapshot inputs
  // to the owner graph; the writer implementation remains in its own lazy chunk.
  // Phase 9 activates the already isolated Creations, Activity, Discovery, and
  // Settings boundaries. The measured owner graph grows only at the activation
  // seam; each substantial surface remains independently lazy.
  // MODUL-8R Task 8 replaces the selected owner presentation and keeps its
  // production entry wrapper within a measured allowance. The extra rollback
  // margin keeps the retained two-line LATTICE selector buildable through Task 8.
  ownerJavaScript: Object.freeze({ raw: 276_000, gzip: 83_500 }),
  // WalletConnect's platform-conditional graph is larger in Netlify's Linux build
  // than in the local Windows build. Keep a small measured cross-platform margin
  // while continuing to budget this lazy runtime independently from the core app.
  standaloneWalletJavaScript: Object.freeze({ raw: 4_400_000, gzip: 1_200_000 }),
  initialCss: Object.freeze({ raw: 117_000, gzip: 20_000 }),
  // Phase 7 adds the lazy owner-only Identity RÄCK; Phase 7.5 adds its compact,
  // shared-theme Keeper context controls. Keep both isolated from initial CSS
  // and deliberately close to the measured owner-only output.
  // Shared lattice navigation styles now have one authority for owner Preview
  // and the visitor runtime; keep the raw ceiling while measuring the split CSS.
  // Visitor Identity reuses the existing MODULE RACK and theme-token CSS. The
  // raw ceiling remains unchanged; this allowance measures the shared split.
  // Phase 9 exposes the already-existing owner-only Creations, Activity, and
  // Settings styles without moving them into initial CSS.
  ownerCss: Object.freeze({ raw: 70_000, gzip: 13_200 }),
  // Owner/publication reconciliation adds the deterministic IPFS hydration and
  // three-way baseline guard to production. Keep the accepted growth bounded.
  // Phase 7 adds paragraph-preserving LSP3 normalization, independently
  // statused direct contract facts, and the pure owner dossier projection.
  // The unified owner Browser adds category authoring, multi-selection,
  // drag/drop, and continuous display controls without changing initial entry.
  // Its first universal RÄCK shell adds bounded move/collapse geometry while
  // retaining Browser state and the existing lazy owner-runtime boundary.
  // Canonical rotate, mirror, and duplicate operations remain owner-lazy and
  // add strict migration/validation at both draft and publication boundaries.
  // Atomic grouped MOVE, DUPLICATE, and REMOVE, authoring-only marquee selection,
  // group RESIZE/ROTATE/MIRROR, Layers, and the reversible compact/module RÄCK
  // controls remain within the same lazy owner boundary and receive only
  // measured production margin.
  // Phase 8A adds the lazy visitor navigation runtime, validated owner preview
  // adapter, and the existing production focus viewer on that public boundary.
  // Keep the measured visitor-parity growth bounded without moving initial or
  // owner-only entry limits.
  // Phase 8A.3 adds only the public identity adapter, trigger ownership, and
  // live public LSP3/RPC read boundary; the RACK itself remains lazy/reused.
  // Phase 8B adds one owner-triggered lazy publication module around the
  // existing canonical IPFS/wallet/read-back pipeline. MODUL-8R Task 4 adds
  // shared headless controllers to the existing lazy Activity and Discovery
  // surfaces while its adapters remain development-only. Initial entry stays
  // unchanged; bound the measured aggregate production graph explicitly.
  // Task 8 prunes the old Browser/Rack owner branch at build selection time.
  // The remaining measured growth is the accepted complete MODUL-8R
  // Activity/People/Layers/Settings presentation; legacy visitor chunks stay
  // readable and are not owner-hybrid reachability.
  coreJavaScript: Object.freeze({ raw: 2_057_000, gzip: 615_000 }),
  publicAssets: Object.freeze({ raw: 15_200_000 }),
  largestPublicAsset: Object.freeze({ raw: 2_700_000 })
});

const normalize = (value) => value.replaceAll('\\', '/');
const isWithin = (parent, child) => {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

export function assertSafeOutputDirectory(projectRoot, outputDirectory) {
  const root = resolve(projectRoot);
  const output = resolve(outputDirectory);
  const filesystemRoot = parse(output).root;
  if (output === root || output === filesystemRoot || output === resolve(homedir()) || output === resolve(tmpdir())) {
    throw new Error(`Refusing unsafe build output directory: ${output}`);
  }
  if (!isWithin(root, output) && !isWithin(resolve(tmpdir()), output)) {
    throw new Error(`Build output must be inside the project or system temporary directory: ${output}`);
  }
  return output;
}

export function resolveBuildOutputDirectory(config) {
  return assertSafeOutputDirectory(config.root, resolve(config.root, config.build.outDir));
}

export async function pruneProductionAuthoringAssets(outputDirectory, {
  projectRoot = process.cwd(), paths = UNUSED_PUBLIC_PATHS
} = {}) {
  const verifiedOutput = assertSafeOutputDirectory(projectRoot, outputDirectory);
  const targets = paths.map((path) => {
    const target = resolve(verifiedOutput, path);
    if (!isWithin(verifiedOutput, target)) throw new Error(`Refusing build-output prune path outside verified output directory: ${path}`);
    return target;
  });
  await Promise.all(targets.map((target) => rm(target, { recursive: true, force: true })));
}

async function walk(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const values = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? walk(resolve(directory, entry.name), root)
    : normalize(relative(root, resolve(directory, entry.name)))));
  return values.flat().sort();
}

export async function findProhibitedProductionArtifacts(outputDirectory) {
  const files = await walk(outputDirectory);
  const findings = [];
  for (const file of files) {
    const filenameRule = PROHIBITED_ARTIFACT_RULES.find(({ pattern }) => pattern.test(file));
    if (filenameRule) findings.push({ file, reason: filenameRule.label });
    const bytes = await readFile(resolve(outputDirectory, file));
    const fingerprint = createHash('sha256').update(bytes).digest('hex');
    if (PROHIBITED_ARTIFACT_SHA256.has(fingerprint)) findings.push({ file, reason: 'historical leaked lock-file content' });
  }
  return findings;
}

export async function assertNoProhibitedProductionArtifacts(outputDirectory) {
  const findings = await findProhibitedProductionArtifacts(outputDirectory);
  if (findings.length) {
    throw new Error(`Production artifact hygiene failed:\n${findings.map(({ file, reason }) => `- ${file}: ${reason}`).join('\n')}`);
  }
  return true;
}

function manifestClosure(manifest, entryKey, { includeDynamic = false, excludeKeys = new Set() } = {}) {
  const keys = new Set();
  const visit = (key) => {
    if (keys.has(key) || excludeKeys.has(key)) return;
    const record = manifest[key];
    if (!record) throw new Error(`Vite manifest references missing entry: ${key}`);
    keys.add(key);
    for (const imported of record.imports || []) visit(imported);
    if (includeDynamic) for (const imported of record.dynamicImports || []) visit(imported);
  };
  visit(entryKey);
  return keys;
}

async function measure(outputDirectory, file) {
  const bytes = await readFile(resolve(outputDirectory, file));
  return { file, raw: bytes.byteLength, gzip: gzipSync(bytes, { level: 9 }).byteLength };
}

const sum = (items) => ({
  raw: items.reduce((total, item) => total + item.raw, 0),
  gzip: items.reduce((total, item) => total + item.gzip, 0)
});

function entryKey(manifest) {
  const keys = Object.keys(manifest).filter((key) => manifest[key].isEntry);
  if (keys.length !== 1) throw new Error(`Expected one Vite entry in the manifest, found ${keys.length}`);
  return keys[0];
}

function ownerKey(manifest) {
  const ownerPaths = ['src/public/OwnerModul8rShell.jsx', 'src/public/OwnerLatticeShell.jsx', 'src/public/ModuleGridShell.jsx'];
  const key = Object.keys(manifest).find((candidate) => ownerPaths.some((path) => normalize(candidate).endsWith(`/${path}`)
    || normalize(candidate) === path)) || Object.keys(manifest).find((candidate) => {
    const record = manifest[candidate];
    return record.isDynamicEntry === true && record.file?.endsWith('.js')
      && ownerPaths.some((path) => normalize(candidate).includes(path.split('/').at(-1).replace('.jsx', ''))
        || normalize(record.file).includes(path.split('/').at(-1).replace('.jsx', '')));
  });
  if (!key) throw new Error('Vite manifest is missing the selected owner runtime dynamic entry');
  return key;
}

function standaloneWalletKey(manifest) {
  return Object.keys(manifest).find((candidate) => normalize(candidate).endsWith('/src/wallet/standaloneWalletSession.js')
    || normalize(candidate) === 'src/wallet/standaloneWalletSession.js'
    || manifest[candidate].name === 'standaloneWalletSession');
}

function cssFiles(manifest, keys) {
  return [...new Set([...keys].flatMap((key) => manifest[key].css || []))].sort();
}

function publicAssetFile(file) {
  return !file.startsWith('.vite/') && !file.endsWith('.html') && !file.endsWith('.js') && !file.endsWith('.css')
    && !GENERATED_BUILD_FILES.includes(file);
}

export function checkProductionBudgets(report, budgets = PRODUCTION_BUDGETS) {
  assertOwnerRuntimeGraph(report.ownerRuntimeGraph);
  const failures = [];
  for (const [name, limits] of Object.entries(budgets)) {
    const actual = report.totals[name];
    if (!actual) throw new Error(`Bundle report is missing budget category: ${name}`);
    for (const [measurement, allowed] of Object.entries(limits)) {
      if (actual[measurement] > allowed) failures.push({ name, measurement, actual: actual[measurement], allowed,
        difference: actual[measurement] - allowed });
    }
  }
  if (failures.length) {
    throw new Error(`Production bundle budget failed:\n${failures.map((failure) =>
      `- ${failure.name}.${failure.measurement}: ${failure.actual} > ${failure.allowed} (+${failure.difference} bytes)`).join('\n')}`);
  }
  return true;
}

function utilization(totals, budgets) {
  return Object.fromEntries(Object.entries(budgets).map(([name, limits]) => [name,
    Object.fromEntries(Object.entries(limits).map(([measurement, allowed]) => [measurement,
      Number(((totals[name][measurement] / allowed) * 100).toFixed(1))]))]));
}

export async function analyzeProductionBuild(outputDirectory, { budgets = PRODUCTION_BUDGETS, chunkGroups = {} } = {}) {
  let manifest; let ownerRuntimeGraph;
  try { manifest = JSON.parse(await readFile(resolve(outputDirectory, '.vite/manifest.json'), 'utf8')); }
  catch (error) { throw new Error(`Cannot check production build: missing or invalid Vite manifest in ${outputDirectory}`, { cause: error }); }
  try { ownerRuntimeGraph = JSON.parse(await readFile(resolve(outputDirectory, 'owner-runtime-graph.json'), 'utf8')); }
  catch (error) { throw new Error(`Cannot check production build: missing or invalid owner runtime graph in ${outputDirectory}`, { cause: error }); }

  const initialKeys = manifestClosure(manifest, entryKey(manifest));
  const ownerKeys = manifestClosure(manifest, ownerKey(manifest));
  const walletEntryKey = standaloneWalletKey(manifest);
  const walletKeys = walletEntryKey
    ? manifestClosure(manifest, walletEntryKey, { includeDynamic: true, excludeKeys: initialKeys })
    : new Set();
  const initialFiles = new Set([...initialKeys].map((key) => manifest[key].file));
  const ownerFiles = [...ownerKeys].map((key) => manifest[key].file).filter((file) => !initialFiles.has(file));
  const walletFiles = [...new Set([...walletKeys].map((key) => manifest[key].file))]
    .filter((file) => !initialFiles.has(file));
  const initialJs = await Promise.all([...initialFiles].sort().map((file) => measure(outputDirectory, file)));
  const ownerJs = await Promise.all(ownerFiles.sort().map((file) => measure(outputDirectory, file)));
  const walletJs = await Promise.all(walletFiles.sort().map((file) => measure(outputDirectory, file)));
  const initialCssNames = cssFiles(manifest, initialKeys);
  const ownerCssNames = cssFiles(manifest, ownerKeys).filter((file) => !initialCssNames.includes(file));
  const initialCss = await Promise.all(initialCssNames.map((file) => measure(outputDirectory, file)));
  const ownerCss = await Promise.all(ownerCssNames.map((file) => measure(outputDirectory, file)));
  const files = await walk(outputDirectory);
  const allJavaScript = await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => measure(outputDirectory, file)));
  const coreJavaScript = allJavaScript.filter(({ file }) => !walletFiles.includes(file));
  const publicFiles = files.filter(publicAssetFile);
  const publicAssets = await Promise.all(publicFiles.map(async (file) => ({ file, raw: (await stat(resolve(outputDirectory, file))).size })));
  publicAssets.sort((left, right) => right.raw - left.raw || left.file.localeCompare(right.file));
  const lazyJavaScript = allJavaScript.filter(({ file }) => !initialFiles.has(file) && !ownerFiles.includes(file)
      && !walletFiles.includes(file))
    .sort((left, right) => right.raw - left.raw || left.file.localeCompare(right.file));
  const totals = {
    initialJavaScript: sum(initialJs), ownerJavaScript: sum(ownerJs), standaloneWalletJavaScript: sum(walletJs),
    initialCss: sum(initialCss), ownerCss: sum(ownerCss), coreJavaScript: sum(coreJavaScript),
    totalJavaScript: sum(allJavaScript), publicAssets: { raw: publicAssets.reduce((total, item) => total + item.raw, 0) },
    largestPublicAsset: { raw: publicAssets[0]?.raw || 0 }
  };
  return {
    version: 2, budgets, utilizationPercent: utilization(totals, budgets), totals,
    initialJavaScript: initialJs, ownerJavaScript: ownerJs, standaloneWalletJavaScript: walletJs,
    lazyJavaScript, initialCss, ownerCss,
    publicAssetCount: publicAssets.length, largestPublicAssets: publicAssets.slice(0, 10),
    chunkModuleGroups: chunkGroups, ownerRuntimeGraph
  };
}

function moduleGroup(id) {
  const normalized = normalize(id);
  const marker = '/node_modules/';
  if (normalized.includes(marker)) {
    const name = normalized.split(marker)[1].split('/');
    return `node_modules/${name[0].startsWith('@') ? `${name[0]}/${name[1]}` : name[0]}`;
  }
  const source = normalized.split('/src/')[1];
  return source ? `src/${source.split('/')[0]}` : 'other';
}

export function collectChunkModuleGroups(bundle) {
  return Object.fromEntries(Object.values(bundle).filter((output) => output.type === 'chunk')
    .sort((left, right) => left.fileName.localeCompare(right.fileName)).map((chunk) => {
      const groups = {};
      for (const [id, details] of Object.entries(chunk.modules)) {
        const group = moduleGroup(id);
        groups[group] = (groups[group] || 0) + (details.renderedLength || 0);
      }
      return [chunk.fileName, Object.entries(groups).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 8).map(([group, renderedBytes]) => ({ group, renderedBytes }))];
    }));
}

export function productionBuildHygienePlugin() {
  let outputDirectory; let chunkGroups = {};
  return {
    name: 'production-build-hygiene', apply: 'build',
    configResolved(config) { outputDirectory = resolveBuildOutputDirectory(config); },
    generateBundle(_options, bundle) { chunkGroups = collectChunkModuleGroups(bundle); },
    async closeBundle() {
      await assertNoProhibitedProductionArtifacts(outputDirectory);
      await pruneProductionAuthoringAssets(outputDirectory);
      await assertNoProhibitedProductionArtifacts(outputDirectory);
      const report = await analyzeProductionBuild(outputDirectory, { chunkGroups });
      await writeFile(resolve(outputDirectory, BUILD_REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`);
      checkProductionBudgets(report);
      console.log('Production budgets passed; owner and standalone wallet runtimes remain outside the initial entry.');
    }
  };
}

export function diagnosticsEnvironmentPlugin() {
  const selectedSource = readFileSync(resolve(process.cwd(), 'src/public/ownerRuntimeSelected.js'), 'utf8');
  const ownerRuntimeSelection = selectedSource.match(/OWNER_RUNTIME_SELECTION\s*=\s*'([^']+)'/u)?.[1];
  if (!['MODUL8R', 'LATTICE', 'LEGACY'].includes(ownerRuntimeSelection)) {
    throw new TypeError(`Unsupported owner runtime build selection: ${String(ownerRuntimeSelection)}`);
  }
  return {
    name: 'diagnostics-environment',
    config(_config, { command }) {
      const presentationFile = ownerRuntimeSelection === 'MODUL8R'
        ? 'ownerWorkspacePresentation.modul8r.js' : 'ownerWorkspacePresentation.lattice.js';
      return {
        resolve: { alias: { '#owner-workspace-presentation': resolve(process.cwd(), 'src/public', presentationFile) } },
        define: {
        __DEVELOPMENT_DIAGNOSTICS__: JSON.stringify(command === 'serve'),
        __OWNER_RUNTIME_SELECTION__: JSON.stringify(ownerRuntimeSelection),
        },
      };
    }
  };
}

export async function checkExistingBuild(outputDirectory) {
  const report = await analyzeProductionBuild(resolve(outputDirectory));
  checkProductionBudgets(report);
  return report;
}
