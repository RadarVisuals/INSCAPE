// @ts-check
import { reconcileRemovedWorkbenchMembers } from './domain/workbenchGroups.js';
import { reconcileArtworkLayers } from './domain/artworkLayers.js';
import { captureProfileDraftWriteAccess } from './profileEditorLease.js';
import { keccak256, stringToHex } from 'viem';
import { normalizeProfileAddress } from '../library/config.js';
import { draftChanges, applyDraftChanges, draftChangeLabel } from './draftHistory.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { DEFAULT_WORKBENCH_AREA } from './domain/workbenchArea.js';
import { bindWorkbenchTextRecovery, textRecoveries, TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import {
  FIRST_WORKBENCH_ID, WORKBENCH_COLLECTION_LIMIT, isWorkbenchCollection, createWorkbenchCollection, assertValidWorkbenchCollection,
  projectWorkbenchDraft, replaceWorkbenchDraft, appendWorkbench, validWorkbenchName,
} from './domain/workbenchCollection.js';
import {
  createEmptySystemWorkflowDraft,
  ensureSystemWorkflowWorldCoverGrid,
  validateSystemWorkflowDraft,
} from './domain/systemWorkflowDraft.js';

/** @typedef {import('../contracts/workbench.js').WorkflowDraft} WorkflowDraft */
/** @typedef {import('../contracts/workbench.js').WorkbenchCollection} WorkbenchCollection */
/** @typedef {import('../contracts/workbench.js').WorkbenchScope} WorkbenchScope */
/** @typedef {import('../contracts/workbench.js').RecordState} RecordState */
/** @typedef {{path: (string | number)[], before: unknown, after: unknown}} HistoryChange */
/** @typedef {{changes: HistoryChange[], label: string}} HistoryEntry */
/** @typedef {{undo: HistoryEntry[], redo: HistoryEntry[], acceptedRaw?: string | null}} History */
/** @typedef {{draft: WorkflowDraft | null, record?: WorkbenchCollection, raw?: string | null, state: RecordState}} LoadedDraft */
/** @typedef {{activation: number, snapshot: WorkflowDraft | null, generation: number, profile: string, id: import('../contracts/workbench.js').WorkbenchId, api?: WorkbenchScope}} ScopedSession */

export const SYSTEM_WORKFLOW_DRAFT_STORAGE_VERSION = 1;
export const SYSTEM_WORKFLOW_DRAFT_KEY_PREFIX =
  `inscape.system-workflow-draft.v${SYSTEM_WORKFLOW_DRAFT_STORAGE_VERSION}:`;
export const SYSTEM_WORKFLOW_RECORD_STATUS = Object.freeze({
  ABSENT: 'absent',
  VALID: 'valid',
  CORRUPT: 'corrupt',
  UNAVAILABLE: 'unavailable',
});

/** @param {string} code @param {string} message */
function storeError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** @param {unknown} profileAddress */
function requireProfileAddress(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid profile address is required');
  return profile;
}

/** @param {unknown} profileAddress */
export function systemWorkflowDraftKey(profileAddress) {
  return `${SYSTEM_WORKFLOW_DRAFT_KEY_PREFIX}${requireProfileAddress(profileAddress)}`;
}

/** @template T @param {T} value @param {WeakSet<object>} [seen] @returns {T} */
function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(/** @type {Record<PropertyKey, unknown>} */ (value)[key], seen));
  return Object.freeze(value);
}

/** @template T @param {T} value @returns {T} */
function detached(value) {
  return structuredClone(value);
}

/** @template T @param {T} value @returns {T} */
function immutableDetached(value) {
  return deepFreeze(detached(value));
}

// Compare only detached, validated candidates with the accepted immutable draft.
// Reuse unchanged branches without changing key order or the serialized record.
// This is structural sharing, not another document cache or storage authority.
/** @template T @param {unknown} previous @param {T} next @returns {T} */
function reuseUnchanged(previous, next) {
  if (Object.is(previous, next)) return /** @type {T} */ (previous);
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object'
    || Array.isArray(previous) !== Array.isArray(next)) return next;
  if (Object.isFrozen(next)) next = /** @type {T} */ (Array.isArray(next) ? [...next] : { ...next });
  const previousKeys = Object.keys(previous), nextKeys = Object.keys(/** @type {object} */ (next));
  let unchanged = previousKeys.length === nextKeys.length
    && (!Array.isArray(next) || /** @type {unknown[]} */ (previous).length === next.length);
  for (let index = 0; index < nextKeys.length; index++) {
    const key = nextKeys[index];
    /** @type {Record<string, unknown>} */ (next)[key] = reuseUnchanged(/** @type {Record<string, unknown>} */ (previous)[key], /** @type {Record<string, unknown>} */ (next)[key]);
    if (previousKeys[index] !== key || !Object.is(/** @type {Record<string, unknown>} */ (previous)[key], /** @type {Record<string, unknown>} */ (next)[key])) unchanged = false;
  }
  return unchanged ? /** @type {T} */ (previous) : next;
}

/** @param {unknown} candidate @param {string} profileAddress @returns {{value: WorkflowDraft | null, errors: {path: string, code: string, message?: string}[]}} */
function validateStoredDraft(candidate, profileAddress) {
  const validation = validateSystemWorkflowDraft(ensureSystemWorkflowWorldCoverGrid(candidate));
  if (!validation.valid) return validation;
  return validation.value.profileAddress === profileAddress ? validation : {
    value: null, errors: [{ path: 'profileAddress', code: 'profile_mismatch' }],
  };
}

/**
 * @param {{generateGridId?: () => string, profileAddress?: import('../contracts/workbench.js').ProfileAddress,
 * storage?: import('../contracts/workbench.js').DraftStorage, requireEditor?: boolean}} [options]
 */
export function createSystemWorkflowDraftStore({
  generateGridId,
  profileAddress,
  storage,
  requireEditor = false,
} = {}) {
  let activeProfileAddress = requireProfileAddress(profileAddress);
  let writeAccess = requireEditor ? captureProfileDraftWriteAccess(activeProfileAddress, storage) : () => true;
  let generation = 0;
  /** @type {WorkflowDraft | null} */ let currentDraft = null;
  /** @type {WorkflowDraft | WorkbenchCollection | null} */ let currentRecord = null;
  let activation = 0;
  /** @type {ScopedSession | null} */ let scopedSession = null;
  /** @type {Map<object, {activation: number, check: import('../contracts/workbench.js').TransitionGuard}>} */ const transitionGuards = new Map();
  /** @type {RecordState | null} */ let recordState = null;
  /** @type {string | null | undefined} */ let acceptedRaw;
  /** @type {string | null} */ let lastCommitFailure = null;
  /** @type {Set<() => void>} */ const listeners = new Set();
  /** @type {Map<string, History>} */ const histories = new Map();
  // Derived size of each session-only history entry. Invalidate only when a
  // grouped gesture replaces its changes; discarded entries are weakly held.
  /** @type {WeakMap<HistoryEntry, number>} */ const historySizes = new WeakMap();
  /** @param {HistoryEntry[]} entries */
  const historySize = entries => 2 + Math.max(0, entries.length - 1) + entries.reduce((size, entry) => {
    if (!historySizes.has(entry)) historySizes.set(entry, JSON.stringify(entry).length);
    return size + /** @type {number} */ (historySizes.get(entry));
  }, 0);
  /** @type {{before: WorkflowDraft, entry: HistoryEntry | null} | null} */ let historyGroup = null;
  const workbenchId = () => isWorkbenchCollection(currentRecord) ? /** @type {WorkbenchCollection} */ (currentRecord).activeId : FIRST_WORKBENCH_ID;
  const historyKey = () => `${activeProfileAddress}/${workbenchId()}`;
  const clearProfileHistory = () => {
    for (const key of histories.keys()) if (key.startsWith(`${activeProfileAddress}/`)) histories.delete(key);
  };
  const history = () => {
    const key = historyKey();
    if (!histories.has(key)) histories.set(key, { undo: [], redo: [] });
    return /** @type {History} */ (histories.get(key));
  };

  /** @param {string} profile @returns {WorkflowDraft} */
  const createEmpty = (profile) => deepFreeze(createEmptySystemWorkflowDraft(
    profile,
    generateGridId ? { generateId: generateGridId } : undefined,
  ));

  /** @param {string} profile @returns {LoadedDraft} */
  const load = (profile) => {
    if (!storage?.getItem) return {
      draft: null,
      state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE, reason: 'storage_unavailable' }),
    };
    let raw;
    try { raw = storage.getItem(systemWorkflowDraftKey(profile)); }
    catch {
      return {
        draft: null,
        state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE, reason: 'storage_read_failed' }),
      };
    }
    if (raw === null) return {
      raw,
      draft: createEmpty(profile),
      state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.ABSENT }),
    };
    let reason = 'invalid_json';
    /** @type {RecordState['issues']} */ let issues = [];
    try {
      const candidate = JSON.parse(raw);
      reason = 'validation_failed';
      if (isWorkbenchCollection(candidate)) {
        const record = assertValidWorkbenchCollection(candidate);
        if (record.profileAddress !== profile) throw new Error('Profile mismatch');
        return { raw, record: deepFreeze(record), draft: deepFreeze(projectWorkbenchDraft(record)),
          state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID }) };
      }
      // The removed Identity subtitle may exist in drafts written by the editor.
      // Discard only that obsolete property; all remaining data is still validated.
      const card = candidate?.identityPresentation?.card;
      if (card?.version === 1 && typeof card.subtitle === 'string' && card.subtitle.length <= 160) {
        delete card.subtitle;
      }
      const validation = validateStoredDraft(candidate, profile);
      const draft = validation.value;
      issues = validation.errors.slice(0, 5).map(({ path, code, message }) => ({ path, code, message }));
      if (draft) return {
        raw,
        draft: deepFreeze(draft),
        state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID }),
      };
    } catch {
      // Corruption is represented below without exposing the stored bytes.
    }
    return {
      raw,
      draft: null,
      state: Object.freeze({
        status: SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT,
        reason,
        issues,
        fingerprint: keccak256(stringToHex(String(raw))),
      }),
    };
  };

  /** @param {LoadedDraft} loaded */
  const acceptLoaded = (loaded) => {
    acceptedRaw = loaded.raw;
    currentDraft = loaded.draft;
    currentRecord = loaded.record || loaded.draft;
    recordState = loaded.state;
  };
  const notify = () => {
    if (scopedSession?.activation === activation) scopedSession.snapshot = currentDraft;
    listeners.forEach(listener => listener());
  };

  acceptLoaded(load(activeProfileAddress));

  // Compare the persisted record, not just this store's in-memory generation.
  // localStorage has no atomic compare-and-swap; this rejects already-visible
  // external edits without pretending to provide simultaneous writer locking.
  const storageStillCurrent = () => {
    try { return Boolean(storage?.getItem) && /** @type {import('../contracts/workbench.js').DraftStorage} */ (storage).getItem(systemWorkflowDraftKey(activeProfileAddress)) === acceptedRaw; }
    catch { return false; }
  };

  const api = {
    hasWriteAccess() { return writeAccess(); },
    beginHistoryGroup() { if (!historyGroup && currentDraft) historyGroup = { before: currentDraft, entry: null }; },
    endHistoryGroup() { historyGroup = null; },
    getHistory() { const h = history(); return { undo: h.undo.at(-1)?.label || null, redo: h.redo.at(-1)?.label || null }; },
    undo() { return travel('undo'); },
    redo() { return travel('redo'); },
    /** @param {() => void} listener */
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    // Rendering can share the already frozen, accepted document. This is the
    // store's authoritative value, replaced on acceptance/profile/reload; it
    // is never a writable operation candidate or a second cached document.
    getSnapshot() {
      if (!currentDraft) {
        const unavailable = /** @type {RecordState} */ (recordState).status === SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE;
        throw storeError(
          unavailable ? 'SYSTEM_WORKFLOW_STORAGE_UNAVAILABLE' : 'SYSTEM_WORKFLOW_DRAFT_CORRUPT',
          unavailable ? 'Canonical System Workflow storage is unavailable' : 'Canonical System Workflow storage is corrupt',
        );
      }
      return currentDraft;
    },
    getDraft() {
      return detached(api.getSnapshot());
    },

    getGeneration() {
      return generation;
    },

    getProfileAddress() {
      return activeProfileAddress;
    },
    getWorkbenchId: workbenchId,
    getActivation: () => activation,
    isCollection: () => isWorkbenchCollection(currentRecord),
    /** @returns {{id: import('../contracts/workbench.js').WorkbenchId, name: string}[]} */
    listWorkbenches: () => isWorkbenchCollection(currentRecord)
      ? /** @type {WorkbenchCollection} */ (currentRecord).workbenches.map(({ id, name }) => ({ id, name }))
      : [{ id: FIRST_WORKBENCH_ID, name: 'Workbench 1' }],
    // Export the whole local collection; the supplied active view captures live
    // geometry without treating panel/camera state as another authored document.
    getBackupSnapshot(draft = currentDraft) {
      return isWorkbenchCollection(currentRecord)
        ? assertValidWorkbenchCollection(replaceWorkbenchDraft(currentRecord, workbenchId(), draft))
        : detached(draft);
    },
    /** @param {string} name @param {{workbench?: import('../contracts/workbench.js').WorkbenchPresentation, generateId?: () => string}} [options] */
    createWorkbench(name, { workbench, generateId = () => globalThis.crypto.randomUUID() } = {}) {
      if (!validWorkbenchName(name)) throw new Error('Use a Workbench name of 1–64 characters.');
      const collection = withCurrentLayout(workbench);
      /** @type {WorkflowDraft} */ const fresh = createEmptySystemWorkflowDraft(activeProfileAddress);
      fresh.grids = []; // Ordinary new canvases do not create a parked Display.
      fresh.workbench = { ...createDefaultWorkbenchPresentation(), area: { ...DEFAULT_WORKBENCH_AREA } };
      fresh.workbench.display.open = false;
      /** @type {import('../contracts/workbench.js').WorkbenchId} */
      const id = `workbench:${generateId()}`;
      const next = appendWorkbench(collection, id, name, fresh);
      return persistCollection(next, { changeContext: true }) ? id : false;
    },
    /** @param {import('../contracts/workbench.js').WorkbenchId} id @param {{workbench?: import('../contracts/workbench.js').WorkbenchPresentation}} [options] */
    switchWorkbench(id, { workbench } = {}) {
      if (id === workbenchId()) return true;
      const collection = withCurrentLayout(workbench);
      if (!collection.workbenches.some(item => item.id === id)) return false;
      return persistCollection({ ...collection, activeId: id }, { changeContext: true });
    },
    /** @param {string} name */
    renameWorkbench(name) {
      if (!validWorkbenchName(name)) throw new Error('Use a Workbench name of 1–64 characters.');
      const collection = withCurrentLayout();
      return persistCollection({ ...collection, workbenches: collection.workbenches.map(item =>
        item.id === collection.activeId ? { ...item, name } : item) });
    },
    /** @param {import('../contracts/workbench.js').TransitionGuard} check */
    guardWorkbenchTransition(check) {
      const token = {};
      transitionGuards.set(token, { activation, check });
      return () => transitionGuards.delete(token);
    },
    // An activation owns its store handle. A delayed operation keeps its old
    // readable snapshot, but can never write after A → B → A.
    /** @returns {import('../contracts/workbench.js').WorkbenchScope} */
    getWorkbenchScope() {
      if (scopedSession?.activation === activation) return /** @type {WorkbenchScope} */ (scopedSession.api);
      /** @type {ScopedSession} */ const session = { activation, snapshot: currentDraft, generation, profile: activeProfileAddress, id: workbenchId() };
      const current = () => session.activation === activation;
      const writable = () => current() && api.hasWriteAccess();
      /**
       * @template {unknown[]} Args
       * @template Result
       * @param {(...args: Args) => Result} method
       * @returns {(...args: Args) => Result | false}
       */
      const write = method => (...args) => writable() ? method(...args) : false;
      // Only the root owns profile/reload/reset and acquiring another scope.
      // New root methods never become capabilities of an existing editor.
      session.api = Object.freeze(/** @satisfies {import('../contracts/workbench.js').WorkbenchScope} */ ({
        hasWriteAccess: writable,
        beginHistoryGroup: write(api.beginHistoryGroup),
        endHistoryGroup: write(api.endHistoryGroup),
        undo: write(api.undo),
        redo: write(api.redo),
        commitCompletedOperation: write(api.commitCompletedOperation),
        retryCompletedOperation: write(api.retryCompletedOperation),
        restoreBackup: write(api.restoreBackup),
        createWorkbench: write(api.createWorkbench),
        switchWorkbench: write(api.switchWorkbench),
        renameWorkbench: write(api.renameWorkbench),
        getHistory: api.getHistory,
        getRecordState: api.getRecordState,
        getLastCommitFailure: api.getLastCommitFailure,
        isCollection: api.isCollection,
        listWorkbenches: api.listWorkbenches,
        getBackupSnapshot: api.getBackupSnapshot,
        getProfileAddress: () => session.profile,
        getWorkbenchId: () => session.id,
        getSnapshot: () => current() ? api.getSnapshot() : session.snapshot,
        getDraft: () => detached(current() ? api.getSnapshot() : session.snapshot),
        getGeneration: () => current() ? generation : session.generation,
        subscribe: listener => api.subscribe(() => { if (current()) listener(); }),
        guardWorkbenchTransition: check => writable() ? api.guardWorkbenchTransition(check) : () => {},
        isCurrent: current,
      }));
      scopedSession = session;
      bindWorkbenchTextRecovery(session.api);
      return session.api;
    },

    getRecordState() {
      return immutableDetached(/** @type {RecordState} */ (recordState));
    },

    reload() {
      historyGroup = null;
      clearProfileHistory();
      acceptLoaded(load(activeProfileAddress));
      activation++;
      generation += 1;
      notify();
      return /** @type {RecordState} */ (recordState).status !== SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE;
    },

    /** @param {{expectedFingerprint?: string, profileAddress?: string}} [options] */
    resetCorruptDraft({ expectedFingerprint, profileAddress: confirmedProfileAddress } = {}) {
      if (!writeAccess() || /** @type {RecordState} */ (recordState).status !== SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT
        || confirmedProfileAddress !== activeProfileAddress
        || expectedFingerprint !== /** @type {RecordState} */ (recordState).fingerprint
        || !storage?.removeItem || !storageStillCurrent()) return false;
      try { storage.removeItem(systemWorkflowDraftKey(activeProfileAddress)); }
      catch { return false; }
      clearProfileHistory();
      currentDraft = createEmpty(activeProfileAddress);
      currentRecord = currentDraft;
      acceptedRaw = null;
      recordState = Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.ABSENT });
      generation += 1;
      activation++;
      notify();
      return true;
    },

    /** @param {string} nextProfileAddress */
    setProfileAddress(nextProfileAddress) {
      const next = normalizeProfileAddress(nextProfileAddress);
      if (!next) return false;
      if (next === activeProfileAddress) return true;
      historyGroup = null;
      const departingHistory = histories.get(historyKey());
      if (departingHistory) departingHistory.acceptedRaw = acceptedRaw;
      const loaded = load(next);
      // History paths belong to the exact accepted record. A different tab may
      // reorder Grids while this profile is inactive, so matching leaf values
      // alone cannot establish that an old index still identifies its owner.
      const returningKey = `${next}/${isWorkbenchCollection(loaded.record) ? /** @type {WorkbenchCollection} */ (loaded.record).activeId : FIRST_WORKBENCH_ID}`;
      const returningHistory = histories.get(returningKey);
      if (returningHistory && returningHistory.acceptedRaw !== loaded.raw) histories.delete(returningKey);
      activeProfileAddress = next;
      writeAccess = requireEditor ? captureProfileDraftWriteAccess(activeProfileAddress, storage) : () => true;
      acceptLoaded(loaded);
      activation++;
      generation += 1;
      notify();
      return true;
    },

    getLastCommitFailure() { return lastCommitFailure; },
    /** @param {unknown} candidate @param {import('../contracts/workbench.js').RestoreOptions} [options] */
    restoreBackup(candidate, { expectedGeneration, expectedFingerprint } = {}) {
      if (/** @type {RecordState} */ (recordState).status === SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE
        || (/** @type {RecordState} */ (recordState).status === SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT && expectedFingerprint !== /** @type {RecordState} */ (recordState).fingerprint)) return false;
      if (isWorkbenchCollection(candidate)) {
        if (expectedGeneration !== generation) return false;
        return persistCollection(candidate, { changeContext: true, restore: true });
      }
      // A single-composition backup must not silently replace a collection.
      if (isWorkbenchCollection(currentRecord)) return false;
      return commit(candidate, { expectedGeneration, recordHistory: false }, null, true);
    },
    /** @param {(draft: import('../contracts/workbench.js').WorkflowDraft) => import('../contracts/workbench.js').WorkflowDraft | null | false} createCandidate @param {import('../contracts/workbench.js').CommitOptions} [options] */
    retryCompletedOperation(createCandidate, options = {}) {
      const loaded = load(activeProfileAddress);
      if (!loaded.draft) {
        lastCommitFailure = loaded.state.status === SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT ? 'corrupt' : 'read_failed';
        return false;
      }
      if (isWorkbenchCollection(loaded.record) !== isWorkbenchCollection(currentRecord)
        || isWorkbenchCollection(loaded.record) && /** @type {WorkbenchCollection} */ (loaded.record).activeId !== workbenchId()) {
        lastCommitFailure = 'changed';
        return false;
      }
      const candidate = createCandidate(detached(loaded.draft));
      if (!candidate) return false;
      return commit(candidate, options, loaded);
    },
    /** @param {unknown} candidate @param {import('../contracts/workbench.js').CommitOptions} [options] */
    commitCompletedOperation(candidate, options = {}) { return commit(candidate, options); },
  };
  /** @param {import('../contracts/workbench.js').WorkbenchPresentation} [workbench] @returns {WorkbenchCollection} */
  function withCurrentLayout(workbench) {
    const draft = workbench ? { ...api.getDraft(), workbench: detached(workbench) } : api.getDraft();
    const validated = validateStoredDraft(draft, activeProfileAddress).value;
    if (!validated) throw new Error('The current Workbench layout is not ready. Finish the edit and try again.');
    return isWorkbenchCollection(currentRecord)
      ? replaceWorkbenchDraft(currentRecord, workbenchId(), validated) : /** @type {WorkbenchCollection} */ (createWorkbenchCollection(validated));
  }
  /** @param {unknown} candidate */
  function persistCollection(candidate, { changeContext = false, restore = false } = {}) {
    /** @param {string} reason */
    const reject = reason => { lastCommitFailure = reason; return false; };
    if (!writeAccess()) return reject('editor_unavailable');
    if (changeContext) {
      if (textRecoveries(api.getWorkbenchScope(), activeProfileAddress).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      for (const guard of transitionGuards.values()) if (guard.activation === activation) {
        const reason = guard.check();
        if (reason) throw new Error(reason);
      }
    }
    let next;
    try {
      next = assertValidWorkbenchCollection(candidate);
      if (next.profileAddress !== activeProfileAddress) return reject('invalid');
    } catch { return reject('invalid'); }
    if (!storage?.setItem) return reject('write_failed');
    try {
      if (storage.getItem(systemWorkflowDraftKey(activeProfileAddress)) !== acceptedRaw) return reject('changed');
    } catch { return reject('read_failed'); }
    const raw = JSON.stringify(next);
    try { storage.setItem(systemWorkflowDraftKey(activeProfileAddress), raw); }
    catch { return reject('write_failed'); }
    if (restore) clearProfileHistory();
    historyGroup = null;
    // Revoke the departing handle before publishing the arriving snapshot.
    if (changeContext) { activation++; transitionGuards.clear(); }
    currentRecord = deepFreeze(reuseUnchanged(currentRecord, next));
    currentDraft = deepFreeze(reuseUnchanged(currentDraft, projectWorkbenchDraft(currentRecord)));
    acceptedRaw = raw;
    recordState = Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID });
    generation++;
    lastCommitFailure = null;
    notify();
    return true;
  }
  /** @param {unknown} candidate @param {import('../contracts/workbench.js').CommitOptions} [options] @param {ReturnType<typeof load> | null} [recovered] @param {boolean} [restore] */
  function commit(candidate, { expectedGeneration, historyLabel, recordHistory = true, historyPresentation } = {}, recovered = null, restore = false) {
      /** @param {string} reason */
      const reject = reason => { lastCommitFailure = reason; return false; };
      if (!writeAccess()) return reject('editor_unavailable');
      if (expectedGeneration !== generation || (!currentDraft && !restore)) return reject('stale');
      const validated = validateStoredDraft(restore ? candidate : reconcileArtworkLayers(recovered?.draft || currentDraft,
        reconcileRemovedWorkbenchMembers(recovered?.draft || currentDraft, candidate)), activeProfileAddress).value;
      if (!validated) return reject('invalid');
      const draft = reuseUnchanged(currentDraft, validated);
      if (!storage?.setItem) return reject('write_failed');
      try {
        if (storage.getItem(systemWorkflowDraftKey(activeProfileAddress)) !== (recovered ? recovered.raw : acceptedRaw)) return reject('changed');
      } catch { return reject('read_failed'); }
      const baseRecord = recovered?.record || currentRecord;
      let nextRecord = draft;
      if (isWorkbenchCollection(baseRecord)) {
        try {
          nextRecord = replaceWorkbenchDraft(baseRecord, workbenchId(), draft);
          nextRecord.shared = reuseUnchanged(/** @type {WorkbenchCollection} */ (baseRecord).shared, nextRecord.shared);
          // The base is already validated and frozen (including on recovery).
          // Only this validated draft can replace its active content. Unchanged
          // compositions need no new validation or copies. A shared change can
          // affect every projection, including its byte limit, so validate all.
          if (nextRecord.shared !== /** @type {WorkbenchCollection} */ (baseRecord).shared)
            nextRecord = assertValidWorkbenchCollection(nextRecord);
        }
        catch { return reject('invalid'); }
      }
      const raw = JSON.stringify(nextRecord);
      // UTF-8 uses at most three bytes per UTF-16 code unit. Avoid allocating a
      // full encoded collection when that upper bound already fits the limit.
      if (isWorkbenchCollection(nextRecord) && raw.length * 3 > WORKBENCH_COLLECTION_LIMIT
        && new TextEncoder().encode(raw).length > WORKBENCH_COLLECTION_LIMIT) return reject('invalid');
      // A destructive composition edit captures the departing live layout for
      // Undo in this same write. It cannot mutate content or claim a prior save.
      const historyBefore = historyPresentation ? validateStoredDraft({ ...currentDraft, workbench: historyPresentation }, activeProfileAddress).value
        : recovered?.draft || currentDraft;
      if (historyPresentation && !historyBefore) return reject('invalid');
      const changes = recordHistory ? draftChanges(historyBefore, draft) : [];
      try { storage.setItem(systemWorkflowDraftKey(activeProfileAddress), raw); }
      catch { return reject('write_failed'); }
      if (restore) { clearProfileHistory(); historyGroup = null; }
      // External edits invalidate local history only after a successful recovery.
      if (recovered && recovered.raw !== acceptedRaw) { clearProfileHistory(); historyGroup = null; }
      if (changes.length) {
        const h = history(); h.redo = [];
        if (historyGroup?.entry && h.undo.at(-1) === historyGroup.entry) {
          if (historyPresentation) historyGroup.before = { ...historyGroup.before, workbench: historyPresentation };
          historyGroup.entry.changes = draftChanges(historyGroup.before, draft);
          historySizes.delete(historyGroup.entry);
          if (!historyGroup.entry.changes.length) { h.undo.pop(); historyGroup.entry = null; }
        } else {
          const entry = { changes, label: historyLabel || draftChangeLabel(changes) };
          h.undo.push(entry); if (historyGroup) historyGroup.entry = entry;
        }
        while (h.undo.length > 50 || h.undo.length > 1 && historySize(h.undo) > 4_000_000) h.undo.shift();
      }
      acceptedRaw = raw;
      currentDraft = deepFreeze(draft);
      currentRecord = deepFreeze(reuseUnchanged(currentRecord, nextRecord));
      recordState = Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID });
      generation += 1;
      lastCommitFailure = null;
      notify();
      return true;
  }
  /** @param {'undo' | 'redo'} direction */
  function travel(direction) {
    historyGroup = null;
    const h = history(), entry = h[direction].at(-1);
    if (!entry || !currentDraft) return false;
    const next = applyDraftChanges(currentDraft, entry.changes, direction);
    if (!next) return false;
    // Move history before notification so subscribers see the final state.
    const other = direction === 'undo' ? 'redo' : 'undo';
    h[direction].pop(); h[other].push(entry);
    if (api.commitCompletedOperation(next, { expectedGeneration: generation, recordHistory: false })) return true;
    h[other].pop(); h[direction].push(entry); return false;
  }
  return Object.freeze(api);
}
