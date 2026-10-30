import { assertValidSystemWorkflowDraft, isSystemWorkflowWorldCoverGrid } from './systemWorkflowDraft.js';

const navigableGrids = (draft) => draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid));

function navigationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

export function firstSystemWorkflowGridId(draftInput) {
  return navigableGrids(assertValidSystemWorkflowDraft(draftInput))[0]?.id ?? null;
}

export function selectSystemWorkflowGrid(draftInput, gridId) {
  return selectSystemWorkflowGridInGrids(assertValidSystemWorkflowDraft(draftInput).grids, gridId);
}

// Accepted store snapshots are already validated. Navigation only reads IDs;
// callers handling untrusted documents use the validating wrappers above/below.
export function selectSystemWorkflowGridInGrids(grids, gridId) {
  if (!grids.some(({ id }) => id === gridId)) {
    throw navigationError('SYSTEM_WORKFLOW_GRID_UNKNOWN', 'The selected Grid does not exist');
  }
  return gridId;
}

export function adjacentSystemWorkflowGridId(draftInput, gridId, direction) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  return adjacentSystemWorkflowGridIdInOrder(navigableGrids(draft).map(({ id }) => id), gridId, direction);
}

// Scene IDs from an accepted draft, excluding the World Cover. Rendering only
// needs this order; it must not validate or clone every placement on each frame.
export function adjacentSystemWorkflowGridIdInOrder(gridIds, gridId, direction) {
  if (!['previous', 'next'].includes(direction)) {
    throw navigationError('SYSTEM_WORKFLOW_NAVIGATION_DIRECTION_INVALID', 'Ordered Grid navigation requires previous or next');
  }
  if (isSystemWorkflowWorldCoverGrid(gridId)) return null;
  const index = gridIds.indexOf(gridId);
  if (index < 0) throw navigationError('SYSTEM_WORKFLOW_GRID_UNKNOWN', 'The selected Grid does not exist');
  if (gridIds.length < 2) return null;
  const destination = (index + (direction === 'next' ? 1 : -1) + gridIds.length) % gridIds.length;
  return gridIds[destination];
}

export function reconcileSystemWorkflowGridSelection(draftInput, selectedGridId) {
  return reconcileSystemWorkflowGridSelectionInGrids(assertValidSystemWorkflowDraft(draftInput).grids, selectedGridId);
}

export function reconcileSystemWorkflowGridSelectionInGrids(grids, selectedGridId) {
  return grids.some(({ id }) => id === selectedGridId) ? selectedGridId
    : grids.find(grid => !isSystemWorkflowWorldCoverGrid(grid))?.id ?? null;
}
