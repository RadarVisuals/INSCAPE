import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuntimeWindowState, loadRuntimeWindowState, runtimeWindowKey, updateRuntimeWindowState, windowZIndex } from './runtimeWindowState.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
test('runtime geometry, open state, and bounded deterministic stacking are independent state', () => {
  let state = createRuntimeWindowState();
  state = updateRuntimeWindowState(state, { type: 'open', id: 'identity' });
  state = updateRuntimeWindowState(state, { type: 'open', id: 'collection' });
  state = updateRuntimeWindowState(state, { type: 'geometry', id: 'identity', rect: { column: 2, row: 3, columnSpan: 10, rowSpan: 8 } });
  state = updateRuntimeWindowState(state, { type: 'focus', id: 'identity' });
  assert.deepEqual(state.openIds, ['identity', 'collection']);
  assert.deepEqual(state.zOrder, ['collection', 'identity']);
  assert.equal(windowZIndex(state, 'identity'), 21);
  assert.deepEqual(state.rects.identity, { column: 2, row: 3, columnSpan: 10, rowSpan: 8 });
});

test('runtime reset restores only supplied authored defaults and corrupt records recover', () => {
  const defaults = { openIds: ['signals'], zOrder: ['signals'], rects: { signals: { column: 1, row: 1, columnSpan: 9, rowSpan: 8 } } };
  assert.deepEqual(updateRuntimeWindowState({ openIds: ['identity'] }, { type: 'reset', initial: defaults }), { version: 1, ...defaults });
  const storage = { getItem: () => '{bad' };
  assert.deepEqual(loadRuntimeWindowState(storage, PROFILE), { version: 1, openIds: [], zOrder: [], rects: {} });
  assert.match(runtimeWindowKey(PROFILE), /runtime-windows\.v1/);
});
