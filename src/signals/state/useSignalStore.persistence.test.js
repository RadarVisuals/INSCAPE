import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSignalDocument } from '../storage/signalStorage.js';
import { flushSignalDocument, resetSignalStoreForTests, useSignalStore } from './useSignalStore.js';

const PROFILE = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const OTHER_PROFILE = '0x2222222222222222222222222222222222222222';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const memoryStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};

test('obsolete profile settings and activity callbacks cannot mutate the current account', async () => {
  const storage = memoryStorage();
  resetSignalStoreForTests(PROFILE, storage);
  const old = useSignalStore.getState();
  old.setProfileAddress(OTHER_PROFILE);
  const before = structuredClone(useSignalStore.getState().document);
  assert.equal(old.updateSetting('audio', true, PROFILE), false);
  assert.equal(old.markSeen(null, PROFILE), false);
  await old.synchronize({ expectedProfile: PROFILE });
  assert.deepEqual(useSignalStore.getState().document, before);
  assert.equal(storage.values.size, 0);
});

test('restored settings remain authoritative after an earlier setting change', async () => {
  const storage = memoryStorage();
  resetSignalStoreForTests(PROFILE, storage);
  useSignalStore.getState().updateSetting('audio', true);
  const restored = { notifications: true, speech: false, visualEffects: true, audio: false };

  assert.equal(useSignalStore.getState().replaceSettings(restored), true);
  await delay(140);
  assert.deepEqual(loadSignalDocument(storage, PROFILE).settings, restored);
  assert.deepEqual(useSignalStore.getState().settings, restored);

  resetSignalStoreForTests(PROFILE, storage);
  assert.deepEqual(useSignalStore.getState().settings, restored);
});

test('failed setting changes preserve saved values and runtime effects, then can be retried', () => {
  const storage = memoryStorage(); let blocked = false;
  const writer = storage.setItem;
  storage.setItem = (key, value) => { if (blocked) throw new Error('quota'); writer(key, value); };
  resetSignalStoreForTests(PROFILE, storage);
  assert.equal(flushSignalDocument(), true);
  useSignalStore.setState({ queue: [{ id: 'queued' }], currentReaction: { id: 'running' } });
  const before = structuredClone(useSignalStore.getState().document);
  blocked = true;
  assert.equal(useSignalStore.getState().updateSetting('notifications', false), false);
  assert.deepEqual(useSignalStore.getState().document, before);
  assert.deepEqual(useSignalStore.getState().queue, [{ id: 'queued' }]);
  assert.equal(useSignalStore.getState().currentReaction.id, 'running');
  assert.match(useSignalStore.getState().persistenceError, /not saved/i);
  assert.deepEqual(loadSignalDocument(storage, PROFILE), before);
  blocked = false;
  assert.equal(useSignalStore.getState().updateSetting('notifications', false), true);
  assert.equal(useSignalStore.getState().persistenceError, null);
  assert.deepEqual(useSignalStore.getState().queue, []);
  resetSignalStoreForTests(PROFILE, storage);
  assert.equal(useSignalStore.getState().settings.notifications, false);
});

test('failed read markers remain unread and retry stores the same existing record', () => {
  const storage = memoryStorage(); let blocked = false;
  const writer = storage.setItem;
  storage.setItem = (key, value) => { if (blocked) throw new Error('quota'); writer(key, value); };
  resetSignalStoreForTests(PROFILE, storage);
  const signal = { id: 'received', profileAddress: PROFILE, type: 'ASSET_RECEIVED', timestamp: 1720000000000, read: false };
  const document = { ...useSignalStore.getState().document, history: [signal] };
  useSignalStore.setState({ document, history: document.history });
  assert.equal(flushSignalDocument(), true);
  blocked = true;
  assert.equal(useSignalStore.getState().markSeen(signal.id), false);
  assert.equal(useSignalStore.getState().history[0].read, false);
  assert.equal(loadSignalDocument(storage, PROFILE).history[0].read, false);
  blocked = false;
  assert.equal(useSignalStore.getState().markSeen(signal.id), true);
  resetSignalStoreForTests(PROFILE, storage);
  assert.equal(useSignalStore.getState().history[0].read, true);
  assert.equal(useSignalStore.getState().history[0].id, signal.id);
});

test('failed persistence feedback is scoped to the originating profile', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  resetSignalStoreForTests(PROFILE, storage);
  assert.equal(useSignalStore.getState().updateSetting('audio', true), false);
  assert.ok(useSignalStore.getState().persistenceError);
  useSignalStore.getState().setProfileAddress(OTHER_PROFILE);
  assert.equal(useSignalStore.getState().persistenceError, null);
  assert.equal(useSignalStore.getState().settings.audio, false);
  assert.equal(useSignalStore.getState().updateSetting('audio', true, PROFILE), false);
  assert.equal(useSignalStore.getState().persistenceError, null);
  resetSignalStoreForTests(PROFILE, memoryStorage());
});

test('activity synchronization retains the previous document on save failure and recovers on retry', async () => {
  const storage = memoryStorage(); let blocked = true;
  const writer = storage.setItem;
  storage.setItem = (key, value) => { if (blocked) throw new Error('quota'); writer(key, value); };
  resetSignalStoreForTests(PROFILE, storage);
  const before = structuredClone(useSignalStore.getState().document);
  await useSignalStore.getState().synchronize({ mode: 'FIXTURE' });
  assert.equal(useSignalStore.getState().status, 'error');
  assert.match(useSignalStore.getState().persistenceError, /could not be saved/);
  assert.deepEqual(useSignalStore.getState().document, before);
  assert.deepEqual(useSignalStore.getState().queue, []);
  blocked = false;
  await useSignalStore.getState().synchronize({ mode: 'FIXTURE' });
  assert.equal(useSignalStore.getState().status, 'partial');
  assert.match(useSignalStore.getState().partialError, /metadata resolver failed/);
  assert.equal(useSignalStore.getState().persistenceError, null);
  assert.ok(useSignalStore.getState().history.length > 0);
  assert.deepEqual(loadSignalDocument(storage, PROFILE), useSignalStore.getState().document);
});

test('failed immediate Signals persistence preserves current settings', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  resetSignalStoreForTests(PROFILE, storage);
  const before = useSignalStore.getState().settings;
  assert.equal(useSignalStore.getState().replaceSettings({ ...before, audio: true }), false);
  assert.deepEqual(useSignalStore.getState().settings, before);
  resetSignalStoreForTests(PROFILE, memoryStorage());
});

test('Signals draft flushing persists the latest settings immediately and reports failure', () => {
  const storage = memoryStorage();
  resetSignalStoreForTests(PROFILE, storage);
  useSignalStore.getState().updateSetting('audio', true);
  assert.equal(flushSignalDocument(), true);
  assert.equal(loadSignalDocument(storage, PROFILE).settings.audio, true);

  resetSignalStoreForTests(PROFILE, { getItem: () => null, setItem: () => { throw new Error('quota'); } });
  assert.equal(flushSignalDocument(), false);
  resetSignalStoreForTests(PROFILE, memoryStorage());
});

test('switching installed profiles isolates activity settings and runtime state', () => {
  const storage = memoryStorage();
  resetSignalStoreForTests(PROFILE, storage);
  useSignalStore.getState().updateSetting('audio', true);
  useSignalStore.setState({ queue: [{ id: 'profile-a-event' }], currentReaction: { id: 'profile-a-event' } });

  assert.equal(useSignalStore.getState().setProfileAddress(OTHER_PROFILE), true);
  assert.equal(useSignalStore.getState().profileAddress, OTHER_PROFILE);
  assert.equal(useSignalStore.getState().document.profileAddress, OTHER_PROFILE);
  assert.equal(useSignalStore.getState().settings.audio, false);
  assert.deepEqual(useSignalStore.getState().queue, []);
  assert.equal(useSignalStore.getState().currentReaction, null);

  assert.equal(useSignalStore.getState().setProfileAddress(PROFILE), true);
  assert.equal(useSignalStore.getState().settings.audio, true);
});
