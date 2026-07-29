import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../domain/latticeProductionDraft.js';
import {
  LATTICE_PRODUCTION_DRAFT_KEY_PREFIX,
  createLatticeProductionDraftStore,
  latticeProductionDraftKey,
} from './latticeProductionDraftStore.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const uppercase = (profile) => profile.toUpperCase().replace('0X', '0x');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writeCount = 0;
  let writeError = null;
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (writeError) throw writeError;
      writeCount += 1;
      values.set(key, value);
    },
    failWrites(error = new Error('quota exceeded')) { writeError = error; },
    get writeCount() { return writeCount; },
    values,
  };
}

function titledDraft(profileAddress, title) {
  const draft = createEmptyLatticeProductionDraft(profileAddress);
  draft.tables[4].title = title;
  return draft;
}

function assertDeeplyFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  Reflect.ownKeys(value).forEach((key) => assertDeeplyFrozen(value[key], seen));
}

test('canonical storage keys use one versioned lowercase profile scope', () => {
  assert.equal(LATTICE_PRODUCTION_DRAFT_KEY_PREFIX, 'inscape.lattice-production-draft.v1:');
  assert.equal(latticeProductionDraftKey(uppercase(PROFILE_A)), `${LATTICE_PRODUCTION_DRAFT_KEY_PREFIX}${PROFILE_A}`);
  assert.notEqual(latticeProductionDraftKey(PROFILE_A), latticeProductionDraftKey(PROFILE_B));
  assert.throws(() => latticeProductionDraftKey('not-a-profile'), /valid profile address/);
});

test('completed operations persist validated drafts immediately and reload them', () => {
  const storage = memoryStorage();
  const store = createLatticeProductionDraftStore({ storage, profileAddress: uppercase(PROFILE_A) });
  const candidate = titledDraft(PROFILE_A, 'Completed composition');

  assert.equal(storage.writeCount, 0);
  assert.equal(store.commitCompletedOperation(candidate), true);
  assert.equal(storage.writeCount, 1);
  assert.deepEqual(JSON.parse(storage.values.get(latticeProductionDraftKey(PROFILE_A))), candidate);

  const restored = createLatticeProductionDraftStore({ storage, profileAddress: PROFILE_A });
  assert.equal(restored.getDraft().tables[4].title, 'Completed composition');
});

test('preview and caller mutations cannot write or mutate accepted state', () => {
  const storage = memoryStorage();
  const store = createLatticeProductionDraftStore({ storage, profileAddress: PROFILE_A });
  const candidate = titledDraft(PROFILE_A, 'Committed title');
  assert.equal(store.commitCompletedOperation(candidate), true);

  candidate.tables[4].title = 'Caller changed candidate';
  const first = store.getDraft();
  assertDeeplyFrozen(first);
  assert.throws(() => { first.tables[4].title = 'Preview title'; }, TypeError);
  assert.equal(storage.writeCount, 1);

  const second = store.getDraft();
  assert.notEqual(first, second);
  assert.notEqual(first.tables, second.tables);
  assert.equal(second.tables[4].title, 'Committed title');
});

test('invalid completed operations fail closed without overwriting accepted state', () => {
  const storage = memoryStorage();
  const store = createLatticeProductionDraftStore({ storage, profileAddress: PROFILE_A });
  assert.equal(store.commitCompletedOperation(titledDraft(PROFILE_A, 'Last valid title')), true);
  const persisted = storage.values.get(latticeProductionDraftKey(PROFILE_A));

  const invalid = titledDraft(PROFILE_A, 'Invalid title');
  invalid.activeTable = { x: 1, y: 0 };
  assert.equal(store.commitCompletedOperation(invalid), false);
  assert.equal(store.commitCompletedOperation(titledDraft(PROFILE_B, 'Wrong profile')), false);
  assert.equal(storage.writeCount, 1);
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE_A)), persisted);
  assert.equal(store.getDraft().tables[4].title, 'Last valid title');
});

test('malformed, unsupported, and wrong-profile records recover to an unwritten empty draft', () => {
  const corruptRecords = [
    '{broken',
    JSON.stringify({ ...titledDraft(PROFILE_A, 'Future'), draftVersion: 2 }),
    JSON.stringify(titledDraft(PROFILE_B, 'Other profile')),
  ];

  corruptRecords.forEach((raw) => {
    const storage = memoryStorage({ [latticeProductionDraftKey(PROFILE_A)]: raw });
    const store = createLatticeProductionDraftStore({ storage, profileAddress: PROFILE_A });
    assert.equal(store.getDraft().profileAddress, PROFILE_A);
    assert.equal(store.getDraft().tables[4].title, '');
    assert.equal(storage.writeCount, 0);
    assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE_A)), raw);
  });
});

test('failed storage writes retain the previous successfully persisted in-memory draft', () => {
  const storage = memoryStorage();
  const store = createLatticeProductionDraftStore({ storage, profileAddress: PROFILE_A });
  assert.equal(store.commitCompletedOperation(titledDraft(PROFILE_A, 'Persisted')), true);
  const persisted = storage.values.get(latticeProductionDraftKey(PROFILE_A));

  storage.failWrites();
  assert.equal(store.commitCompletedOperation(titledDraft(PROFILE_A, 'Not persisted')), false);
  assert.equal(store.getDraft().tables[4].title, 'Persisted');
  assert.equal(storage.values.get(latticeProductionDraftKey(PROFILE_A)), persisted);
});

test('profile switching isolates drafts and rejects late cross-profile commits', () => {
  const storage = memoryStorage();
  const store = createLatticeProductionDraftStore({ storage, profileAddress: PROFILE_A });
  const lateProfileACommit = titledDraft(PROFILE_A, 'Late A');
  assert.equal(store.commitCompletedOperation(titledDraft(PROFILE_A, 'Profile A')), true);

  assert.equal(store.setProfileAddress(PROFILE_B), true);
  assert.equal(store.getProfileAddress(), PROFILE_B);
  assert.equal(store.getDraft().tables[4].title, '');
  assert.equal(store.commitCompletedOperation(lateProfileACommit), false);
  assert.equal(store.commitCompletedOperation(titledDraft(PROFILE_B, 'Profile B')), true);

  assert.equal(store.setProfileAddress(PROFILE_A), true);
  assert.equal(store.getDraft().tables[4].title, 'Profile A');
  assert.equal(store.setProfileAddress(PROFILE_B), true);
  assert.equal(store.getDraft().tables[4].title, 'Profile B');
  assert.notEqual(
    storage.values.get(latticeProductionDraftKey(PROFILE_A)),
    storage.values.get(latticeProductionDraftKey(PROFILE_B)),
  );
});
