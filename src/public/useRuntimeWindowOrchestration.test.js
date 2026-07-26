import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAuthoredRuntimeWindowDefaults,
  loadRuntimeWindowProfileState,
  runtimeWindowProfileMatches
} from './useRuntimeWindowOrchestration.js';
import {
  createRuntimeWindowState,
  runtimeWindowKey,
  saveRuntimeWindowState,
  updateRuntimeWindowState
} from './windows/runtimeWindowState.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const GEOMETRY = { minColumn: -8, minRow: -4, columns: 32, rows: 20 };

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('runtime-window loading remains isolated to the requested profile', () => {
  const storage = memoryStorage([
    [runtimeWindowKey(PROFILE_A), JSON.stringify({
      version: 1,
      openIds: ['identity', 'unknown'],
      zOrder: ['unknown', 'identity'],
      rects: { identity: { column: 2, row: 3, columnSpan: 11, rowSpan: 8 } }
    })],
    [runtimeWindowKey(PROFILE_B), JSON.stringify({
      version: 1,
      openIds: ['signals'],
      zOrder: ['signals'],
      rects: { signals: { column: 4, row: 5, columnSpan: 13, rowSpan: 9 } }
    })]
  ]);
  const authoredDefaults = createAuthoredRuntimeWindowDefaults({});

  const profileA = loadRuntimeWindowProfileState({
    storage,
    profileAddress: PROFILE_A,
    placementGeometry: GEOMETRY,
    authoredDefaults
  });
  const profileB = loadRuntimeWindowProfileState({
    storage,
    profileAddress: PROFILE_B,
    placementGeometry: GEOMETRY,
    authoredDefaults
  });

  assert.deepEqual(profileA.windows.openIds, ['identity']);
  assert.deepEqual(profileA.windows.zOrder, ['identity']);
  assert.deepEqual(profileA.windows.rects, {
    identity: { column: 2, row: 3, columnSpan: 11, rowSpan: 8 }
  });
  assert.deepEqual(profileB.windows.openIds, ['signals']);
  assert.deepEqual(profileB.windows.rects, {
    signals: { column: 4, row: 5, columnSpan: 13, rowSpan: 9 }
  });
  assert.equal(runtimeWindowProfileMatches(profileA, PROFILE_A), true);
  assert.equal(runtimeWindowProfileMatches(profileA, PROFILE_B), false);
});

test('saved empty runtime state wins over authored start-open defaults', () => {
  const storage = memoryStorage([
    [runtimeWindowKey(PROFILE_A), JSON.stringify({ version: 1, openIds: [], zOrder: [], rects: {} })]
  ]);
  const authoredDefaults = createAuthoredRuntimeWindowDefaults({
    identity: {
      startOpen: true,
      windowGeometry: { column: 1, row: 2, columnSpan: 11, rowSpan: 8 }
    }
  });

  const loaded = loadRuntimeWindowProfileState({
    storage,
    profileAddress: PROFILE_A,
    placementGeometry: GEOMETRY,
    authoredDefaults
  });

  assert.deepEqual(loaded.windows, { version: 1, openIds: [], zOrder: [], rects: {} });
});

test('geometry, open state, and z-order persist through the profile-scoped controller load', () => {
  const storage = memoryStorage();
  let windows = createRuntimeWindowState();
  windows = updateRuntimeWindowState(windows, { type: 'open', id: 'collection' });
  windows = updateRuntimeWindowState(windows, { type: 'open', id: 'signals' });
  windows = updateRuntimeWindowState(windows, {
    type: 'geometry',
    id: 'collection',
    rect: { column: -2, row: 4, columnSpan: 15, rowSpan: 10 }
  });
  windows = updateRuntimeWindowState(windows, { type: 'focus', id: 'collection' });
  assert.equal(saveRuntimeWindowState(storage, PROFILE_A, windows), true);

  const loaded = loadRuntimeWindowProfileState({
    storage,
    profileAddress: PROFILE_A,
    placementGeometry: GEOMETRY,
    authoredDefaults: createAuthoredRuntimeWindowDefaults({})
  });

  assert.deepEqual(loaded.windows.openIds, ['collection', 'signals']);
  assert.deepEqual(loaded.windows.zOrder, ['signals', 'collection']);
  assert.deepEqual(loaded.windows.rects.collection, {
    column: -2,
    row: 4,
    columnSpan: 15,
    rowSpan: 10
  });
});

test('authored defaults coordinate start-open state and geometry for a new profile', () => {
  const authoredDefaults = createAuthoredRuntimeWindowDefaults({
    collection: {
      startOpen: true,
      windowGeometry: { column: -3, row: 1, columnSpan: 15, rowSpan: 10 }
    },
    signals: { startOpen: false, windowGeometry: null }
  });
  const loaded = loadRuntimeWindowProfileState({
    storage: memoryStorage(),
    profileAddress: PROFILE_A,
    placementGeometry: GEOMETRY,
    authoredDefaults
  });

  assert.deepEqual(loaded.windows, {
    version: 1,
    openIds: ['collection'],
    zOrder: ['collection'],
    rects: { collection: { column: -3, row: 1, columnSpan: 15, rowSpan: 10 } }
  });
});
