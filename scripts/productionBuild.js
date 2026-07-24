import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
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
  'assets/manifest.json',
  'assets/actors/abyssal_eye/full multi eye purple.afdesign',
  'assets/actors/skull_reaper/position.afdesign'
]);

// Phase 1C2H baseline, recalibrated for the approved Gallery and hybrid Index runtime.
// Keep these byte limits deterministic and deliberately close to the measured build.
export const PRODUCTION_BUDGETS = Object.freeze({
  initialJavaScript: Object.freeze({ raw: 1_250_000, gzip: 365_000 }),
  ownerJavaScript: Object.freeze({ raw: 220_000, gzip: 63_000 }),
  initialCss: Object.freeze({ raw: 117_000, gzip: 20_000 }),
  ownerCss: Object.freeze({ raw: 31_000, gzip: 6_300 }),
  totalJavaScript: Object.freeze({ raw: 1_820_000, gzip: 533_000 }),
  publicAssets: Object.freeze({ raw: 15_000_000 }),
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

export async function pruneProductionAuthoringAssets(outputDirectory) {
  await Promise.all(UNUSED_PUBLIC_PATHS.map((path) => rm(resolve(outputDirectory, path), { recursive: true, force: true })));
}

async function walk(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const values = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? walk(resolve(directory, entry.name), root)
    : normalize(relative(root, resolve(directory, entry.name)))));
  return values.flat().sort();
}

function manifestClosure(manifest, entryKey) {
  const keys = new Set();
  const visit = (key) => {
    if (keys.has(key)) return;
    const record = manifest[key];
    if (!record) throw new Error(`Vite manifest references missing entry: ${key}`);
    keys.add(key);
    for (const imported of record.imports || []) visit(imported);
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
  const key = Object.keys(manifest).find((candidate) => normalize(candidate).endsWith('/src/public/ModuleGridShell.jsx')
    || normalize(candidate) === 'src/public/ModuleGridShell.jsx');
  if (!key) throw new Error('Vite manifest is missing the owner ModuleGridShell dynamic entry');
  return key;
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
  const initialFiles = new Set([...initialKeys].map((key) => manifest[key].file));
  const ownerFiles = [...ownerKeys].map((key) => manifest[key].file).filter((file) => !initialFiles.has(file));
  const initialJs = await Promise.all([...initialFiles].sort().map((file) => measure(outputDirectory, file)));
  const ownerJs = await Promise.all(ownerFiles.sort().map((file) => measure(outputDirectory, file)));
  const initialCssNames = cssFiles(manifest, initialKeys);
  const ownerCssNames = cssFiles(manifest, ownerKeys).filter((file) => !initialCssNames.includes(file));
  const initialCss = await Promise.all(initialCssNames.map((file) => measure(outputDirectory, file)));
  const ownerCss = await Promise.all(ownerCssNames.map((file) => measure(outputDirectory, file)));
  const files = await walk(outputDirectory);
  const allJavaScript = await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => measure(outputDirectory, file)));
  const publicFiles = files.filter(publicAssetFile);
  const publicAssets = await Promise.all(publicFiles.map(async (file) => ({ file, raw: (await stat(resolve(outputDirectory, file))).size })));
  publicAssets.sort((left, right) => right.raw - left.raw || left.file.localeCompare(right.file));
  const lazyJavaScript = allJavaScript.filter(({ file }) => !initialFiles.has(file) && !ownerFiles.includes(file))
    .sort((left, right) => right.raw - left.raw || left.file.localeCompare(right.file));
  const totals = {
    initialJavaScript: sum(initialJs), ownerJavaScript: sum(ownerJs), initialCss: sum(initialCss), ownerCss: sum(ownerCss),
    totalJavaScript: sum(allJavaScript), publicAssets: { raw: publicAssets.reduce((total, item) => total + item.raw, 0) },
    largestPublicAsset: { raw: publicAssets[0]?.raw || 0 }
  };
  return {
    version: 1, budgets, utilizationPercent: utilization(totals, budgets), totals,
    initialJavaScript: initialJs, ownerJavaScript: ownerJs, lazyJavaScript, initialCss, ownerCss,
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
      await pruneProductionAuthoringAssets(outputDirectory);
      const report = await analyzeProductionBuild(outputDirectory, { chunkGroups });
      await writeFile(resolve(outputDirectory, BUILD_REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`);
      checkProductionBudgets(report);
      console.log('Production budgets passed; owner runtime remains outside the initial entry.');
    }
  };
}

export function diagnosticsEnvironmentPlugin() {
  return {
    name: 'diagnostics-environment',
    config(_config, { command }) {
      return { define: { __DEVELOPMENT_DIAGNOSTICS__: JSON.stringify(command === 'serve') } };
    }
  };
}

export async function checkExistingBuild(outputDirectory) {
  const report = await analyzeProductionBuild(resolve(outputDirectory));
  checkProductionBudgets(report);
  return report;
}
