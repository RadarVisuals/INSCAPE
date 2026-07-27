import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LatticeTableRenderer.jsx', import.meta.url), 'utf8');
const gridPlane = readFileSync(new URL('./LatticeGridPlane.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeTableRenderer.css', import.meta.url), 'utf8');

test('shared table renderer uses the lattice contract without owner or persistence dependencies', () => {
  assert.match(source, /tableDisplayTitle/);
  assert.match(source, /TABLE_VISIBILITY\.PRIVATE/);
  assert.match(source, /projectCanonicalLatticeArtboard/);
  assert.match(source, /projectTableLabelPosition/);
  assert.doesNotMatch(source, /useWalletStore|useLibraryStore|localStorage|sessionStorage|indexedDB|profileDocument|onPointer/);
});

test('one shared grid plane replaces visible boundaries between transparent tables', () => {
  assert.match(gridPlane, /semanticGridVariables/);
  assert.match(gridPlane, /normalizeLatticeSurface/);
  assert.equal((styles.match(/linear-gradient\(/g) || []).length, 2);
  assert.match(styles, /var\(--lattice-grid-cell-size\) var\(--lattice-grid-cell-size\)/);
  assert.match(styles, /var\(--lattice-grid-origin-x\) var\(--lattice-grid-origin-y\)/);
  const authoredFieldRule = styles.match(/\.lattice-table-renderer__authored-field\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(authoredFieldRule, /^\s*(border|outline|background|box-shadow)\s*:/mu);
  const tableRule = styles.match(/\.lattice-table-renderer\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(tableRule, /^\s*(border|outline|background|box-shadow)\s*:/mu);
  assert.doesNotMatch(styles, /outline|box-shadow/);
});
