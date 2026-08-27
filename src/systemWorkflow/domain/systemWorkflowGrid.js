import { keccak256, stringToHex } from 'viem';
import {
  SYSTEM_WORKFLOW_LIMITS,
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
  createSystemWorkflowGridId,
  isSystemWorkflowWorldCoverGrid,
} from './systemWorkflowDraft.js';

function gridError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function requireGrid(draft, gridId) {
  const grid = draft.grids.find(({ id }) => id === gridId);
  if (!grid) throw gridError('SYSTEM_WORKFLOW_GRID_UNKNOWN', 'The canonical Grid does not exist');
  return grid;
}

function requireEditableGrid(grid) {
  if (isSystemWorkflowWorldCoverGrid(grid)) {
    throw gridError('SYSTEM_WORKFLOW_WORLD_COVER_PROTECTED', 'The World Cover cannot be renamed, reordered, hidden, or deleted');
  }
}

export function systemWorkflowGridFingerprint(gridInput) {
  const grid = structuredClone(gridInput);
  return keccak256(stringToHex(JSON.stringify(grid)));
}

function requireExpectedGridFingerprint(grid, expectedGridFingerprint) {
  if (typeof expectedGridFingerprint !== 'string'
    || expectedGridFingerprint !== systemWorkflowGridFingerprint(grid)) {
    throw gridError('SYSTEM_WORKFLOW_GRID_STALE', 'The canonical Grid changed before editing completed');
  }
}

function normalizedName(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  const name = value.trim().replace(/\s+/gu, ' ');
  return name && name.length <= 80 ? name : null;
}

function nextDefaultGridTitle(draft) {
  const titles = new Set(draft.grids.map(({ title }) => title.trim().toUpperCase()));
  for (let number = 2; number <= SYSTEM_WORKFLOW_LIMITS.maxGrids; number += 1) {
    const candidate = `GRID ${String(number).padStart(2, '0')}`;
    if (!titles.has(candidate)) return candidate;
  }
  throw gridError('SYSTEM_WORKFLOW_GRID_NAME_EXHAUSTED', 'No safe default Grid name is available');
}

export function systemWorkflowGridOrder(draftInput) {
  return assertValidSystemWorkflowDraft(draftInput).grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid)).map(({ id }) => id);
}

export function createSystemWorkflowGridCandidate(draftInput, options = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  if (draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid)).length >= SYSTEM_WORKFLOW_LIMITS.maxGrids) {
    throw gridError('SYSTEM_WORKFLOW_GRID_LIMIT_REACHED', 'The 24 Grid safety limit is reached');
  }
  const grid = {
    id: createSystemWorkflowGridId(draft.grids.map(({ id }) => id), options),
    title: nextDefaultGridTitle(draft),
    subtitle: '',
    visibility: SYSTEM_WORKFLOW_VISIBILITY.PRIVATE,
    labelVisible: true,
    labelAnchor: 'top-left',
    labelOffset: { column: 0, row: 0 },
    placements: [],
  };
  const coverIndex = draft.grids.findIndex(isSystemWorkflowWorldCoverGrid);
  draft.grids.splice(coverIndex < 0 ? draft.grids.length : coverIndex, 0, grid);
  return assertValidSystemWorkflowDraft(draft);
}

export function createSystemWorkflowGridRenameCandidate(draftInput, {
  expectedGridFingerprint,
  gridId,
  name,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = requireGrid(draft, gridId);
  requireEditableGrid(grid);
  requireExpectedGridFingerprint(grid, expectedGridFingerprint);
  const title = normalizedName(name);
  if (!title) throw gridError('SYSTEM_WORKFLOW_GRID_NAME_INVALID', 'A non-empty safe Grid name is required');
  if (grid.title === title) return null;
  grid.title = title;
  return assertValidSystemWorkflowDraft(draft);
}

export function createSystemWorkflowGridVisibilityCandidate(draftInput, {
  expectedGridFingerprint,
  gridId,
  visibility,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = requireGrid(draft, gridId);
  requireEditableGrid(grid);
  requireExpectedGridFingerprint(grid, expectedGridFingerprint);
  if (!Object.values(SYSTEM_WORKFLOW_VISIBILITY).includes(visibility)) {
    throw gridError('SYSTEM_WORKFLOW_GRID_VISIBILITY_INVALID', 'A canonical Grid visibility is required');
  }
  if (grid.visibility === visibility) return null;
  grid.visibility = visibility;
  return assertValidSystemWorkflowDraft(draft);
}

export function createSystemWorkflowGridReorderCandidate(draftInput, {
  expectedOrder,
  gridId,
  toIndex,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const currentOrder = draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid)).map(({ id }) => id);
  if (!Array.isArray(expectedOrder)
    || expectedOrder.length !== currentOrder.length
    || expectedOrder.some((id, index) => id !== currentOrder[index])) {
    throw gridError('SYSTEM_WORKFLOW_GRID_ORDER_STALE', 'Grid order changed before reorder completed');
  }
  const fromIndex = currentOrder.indexOf(gridId);
  if (fromIndex < 0) throw gridError('SYSTEM_WORKFLOW_GRID_UNKNOWN', 'The canonical Grid does not exist');
  if (!Number.isSafeInteger(toIndex) || toIndex < 0 || toIndex >= currentOrder.length) {
    throw gridError('SYSTEM_WORKFLOW_GRID_REORDER_INVALID', 'A bounded destination index is required');
  }
  if (fromIndex === toIndex) return null;
  const ordered = draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid));
  const [grid] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, grid);
  draft.grids = [...ordered, draft.grids.find(isSystemWorkflowWorldCoverGrid)];
  return assertValidSystemWorkflowDraft(draft);
}

function deletionFingerprint(grid) {
  return systemWorkflowGridFingerprint(grid);
}

export function inspectSystemWorkflowGridDeletion(draftInput, { gridId } = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = requireGrid(draft, gridId);
  requireEditableGrid(grid);
  return Object.freeze({
    gridId: grid.id,
    title: grid.title,
    placementCount: grid.placements.length,
    fingerprint: deletionFingerprint(grid),
  });
}

export function createSystemWorkflowGridDeleteCandidate(draftInput, { confirmation, gridId } = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  if (draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid)).length === 1) {
    throw gridError('SYSTEM_WORKFLOW_GRID_LAST', 'The final remaining Grid cannot be deleted');
  }
  const impact = inspectSystemWorkflowGridDeletion(draft, { gridId });
  if (!confirmation
    || confirmation.gridId !== impact.gridId
    || confirmation.title !== impact.title
    || confirmation.placementCount !== impact.placementCount
    || confirmation.fingerprint !== impact.fingerprint) {
    throw gridError('SYSTEM_WORKFLOW_GRID_DELETE_CONFIRMATION_STALE', 'Exact current deletion impact confirmation is required');
  }
  draft.grids.splice(draft.grids.findIndex(({ id }) => id === gridId), 1);
  return assertValidSystemWorkflowDraft(draft);
}
