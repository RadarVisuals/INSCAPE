import { keccak256, stringToHex } from 'viem';
import { normalizeProfileAddress } from '../library/config.js';
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
      draft: createEmpty(profile),
      state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.ABSENT }),
    };
    try {
      const draft = acceptedDraft(JSON.parse(raw), profile);
      if (draft) return {
        draft: deepFreeze(draft),
        state: Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID }),
      };
    } catch {
      // Corruption is represented below without exposing the stored bytes.
    }
    return {
      draft: null,
      state: Object.freeze({
        status: SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT,
        fingerprint: keccak256(stringToHex(String(raw))),
      }),
    };
  };

  const acceptLoaded = (loaded) => {
    currentDraft = loaded.draft;
    recordState = loaded.state;
  };

  acceptLoaded(load(activeProfileAddress));

  return Object.freeze({
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
      acceptLoaded(load(activeProfileAddress));
      generation += 1;
      return recordState.status !== SYSTEM_WORKFLOW_RECORD_STATUS.UNAVAILABLE;
    },

    resetCorruptDraft({ expectedFingerprint, profileAddress: confirmedProfileAddress } = {}) {
      if (recordState.status !== SYSTEM_WORKFLOW_RECORD_STATUS.CORRUPT
        || confirmedProfileAddress !== activeProfileAddress
        || expectedFingerprint !== recordState.fingerprint
        || !storage?.removeItem) return false;
      try { storage.removeItem(systemWorkflowDraftKey(activeProfileAddress)); }
      catch { return false; }
      currentDraft = createEmpty(activeProfileAddress);
      recordState = Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.ABSENT });
      generation += 1;
      return true;
    },

    setProfileAddress(nextProfileAddress) {
      const next = normalizeProfileAddress(nextProfileAddress);
      if (!next) return false;
      if (next === activeProfileAddress) return true;
      const loaded = load(next);
      activeProfileAddress = next;
      acceptLoaded(loaded);
      generation += 1;
      return true;
    },

    commitCompletedOperation(candidate, { expectedGeneration } = {}) {
      if (expectedGeneration !== generation || !currentDraft) return false;
      const draft = acceptedDraft(candidate, activeProfileAddress);
      if (!draft || !storage?.setItem) return false;
      try { storage.setItem(systemWorkflowDraftKey(activeProfileAddress), JSON.stringify(draft)); }
      catch { return false; }
      currentDraft = deepFreeze(draft);
      recordState = Object.freeze({ status: SYSTEM_WORKFLOW_RECORD_STATUS.VALID });
      generation += 1;
      return true;
    },
  });
}
