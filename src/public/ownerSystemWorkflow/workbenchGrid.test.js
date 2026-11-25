import assert from 'node:assert/strict';
import test from 'node:test';
import { snapWorkbenchPosition } from './workbenchGrid.js';
import { normalizeWorkbenchPreferences } from './workbenchPreferences.js';


test('window movement shares the existing 24px grid and can bypass it without changing the source', () => {
  const position = { left: 109, top: 67 };
  assert.deepEqual(snapWorkbenchPosition(position, true), { left: 120, top: 72 });
  assert.deepEqual(snapWorkbenchPosition(position, false), position);
  assert.deepEqual(position, { left: 109, top: 67 });
});
test('existing snapping preferences remain authoritative; removed column mode falls back without resetting other settings', () => {
  const old = normalizeWorkbenchPreferences({ shortcutSnap: false, gridMode: 'DOTS', surfaceId: 'carbon' });
  assert.equal(old.shortcutSnap, false); assert.equal(old.gridMode, 'DOTS');
  const trial = normalizeWorkbenchPreferences({ shortcutSnap: true, gridMode: 'COLUMNS', surfaceId: 'carbon' });
  assert.equal(trial.gridMode, 'LINES'); assert.equal(Object.hasOwn(trial, 'surfaceId'), false);
});
