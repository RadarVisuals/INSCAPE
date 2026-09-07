import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveIdentityCard } from '../profileIdentity/domain/identityCard.js';
import { createEmptySystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { systemWorkflowGridFingerprint } from './domain/systemWorkflowGrid.js';
import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';
import {
  SYSTEM_WORKFLOW_RECORD_STATUS,
  createSystemWorkflowDraftStore,
  systemWorkflowDraftKey,
} from './systemWorkflowDraftStore.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';

function memoryStorage(initial = {}) {
  const records = new Map(Object.entries(initial));
  const activity = { reads: 0, writes: 0, removes: 0 };
  const failures = { read: false, write: false, remove: false };
  return {
    activity,
    failures,
    records,
    getItem(key) {
      activity.reads += 1;
      if (failures.read) throw new Error('read failed');
      return records.has(key) ? records.get(key) : null;
    },
    setItem(key, value) {
      activity.writes += 1;
      if (failures.write) throw new Error('write failed');
      records.set(key, value);
    },
    removeItem(key) {
      activity.removes += 1;
      if (failures.remove) throw new Error('remove failed');
      records.delete(key);
    },
  };
}

const createStore = (storage, profileAddress = PROFILE_A) => createSystemWorkflowDraftStore({
  generateGridId: () => profileAddress === PROFILE_A ? 'home-a' : 'home-b',
  profileAddress,
  storage,
});

test('Identity artwork saves its chosen image without changing Grids, and rejects stale or failed writes', () => {
  const storage = memoryStorage(); const store = createStore(storage);
  const session = createSystemWorkflowAuthoringSession({ store });
  const original = store.getDraft();
  const avatar = { mode: 'inscape', stableAssetId: `42:${PROFILE_B}:0x01`, shape: 'square',
    selectedMedia: { url: 'https://assets.example/purple.png', width: 2000, height: 2000 } };
  assert.equal(session.setIdentityAvatar({ expectedAvatar: original.identityPresentation.avatar, avatar }), true);
  assert.equal(storage.activity.writes, 1);
  assert.deepEqual(createStore(storage).getDraft().identityPresentation.avatar, avatar);
  assert.deepEqual(store.getDraft().grids, original.grids);
  assert.equal(session.setIdentityAvatar({ expectedAvatar: avatar, avatar }), false);
  assert.throws(() => session.setIdentityAvatar({ expectedAvatar: original.identityPresentation.avatar, avatar }), /changed/);
  assert.throws(() => session.setIdentityAvatar({ expectedAvatar: avatar,
    avatar: { ...avatar, selectedMedia: { ...avatar.selectedMedia, url: 'javascript:alert(1)' } } }));
  storage.failures.write = true;
  assert.throws(() => session.setIdentityAvatar({ expectedAvatar: avatar, avatar: original.identityPresentation.avatar }), /could not be saved/);
  assert.deepEqual(store.getDraft().identityPresentation.avatar, avatar);
});

test('a second editor cannot overwrite an already saved external change', () => {
  const storage = memoryStorage();
  const first = createStore(storage); const second = createStore(storage);
  const earlier = second.getDraft();
  const newer = first.getDraft(); newer.grids[0].subtitle = 'saved in first tab';
  assert.equal(first.commitCompletedOperation(newer, { expectedGeneration: 0 }), true);
  const saved = storage.records.get(systemWorkflowDraftKey(PROFILE_A));
  earlier.grids[0].subtitle = 'stale second tab';
  assert.equal(second.commitCompletedOperation(earlier, { expectedGeneration: 0 }), false);
  assert.equal(second.getGeneration(), 0);
  assert.equal(storage.records.get(systemWorkflowDraftKey(PROFILE_A)), saved);
  second.reload();
  const refreshed = second.getDraft(); refreshed.grids[0].subtitle = 'continued after reload';
  assert.equal(second.commitCompletedOperation(refreshed, { expectedGeneration: second.getGeneration() }), true);
});

test('external removal and read failure preserve the accepted draft and do not write', () => {
  const storage = memoryStorage(); const store = createStore(storage);
  assert.equal(store.commitCompletedOperation(store.getDraft(), { expectedGeneration: 0 }), true);
  const before = store.getDraft(); const writes = storage.activity.writes;
  storage.failures.read = true;
  assert.equal(store.commitCompletedOperation(before, { expectedGeneration: 1 }), false);
  storage.failures.read = false;
  storage.records.delete(systemWorkflowDraftKey(PROFILE_A));
  assert.equal(store.commitCompletedOperation(before, { expectedGeneration: 1 }), false);
  assert.equal(storage.activity.writes, writes);
  assert.deepEqual(store.getDraft(), before);
  assert.equal(store.getGeneration(), 1);
});

test('a stale corruption confirmation never removes a replacement record', () => {
  for (const replacement of ['different corruption', JSON.stringify(createEmptySystemWorkflowDraft(PROFILE_A, { generateId: () => 'replacement' }))]) {
    const key = systemWorkflowDraftKey(PROFILE_A);
    const storage = memoryStorage({ [key]: '{broken' }); const store = createStore(storage);
    const expectedFingerprint = store.getRecordState().fingerprint;
    storage.records.set(key, replacement);
    assert.equal(store.resetCorruptDraft({ expectedFingerprint, profileAddress: PROFILE_A }), false);
    assert.equal(storage.records.get(key), replacement);
    assert.equal(storage.activity.removes, 0);
  }
});

test('corrupt canonical records block authoring and require exact explicit recovery', () => {
  const key = systemWorkflowDraftKey(PROFILE_A);
  const storage = memoryStorage({ [key]: '{not-json' });
  const store = createStore(storage);
  const corrupt = store.getRecordState();
  assert.equal(corrupt.status, SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT);
  assert.match(corrupt.fingerprint, /^0x[0-9a-f]{64}$/u);
  assert.throws(() => store.getDraft(), { code: 'SYSTEM_WORKFLOW_DRAFT_CORRUPT' });
  assert.equal(store.commitCompletedOperation(createEmptySystemWorkflowDraft(PROFILE_A, {
    generateId: () => 'candidate',
  }), {
    expectedGeneration: store.getGeneration(),
  }), false);
  assert.equal(storage.records.get(key), '{not-json');
  assert.equal(storage.activity.writes, 0);
  assert.equal(store.resetCorruptDraft({
    expectedFingerprint: `${corrupt.fingerprint.slice(0, -1)}0`,
    profileAddress: PROFILE_A,
  }), false);
  assert.equal(store.resetCorruptDraft({
    expectedFingerprint: corrupt.fingerprint,
    profileAddress: PROFILE_B,
  }), false);
  storage.failures.remove = true;
  assert.equal(store.resetCorruptDraft({
    expectedFingerprint: corrupt.fingerprint,
    profileAddress: PROFILE_A,
  }), false);
  assert.equal(storage.records.get(key), '{not-json');
  storage.failures.remove = false;
  assert.equal(store.resetCorruptDraft({
    expectedFingerprint: corrupt.fingerprint,
    profileAddress: PROFILE_A,
  }), true);
  assert.equal(storage.records.has(key), false);
  assert.equal(store.getRecordState().status, SYSTEM_WORKFLOW_RECORD_STATUS.ABSENT);
  assert.equal(store.getDraft().grids[0].id, 'grid:home-a');
  assert.equal(storage.activity.writes, 0);
});

test('read and write failures fail closed without changing the accepted generation or draft', () => {
  const unreadableStorage = memoryStorage();
  unreadableStorage.failures.read = true;
  const unreadable = createStore(unreadableStorage);
  assert.equal(unreadable.getRecordState().status, SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE);
  assert.throws(() => unreadable.getDraft(), { code: 'SYSTEM_WORKFLOW_STORAGE_UNAVAILABLE' });
  unreadableStorage.failures.read = false;
  assert.equal(unreadable.reload(), true);
  assert.equal(unreadable.getRecordState().status, SYSTEM_WORKFLOW_RECORD_STATUS.ABSENT);

  const storage = memoryStorage();
  const store = createStore(storage);
  const generation = store.getGeneration();
  const before = store.getDraft();
  const candidate = structuredClone(before);
  candidate.grids[0].subtitle = 'candidate';
  storage.failures.write = true;
  assert.equal(store.commitCompletedOperation(candidate, { expectedGeneration: generation }), false);
  assert.equal(store.getGeneration(), generation);
  assert.deepEqual(store.getDraft(), before);
  assert.equal(storage.records.has(systemWorkflowDraftKey(PROFILE_A)), false);
});

test('getDraft is detached and profile records remain isolated', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const detached = store.getDraft();
  detached.grids[0].title = 'MUTATED';
  detached.grids.push(detached.grids[0]);
  assert.equal(store.getDraft().grids[0].title, 'HOME');
  assert.equal(store.getDraft().grids.length, 2);

  const draftA = store.getDraft();
  draftA.grids[0].subtitle = 'profile-a';
  assert.equal(store.commitCompletedOperation(draftA, {
    expectedGeneration: store.getGeneration(),
  }), true);
  assert.equal(store.setProfileAddress(PROFILE_B), true);
  assert.equal(store.getDraft().profileAddress, PROFILE_B);
  assert.equal(store.getDraft().grids[0].subtitle, '');
  assert.equal(store.setProfileAddress(PROFILE_A), true);
  assert.equal(store.getDraft().grids[0].subtitle, 'profile-a');
});

test('session commits exactly once per completed operation and persists no-op or stale Grid edits never', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const session = createSystemWorkflowAuthoringSession({ store });
  const home = session.getState().draft.grids[0];
  const fingerprint = systemWorkflowGridFingerprint(home);
  assert.equal(session.renameGrid({
    expectedGridFingerprint: fingerprint,
    gridId: home.id,
    name: home.title,
  }), false);
  assert.equal(session.setGridVisibility({
    expectedGridFingerprint: fingerprint,
    gridId: home.id,
    visibility: home.visibility,
  }), false);
  assert.equal(storage.activity.writes, 0);

  assert.equal(session.renameGrid({
    expectedGridFingerprint: fingerprint,
    gridId: home.id,
    name: 'ARCHIVE',
  }), true);
  assert.equal(storage.activity.writes, 1);
  assert.equal(session.getState().draft.grids[0].title, 'ARCHIVE');
  assert.throws(() => session.setGridVisibility({
    expectedGridFingerprint: fingerprint,
    gridId: home.id,
    visibility: 'PRIVATE',
  }), { code: 'SYSTEM_WORKFLOW_GRID_STALE' });
  assert.equal(storage.activity.writes, 1);

  assert.equal(session.createGrid({ generateId: () => 'second' }), true);
  assert.equal(storage.activity.writes, 2);
  assert.deepEqual(session.getState().draft.grids.map(({ id }) => id), [
    'grid:home-a', 'grid:second', 'grid:world-cover',
  ]);
});

test('Identity details persist separately, reject stale edits and preserve the draft on storage failure', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const session = createSystemWorkflowAuthoringSession({ store });
  const initial = store.getDraft();
  const { alias, bio, tags } = initial.identityPresentation;
  const expectedDetails = { alias, bio, tags };
  const details = { alias: 'Human Underneath', bio: { mode: 'inscape', customText: 'A story from my world.' }, tags: { ...tags, additional: ['Illustration'] } };
  assert.equal(session.setIdentityDetails({ expectedDetails, details }), true);
  assert.equal(storage.activity.writes, 1);
  assert.deepEqual(store.getDraft().grids, initial.grids);
  assert.deepEqual(store.getDraft().identityPresentation.avatar, initial.identityPresentation.avatar);
  assert.equal(createStore(storage).getDraft().identityPresentation.alias, 'Human Underneath');
  assert.throws(() => session.setIdentityDetails({ expectedDetails, details: { ...details, alias: 'Stale' } }), { code: 'SYSTEM_WORKFLOW_IDENTITY_STALE' });
  assert.equal(session.setIdentityDetails({ expectedDetails: details, details }), false);
  assert.equal(storage.activity.writes, 1);
  assert.throws(() => session.setIdentityDetails({ expectedDetails: details, details: { ...details, alias: 'x'.repeat(81) } }));
  const saved = store.getDraft();
  storage.failures.write = true;
  assert.throws(() => session.setIdentityDetails({ expectedDetails: details, details: { ...details, alias: 'Unsaved' } }), { code: 'SYSTEM_WORKFLOW_OPERATION_STALE' });
  assert.deepEqual(store.getDraft(), saved);
});

test('Identity card saves are isolated, durable and reject stale or failed writes', () => {
  const storage = memoryStorage(); const store = createStore(storage);
  const session = createSystemWorkflowAuthoringSession({ store });
  const before = store.getDraft(); const expectedCard = resolveIdentityCard(before.identityPresentation);
  const card = { ...expectedCard, background: { type: 'clouds', color: '#123456', speed: 0 }, fields: [
    { id: 'field:role', label: 'Role', type: 'list', value: ['Artist', 'Writer'] },
  ] };
  assert.equal(session.setIdentityCard({ expectedCard, card }), true);
  assert.equal(storage.activity.writes, 1);
  assert.deepEqual(createStore(storage).getDraft().identityPresentation.card, card);
  assert.deepEqual(store.getDraft().grids, before.grids);
  assert.deepEqual(store.getDraft().identityPresentation.avatar, before.identityPresentation.avatar);
  assert.equal(session.setIdentityCard({ expectedCard: card, card }), false);
  assert.throws(() => session.setIdentityCard({ expectedCard, card }), { code: 'SYSTEM_WORKFLOW_IDENTITY_STALE' });
  assert.equal(storage.activity.writes, 1);
  storage.failures.write = true;
  assert.throws(() => session.setIdentityCard({ expectedCard: card, card: { ...card, fields: [] } }), { code: 'SYSTEM_WORKFLOW_OPERATION_STALE' });
  assert.deepEqual(store.getDraft().identityPresentation.card, card);
});

test('explicitly saving the default Identity background makes it durable without rewriting old drafts on read', () => {
  const storage = memoryStorage(); const store = createStore(storage);
  const session = createSystemWorkflowAuthoringSession({ store });
  const expectedCard = resolveIdentityCard(store.getDraft().identityPresentation);
  assert.equal(Object.hasOwn(store.getDraft().identityPresentation, 'card'), false);
  assert.equal(storage.activity.writes, 0);
  assert.equal(session.setIdentityCard({ expectedCard, card: expectedCard }), true);
  assert.deepEqual(store.getDraft().identityPresentation.card, expectedCard);
  assert.equal(session.setIdentityCard({ expectedCard, card: expectedCard }), false);
  assert.equal(storage.activity.writes, 1);
});

test('removed broad updatePlacement authority is not exposed by the session', () => {
  const session = createSystemWorkflowAuthoringSession({ store: createStore(memoryStorage()) });
  assert.equal(Object.hasOwn(session, 'updatePlacement'), false);
});
