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

test('corrupt current data stays intact and blocks writes', () => {
  const storage = storageFor(); const key = libraryWorkspaceKey(profile);
  storage.records.set(key, '{corrupt');
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

test('unsupported versions under the current key stay intact and block writes until explicit reload after repair', () => {
  for (const version of [1, 8, 10]) {
    const storage = storageFor(), key = libraryWorkspaceKey(profile);
    const raw = JSON.stringify({ version, profileAddress: profile, favorites: ['unsupported'], folders: [] });
    storage.records.set(key, raw);
    const persistence = createLibraryWorkspacePersistence(storage), loaded = persistence.load(profile);
    assert.match(loaded.persistenceError, /preserved/);
    assert.equal(persistence.save(loaded.workspace).ok, false);
    assert.equal(storage.getItem(key), raw);
    storage.records.set(key, JSON.stringify({ version: 9, profileAddress: profile, favorites: ['repaired'], folders: [] }));
    assert.equal(persistence.save(loaded.workspace).ok, false, 'external repair does not silently grant write access');
    const recovered = persistence.load(profile);
    assert.equal(recovered.persistenceError, null); assert.deepEqual(recovered.workspace.favorites, ['repaired']);
    assert.equal(persistence.save(recovered.workspace).ok, true);
  }
});

test('historical keys are neither read, migrated nor removed when the current record is absent', () => {
  const storage = storageFor(), historical = `inscape.library-workspace.v8:${profile}`, reads = [];
  const raw = '{historical bytes'; storage.records.set(historical, raw);
  const get = storage.getItem; storage.getItem = key => { reads.push(key); return get(key); };
  const persistence = createLibraryWorkspacePersistence(storage), loaded = persistence.load(profile);
  assert.equal(loaded.persistenceError, null); assert.deepEqual(loaded.workspace.favorites, []);
  assert.equal(storage.records.size, 1); assert.deepEqual(reads, [libraryWorkspaceKey(profile)]);
  assert.equal(persistence.save({ ...loaded.workspace, favorites: ['new'] }).ok, true);
  assert.equal(storage.records.get(historical), raw);
});

test('a failed read blocks writes and a successful reload restores current data', () => {
  const storage = storageFor(), get = storage.getItem;
  storage.getItem = () => { throw new Error('denied'); };
  const persistence = createLibraryWorkspacePersistence(storage), failed = persistence.load(profile);
  assert.match(failed.persistenceError, /unavailable/); assert.equal(persistence.save(failed.workspace).ok, false);
  storage.getItem = get;
  const recovered = persistence.load(profile);
  assert.equal(recovered.persistenceError, null); assert.equal(persistence.save(recovered.workspace).ok, true);
});
