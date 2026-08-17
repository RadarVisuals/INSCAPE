import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('table lifecycle and transient actions are isolated behind one controller', async () => {
  const [controller, parent] = await Promise.all([
    read('./useOwnerShellSystemTables.js'),
    read('./OwnerShellSystemPrototype.jsx'),
  ]);
  assert.match(parent, /useOwnerShellSystemTables/);
  assert.doesNotMatch(parent, /\b(?:setTables|setActiveTableId|setTableActionId|setTableRename|setTableDeleteId)\b/);
  assert.match(controller, /createOwnerShellSystemTable/);
  assert.match(controller, /removeOwnerShellSystemTable/);
  assert.match(controller, /placeOwnerShellSystemTable/);
  assert.match(controller, /moveOwnerShellSystemTable/);
  assert.match(controller, /cancelTransientAction/);
  assert.match(controller, /setPlacements\(\(current\) => current\.filter/);
});
