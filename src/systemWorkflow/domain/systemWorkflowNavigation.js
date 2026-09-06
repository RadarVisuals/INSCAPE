import { assertValidSystemWorkflowDraft, isSystemWorkflowWorldCoverGrid } from './systemWorkflowDraft.js';

const navigableGrids = (draft) => draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid));

function navigationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

export function firstSystemWorkflowGridId(draftInput) {
  return navigableGrids(assertValidSystemWorkflowDraft(draftInput))[0].id;
}

export function selectSystemWorkflowGrid(draftInput, gridId) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  if (!draft.grids.some(({ id }) => id === gridId)) {
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
  const draft = assertValidSystemWorkflowDraft(draftInput);
  return draft.grids.some(({ id }) => id === selectedGridId) ? selectedGridId : navigableGrids(draft)[0].id;
}
