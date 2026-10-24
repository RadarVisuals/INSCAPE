import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrowserSuiteCatalog, selectBrowserSuites, loadBrowserSuiteCatalog } from './browserSuiteCatalog.mjs';
import { resolve } from 'node:path';

const suite = (name, category = 'release') => ({ name, category, rationale: `Coverage for ${name}` });
const catalog = (...suites) => ({ schemaVersion: 1, suites });

test('behavioral replacements for standard owner contracts remain in the release gate', async () => {
  const value = await loadBrowserSuiteCatalog(resolve(import.meta.dirname, '..'));
  assert.ok(selectBrowserSuites(value).includes('owner-workflow-contracts'),
    'owner-workflow-contracts replaces standard checks and must run in the default release gate');
});

test('a new browser suite cannot silently stay outside the catalog', () => {
  assert.throws(() => validateBrowserSuiteCatalog(catalog(suite('existing')), ['existing', 'new-workflow']), /missing from catalog: new-workflow/);
});

test('removed files, duplicates, unclassified entries and empty explanations fail validation', () => {
  const cases = [
    [catalog(suite('missing')), [], /no browser test file/],
    [catalog(suite('one'), suite('one')), ['one'], /Duplicate browser suite/],
    [catalog(suite('one', 'pending_review')), ['one'], /Unclassified browser suite/],
    [catalog({ ...suite('one'), rationale: '  ' }), ['one'], /requires a classification rationale/],
    [catalog(suite('one', 'targeted')), ['one'], /no release suites/],
    [{ schemaVersion: 2, suites: [] }, [], /schemaVersion 1/],
  ];
  for (const [value, files, error] of cases) assert.throws(() => validateBrowserSuiteCatalog(value, files), error);
});

test('release selection preserves catalog order; all other classifications remain explicitly runnable', () => {
  const value = catalog(suite('second'), suite('focused', 'targeted'), suite('first'),
    suite('benchmark', 'performance'), suite('older_case', 'historical_candidate'), suite('mini-apps.production', 'targeted'));
  validateBrowserSuiteCatalog(value, value.suites.map(entry => entry.name));
  assert.deepEqual(selectBrowserSuites(value), ['second', 'first']);
  assert.deepEqual(selectBrowserSuites(value, ['older_case', 'benchmark', 'focused', 'mini-apps.production']), ['older_case', 'benchmark', 'focused', 'mini-apps.production']);
});

test('explicit selection rejects unknown names, duplicate runs and paths before starting a browser', () => {
  const value = catalog(suite('known'));
  for (const name of ['unknown', '../known', '/known', 'known.browser.mjs', '']) {
    assert.throws(() => selectBrowserSuites(value, [name]), /Unknown browser suite/);
  }
  assert.throws(() => selectBrowserSuites(value, ['known', 'known']), /Duplicate requested/);
  for (const name of ['../known', '/known', 'known..other', 'known/other']) {
    assert.throws(() => validateBrowserSuiteCatalog(catalog(suite(name)), [name]), /Invalid browser suite name/);
  }
});
