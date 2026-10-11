import { assertValidSystemWorkflowDraft, resolveInspectionMode, SYSTEM_WORKFLOW_VISIBILITY } from './domain/systemWorkflowDraft.js';
import { sameSystemWorkflowPlacementSnapshot } from './systemWorkflowRemoval.js';

export function createSystemWorkflowInspectionCandidate(input, { gridId, placementId, expectedPlacement, inspectionMode } = {}) {
  const draft = assertValidSystemWorkflowDraft(input);
  const grid = draft.grids.find(item => item.id === gridId);
  const placement = grid?.placements.find(item => item.id === placementId);
  if (grid?.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC || !placement
    || placement.kind === 'text' || placement.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC || placement.locked) {
    throw new TypeError('Artwork inspection choice is unavailable for this placement');
  }
  if (!sameSystemWorkflowPlacementSnapshot(placement, expectedPlacement)) throw new TypeError('The canonical placement changed before inspection editing completed');
  if (!['IN_PLACE', 'LIFT'].includes(inspectionMode)) throw new TypeError('Unknown artwork inspection mode');
  if (resolveInspectionMode(placement) === inspectionMode) return null;
  placement.inspectionMode = inspectionMode;
  return assertValidSystemWorkflowDraft(draft);
}
