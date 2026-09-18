import test from 'node:test';
import assert from 'node:assert/strict';
import { textRecoveryScope, retainTextRecovery, readTextRecovery, clearTextRecovery, textRecoveries, subscribeTextRecovery } from './textEditRecovery.js';
test('failed edits survive editor disposal, stay profile/module scoped, and clear only after a confirmed save', () => {
  const profile = 'profile:a', store = { getProfileAddress: () => profile };
  const scope = textRecoveryScope(profile, 'text:one', 'display:one', 'grid:one');
  const expected = { id: 'text:one', text: { value: 'saved' } }, working = { value: 'unsaved' };
  let changes = 0; const dispose = subscribeTextRecovery(store, () => changes++);
  retainTextRecovery(store, scope, expected, working, { reason: 'write_failed', message: 'full' });
  dispose(); working.value = 'mutated outside buffer';
  assert.equal(readTextRecovery(store, scope).value.value, 'unsaved');
  assert.equal(textRecoveries(store, 'profile:b').length, 0);
  assert.equal(readTextRecovery(store, { ...scope, moduleId: 'display:two' }), undefined);
  assert.equal(textRecoveries({ getProfileAddress: () => profile }, profile).length, 0);
  retainTextRecovery(store, { ...scope, profile: 'profile:b' }, expected, working, {});
  assert.equal(textRecoveries(store, 'profile:b').length, 0);
  clearTextRecovery(store, scope); assert.equal(textRecoveries(store, profile).length, 0); assert.equal(changes, 1);
});
