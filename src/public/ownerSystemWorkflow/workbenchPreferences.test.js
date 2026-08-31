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
    compositionLocked: true, gridColor: '#AABBCC', gridMode: 'DOTS', shortcutSnap: false, surfaceId: 'carbon',
  }, storage);

  assert.deepEqual(saved, {
    compositionLocked: true, gridColor: '#aabbcc', gridMode: 'DOTS', shortcutSnap: false, surfaceId: 'carbon',
  });
  assert.deepEqual(loadWorkbenchPreferences(profile, 'paper', storage), saved);
  assert.equal(storage.values.size, 1);
  assert.ok(storage.values.has(workbenchPreferencesStorageKey(profile)));
});

test('Workbench preferences reject malformed local values and inherit the current Stage surface once', () => {
  const storage = memoryStorage();
  storage.setItem(workbenchPreferencesStorageKey('0xdef'), JSON.stringify({
    gridColor: 'red', gridMode: 'BROKEN', shortcutSnap: 'yes', surfaceId: 'unknown',
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
