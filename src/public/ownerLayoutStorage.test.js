import assert from 'node:assert/strict';
import test from 'node:test';
import { createModuleGridGeometry, encodeModuleLayout, getDefaultModulePositions, LEGACY_MODULE_LAYOUT_STORAGE_KEY, MODULE_LAYOUT_STORAGE_KEY } from './moduleLayout.js';
import {
  LEGACY_SYSTEM_PRESENTATION_KEY,
  loadClaimedLegacyLayoutValue,
  loadProfileModulePositions,
  loadProfileSystemPresentation,
  OWNER_LAYOUT_LEGACY_CLAIM_KEY,
  profileModuleLayoutKey,
  profileSystemPresentationKey,
  removeProfileModulePositions,
  saveProfileModulePositions,
  saveProfileSystemPresentation
} from './ownerLayoutStorage.js';

const PROFILE_A = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';
const PROFILE_B = '0x1111111111111111111111111111111111111111';
const geometry = { ...createModuleGridGeometry(1280, 720), minColumn: -24, minRow: -13, columns: 72, rows: 39 };
const positionsA = {
  identity: { column: -8, row: -4 }, collection: { column: 8, row: -4 }, creations: { column: -8, row: 8 }, signals: { column: 8, row: 8 }
};
const positionsB = {
  identity: { column: -2, row: -1 }, collection: { column: 12, row: -1 }, creations: { column: -2, row: 12 }, signals: { column: 12, row: 12 }
};

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test('the first profile claims and copies intact global layout records without deleting them', () => {
  const storage = memoryStorage();
  const presentation = { identity: { appearanceMode: 'icon', startOpen: true } };
  storage.setItem(MODULE_LAYOUT_STORAGE_KEY, encodeModuleLayout(positionsA));
  storage.setItem(LEGACY_SYSTEM_PRESENTATION_KEY, JSON.stringify(presentation));

  assert.deepEqual(loadProfileModulePositions(storage, PROFILE_A, geometry), positionsA);
  assert.deepEqual(loadProfileSystemPresentation(storage, PROFILE_A), presentation);
  assert.equal(storage.getItem(profileModuleLayoutKey(PROFILE_A)), encodeModuleLayout(positionsA));
  assert.equal(storage.getItem(profileSystemPresentationKey(PROFILE_A)), JSON.stringify(presentation));
  assert.equal(JSON.parse(storage.getItem(OWNER_LAYOUT_LEGACY_CLAIM_KEY)).profileAddress, PROFILE_A);
  assert.equal(storage.getItem(MODULE_LAYOUT_STORAGE_KEY), encodeModuleLayout(positionsA));
  assert.equal(storage.getItem(LEGACY_SYSTEM_PRESENTATION_KEY), JSON.stringify(presentation));
});

test('a different profile never inherits globally claimed layout data', () => {
  const storage = memoryStorage();
  storage.setItem(MODULE_LAYOUT_STORAGE_KEY, encodeModuleLayout(positionsA));
  storage.setItem(LEGACY_SYSTEM_PRESENTATION_KEY, JSON.stringify({ identity: { startOpen: true } }));
  loadProfileModulePositions(storage, PROFILE_A, geometry);

  assert.deepEqual(loadProfileModulePositions(storage, PROFILE_B, geometry), getDefaultModulePositions(geometry));
  assert.equal(loadProfileSystemPresentation(storage, PROFILE_B), null);
  assert.equal(storage.getItem(profileModuleLayoutKey(PROFILE_B)), null);
  assert.equal(storage.getItem(profileSystemPresentationKey(PROFILE_B)), null);
  storage.setItem('legacy-window-layout', 'profile-a-window');
  assert.equal(loadClaimedLegacyLayoutValue(storage, PROFILE_A, 'legacy-window-layout'), 'profile-a-window');
  assert.equal(loadClaimedLegacyLayoutValue(storage, PROFILE_B, 'legacy-window-layout'), null);
});

test('the older v3 module record still migrates when no v4 record exists', () => {
  const storage = memoryStorage();
  storage.setItem(LEGACY_MODULE_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 3, positions: positionsA }));
  assert.deepEqual(loadProfileModulePositions(storage, PROFILE_A, geometry), positionsA);
  assert.equal(storage.getItem(profileModuleLayoutKey(PROFILE_A)), encodeModuleLayout(positionsA));
});

test('profile-scoped layout and system presentation round-trip independently', () => {
  const storage = memoryStorage();
  assert.equal(saveProfileModulePositions(storage, PROFILE_A, positionsA), true);
  assert.equal(saveProfileModulePositions(storage, PROFILE_B, positionsB), true);
  assert.equal(saveProfileSystemPresentation(storage, PROFILE_A, { identity: { startOpen: true } }), true);
  assert.equal(saveProfileSystemPresentation(storage, PROFILE_B, { identity: { startOpen: false } }), true);

  assert.deepEqual(loadProfileModulePositions(storage, PROFILE_A, geometry), positionsA);
  assert.deepEqual(loadProfileModulePositions(storage, PROFILE_B, geometry), positionsB);
  assert.equal(loadProfileSystemPresentation(storage, PROFILE_A).identity.startOpen, true);
  assert.equal(loadProfileSystemPresentation(storage, PROFILE_B).identity.startOpen, false);
  assert.equal(removeProfileModulePositions(storage, PROFILE_A), true);
  assert.equal(storage.getItem(profileModuleLayoutKey(PROFILE_A)), null);
  assert.notEqual(storage.getItem(profileModuleLayoutKey(PROFILE_B)), null);
});

test('invalid profiles, malformed records, and unavailable storage fail closed', () => {
  const storage = memoryStorage();
  storage.setItem(profileModuleLayoutKey(PROFILE_A), '{bad');
  storage.setItem(profileSystemPresentationKey(PROFILE_A), '{bad');
  assert.deepEqual(loadProfileModulePositions(storage, PROFILE_A, geometry), getDefaultModulePositions(geometry));
  assert.equal(loadProfileSystemPresentation(storage, PROFILE_A), null);
  assert.equal(saveProfileModulePositions(null, PROFILE_A, positionsA), false);
  assert.equal(saveProfileSystemPresentation(storage, 'invalid', {}), false);
  assert.equal(removeProfileModulePositions(null, PROFILE_A), false);
});
