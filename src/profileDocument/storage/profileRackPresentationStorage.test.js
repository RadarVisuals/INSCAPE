import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultProfileRackPresentation,
  loadProfileRackPresentation,
  profileRackPresentationKey,
  saveProfileRackPresentation,
  setIdentityDisclosureVisibility,
  setIdentityModuleOrder
} from './profileRackPresentationStorage.js';

const PROFILE = '0xf3C189819Fd5b042f692983bFbFD57ab607ee709';
const OTHER = '0x1111111111111111111111111111111111111111';

function memoryStorage() {
  const records = new Map();
  return {
    records,
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value)
  };
}

test('profile disclosure defaults fail closed while the public profile module remains visible', () => {
  const value = createDefaultProfileRackPresentation();
  assert.equal(value.identity.visible, true);
  assert.deepEqual(value.identity.modules.map(({ id, visible }) => [id, visible]), [
    ['profile', true], ['bio', false], ['links-tags', false]
  ]);
});

test('owner disclosure choices persist independently per normalized profile address', () => {
  const storage = memoryStorage();
  const disclosed = setIdentityDisclosureVisibility(
    setIdentityDisclosureVisibility(createDefaultProfileRackPresentation(), 'bio', true),
    'links-tags',
    true
  );
  assert.equal(saveProfileRackPresentation(storage, PROFILE, disclosed), true);
  assert.equal(loadProfileRackPresentation(storage, PROFILE).identity.modules.find((module) => module.id === 'bio').visible, true);
  assert.equal(loadProfileRackPresentation(storage, OTHER).identity.modules.find((module) => module.id === 'bio').visible, false);
  assert.equal(storage.records.has(profileRackPresentationKey(PROFILE)), true);
});

test('malformed storage and attempts to hide the required profile module fail closed', () => {
  const storage = memoryStorage();
  storage.records.set(profileRackPresentationKey(PROFILE), '{bad');
  assert.deepEqual(loadProfileRackPresentation(storage, PROFILE), createDefaultProfileRackPresentation());
  storage.records.set(profileRackPresentationKey(PROFILE), JSON.stringify({
    version: 1,
    identity: { id: 'identity', visible: false, modules: [
      { id: 'profile', visible: false }, { id: 'bio', visible: true }, { id: 'links-tags', visible: false }
    ] }
  }));
  const normalized = loadProfileRackPresentation(storage, PROFILE);
  assert.equal(normalized.identity.visible, true);
  assert.equal(normalized.identity.modules.find((module) => module.id === 'profile').visible, true);
  assert.equal(normalized.identity.modules.find((module) => module.id === 'bio').visible, true);
});

test('storage failures leave the caller in control and invalid addresses are rejected', () => {
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadProfileRackPresentation(throwing, PROFILE), createDefaultProfileRackPresentation());
  assert.equal(saveProfileRackPresentation(throwing, PROFILE, createDefaultProfileRackPresentation()), false);
  assert.equal(saveProfileRackPresentation(memoryStorage(), 'invalid', createDefaultProfileRackPresentation()), false);
});

test('owner identity module order is normalized without changing disclosure choices', () => {
  const disclosed = setIdentityDisclosureVisibility(
    setIdentityDisclosureVisibility(createDefaultProfileRackPresentation(), 'bio', true),
    'links-tags',
    true
  );
  const arranged = setIdentityModuleOrder(disclosed, ['links-tags', 'bio', 'profile']);
  assert.deepEqual(arranged.identity.modules.map(({ id, order, visible }) => [id, order, visible]), [
    ['links-tags', 0, true], ['bio', 1, true], ['profile', 2, true]
  ]);
  assert.deepEqual(
    setIdentityModuleOrder(disclosed, ['bio', 'bio', 'unknown']).identity.modules.map(({ id }) => id),
    ['bio', 'profile', 'links-tags']
  );
});

test('owner identity module order survives a persisted draft round trip', () => {
  const storage = memoryStorage();
  const arranged = setIdentityModuleOrder(
    createDefaultProfileRackPresentation(),
    ['links-tags', 'profile', 'bio']
  );

  assert.equal(saveProfileRackPresentation(storage, PROFILE, arranged), true);
  assert.deepEqual(
    loadProfileRackPresentation(storage, PROFILE).identity.modules.map(({ id, order }) => [id, order]),
    [['links-tags', 0], ['profile', 1], ['bio', 2]]
  );
});
