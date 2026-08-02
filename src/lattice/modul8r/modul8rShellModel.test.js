import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODUL8R_MODULE_ORDER,
  createModul8rShellState,
  toggleModul8rMaster,
  toggleModul8rModule,
} from './modul8rShellModel.js';

test('MODUL-8R shell model freezes the accepted module order and one-open invariant', () => {
  assert.deepEqual(MODUL8R_MODULE_ORDER, ['library', 'activity', 'people', 'layers']);
  let state = createModul8rShellState();
  assert.deepEqual(state, { masterExpanded: true, openModule: 'library' });
  state = toggleModul8rModule(state, 'activity');
  assert.equal(state.openModule, 'activity');
  state = toggleModul8rModule(state, 'activity');
  assert.equal(state.openModule, null);
  state = toggleModul8rModule(state, 'layers');
  assert.equal(state.openModule, 'layers');
  assert.equal(Object.isFrozen(state), true);
});

test('master collapse retains the exact open module and invalid module requests are inert', () => {
  const openPeople = createModul8rShellState({ openModule: 'people' });
  const collapsed = toggleModul8rMaster(openPeople);
  assert.deepEqual(collapsed, { masterExpanded: false, openModule: 'people' });
  assert.deepEqual(toggleModul8rMaster(collapsed), openPeople);
  assert.equal(toggleModul8rModule(openPeople, 'settings'), openPeople);
  assert.throws(() => createModul8rShellState({ openModule: 'settings' }), /Unknown MODUL-8R module/);
});
