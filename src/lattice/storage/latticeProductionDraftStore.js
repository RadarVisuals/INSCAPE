import { normalizeProfileAddress } from '../../library/config.js';
import {
  createEmptyLatticeProductionDraft,
  validateLatticeProductionDraft,
} from '../domain/latticeProductionDraft.js';

export const LATTICE_PRODUCTION_DRAFT_STORAGE_VERSION = 1;
export const LATTICE_PRODUCTION_DRAFT_KEY_PREFIX =
  `inscape.lattice-production-draft.v${LATTICE_PRODUCTION_DRAFT_STORAGE_VERSION}:`;
export const LATTICE_PRODUCTION_RECORD_STATUS = Object.freeze({
  ABSENT: 'absent',
  VALID: 'valid',
  CORRUPT: 'corrupt',
});

function requireProfileAddress(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid profile address is required');
  return profile;
}

export function latticeProductionDraftKey(profileAddress) {
  return `${LATTICE_PRODUCTION_DRAFT_KEY_PREFIX}${requireProfileAddress(profileAddress)}`;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function immutableDetached(value) {
  return deepFreeze(structuredClone(value));
}

function validatedDraftForProfile(candidate, profileAddress) {
  const validation = validateLatticeProductionDraft(candidate);
  if (!validation.valid || validation.value.profileAddress !== profileAddress) return null;
  return validation.value;
}

function emptyAcceptedDraft(profileAddress) {
  const draft = validatedDraftForProfile(
    createEmptyLatticeProductionDraft(profileAddress),
    profileAddress,
  );
  if (!draft) throw new TypeError('Could not create a valid production lattice draft');
  return deepFreeze(draft);
}

function loadAcceptedDraft(storage, profileAddress) {
  if (!storage?.getItem) return emptyAcceptedDraft(profileAddress);
  try {
    const raw = storage.getItem(latticeProductionDraftKey(profileAddress));
    if (raw === null) return emptyAcceptedDraft(profileAddress);
    const draft = validatedDraftForProfile(JSON.parse(raw), profileAddress);
    return draft ? deepFreeze(draft) : emptyAcceptedDraft(profileAddress);
  } catch {
    return emptyAcceptedDraft(profileAddress);
  }
}

export function createLatticeProductionDraftStore({ storage, profileAddress } = {}) {
  let activeProfileAddress = requireProfileAddress(profileAddress);
  let acceptedDraft = loadAcceptedDraft(storage, activeProfileAddress);
  const issuedCheckpoints = new WeakMap();

  function classifyForReconciliation() {
    if (!storage?.getItem) return Object.freeze({ status: LATTICE_PRODUCTION_RECORD_STATUS.CORRUPT });
    let raw;
    try { raw = storage.getItem(latticeProductionDraftKey(activeProfileAddress)); }
    catch { return Object.freeze({ status: LATTICE_PRODUCTION_RECORD_STATUS.CORRUPT }); }
    if (raw === null) {
      const checkpoint = Object.freeze({ absent: true });
      issuedCheckpoints.set(checkpoint, activeProfileAddress);
      return Object.freeze({ status: LATTICE_PRODUCTION_RECORD_STATUS.ABSENT, checkpoint });
    }
    try {
      const draft = validatedDraftForProfile(JSON.parse(raw), activeProfileAddress);
      if (!draft) return Object.freeze({ status: LATTICE_PRODUCTION_RECORD_STATUS.CORRUPT });
      const checkpoint = immutableDetached(draft);
      issuedCheckpoints.set(checkpoint, activeProfileAddress);
      return Object.freeze({ status: LATTICE_PRODUCTION_RECORD_STATUS.VALID, checkpoint });
    } catch {
      return Object.freeze({ status: LATTICE_PRODUCTION_RECORD_STATUS.CORRUPT });
    }
  }

  return Object.freeze({
    getProfileAddress() {
      return activeProfileAddress;
    },

    getDraft() {
      return immutableDetached(acceptedDraft);
    },

    classifyForReconciliation,

    restoreReconciliationCheckpoint(checkpoint) {
      if (!checkpoint || typeof checkpoint !== 'object'
        || issuedCheckpoints.get(checkpoint) !== activeProfileAddress) return false;
      const key = latticeProductionDraftKey(activeProfileAddress);
      if (checkpoint.absent === true && Object.keys(checkpoint).length === 1) {
        if (!storage?.removeItem) return false;
        try { storage.removeItem(key); }
        catch { return false; }
        acceptedDraft = emptyAcceptedDraft(activeProfileAddress);
        return true;
      }
      const validated = validatedDraftForProfile(checkpoint, activeProfileAddress);
      if (!validated || !storage?.setItem) return false;
      try { storage.setItem(key, JSON.stringify(validated)); }
      catch { return false; }
      acceptedDraft = deepFreeze(validated);
      return true;
    },

    setProfileAddress(nextProfileAddress) {
      const profile = normalizeProfileAddress(nextProfileAddress);
      if (!profile) return false;
      if (profile === activeProfileAddress) return true;
      const nextDraft = loadAcceptedDraft(storage, profile);
      activeProfileAddress = profile;
      acceptedDraft = nextDraft;
      return true;
    },

    commitCompletedOperation(candidate) {
      const validated = validatedDraftForProfile(candidate, activeProfileAddress);
      if (!validated || !storage?.setItem) return false;

      let serialized;
      try {
        serialized = JSON.stringify(validated);
        storage.setItem(latticeProductionDraftKey(activeProfileAddress), serialized);
      } catch {
        return false;
      }

      acceptedDraft = deepFreeze(validated);
      return true;
    },
  });
}
