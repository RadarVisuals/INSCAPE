import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('./LatticeEnginePrototype.jsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('./lattice/controller/latticeNavigation.js', import.meta.url), 'utf8');

test('lattice engine harness is a development-only lazy route backed by the Slice 1A topology', () => {
  assert.match(entry, /import\.meta\.env\.DEV && prototypePath === '\/prototype\/lattice-engine'/);
  assert.match(entry, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/LatticeEnginePrototype\.jsx'\)\)/);
  assert.match(source, /LATTICE_COORDINATES/);
  assert.match(source, /latticeTableFallbackTitle/);
  assert.match(source, /LatticeTableRenderer/);
  assert.match(source, /LatticeGridPlane/);
  assert.match(source, /FREE-ARTBOARD FOUNDATION/);
  assert.match(source, /createFixturePlacements/);
  assert.match(source, /assetsByStableId=\{FIXTURE_MEDIA\}/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|useWalletStore|profileDocument/);
});

test('Phase 2 fixture composition belongs permanently to the authored center table', () => {
  assert.match(source, /isAuthoredTable = coordinate\.x === 0 && coordinate\.y === 0/);
  assert.match(source, /placements: isAuthoredTable/);
  assert.doesNotMatch(source, /placements: isActive/);
  assert.match(source, /TRANSPARENCY_MODES\.AUTO/);
  assert.match(source, /TRANSPARENCY_MODES\.PRESERVE_ALPHA/);
  assert.match(source, /Object\.values\(TRANSPARENCY_MODES\)/);
  assert.doesNotMatch(source, /crop:\s*\{/);
});

test('renderer controls exercise geometry and label contract values without persistence', () => {
  for (const token of [
    'LATTICE_GEOMETRY_PRESETS',
    'PROTOTYPE_START_GEOMETRY',
    'LATTICE_SURFACES',
    'TABLE_LABEL_ANCHORS',
    'labelVisible',
    'labelOffset',
    'RESET RENDER',
  ]) assert.match(source, new RegExp(token));
  assert.doesNotMatch(source, /IDENTITY|COLLECTIONS|ARCHIVE|DROPS|CURATED/);
});

test('prototype uses the canonical artboard and normalized free-placement bounds', () => {
  assert.match(source, /CANONICAL_LATTICE_ARTBOARD/);
  assert.match(source, /x: 0\.46, y: 0\.13, width: 0\.4, height: 0\.4 \* \(16 \/ 9\) \* \(2000 \/ 4636\)/);
  assert.doesNotMatch(source, /scaledFixturePlacement|columnSpan|rowSpan/);
});

test('all tunable interaction behavior lives in one transient configuration object', () => {
  for (const field of [
    'deadZone',
    'commitThreshold',
    'diagonalTolerance',
    'edgeResistance',
    'wheelAccumulationThreshold',
    'wheelCooldown',
    'snapDuration',
  ]) {
    assert.match(controller, new RegExp(`${field}:`));
    assert.match(source, new RegExp(`'${field}'`));
  }
  assert.doesNotMatch(controller, /velocity|inertia|friction|spring/iu);
});
