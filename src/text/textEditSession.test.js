import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextEditSession } from './textEditSession.js';
import { readTextRecovery, textRecoveryScope } from './textEditRecovery.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { addTextModule, saveTextModuleResult } from './textSession.js';
const profile = `0x${'1'.repeat(40)}`;

test('standalone Text retains save, recovery and disposal behavior', () => {
  const entries = new Map(); let broken = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (broken) throw Error('full'); entries.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const id = addTextModule(store, profile);
  const read = () => store.getSnapshot().texts.find(item => item.id === id);
  const valueOf = record => record;
  const scope = textRecoveryScope(profile, id);
  const saveRecord = (store, scope, expected, next, options) => saveTextModuleResult(store, scope.profile, expected, next, options);
  const open = () => createTextEditSession({ store, scope, record: read(), valueOf, saveRecord });
  const changeTitle = (value, title) => ({ ...value, article: { ...value.article, title } });
  let session = open();
  const original = read(), next = changeTitle(session.getSnapshot().value, 'Unsaved');
  broken = true;
  assert.equal(session.save(next), false);
  assert.equal(session.getSnapshot().failed, true);
  assert.equal(read(), original);
  assert.deepEqual(readTextRecovery(store, scope).value, next);
  session.receive(structuredClone(original));
  assert.deepEqual(session.getSnapshot().value, next);
  session.dispose(); const closed = session;
  broken = false;
  assert.equal(closed.save(changeTitle(next, 'Late callback')), false);
  assert.equal(read(), original);
  session = open();
  assert.deepEqual(session.getSnapshot().value, next);
  assert.ok(session.save(next, { retry: true }));
  assert.equal(session.getSnapshot().failed, false);
  assert.deepEqual(session.getSnapshot().value, valueOf(read()));
  assert.equal(readTextRecovery(store, scope), undefined);
  assert.ok(store.undo()); session.receive(read());
  assert.deepEqual(session.getSnapshot().value, valueOf(original));
  // Another editor wins a save. Failed working text survives receiving that record.
  const concurrent = open(), theirs = changeTitle(concurrent.getSnapshot().value, 'Other editor');
  assert.ok(concurrent.save(theirs));
  assert.equal(session.save(next), false);
  assert.equal(session.getSnapshot().reason, 'conflict');
  session.receive(read()); assert.deepEqual(session.getSnapshot().value, next);
  assert.ok(session.save(next, { retry: true, replace: true }));
  assert.equal(session.getSnapshot().error, '');
  store.setProfileAddress(`0x${'2'.repeat(40)}`);
  assert.equal(session.save(next), false);
});

test('an unexpected save exception retains the edit and can recover on retry', () => {
  const store = { getProfileAddress: () => profile }, scope = textRecoveryScope(profile, 'text:exception');
  let broken = true;
  const session = createTextEditSession({ store, scope, record: { title: 'Saved' }, valueOf: value => value,
    saveRecord: (_store, _scope, _expected, value) => { if (broken) throw Error('Unavailable'); return { saved: true, record: value }; } });
  const value = { title: 'Keep me' };
  assert.equal(session.save(value), false);
  assert.equal(session.getSnapshot().error, 'Unavailable');
  assert.deepEqual(readTextRecovery(store, scope).value, value);
  broken = false; assert.ok(session.save(value));
  assert.equal(readTextRecovery(store, scope), undefined);
});
