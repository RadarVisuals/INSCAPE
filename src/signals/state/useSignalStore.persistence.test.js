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

test('a pending Signals save cannot overwrite immediately restored settings', async () => {
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
