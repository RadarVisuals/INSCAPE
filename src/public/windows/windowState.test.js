import assert from 'node:assert/strict';
import test from 'node:test';
import { initialWindowState, publicWindowReducer } from './windowState.js';

test('public windows open, focus, and close with the active window on top', () => {
  let state = publicWindowReducer(initialWindowState, { type: 'open', id: 'identity' });
  assert.deepEqual(state, { openIds: ['identity'], activeId: 'identity' });

  state = publicWindowReducer(state, { type: 'open', id: 'signals' });
  assert.deepEqual(state, { openIds: ['identity', 'signals'], activeId: 'signals' });

  state = publicWindowReducer(state, { type: 'focus', id: 'identity' });
  assert.deepEqual(state, { openIds: ['signals', 'identity'], activeId: 'identity' });

  state = publicWindowReducer(state, { type: 'close', id: 'identity' });
  assert.deepEqual(state, { openIds: ['signals'], activeId: 'signals' });

  state = publicWindowReducer(state, { type: 'close', id: 'signals' });
  assert.deepEqual(state, { openIds: [], activeId: null });
});

test('opening an existing window brings it forward without duplication', () => {
  const state = { openIds: ['identity', 'collection', 'signals'], activeId: 'signals' };
  const next = publicWindowReducer(state, { type: 'open', id: 'collection' });

  assert.deepEqual(next, {
    openIds: ['identity', 'signals', 'collection'],
    activeId: 'collection'
  });
});

test('unknown public window actions do not mutate shell state', () => {
  const state = { openIds: ['identity'], activeId: 'identity' };
  assert.equal(publicWindowReducer(state, { type: 'open', id: 'editor' }), state);
  assert.equal(publicWindowReducer(state, { type: 'close', id: 'signals' }), state);
});
