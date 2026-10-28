import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileDraftReader } from './profileDraftReader.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { createReception } from '../profileDocument/domain/receptionPresentation.js';

const address = '0x3333333333333333333333333333333333333333';
const key = systemWorkflowDraftKey(address);
function setup() {
  const records = new Map(), events = new EventTarget(), visibility = new EventTarget();
  visibility.visibilityState = 'visible';
  const storage = { getItem: k => records.get(k) ?? null, setItem: (k, v) => records.set(k, v) };
  const save = name => {
    const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
    const reception = createReception(); reception.branding.name = name;
    assert.ok(store.commitCompletedOperation({ ...store.getDraft(), reception }, { expectedGeneration: store.getGeneration() }));
  };
  const changed = (changedKey = key) => events.dispatchEvent(Object.assign(new Event('storage'), { key: changedKey, storageArea: storage }));
  return { records, storage, events, visibility, save, changed };
}
test('reader refreshes committed cross-tab changes and foreground changes without writing or replacing unchanged snapshots', () => {
  const f = setup(); f.save('First');
  const reader = createProfileDraftReader({ profileAddress: address, ...f });
  let notifications = 0;
  const unsubscribe = reader.subscribe(() => notifications++);
  const first = reader.getSnapshot();
  f.changed(); assert.equal(reader.getSnapshot(), first); assert.equal(notifications, 0);
  f.save('Second'); f.changed('other-profile');
  assert.equal(reader.getSnapshot(), first);
  f.changed(); assert.equal(reader.getSnapshot().draft.reception.branding.name, 'Second');
  f.save('Third'); f.events.dispatchEvent(new Event('focus'));
  assert.equal(reader.getSnapshot().draft.reception.branding.name, 'Third');
  f.save('Fourth'); f.visibility.visibilityState = 'hidden';
  f.visibility.dispatchEvent(new Event('visibilitychange'));
  assert.equal(reader.getSnapshot().draft.reception.branding.name, 'Third');
  f.visibility.visibilityState = 'visible'; f.visibility.dispatchEvent(new Event('visibilitychange'));
  assert.equal(reader.getSnapshot().draft.reception.branding.name, 'Fourth');
  const raw = f.records.get(key);
  reader.refresh(); assert.equal(f.records.get(key), raw); assert.equal(notifications, 3);
  unsubscribe(); f.save('Fifth'); f.changed();
  assert.equal(reader.getSnapshot().draft.reception.branding.name, 'Fourth');
});
test('invalid or unavailable storage preserves the last good view, while removal clears it', () => {
  const f = setup(); f.save('Saved');
  const reader = createProfileDraftReader({ profileAddress: address, ...f });
  f.records.set(key, '{broken'); reader.refresh();
  assert.equal(reader.getSnapshot().status, 'corrupt');
  assert.equal(reader.getSnapshot().stale, true);
  assert.equal(reader.getSnapshot().draft.reception.branding.name, 'Saved');
  const getItem = f.storage.getItem;
  f.storage.getItem = () => { throw Error('unavailable'); };
  reader.refresh(); assert.equal(reader.getSnapshot().status, 'unavailable');
  f.storage.getItem = getItem; f.records.delete(key); reader.refresh();
  assert.equal(reader.getSnapshot().status, 'absent'); assert.equal(reader.getSnapshot().draft, null);
});
test('collection reader exposes all validated canvases without activation, writes or editing capabilities', () => {
  const f = setup(); f.save('About');
  const writer = createSystemWorkflowDraftStore({ profileAddress: address, storage: f.storage });
  const first = writer.getWorkbenchId(), second = writer.createWorkbench('Second canvas');
  const raw = f.records.get(key);
  const reader = createProfileDraftReader({ profileAddress: address, ...f });
  const collection = reader.getSnapshot().collection;
  assert.deepEqual(collection.entries.map(entry => entry.id), [first, second]);
  assert.equal(collection.activeId, second); assert.equal(collection.kind, 'local');
  assert.equal(collection.entries[0].draft.reception.branding.name, 'About');
  assert.equal(typeof collection.switchWorkbench, 'undefined');
  assert.ok(Object.isFrozen(collection.entries[0].draft));
  assert.equal(f.records.get(key), raw);
  f.records.set(key, '{broken'); reader.refresh();
  assert.equal(reader.getSnapshot().collection.entries, collection.entries);
  assert.equal(reader.getSnapshot().collection.stale, true);
  assert.equal(reader.getSnapshot().collection.revision, collection.revision);
  f.records.delete(key); reader.refresh();
  assert.equal(reader.getSnapshot().collection, null);
});
