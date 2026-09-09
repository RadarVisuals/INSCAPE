import { SYSTEM_WORKFLOW_VISIBILITY, assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

export function createSystemWorkflowLockCandidate(draftInput, { expectedPlacement, gridId, locked, placementId } = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput); const grid = draft.grids.find(({ id }) => id === gridId); const placement = grid?.placements.find(({ id }) => id === placementId);
  if (!grid || grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC || !placement || placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) throw Object.assign(new TypeError('Canonical public placement is unavailable'), { code: 'SYSTEM_WORKFLOW_LOCK_PLACEMENT_UNAVAILABLE' });
  if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) throw Object.assign(new TypeError('Canonical placement changed before lock editing completed'), { code: 'SYSTEM_WORKFLOW_LOCK_STALE' });
  if (typeof locked !== 'boolean') throw Object.assign(new TypeError('A canonical lock value is required'), { code: 'SYSTEM_WORKFLOW_LOCK_INVALID' });
  if (placement.locked === locked) return null;
  placement.locked = locked;
  return assertValidSystemWorkflowDraft(draft);
}
