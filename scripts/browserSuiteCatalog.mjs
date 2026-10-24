import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await loadBrowserSuiteCatalog(resolve(import.meta.dirname, '..'));
  const counts = Object.fromEntries(categories.map(category => [category, catalog.suites.filter(suite => suite.category === category).length]));
  console.log(JSON.stringify({ suites: catalog.suites.length, ...counts }));
}
