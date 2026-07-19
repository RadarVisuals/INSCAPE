import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModuleGridGeometry,
  clampModulePosition,
  decodeModuleLayout,
  decodeWindowGeometry,
  encodeModuleLayout,
  encodeWindowGeometry,
  findNearestAvailableModulePosition,
  getCanvasSpaceSpan,
  getDefaultModulePositions,
  getCollectionSpan,
  getIdentitySpan,
  moduleRectsOverlap
} from './moduleLayout.js';

test('desktop windows retain intentional usable defaults on the square grid',()=>{const geometry=createModuleGridGeometry(1440,900);const identity=getIdentitySpan(geometry);const collection=getCollectionSpan(geometry);assert.ok(identity.columns*geometry.cellWidth>=600);assert.ok(identity.rows*geometry.cellHeight>=380);assert.ok(collection.columns*geometry.cellWidth>=760);});

test('window geometry persists, clamps, and corrupt records reset safely',()=>{const geometry=createModuleGridGeometry(1280,720);const encoded=encodeWindowGeometry({identity:{columns:999,rows:1},signals:{columns:8,rows:6}});const decoded=decodeWindowGeometry(encoded,geometry);assert.equal(decoded.identity.columns,geometry.columns);assert.equal(decoded.identity.rows,5);assert.deepEqual(decoded.signals,{columns:8,rows:6});assert.deepEqual(decodeWindowGeometry('{bad',geometry),{});});
test('resized window span survives move and a later resize from the moved origin',()=>{const geometry=createModuleGridGeometry(1440,900);const resized={columns:12,rows:8};const stored=decodeWindowGeometry(encodeWindowGeometry({identity:resized}),geometry).identity;const moved=clampModulePosition({column:20,row:20},stored,geometry);assert.deepEqual(stored,resized);assert.deepEqual(moved,{column:geometry.columns-resized.columns,row:geometry.rows-resized.rows});const resizedAgain={columns:10,rows:7};assert.deepEqual(decodeWindowGeometry(encodeWindowGeometry({identity:resizedAgain}),geometry).identity,resizedAgain);});

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

test('expanded Collection has a bounded desktop and full mobile span', () => {
  const desktop = createModuleGridGeometry(1280, 720);
  const desktopSpan = getCollectionSpan(desktop);
  assert.ok(desktopSpan.columns <= desktop.columns && desktopSpan.rows <= desktop.rows);
  const shortDesktop = createModuleGridGeometry(900, 360);
  assert.ok(getCollectionSpan(shortDesktop).rows <= shortDesktop.rows);
  const mobile = createModuleGridGeometry(390, 844);
  assert.deepEqual(getCollectionSpan(mobile), { columns: mobile.columns, rows: mobile.rows });
  assert.deepEqual(getCanvasSpaceSpan(mobile), { columns: mobile.columns, rows: mobile.rows });
  const folderSpan = getCanvasSpaceSpan(desktop);
  assert.ok(folderSpan.columns <= desktop.columns && folderSpan.rows <= desktop.rows);
});

test('custom launcher IDs participate in collision-safe placement', () => {
  const geometry = createModuleGridGeometry(1280, 720);
  const positions = { ...getDefaultModulePositions(geometry), 'library:folder:first': { column: 2, row: 2 } };
  const placement = findNearestAvailableModulePosition('library:folder:second', { column: 2, row: 2 }, { columns: 1, rows: 1 }, positions, geometry);
  assert.notDeepEqual(placement, positions['library:folder:first']);
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
