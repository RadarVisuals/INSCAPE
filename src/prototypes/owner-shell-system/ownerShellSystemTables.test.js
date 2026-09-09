import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOwnerShellSystemTable,
  moveOwnerShellSystemTable,
  placeOwnerShellSystemTable,
  removeOwnerShellSystemTable,
  updateOwnerShellSystemTable,
} from './ownerShellSystemTables.js';

const tables = Object.freeze([
  { id: 'home', name: 'HOME', public: true },
  { id: 'grid-2', name: 'GRID 02', public: false },
  { id: 'grid-3', name: 'GRID 03', public: false },
]);

test('new table identity is derived from the current table count', () => {
  assert.deepEqual(createOwnerShellSystemTable(tables, 42), { id: 'table-42', name: 'TABLE 04', public: false });
});

test('table updates preserve every unrelated table', () => {
  const updated = updateOwnerShellSystemTable(tables, 'grid-2', { name: 'ARCHIVE', public: true });
  assert.deepEqual(updated[1], { id: 'grid-2', name: 'ARCHIVE', public: true });
  assert.equal(updated[0], tables[0]);
  assert.equal(updated[2], tables[2]);
});

test('removing an active table selects its nearest surviving neighbor', () => {
  assert.deepEqual(removeOwnerShellSystemTable(tables, 'grid-2', 'grid-2'), {
    activeTableId: 'grid-3', focusTableId: 'grid-3', removed: true, tables: [tables[0], tables[2]],
  });
  assert.equal(removeOwnerShellSystemTable([tables[0]], 'home', 'home').removed, false);
});

test('table ordering moves stable identities without changing their contents', () => {
  assert.deepEqual(moveOwnerShellSystemTable(tables, 'grid-3', 0).map(({ id }) => id), ['grid-3', 'home', 'grid-2']);
  assert.deepEqual(moveOwnerShellSystemTable(tables, 'home', 99).map(({ id }) => id), ['grid-2', 'grid-3', 'home']);
  assert.equal(moveOwnerShellSystemTable(tables, 'missing', 0), tables);
});

test('drop placement supports before and after insertion without changing table IDs', () => {
  assert.deepEqual(placeOwnerShellSystemTable(tables, 'grid-3', 'home', 'before').map(({ id }) => id), ['grid-3', 'home', 'grid-2']);
  assert.deepEqual(placeOwnerShellSystemTable(tables, 'home', 'grid-2', 'after').map(({ id }) => id), ['grid-2', 'home', 'grid-3']);
  assert.equal(placeOwnerShellSystemTable(tables, 'home', 'home', 'before'), tables);
});
