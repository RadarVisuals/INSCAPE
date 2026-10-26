import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WORKBENCH_PREFERENCES,
  createWorkbenchPreferencesStore,
  loadWorkbenchPreferences,
  normalizeWorkbenchPreferences,
  saveWorkbenchPreferences,
  workbenchGridColorPreview,
  workbenchPreferencesStorageKey,
} from './workbenchPreferences.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
};

test('Workbench preferences remain profile-scoped local editor state', () => {
  const storage = memoryStorage();
  const profile = '0xAbC';
  const saved = saveWorkbenchPreferences(profile, {
    chromeNoise: false, compositionLocked: true, gridColor: '#AABBCC', gridMode: 'DOTS', shortcutSnap: false, surfaceId: 'carbon',
  }, storage);

  assert.deepEqual(saved, {
    galleryCardSize: 2, gridSpacing: 24, edgeSnap: true, moduleGap: 0, chromeNoise: false, compositionLocked: true, dockVisible: true, gridColor: '#aabbcc', gridMode: 'DOTS', shortcutSnap: false, surfaceId: 'carbon',
  });
  assert.deepEqual(loadWorkbenchPreferences(profile, 'paper', storage), saved);
  assert.equal(storage.values.size, 1);
  assert.ok(storage.values.has(workbenchPreferencesStorageKey(profile)));
});

test('failed writes keep the latest visible preferences and retry only their own profile record', () => {
  const storage = memoryStorage(), write = storage.setItem;
  storage.setItem('composition', 'unchanged');
  const store = createWorkbenchPreferencesStore({ profile: 'alice', storage, fresh: true });
  assert.equal(storage.values.size, 1, 'constructing the store does not write');
  assert.equal(store.flush(), true);
  assert.equal(store.getSnapshot().gridMode, 'NONE');
  storage.setItem = () => { throw Error('Quota'); };
  store.update(current => ({ ...current, gridSpacing: 41, dockVisible: false }));
  store.update(current => ({ ...current, gridSpacing: 52 }));
  assert.match(store.getError(), /could not be saved/);
  assert.equal(store.getSnapshot().gridSpacing, 52);
  assert.equal(loadWorkbenchPreferences('alice', 'mist', storage).gridSpacing, 24);
  assert.equal(store.retry(), false);
  storage.setItem = write;
  assert.equal(store.retry(), true);
  assert.equal(store.getError(), null);
  assert.equal(loadWorkbenchPreferences('alice', 'mist', storage).gridSpacing, 52);
  assert.equal(loadWorkbenchPreferences('alice', 'mist', storage).dockVisible, false);
  assert.equal(storage.getItem('composition'), 'unchanged');
  assert.equal(storage.getItem(workbenchPreferencesStorageKey('bob')), null);
  store.dispose();
});

test('unreadable preference records remain intact until explicitly saving current settings', () => {
  for (const corrupt of ['{broken', 'null', '[]', 'false', '"text"']) {
    const storage = memoryStorage(), key = workbenchPreferencesStorageKey('alice');
    storage.setItem(key, corrupt);
    const store = createWorkbenchPreferencesStore({ profile: 'alice', storage, fallbackSurfaceId: 'carbon' });
    assert.match(store.getError(), /could not be read/);
    store.update(current => ({ ...current, edgeSnap: false }));
    assert.equal(store.flush(), false);
    assert.equal(storage.getItem(key), corrupt);
    assert.equal(store.retry(), true);
    assert.equal(loadWorkbenchPreferences('alice', 'mist', storage).edgeSnap, false);
    assert.equal(loadWorkbenchPreferences('alice', 'mist', storage).surfaceId, 'carbon');
    store.dispose();
  }
});

test('read failures do not overwrite saved preferences when storage becomes available again', () => {
  const storage = memoryStorage(), read = storage.getItem;
  const original = JSON.stringify({ gridSpacing: 80 });
  storage.setItem(workbenchPreferencesStorageKey('alice'), original);
  storage.getItem = () => { throw Error('Denied'); };
  const store = createWorkbenchPreferencesStore({ profile: 'alice', storage });
  storage.getItem = read;
  store.update(current => ({ ...current, chromeNoise: false }));
  store.dispose();
  assert.equal(storage.getItem(workbenchPreferencesStorageKey('alice')), original);
  assert.match(store.getError(), /could not be read/);
});

test('external edits and lost authority block saves; disposed callbacks cannot change either profile', () => {
  const storage = memoryStorage(); let writable = true;
  const store = createWorkbenchPreferencesStore({ profile: 'alice', storage, canSave: () => writable });
  store.flush();
  storage.setItem(workbenchPreferencesStorageKey('alice'), 'external');
  store.update(current => ({ ...current, shortcutSnap: false }));
  assert.match(store.getError(), /another window/);
  assert.equal(storage.getItem(workbenchPreferencesStorageKey('alice')), 'external');
  writable = false;
  assert.equal(store.retry(), false);
  assert.match(store.getError(), /write access/);
  writable = true;
  assert.equal(store.retry(), true);
  store.dispose();
  const saved = storage.getItem(workbenchPreferencesStorageKey('alice'));
  store.update(() => { throw Error('Disposed callback must not run'); });
  assert.equal(store.retry(), false);
  assert.equal(storage.getItem(workbenchPreferencesStorageKey('alice')), saved);
  const other = createWorkbenchPreferencesStore({ profile: 'bob', storage });
  assert.equal(other.getSnapshot().shortcutSnap, true);
  other.dispose();
});

test('unavailable storage and direct storage helpers cannot report a successful save', () => {
  const store = createWorkbenchPreferencesStore({ profile: 'alice', storage: null });
  assert.match(store.getError(), /could not be read/);
  assert.equal(store.retry(), false);
  assert.match(store.getError(), /could not be saved/);
  assert.throws(() => saveWorkbenchPreferences('alice', {}, null));
  assert.throws(() => loadWorkbenchPreferences('alice', 'mist', null));
  store.dispose();
});

test('old preferences show the dock; hiding it persists only for that profile', () => {
  const storage = memoryStorage();
  const key = workbenchPreferencesStorageKey('0xabc');
  const legacy = JSON.stringify({ surfaceId: 'carbon', shortcutSnap: false });
  storage.setItem(key, legacy);
  const loaded = loadWorkbenchPreferences('0xabc', 'paper', storage);
  assert.equal(loaded.dockVisible, true);
  assert.equal(storage.getItem(key), legacy);
  saveWorkbenchPreferences('0xabc', { ...loaded, dockVisible: false }, storage);
  assert.equal(loadWorkbenchPreferences('0xabc', 'paper', storage).dockVisible, false);
  assert.equal(loadWorkbenchPreferences('0xdef', 'paper', storage).dockVisible, true);
});

test('retired frame preferences are ignored without changing other settings or rewriting on read', () => {
  const storage = memoryStorage(), key = workbenchPreferencesStorageKey('0xabc');
  const legacy = JSON.stringify({ surfaceId: 'carbon', shortcutSnap: false, dockVisible: false,
    referenceFrameVisible: true, referenceFrameSize: { width: 1080, height: 1920 } });
  storage.setItem(key, legacy);
  const loaded = loadWorkbenchPreferences('0xabc', 'paper', storage);
  assert.equal('referenceFrameVisible' in loaded, false);
  assert.equal('referenceFrameSize' in loaded, false);
  assert.equal(storage.getItem(key), legacy, 'reading does not rewrite existing preferences');
  saveWorkbenchPreferences('0xabc', { ...loaded, gridMode: 'DOTS' }, storage);
  const restored = loadWorkbenchPreferences('0xabc', 'paper', storage);
  assert.equal('referenceFrameVisible' in restored, false);
  assert.equal('referenceFrameSize' in restored, false);
  assert.equal(restored.gridMode, 'DOTS');
  assert.equal(restored.surfaceId, 'carbon');
  assert.equal(restored.shortcutSnap, false);
  assert.equal(restored.dockVisible, false);
  assert.equal(loadWorkbenchPreferences('0xdef', 'paper', storage).gridMode, 'LINES');
  for (const width of [0, -1, 1.5, 7945, Infinity, NaN, '1920', null]) {
    assert.equal('referenceFrameSize' in normalizeWorkbenchPreferences({ referenceFrameSize: { width, height: 1080 } }), false);
  }
});

test('Workbench preferences reject malformed local values and inherit the current Stage surface once', () => {
  const storage = memoryStorage();
  storage.setItem(workbenchPreferencesStorageKey('0xdef'), JSON.stringify({
    chromeNoise: 'no', gridColor: 'red', gridMode: 'BROKEN', shortcutSnap: 'yes', surfaceId: 'unknown',
  }));

  assert.deepEqual(loadWorkbenchPreferences('0xdef', 'graphite', storage), {
    ...DEFAULT_WORKBENCH_PREFERENCES,
    surfaceId: 'graphite',
  });
  assert.deepEqual(normalizeWorkbenchPreferences(null, 'paper'), {
    ...DEFAULT_WORKBENCH_PREFERENCES,
    surfaceId: 'paper',
  });
  assert.equal(workbenchGridColorPreview('carbon'), '#1d1e1d');
});

test('cell size persists, invalid spacing is rejected, and only fresh workspaces begin without guides', () => {
  const storage = memoryStorage();
  assert.equal(loadWorkbenchPreferences('fresh', 'mist', storage, true).gridMode, 'NONE');
  assert.equal(loadWorkbenchPreferences('existing', 'mist', storage, false).gridMode, 'LINES');
  saveWorkbenchPreferences('fresh', { gridMode: 'DOTS', gridSpacing: 37.5 }, storage);
  assert.equal(loadWorkbenchPreferences('fresh', 'mist', storage, true).gridMode, 'DOTS');
  assert.equal(loadWorkbenchPreferences('fresh', 'mist', storage, true).gridSpacing, 37.5);
  for (const gridSpacing of [0, 7, 513, NaN, '24']) assert.equal(normalizeWorkbenchPreferences({ gridSpacing }).gridSpacing, 24);
});
