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
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|useWalletStore|profileDocument/);
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
