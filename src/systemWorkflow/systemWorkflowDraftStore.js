import { keccak256, stringToHex } from 'viem';
import { normalizeProfileAddress } from '../library/config.js';
import { draftChanges, applyDraftChanges, draftChangeLabel } from './draftHistory.js';
import {
  createEmptySystemWorkflowDraft,
  ensureSystemWorkflowWorldCoverGrid,
  validateSystemWorkflowDraft,
} from './domain/systemWorkflowDraft.js';

export const SYSTEM_WORKFLOW_DRAFT_STORAGE_VERSION = 1;
export const SYSTEM_WORKFLOW_DRAFT_KEY_PREFIX =
  `inscape.system-workflow-draft.v${SYSTEM_WORKFLOW_DRAFT_STORAGE_VERSION}:`;
export const SYSTEM_WORKFLOW_RECORD_STATUS = Object.freeze({
  ABSENT: 'absent',
  VALID: 'valid',
  CORRUPT: 'corrupt',
  UNAVAILABLE: 'unavailable',
});

function storeError(code, message) {
  return Object.assign(new Error(message), { code });
}

function requireProfileAddress(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid profile address is required');
  return profile;
}

export function systemWorkflowDraftKey(profileAddress) {
  return `${SYSTEM_WORKFLOW_DRAFT_KEY_PREFIX}${requireProfileAddress(profileAddress)}`;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function detached(value) {
  return structuredClone(value);
}

function immutableDetached(value) {
  return deepFreeze(detached(value));
}

function acceptedDraft(candidate, profileAddress) {
  const validation = validateSystemWorkflowDraft(ensureSystemWorkflowWorldCoverGrid(candidate));
  return validation.valid && validation.value.profileAddress === profileAddress ? validation.value : null;
}

export function createSystemWorkflowDraftStore({
  generateGridId,
  profileAddress,
  storage,
} = {}) {
  let activeProfileAddress = requireProfileAddress(profileAddress);
  let generation = 0;
  let currentDraft = null;
  let recordState = null;
  let acceptedRaw;
  const listeners = new Set();
  const histories = new Map();
  let historyGroup = null;
  const history = () => {
    if (!histories.has(activeProfileAddress)) histories.set(activeProfileAddress, { undo: [], redo: [] });
    return histories.get(activeProfileAddress);
  };

  const createEmpty = (profile) => deepFreeze(createEmptySystemWorkflowDraft(
    profile,
    generateGridId ? { generateId: generateGridId } : undefined,
  ));

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
    try {
      const candidate = JSON.parse(raw);
      // The removed Identity subtitle may exist in drafts written by the editor.
      // Discard only that obsolete property; all remaining data is still validated.
      const card = candidate?.identityPresentation?.card;
      if (card?.version === 1 && typeof card.subtitle === 'string' && card.subtitle.length <= 160) {
        delete card.subtitle;
      }
      const draft = acceptedDraft(candidate, profile);
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
        fingerprint: keccak256(stringToHex(String(raw))),
      }),
    };
  };

  const acceptLoaded = (loaded) => {
    acceptedRaw = loaded.raw;
    currentDraft = loaded.draft;
    recordState = loaded.state;
  };

  acceptLoaded(load(activeProfileAddress));

  // Compare the persisted record, not just this store's in-memory generation.
  // localStorage has no atomic compare-and-swap; this rejects already-visible
  // external edits without pretending to provide simultaneous writer locking.
  const storageStillCurrent = () => {
    try { return Boolean(storage?.getItem) && storage.getItem(systemWorkflowDraftKey(activeProfileAddress)) === acceptedRaw; }
    catch { return false; }
  };

  const api = {
    beginHistoryGroup() { if (!historyGroup && currentDraft) historyGroup = { before: currentDraft, entry: null }; },
    endHistoryGroup() { historyGroup = null; },
    getHistory() { const h = history(); return { undo: h.undo.at(-1)?.label || null, redo: h.redo.at(-1)?.label || null }; },
    undo() { return travel('undo'); },
    redo() { return travel('redo'); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getDraft() {
      if (!currentDraft) {
        const unavailable = recordState.status === SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE;
        throw storeError(
          unavailable ? 'SYSTEM_WORKFLOW_STORAGE_UNAVAILABLE' : 'SYSTEM_WORKFLOW_DRAFT_CORRUPT',
          unavailable ? 'Canonical System Workflow storage is unavailable' : 'Canonical System Workflow storage is corrupt',
        );
      }
      return detached(currentDraft);
    },

    getGeneration() {
      return generation;
    },

    getProfileAddress() {
      return activeProfileAddress;
    },

    getRecordState() {
      return immutableDetached(recordState);
    },

    reload() {
      historyGroup = null;
      histories.delete(activeProfileAddress);
      acceptLoaded(load(activeProfileAddress));
      generation += 1;
      listeners.forEach(listener => listener());
      return recordState.status !== SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE;
    },

    resetCorruptDraft({ expectedFingerprint, profileAddress: confirmedProfileAddress } = {}) {
      if (recordState.status !== SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT
        || confirmedProfileAddress !== activeProfileAddress
        || expectedFingerprint !== recordState.fingerprint
        || !storage?.removeItem || !storageStillCurrent()) return false;
      try { storage.removeItem(systemWorkflowDraftKey(activeProfileAddress)); }
      catch { return false; }
      histories.delete(activeProfileAddress);
      currentDraft = createEmpty(activeProfileAddress);
      acceptedRaw = null;
      recordState = Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.ABSENT });
      generation += 1;
      listeners.forEach(listener => listener());
      return true;
    },

    setProfileAddress(nextProfileAddress) {
      const next = normalizeProfileAddress(nextProfileAddress);
      if (!next) return false;
      if (next === activeProfileAddress) return true;
      historyGroup = null;
      const loaded = load(next);
      activeProfileAddress = next;
      acceptLoaded(loaded);
      generation += 1;
      listeners.forEach(listener => listener());
      return true;
    },

    commitCompletedOperation(candidate, { expectedGeneration, historyLabel, recordHistory = true } = {}) {
      if (expectedGeneration !== generation || !currentDraft) return false;
      const draft = acceptedDraft(candidate, activeProfileAddress);
      if (!draft || !storage?.setItem || !storageStillCurrent()) return false;
      const raw = JSON.stringify(draft);
      const changes = recordHistory ? draftChanges(currentDraft, draft) : [];
      try { storage.setItem(systemWorkflowDraftKey(activeProfileAddress), raw); }
      catch { return false; }
      if (changes.length) {
        const h = history(); h.redo = [];
        if (historyGroup?.entry && h.undo.at(-1) === historyGroup.entry) {
          historyGroup.entry.changes = draftChanges(historyGroup.before, draft);
          if (!historyGroup.entry.changes.length) { h.undo.pop(); historyGroup.entry = null; }
        } else {
          const entry = { changes, label: historyLabel || draftChangeLabel(changes) };
          h.undo.push(entry); if (historyGroup) historyGroup.entry = entry;
        }
        while (h.undo.length > 50 || h.undo.length > 1 && JSON.stringify(h.undo).length > 4_000_000) h.undo.shift();
      }
      acceptedRaw = raw;
      currentDraft = deepFreeze(draft);
      recordState = Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID });
      generation += 1;
      listeners.forEach(listener => listener());
      return true;
    },
  };
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
