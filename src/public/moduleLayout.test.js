import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModuleGridGeometry,
  decodeModuleLayout,
  encodeModuleLayout,
  findNearestAvailableModulePosition,
  getDefaultModulePositions,
  getIdentitySpan,
  moduleRectsOverlap
} from './moduleLayout.js';

test('desktop module geometry aligns positions to a stable responsive cell grid', () => {
  const geometry = createModuleGridGeometry(1280, 720);
  const positions = getDefaultModulePositions(geometry);
  const identitySpan = getIdentitySpan(geometry);

  assert.equal(geometry.narrow, false);
  assert.ok(geometry.columns >= 7);
  assert.equal(moduleRectsOverlap(positions.identity, identitySpan, positions.collection, { columns: 1, rows: 1 }), false);
});

test('layout records are versioned, validated, clamped, and collision-safe', () => {
  const geometry = createModuleGridGeometry(1280, 720);
  const decoded = decodeModuleLayout(encodeModuleLayout({
    identity: { column: 1, row: 1 },
    collection: { column: 1, row: 1 },
    creations: { column: 200, row: 200 },
    signals: { column: 4, row: 2 }
  }), geometry);

  assert.notDeepEqual(decoded.identity, decoded.collection);
  assert.ok(decoded.creations.column < geometry.columns);
  assert.deepEqual(decodeModuleLayout('{bad json', geometry), getDefaultModulePositions(geometry));
});

test('expanded Identity finds the nearest free grid-aligned placement', () => {
  const geometry = createModuleGridGeometry(1280, 720);
  const positions = getDefaultModulePositions(geometry);
  const span = getIdentitySpan(geometry);
  const placement = findNearestAvailableModulePosition('identity', { column: 5, row: 4 }, span, positions, geometry);

  assert.ok(placement.column >= 0 && placement.row >= 0);
  assert.ok(placement.column + span.columns <= geometry.columns);
});

test('mobile ignores stored desktop coordinates and returns an ordered fallback', () => {
  const geometry = createModuleGridGeometry(390, 844);
  const positions = decodeModuleLayout(encodeModuleLayout({
    identity: { column: 8, row: 6 },
    collection: { column: 7, row: 5 },
    creations: { column: 6, row: 4 },
    signals: { column: 5, row: 3 }
  }), geometry);

  assert.equal(geometry.narrow, true);
  assert.deepEqual(positions, getDefaultModulePositions(geometry));
});
