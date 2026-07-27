import test from 'node:test';
import assert from 'node:assert/strict';

import {
  focusViewerDestination,
  focusedViewerRectangle,
  normalizeViewerRectangle,
  orderedFocusViewerEntries,
} from './latticeFocusViewer.js';

test('focused viewer preserves native presentation ratio and centers within safe viewport margins', () => {
  const origin = { left: 120, top: 80, width: 240, height: 360 };
  const focused = focusedViewerRectangle(origin, { width: 1440, height: 900 });
  assert.equal(focused.width / focused.height, origin.width / origin.height);
  assert.equal(focused.left + (focused.width / 2), 720);
  assert.equal(focused.top + (focused.height / 2), 450);
  assert.ok(focused.left >= 48);
  assert.ok(focused.top >= 40);
});

test('focused viewer refits deterministically for compact and iframe viewports', () => {
  const origin = { left: 10, top: 20, width: 640, height: 320 };
  const compact = focusedViewerRectangle(origin, { width: 480, height: 320 });
  assert.deepEqual(compact, { left: 48, top: 64, width: 384, height: 192 });
});

test('viewer rectangle validation rejects missing, non-finite and zero-sized geometry', () => {
  assert.throws(() => normalizeViewerRectangle(null), /required/);
  assert.throws(() => normalizeViewerRectangle({ left: 0, top: 0, width: 0, height: 1 }), /positive/);
  assert.throws(() => normalizeViewerRectangle({ left: NaN, top: 0, width: 1, height: 1 }), /finite/);
});

const entry = (id, navigationOrder, layer, stableAssetId = `asset:${id}`) => ({
  placement: { id, navigationOrder, layer, stableAssetId },
});

test('viewer sequence is controlled only by navigationOrder and never by visual layer', () => {
  const entries = [entry('third', 2, 0), entry('first', 0, 99), entry('second', 1, 4)];
  assert.deepEqual(orderedFocusViewerEntries(entries).map(({ placement }) => placement.id), ['first', 'second', 'third']);
  entries[0].placement.layer = 200;
  entries[1].placement.layer = -10;
  assert.deepEqual(orderedFocusViewerEntries(entries).map(({ placement }) => placement.id), ['first', 'second', 'third']);
});

test('viewer navigation wraps in both directions and keeps repeated assets as distinct placements', () => {
  const entries = [entry('first', 0, 0, 'same'), entry('second', 1, 1, 'same'), entry('third', 2, 2)];
  assert.equal(focusViewerDestination(entries, 'first', -1).placement.id, 'third');
  assert.equal(focusViewerDestination(entries, 'third', 1).placement.id, 'first');
  assert.equal(focusViewerDestination(entries, 'first', 1).placement.id, 'second');
});

test('viewer navigation rejects ambiguous directions and missing current placements', () => {
  const entries = [entry('first', 0, 0)];
  assert.throws(() => focusViewerDestination(entries, 'first', 0), /direction/);
  assert.throws(() => focusViewerDestination(entries, 'missing', 1), /not present/);
});
