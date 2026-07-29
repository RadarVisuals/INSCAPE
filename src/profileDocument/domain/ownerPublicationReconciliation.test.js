import test from 'node:test';
import assert from 'node:assert/strict';
import { decideOwnerPublicationReconciliation, executeOwnerPublicationReconciliationTransaction, isWorkspacePublicProjectionEmpty, OWNER_RECONCILIATION_ACTION as ACTION } from './ownerPublicationReconciliation.js';
import { createEmptyLatticeProductionDraft } from '../../lattice/domain/latticeProductionDraft.js';
import { createLatticeProductionDraftStore, latticeProductionDraftKey } from '../../lattice/storage/latticeProductionDraftStore.js';

const input = (overrides = {}) => ({
  localRecordPresence: 'current',
  localFingerprint: 'local',
  localPublicProjectionEmpty: false,
  baseline: { publishedFingerprint: 'base', localFingerprint: 'base' },
  publishedFingerprint: 'base',
  ...overrides
});

test('an absent owner workspace hydrates from the verified publication', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ localRecordPresence: 'absent' })), ACTION.HYDRATE_PUBLICATION);
});

test('legacy empty records from premature autosave hydrate once when no baseline exists', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ baseline: null, localPublicProjectionEmpty: true })), ACTION.HYDRATE_PUBLICATION);
});

test('unchanged local state fast-forwards when the publication advances', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ localFingerprint: 'base', publishedFingerprint: 'next' })), ACTION.HYDRATE_PUBLICATION);
});

test('newer local state survives while publication remains at its baseline', () => {
  assert.equal(decideOwnerPublicationReconciliation(input()), ACTION.KEEP_LOCAL);
});

test('two divergent changes require an explicit conflict decision', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ publishedFingerprint: 'next' })), ACTION.CONFLICT);
});

test('matching local and published state adopts the current publication baseline', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ localFingerprint: 'same', publishedFingerprint: 'same' })), ACTION.ADOPT_BASELINE);
});

test('public projection emptiness ignores private folders and private artwork', () => {
  assert.equal(isWorkspacePublicProjectionEmpty({ folders: [{ public: false }], canvas: { objects: [{ visitorVisible: false }] } }), true);
  assert.equal(isWorkspacePublicProjectionEmpty({ folders: [{ public: true }], canvas: { objects: [] } }), false);
  assert.equal(isWorkspacePublicProjectionEmpty({ folders: [], canvas: { objects: [{ visitorVisible: true }] } }), false);
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('corrupt canonical records block before compatibility and baseline writes', () => {
  const profile = '0x1111111111111111111111111111111111111111';
  const storage = memoryStorage({ [latticeProductionDraftKey(profile)]: '{corrupt' });
  const latticeStore = createLatticeProductionDraftStore({ storage, profileAddress: profile });
  const calls = [];
  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: profile,
    latticeStore,
    latticeDraft: createEmptyLatticeProductionDraft(profile),
    compatibilityOperations: [{ name: 'compatibility', apply: () => calls.push('compatibility'), compensate: () => true }],
    baselineOperation: { apply: () => calls.push('baseline'), compensate: () => true },
  }), (error) => error.code === 'OWNER_RECONCILIATION_CORRUPT_LATTICE');
  assert.deepEqual(calls, []);
  assert.equal(storage.values.get(latticeProductionDraftKey(profile)), '{corrupt');
});

test('baseline failure compensates canonical and compatibility state in reverse order', () => {
  const profile = '0x1111111111111111111111111111111111111111';
  const prior = createEmptyLatticeProductionDraft(profile);
  prior.tables[4].title = 'Prior';
  const storage = memoryStorage({ [latticeProductionDraftKey(profile)]: JSON.stringify(prior) });
  const latticeStore = createLatticeProductionDraftStore({ storage, profileAddress: profile });
  const next = createEmptyLatticeProductionDraft(profile);
  next.tables[4].title = 'Hydrated';
  const calls = [];
  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: profile,
    latticeStore,
    latticeDraft: next,
    compatibilityOperations: [
      { name: 'workspace', apply: () => { calls.push('write-workspace'); return true; }, compensate: () => { calls.push('restore-workspace'); return true; } },
      { name: 'signals', apply: () => { calls.push('write-signals'); return true; }, compensate: () => { calls.push('restore-signals'); return true; } },
    ],
    baselineOperation: {
      apply: () => { calls.push('write-baseline'); return false; },
      compensate: () => { calls.push('restore-baseline'); return true; },
    },
  }), /baseline/);
  assert.deepEqual(calls, [
    'write-workspace', 'write-signals', 'write-baseline', 'restore-baseline', 'restore-signals', 'restore-workspace',
  ]);
  assert.equal(latticeStore.getDraft().tables[4].title, 'Prior');
  assert.deepEqual(JSON.parse(storage.values.get(latticeProductionDraftKey(profile))), prior);
});

test('compensation failures are collected while remaining compensation continues', () => {
  const calls = [];
  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: '0x1111111111111111111111111111111111111111',
    compatibilityOperations: [
      { name: 'first', apply: () => true, compensate: () => { calls.push('first'); return false; } },
      { name: 'second', apply: () => true, compensate: () => { calls.push('second'); throw new Error('second failed'); } },
    ],
    baselineOperation: { apply: () => false, compensate: () => { calls.push('baseline'); return false; } },
  }), (error) => {
    assert.equal(error.compensationErrors.length, 3);
    return true;
  });
  assert.deepEqual(calls, ['baseline', 'second', 'first']);
});

test('runtime application failure compensates runtime, baseline, lattice, and compatibility in reverse order', () => {
  const profile = '0x1111111111111111111111111111111111111111';
  const prior = createEmptyLatticeProductionDraft(profile);
  prior.tables[4].title = 'Prior';
  const storage = memoryStorage({ [latticeProductionDraftKey(profile)]: JSON.stringify(prior) });
  const underlyingStore = createLatticeProductionDraftStore({ storage, profileAddress: profile });
  const next = createEmptyLatticeProductionDraft(profile);
  next.tables[4].title = 'Hydrated';
  const calls = [];
  const latticeStore = {
    getProfileAddress: () => underlyingStore.getProfileAddress(),
    classifyForReconciliation: () => underlyingStore.classifyForReconciliation(),
    commitCompletedOperation: (draft) => { calls.push('write-lattice'); return underlyingStore.commitCompletedOperation(draft); },
    restoreReconciliationCheckpoint: (checkpoint) => { calls.push('restore-lattice'); return underlyingStore.restoreReconciliationCheckpoint(checkpoint); },
  };

  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: profile,
    latticeStore,
    latticeDraft: next,
    compatibilityOperations: [{
      name: 'workspace', apply: () => { calls.push('write-workspace'); return true; },
      compensate: () => { calls.push('restore-workspace'); return true; },
    }],
    baselineOperation: {
      apply: () => { calls.push('write-baseline'); return true; },
      compensate: () => { calls.push('restore-baseline'); return true; },
    },
    runtimeOperations: [
      { name: 'runtime-one', apply: () => { calls.push('apply-runtime-one'); }, compensate: () => { calls.push('restore-runtime-one'); } },
      { name: 'runtime-two', apply: () => { calls.push('apply-runtime-two'); throw new Error('runtime failed'); }, compensate: () => { calls.push('restore-runtime-two'); } },
    ],
  }), /runtime failed/);
  assert.deepEqual(calls, [
    'write-workspace', 'write-lattice', 'write-baseline', 'apply-runtime-one', 'apply-runtime-two',
    'restore-runtime-two', 'restore-runtime-one', 'restore-baseline', 'restore-lattice', 'restore-workspace',
  ]);
  assert.deepEqual(JSON.parse(storage.values.get(latticeProductionDraftKey(profile))), prior);
});

test('non-hydration baseline failure is compensated and cannot complete reconciliation', () => {
  const calls = [];
  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: '0x1111111111111111111111111111111111111111',
    baselineOperation: {
      apply: () => { calls.push('write-baseline'); return false; },
      compensate: () => { calls.push('restore-baseline'); return true; },
    },
  }), (error) => error.stage === 'reconciliation baseline save');
  assert.deepEqual(calls, ['write-baseline', 'restore-baseline']);
});

test('late profile changes block the lattice commit and compensate attempted compatibility writes', () => {
  const profileA = '0x1111111111111111111111111111111111111111';
  const profileB = '0x2222222222222222222222222222222222222222';
  const profileBRecord = createEmptyLatticeProductionDraft(profileB);
  profileBRecord.tables[4].title = 'Profile B untouched';
  const storage = memoryStorage({ [latticeProductionDraftKey(profileB)]: JSON.stringify(profileBRecord) });
  const latticeStore = createLatticeProductionDraftStore({ storage, profileAddress: profileA });
  let activeProfile = profileA;
  const calls = [];
  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: profileA,
    getActiveProfileAddress: () => activeProfile,
    latticeStore,
    latticeDraft: createEmptyLatticeProductionDraft(profileA),
    compatibilityOperations: [{
      name: 'workspace',
      apply: () => {
        calls.push('write-workspace');
        activeProfile = profileB;
        latticeStore.setProfileAddress(profileB);
        return true;
      },
      compensate: () => { calls.push('restore-workspace'); return true; },
    }],
    baselineOperation: { apply: () => { calls.push('baseline'); return true; }, compensate: () => true },
  }), (error) => error.code === 'OWNER_RECONCILIATION_PROFILE_CHANGED');
  assert.deepEqual(calls, ['write-workspace', 'restore-workspace']);
  assert.deepEqual(JSON.parse(storage.values.get(latticeProductionDraftKey(profileB))), profileBRecord);
  assert.equal(storage.values.has(latticeProductionDraftKey(profileA)), false);
});

test('all candidates, operations, and context guards prevalidate before the first write', () => {
  const calls = [];
  assert.throws(() => executeOwnerPublicationReconciliationTransaction({
    profileAddress: '0x1111111111111111111111111111111111111111',
    isGenerationCurrent: () => true,
    compatibilityOperations: [{
      validate: () => false,
      apply: () => calls.push('write'),
      compensate: () => calls.push('restore'),
    }],
    baselineOperation: { apply: () => calls.push('baseline'), compensate: () => true },
  }), /prevalidation/);
  assert.deepEqual(calls, []);
});
