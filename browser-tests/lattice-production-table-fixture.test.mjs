import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import test from 'node:test';

const fixture = resolve('browser-tests/lattice-production-table-fixture.jsx');

function moduleGraph(start) {
  const visited = new Set();
  const visit = (file) => {
    const absolute = resolve(file);
    if (visited.has(absolute)) return;
    visited.add(absolute);
    const source = readFileSync(absolute, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/gu)) {
      if (extname(match[1]) === '.css') continue;
      visit(resolve(dirname(absolute), match[1]));
    }
  };
  visit(start);
  return [...visited].map((file) => file.replaceAll('\\', '/'));
}

test('Phase 3 visual fixture remains browser-test-only and free of owner/runtime authority dependencies', () => {
  const html = readFileSync(resolve('browser-tests/lattice-production-table-fixture.html'), 'utf8');
  const source = readFileSync(fixture, 'utf8');
  const browserComparison = readFileSync(resolve('browser-tests/lattice-production-table.browser.mjs'), 'utf8');
  const graph = moduleGraph(fixture);
  const joined = graph.join('\n');
  assert.match(html, /\/browser-tests\/lattice-production-table-fixture\.jsx/);
  assert.match(source, /LatticeProductionTableRenderer/);
  assert.match(source, /projectLatticeProductionPublication/);
  assert.match(source, /<iframe[^>]*embed=wide/);
  assert.match(source, /<iframe[^>]*embed=tall/);
  for (const contractCase of [
    'phase3-transparent', 'phase3-crop', 'phase3-backed', 'phase3-opaque-fallback',
    'phase3-auto-loading', 'phase3-failed', 'phase3-unsupported',
  ]) assert.match(source, new RegExp(contractCase));
  assert.match(browserComparison, /dataMediaState|data-media-state|dataset\.mediaState/u);
  assert.match(browserComparison, /cornerAlpha/u);
  assert.match(browserComparison, /Access-Control-Allow-Origin/u);
  assert.doesNotMatch(browserComparison, /page\.screenshot|toHaveScreenshot/u);
  assert.match(browserComparison, /interactiveMode = process\.argv\.includes\('--visual'\)/u);
  assert.match(browserComparison, /headless: false/u);
  assert.match(browserComparison, /127\.0\.0\.1:\$\{interactivePort\}/u);
  assert.match(browserComparison, /Press Ctrl\+C/u);
  for (const forbidden of [
    '/src/public/ModuleGridShell.jsx', '/src/library/state/', '/src/signals/state/',
    '/src/lattice/storage/', 'Reconciliation', '/src/wallet/', 'profileDocumentPublisher',
    'profileDocumentUploadClient', 'LatticeEnginePrototype', '/src/lattice/prototype/',
    '/src/lattice/controller/',
  ]) assert.doesNotMatch(joined, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'iu'));
  const unexpectedGraphEntries = graph.filter((file) => !(file.includes('/browser-tests/') || file.includes('/src/lattice/domain/')
    || file.includes('/src/lattice/rendering/') || file.includes('/src/profileDocument/domain/')
    || file.endsWith('/src/lattice/authoring/latticeProductionTransform.js')
    || file.endsWith('/src/lattice/authoring/latticeProductionRemoval.js')
    || file.endsWith('/src/library/config.js')));
  assert.deepEqual(unexpectedGraphEntries, []);
});
