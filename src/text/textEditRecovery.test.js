import test from 'node:test';
import assert from 'node:assert/strict';
import { bindWorkbenchTextRecovery, textRecoveryScope, retainTextRecovery, readTextRecovery, clearTextRecovery, textRecoveries, subscribeTextRecovery } from './textEditRecovery.js';

test('Workbench recovery survives new stores but cannot be read or cleared by another profile', () => {
  const profile = 'profile:remount';
  const first = { getProfileAddress: () => profile };
  const scope = textRecoveryScope(profile, 'text:one');
  bindWorkbenchTextRecovery(first);
  retainTextRecovery(first, scope, { title: 'saved' }, { title: 'pending' }, { reason: 'write_failed' });
  const second = { getProfileAddress: () => profile };
  bindWorkbenchTextRecovery(second);
  assert.equal(readTextRecovery(second, scope).value.title, 'pending');
  const other = { getProfileAddress: () => 'profile:other' };
  bindWorkbenchTextRecovery(other);
  assert.equal(readTextRecovery(other, scope), undefined);
  clearTextRecovery(other, scope);
  assert.equal(textRecoveries(other, profile).length, 0);
  assert.equal(readTextRecovery(second, scope).expected.title, 'saved');
  clearTextRecovery(second, scope);
  assert.equal(textRecoveries(first, profile).length, 0);
});
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
