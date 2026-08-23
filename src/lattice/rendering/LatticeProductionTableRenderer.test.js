import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import test from 'node:test';

const entry = new URL('./LatticeProductionTableRenderer.jsx', import.meta.url);
const source = readFileSync(entry, 'utf8');
const styles = readFileSync(new URL('./latticeProductionTableRenderer.css', import.meta.url), 'utf8');

function visitorGraph(start) {
  const visited = new Set();
  const visit = (url) => {
    const file = url.pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));
    const normalized = decodeURIComponent(file).replaceAll('/', process.platform === 'win32' ? '\\' : '/');
    const absolute = resolve(normalized);
    if (visited.has(absolute)) return;
    visited.add(absolute);
    const text = readFileSync(absolute, 'utf8');
    for (const match of text.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/gu)) {
      const requested = match[1];
      if (extname(requested) === '.css') continue;
      const candidate = resolve(dirname(absolute), requested);
      visit(new URL(`file:///${candidate.replaceAll('\\', '/')}`));
    }
  };
  visit(start);
  return [...visited].map((file) => file.replaceAll('\\', '/'));
}

test('renderer preserves semantic frame, order, media safety, resize projection and optional decoded activation', () => {
  assert.match(source, /createLatticeProductionTableRenderModel/);
  assert.match(source, /createLatticeProductionLayerRanks/);
  assert.match(source, /ResizeObserver/);
  assert.match(source, /table\.placements\.map/);
  assert.match(source, /zIndex: layerRank/);
  assert.match(source, /data-frame-id=\{placement\.frameId\}/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.match(source, /imageLoading = 'lazy'/);
  assert.match(source, /loading=\{imageLoading\}/);
  assert.match(source, /Artwork unavailable/);
  assert.match(source, /event\.key !== 'Enter'/);
  assert.match(source, /loaded && dimensions/);
  assert.match(source, /const decodedDimensions = [^;]+loadState\.dimensions/);
  assert.match(source, /const dimensions = decodedDimensions \|\| media\.dimensions/);
  assert.doesNotMatch(source, /onAuthor|wallet|localStorage|sessionStorage|indexedDB|fetch\(/iu);
});

test('only eager media receives bounded automatic retries and cannot remain loading forever', () => {
  assert.match(source, /LATTICE_PRODUCTION_EAGER_MEDIA_ATTEMPTS = 3/);
  assert.match(source, /imageLoading !== 'eager'/);
  assert.match(source, /current\.attempt \+ 1 < LATTICE_PRODUCTION_EAGER_MEDIA_ATTEMPTS/);
  assert.match(source, /\{ \.\.\.current, status: 'failed', dimensions: null \}/);
  assert.match(source, /key=\{`\$\{media\.src\}:\$\{loadState\.attempt\}`\}/);
});

test('authored boundary is invisible and the atmospheric grid shares its exact projected origin and cell size', () => {
  assert.match(source, /'--lattice-production-cell-size': `\$\{projected\.cellSize\}px`/);
  assert.match(source, /'--lattice-production-grid-origin-x': `\$\{projected\.left\}px`/);
  assert.match(source, /'--lattice-production-grid-origin-y': `\$\{projected\.top\}px`/);
  assert.match(styles, /data-guide-mode="LINES"[^}]*background-image: none/s);
  assert.match(styles, /data-guide-mode="DOTS"[^}]*background-image: none/s);
  const planeRule = styles.match(/\.lattice-production-table__authored-plane\s*\{([^}]*)\}/su)?.[1] || '';
  assert.doesNotMatch(planeRule, /border|outline|background|box-shadow/iu);
  assert.match(styles, /\.lattice-production-placement__opening\s*\{[^}]*overflow: hidden;/su);
  assert.doesNotMatch(styles, /transition|animation/iu);
});

test('transitive visitor renderer graph excludes owner, persistence, reconciliation, wallet, publication writers and prototype fixtures', () => {
  const graph = visitorGraph(entry);
  const joined = graph.join('\n');
  for (const forbidden of [
    '/src/public/OwnerSystemWorkflowShell.jsx', '/src/library/state/', '/src/signals/state/',
    '/src/lattice/storage/', 'Reconciliation', '/src/wallet/', 'profileDocumentPublisher',
    'profileDocumentUploadClient', 'LatticeEnginePrototype', '/src/lattice/prototype/',
    '/src/lattice/controller/',
  ]) assert.doesNotMatch(joined, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'iu'));
  assert.ok(graph.some((file) => file.endsWith('/latticeProductionPublication.js')));
  assert.ok(graph.some((file) => file.endsWith('/publishedAssetUrl.js')));
});
