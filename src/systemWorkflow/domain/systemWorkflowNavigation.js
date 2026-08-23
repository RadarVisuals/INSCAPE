import { assertValidSystemWorkflowDraft } from './systemWorkflowDraft.js';

function navigationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

export function firstSystemWorkflowGridId(draftInput) {
  return assertValidSystemWorkflowDraft(draftInput).grids[0].id;
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
  if (!['previous', 'next'].includes(direction)) {
    throw navigationError('SYSTEM_WORKFLOW_NAVIGATION_DIRECTION_INVALID', 'Ordered Grid navigation requires previous or next');
  }
  const index = draft.grids.findIndex(({ id }) => id === gridId);
  if (index < 0) throw navigationError('SYSTEM_WORKFLOW_GRID_UNKNOWN', 'The selected Grid does not exist');
  const destination = index + (direction === 'next' ? 1 : -1);
  return draft.grids[destination]?.id || null;
}

export function reconcileSystemWorkflowGridSelection(draftInput, selectedGridId) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  return draft.grids.some(({ id }) => id === selectedGridId) ? selectedGridId : draft.grids[0].id;
}
