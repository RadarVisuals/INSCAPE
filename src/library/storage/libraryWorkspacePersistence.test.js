import assert from 'node:assert/strict';
import test from 'node:test';
import { browserLibraryStorage, createLibraryWorkspacePersistence } from './libraryWorkspacePersistence.js';
import { libraryWorkspaceKey } from './libraryWorkspaceStorage.js';

const profile = '0x1111111111111111111111111111111111111111';
const storageFor = () => {
  const records = new Map(); let denied = false;
  return { records, deny: (value) => { denied = value; },
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { if (denied) throw new Error('quota'); records.set(key, value); } };
};

test('failed writes preserve persisted bytes and can be retried after storage recovers', () => {
  const storage = storageFor(); const persistence = createLibraryWorkspacePersistence(storage);
  const { workspace } = persistence.load(profile);
  const candidate = { ...workspace, favorites: ['saved-asset'] };
  storage.deny(true);
  assert.equal(persistence.save(candidate).ok, false);
  assert.equal(storage.records.size, 0);
  storage.deny(false);
  assert.equal(persistence.save(candidate).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem(libraryWorkspaceKey(profile))).favorites, ['saved-asset']);
});

test('corrupt current data stays intact even when legacy data exists', () => {
  const storage = storageFor(); const key = libraryWorkspaceKey(profile);
  storage.records.set(key, '{corrupt');
  storage.records.set(libraryWorkspaceKey(profile, 8), JSON.stringify({ version: 8, profileAddress: profile, folders: [] }));
  const persistence = createLibraryWorkspacePersistence(storage);
  const loaded = persistence.load(profile);
  assert.match(loaded.persistenceError, /preserved/);
  assert.equal(persistence.save(loaded.workspace).ok, false);
  assert.equal(storage.getItem(key), '{corrupt');
});

test('two Library authorities cannot overwrite a visible external edit or removal', () => {
  const storage = storageFor();
  const first = createLibraryWorkspacePersistence(storage), second = createLibraryWorkspacePersistence(storage);
  const a = first.load(profile).workspace, b = second.load(profile).workspace;
  assert.equal(first.save({ ...a, favorites: ['first'] }).ok, true);
  assert.equal(second.save({ ...b, favorites: ['second'] }).ok, false);
  assert.deepEqual(JSON.parse(storage.getItem(libraryWorkspaceKey(profile))).favorites, ['first']);
  second.load(profile);
  assert.equal(second.save({ ...b, favorites: ['continued'] }).ok, true);
  storage.records.delete(libraryWorkspaceKey(profile));
  assert.equal(second.save(b).ok, false);
  assert.equal(storage.records.size, 0);
});

test('a blocked browser storage getter does not escape during acquisition', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.defineProperty({}, 'localStorage', { get() { throw new Error('blocked'); } }) });
  try { assert.equal(browserLibraryStorage(), null); }
  finally { if (original) Object.defineProperty(globalThis, 'window', original); else delete globalThis.window; }
});

test('legacy data remains migratable, while malformed legacy data is preserved and blocked', () => {
  for (const valid of [true, false]) {
    const storage = storageFor(); const legacyKey = libraryWorkspaceKey(profile, 8);
    const raw = valid ? JSON.stringify({ version: 8, profileAddress: profile, favorites: ['legacy'], folders: [] }) : '{broken legacy';
    storage.records.set(legacyKey, raw);
    const persistence = createLibraryWorkspacePersistence(storage);
    const loaded = persistence.load(profile);
    assert.equal(storage.getItem(legacyKey), raw);
    if (valid) {
      assert.equal(loaded.persistenceError, null);
      assert.deepEqual(loaded.workspace.favorites, ['legacy']);
      assert.equal(persistence.save(loaded.workspace).ok, true);
    } else {
      assert.ok(loaded.persistenceError);
      assert.equal(persistence.save(loaded.workspace).ok, false);
      assert.equal(storage.getItem(libraryWorkspaceKey(profile)), null);
    }
  }
});
