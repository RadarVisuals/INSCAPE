import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WORKBENCH_PREFERENCES,
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
    edgeSnap: true, moduleGap: 0, chromeNoise: false, compositionLocked: true, dockVisible: true, gridColor: '#aabbcc', gridMode: 'DOTS', shortcutSnap: false, surfaceId: 'carbon',
  });
  assert.deepEqual(loadWorkbenchPreferences(profile, 'paper', storage), saved);
  assert.equal(storage.values.size, 1);
  assert.ok(storage.values.has(workbenchPreferencesStorageKey(profile)));
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
