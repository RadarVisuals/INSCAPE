import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import timings from './browserSuiteTimings.json' with { type: 'json' };
import { BROWSER_SHARDS } from './verificationPlan.mjs';

const categories = ['release', 'targeted', 'performance', 'historical_candidate'];
const validName = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;

export function validateBrowserSuiteCatalog(catalog, availableNames) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.suites)) {
    throw Error('Browser suite catalog requires schemaVersion 1 and a suites array');
  }
  const available = new Set(availableNames);
  const seen = new Set();
  for (const suite of catalog.suites) {
    if (!suite || !validName.test(suite.name || '')) throw Error(`Invalid browser suite name: ${suite?.name}`);
    if (seen.has(suite.name)) throw Error(`Duplicate browser suite: ${suite.name}`);
    seen.add(suite.name);
    if (!available.has(suite.name)) throw Error(`Catalog suite has no browser test file: ${suite.name}`);
    if (!categories.includes(suite.category)) throw Error(`Unclassified browser suite: ${suite.name}`);
    if (typeof suite.rationale !== 'string' || !suite.rationale.trim()) {
      throw Error(`Browser suite requires a classification rationale: ${suite.name}`);
    }
  }
  const missing = [...available].filter(name => !seen.has(name));
  if (missing.length) throw Error(`Browser suites missing from catalog: ${missing.join(', ')}`);
  if (!catalog.suites.some(suite => suite.category === 'release')) throw Error('Browser catalog has no release suites');
  return catalog;
}

export async function loadBrowserSuiteCatalog(root) {
  const catalog = JSON.parse(await readFile(resolve(root, 'scripts/browserSuites.json'), 'utf8'));
  const files = await readdir(resolve(root, 'browser-tests'), { withFileTypes: true });
  const names = files.filter(file => file.isFile() && file.name.endsWith('.browser.mjs'))
    .map(file => file.name.slice(0, -'.browser.mjs'.length));
  return validateBrowserSuiteCatalog(catalog, names);
}

export function selectBrowserSuites(catalog, requested = []) {
  if (!requested.length) return catalog.suites.filter(suite => suite.category === 'release').map(suite => suite.name);
  const available = new Set(catalog.suites.map(suite => suite.name));
  const selected = new Set();
  for (const name of requested) {
    if (!validName.test(name) || !available.has(name)) throw Error(`Unknown browser suite: ${name}`);
    if (selected.has(name)) throw Error(`Duplicate requested browser suite: ${name}`);
    selected.add(name);
  }
  return [...selected];
}

export function browserShards(catalog, count = BROWSER_SHARDS, weights = timings) {
  if (!Number.isInteger(count) || count < 1) throw Error('Invalid shard count');
  const names = selectBrowserSuites(catalog);
  if (count > names.length) throw Error('Shards must not be empty');
  const weight = name => weights.seconds[name] ?? weights.unknownSeconds;
  if (names.some(name => !Number.isFinite(weight(name)) || weight(name) <= 0)) throw Error('Invalid suite scheduling weight');
  const shards = Array.from({ length: count }, (_, index) => ({ index: index + 1, total: count, suites: [], estimatedSeconds: 0 }));
  for (const name of [...names].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b, 'en'))) {
    const shard = [...shards].sort((a, b) => a.estimatedSeconds - b.estimatedSeconds || a.suites.length - b.suites.length || a.index - b.index)[0];
    shard.suites.push(name); shard.estimatedSeconds += weight(name);
  }
  return shards;
}

export function browserSelection(catalog, args = []) {
  if (args.some(arg => arg.startsWith('--'))) {
    const match = args.length === 1 && args[0].match(/^--shard=(\d+)\/(\d+)$/u);
    if (!match || Number(match[2]) !== BROWSER_SHARDS) throw Error(`Use --shard=1/${BROWSER_SHARDS} through --shard=${BROWSER_SHARDS}/${BROWSER_SHARDS}`);
    const shard = browserShards(catalog)[Number(match[1]) - 1];
    if (!shard) throw Error('Unknown browser shard');
    return { mode: 'shard', suites: shard.suites, shard: { index: shard.index, total: shard.total }, estimatedSeconds: shard.estimatedSeconds };
  }
  return { mode: args.length ? 'explicit' : 'release', suites: selectBrowserSuites(catalog, args) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await loadBrowserSuiteCatalog(resolve(import.meta.dirname, '..'));
  const counts = Object.fromEntries(categories.map(category => [category, catalog.suites.filter(suite => suite.category === category).length]));
  console.log(JSON.stringify({ suites: catalog.suites.length, ...counts }));
}
