import { normalizeProfileAddress } from '../../library/config.js';
import { assertValidLatticeProductionDraft } from '../../lattice/domain/latticeProductionDraft.js';

export const OWNER_RECONCILIATION_ACTION = Object.freeze({
  ADOPT_BASELINE: 'ADOPT_BASELINE',
  CONFLICT: 'CONFLICT',
  HYDRATE_PUBLICATION: 'HYDRATE_PUBLICATION',
  KEEP_LOCAL: 'KEEP_LOCAL',
  WAIT: 'WAIT'
});

export function isWorkspacePublicProjectionEmpty(workspace) {
  const publicFolders = (workspace?.folders || []).some((folder) => folder.public === true);
  const publicObjects = (workspace?.canvas?.objects || []).some((object) => object.visitorVisible === true);
  return !publicFolders && !publicObjects;
}

export function decideOwnerPublicationReconciliation({
  localRecordPresence,
  localFingerprint,
  localPublicProjectionEmpty,
  baseline,
  publishedFingerprint
}) {
  if (!publishedFingerprint || !localFingerprint) return OWNER_RECONCILIATION_ACTION.WAIT;
  if (localRecordPresence === 'absent') return OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION;

  if (!baseline) {
    if (localFingerprint === publishedFingerprint) return OWNER_RECONCILIATION_ACTION.ADOPT_BASELINE;
    // One-time repair for records produced by the previous premature-empty autosave bug.
    if (localPublicProjectionEmpty) return OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION;
    return OWNER_RECONCILIATION_ACTION.CONFLICT;
  }

  const basePublished = baseline.publishedFingerprint;
  const baseLocal = baseline.localFingerprint;
  if (!basePublished || !baseLocal) return OWNER_RECONCILIATION_ACTION.ADOPT_BASELINE;
  if (localFingerprint === publishedFingerprint) return OWNER_RECONCILIATION_ACTION.ADOPT_BASELINE;
  if (localFingerprint === baseLocal) {
    return publishedFingerprint === basePublished
      ? OWNER_RECONCILIATION_ACTION.KEEP_LOCAL
      : OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION;
  }
  if (publishedFingerprint === basePublished) return OWNER_RECONCILIATION_ACTION.KEEP_LOCAL;
  return OWNER_RECONCILIATION_ACTION.CONFLICT;
}

function operationFailure(name) {
  return Object.assign(new Error(`Owner publication reconciliation failed during ${name}`), {
    code: 'OWNER_RECONCILIATION_WRITE_FAILED',
    stage: name,
  });
}

function contextFailure(message) {
  return Object.assign(new Error(message), { code: 'OWNER_RECONCILIATION_PROFILE_CHANGED' });
}

function validateOperation(operation, kind) {
  if (!operation || typeof operation.apply !== 'function' || typeof operation.compensate !== 'function') {
    throw new TypeError(`Invalid ${kind} reconciliation operation`);
  }
  if (operation.validate?.() === false) throw new TypeError(`${kind} reconciliation operation failed prevalidation`);
}

/**
 * Coordinates validated synchronous writes with reverse-order compensation.
 * Separate browser storage keys are not atomically writable; compensation is best effort.
 */
export function executeOwnerPublicationReconciliationTransaction({
  profileAddress,
  compatibilityOperations = [],
  latticeStore = null,
  latticeDraft = null,
  baselineOperation,
  runtimeOperations = [],
  getActiveProfileAddress = () => profileAddress,
  isGenerationCurrent = () => true,
}) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid reconciliation profile is required');
  if (typeof getActiveProfileAddress !== 'function' || typeof isGenerationCurrent !== 'function') {
    throw new TypeError('Reconciliation profile and generation guards are required');
  }
  const assertActiveContext = () => {
    if (normalizeProfileAddress(getActiveProfileAddress()) !== profile) {
      throw contextFailure('The active profile changed during reconciliation');
    }
    if (isGenerationCurrent() !== true) {
      throw Object.assign(new Error('The owner draft generation changed during reconciliation'), {
        code: 'OWNER_RECONCILIATION_GENERATION_CHANGED',
      });
    }
  };
  compatibilityOperations.forEach((operation) => validateOperation(operation, 'compatibility'));
  validateOperation(baselineOperation, 'baseline');
  runtimeOperations.forEach((operation) => validateOperation(operation, 'runtime'));
  assertActiveContext();

  let latticeCheckpoint = null;
  if (latticeDraft) {
    const candidate = assertValidLatticeProductionDraft(latticeDraft);
    if (candidate.profileAddress !== profile) throw new TypeError('The canonical lattice candidate belongs to another profile');
    if (normalizeProfileAddress(latticeStore?.getProfileAddress?.()) !== profile) {
      throw contextFailure('The canonical lattice store profile changed before reconciliation');
    }
    const classification = latticeStore.classifyForReconciliation();
    if (classification.status === 'corrupt') {
      throw Object.assign(new Error('The canonical lattice record is corrupt and requires explicit recovery'), {
        code: 'OWNER_RECONCILIATION_CORRUPT_LATTICE',
      });
    }
    latticeCheckpoint = classification.checkpoint;
  }

  const attemptedCompatibility = [];
  const attemptedRuntime = [];
  let latticeCommitted = false;
  let baselineAttempted = false;
  try {
    for (const operation of compatibilityOperations) {
      attemptedCompatibility.push(operation);
      if (operation.apply() === false) throw operationFailure(operation.name || 'compatibility write');
    }
    if (latticeDraft) {
      assertActiveContext();
      if (normalizeProfileAddress(latticeStore.getProfileAddress()) !== profile) {
        throw contextFailure('The canonical lattice store profile changed before commit');
      }
      if (!latticeStore.commitCompletedOperation(latticeDraft)) throw operationFailure('canonical lattice commit');
      latticeCommitted = true;
    }
    assertActiveContext();
    baselineAttempted = true;
    if (baselineOperation.apply() === false) throw operationFailure('reconciliation baseline save');
    for (const operation of runtimeOperations) {
      assertActiveContext();
      attemptedRuntime.push(operation);
      if (operation.apply() === false) throw operationFailure(operation.name || 'runtime application');
    }
    return true;
  } catch (error) {
    const compensationErrors = [];
    const compensate = (name, action) => {
      try {
        if (action() === false) throw new Error(`${name} compensation returned false`);
      } catch (compensationError) {
        compensationErrors.push({ name, error: compensationError });
      }
    };
    for (const operation of [...attemptedRuntime].reverse()) compensate(operation.name || 'runtime application', () => {
      if (normalizeProfileAddress(getActiveProfileAddress()) !== profile) {
        throw contextFailure('The active profile changed before runtime compensation');
      }
      return operation.compensate();
    });
    if (baselineAttempted) compensate('reconciliation baseline', baselineOperation.compensate);
    if (latticeCommitted) compensate('canonical lattice', () => {
      if (normalizeProfileAddress(getActiveProfileAddress()) !== profile
        || normalizeProfileAddress(latticeStore.getProfileAddress()) !== profile) {
        throw contextFailure('The active profile changed before canonical lattice compensation');
      }
      return latticeStore.restoreReconciliationCheckpoint(latticeCheckpoint);
    });
    for (const operation of [...attemptedCompatibility].reverse()) compensate(operation.name || 'compatibility write', operation.compensate);
    if (error && typeof error === 'object') error.compensationErrors = compensationErrors;
    throw error;
  }
}
