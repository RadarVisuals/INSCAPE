import { assertValidSystemWorkflowDraft, SYSTEM_WORKFLOW_VISIBILITY } from './domain/systemWorkflowDraft.js';
import { createSystemWorkflowPlacementId } from './systemWorkflowPlacement.js';

function duplicateError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function nextOrder(placements, key) {
  const maximum = placements.reduce((value, placement) => Math.max(value, placement[key]), -1);
  if (maximum >= Number.MAX_SAFE_INTEGER) {
    throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_ORDER_EXHAUSTED', 'Placement order is exhausted');
  }
  return maximum + 1;
}

function offsetGeometry(source) {
  if (source.column + source.columnSpan < 32 && source.row + source.rowSpan < 18) {
    return { column: source.column + 1, row: source.row + 1 };
  }
  if (source.column > 0 && source.row > 0) return { column: source.column - 1, row: source.row - 1 };
  return { column: source.column, row: source.row };
}

function groupOffset(sources) {
  const maximumColumn = Math.max(...sources.map(({ column, columnSpan }) => column + columnSpan));
  const maximumRow = Math.max(...sources.map(({ row, rowSpan }) => row + rowSpan));
  if (maximumColumn < 32 && maximumRow < 18) return { column: 1, row: 1 };
  if (Math.min(...sources.map(({ column }) => column)) > 0
    && Math.min(...sources.map(({ row }) => row)) > 0) return { column: -1, row: -1 };
  return { column: 0, row: 0 };
}

export function createSystemWorkflowGroupDuplicateCandidate(draftInput, {
  expectedPlacements,
  generatePlacementId,
  placementIds,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid || grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_GRID_UNAVAILABLE', 'Canonical public grid is unavailable');
  }
  if (!Array.isArray(placementIds) || placementIds.length < 1
    || new Set(placementIds).size !== placementIds.length
    || !Array.isArray(expectedPlacements) || expectedPlacements.length !== placementIds.length) {
    throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_GROUP_INVALID', 'Group duplicate requires unique placement snapshots');
  }
  const expectedById = new Map(expectedPlacements.map((placement) => [placement?.id, placement]));
  const sources = placementIds.map((placementId) => {
    const source = grid.placements.find((placement) => placement.id === placementId);
    if (!source || source.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
      throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_PLACEMENT_UNAVAILABLE', 'Canonical public placement is unavailable');
    }
    if (source.locked) throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_PLACEMENT_LOCKED', 'Placement is locked');
    if (JSON.stringify(expectedById.get(placementId)) !== JSON.stringify(source)) {
      throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_STALE_PLACEMENT', 'Canonical placement changed before duplicate');
    }
    return source;
  });
  const usedIds = new Set(draft.grids.flatMap((candidate) => candidate.placements.map(({ id }) => id)));
  const offset = groupOffset(sources);
  let layer = nextOrder(grid.placements, 'layer');
  let navigationOrder = nextOrder(grid.placements, 'navigationOrder');
  const duplicates = sources.map((source, index) => {
    if (layer > Number.MAX_SAFE_INTEGER - index || navigationOrder > Number.MAX_SAFE_INTEGER - index) {
      throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_ORDER_EXHAUSTED', 'Placement order is exhausted');
    }
    const id = createSystemWorkflowPlacementId(usedIds,
      generatePlacementId ? { generateCandidate: generatePlacementId } : undefined);
    usedIds.add(id);
    const duplicate = {
      ...structuredClone(source),
      column: source.column + offset.column,
      row: source.row + offset.row,
      id,
      layer: layer + index,
      navigationOrder: navigationOrder + index,
    };
    return duplicate;
  });
  grid.placements.push(...duplicates);
  return Object.freeze({
    draft: assertValidSystemWorkflowDraft(draft),
    placementIds: Object.freeze(duplicates.map(({ id }) => id)),
  });
}

export function createSystemWorkflowDuplicateCandidate(draftInput, {
  expectedPlacement,
  generatePlacementId,
  placementId,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid || grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_GRID_UNAVAILABLE', 'Canonical public grid is unavailable');
  }
  const source = grid.placements.find((placement) => placement.id === placementId);
  if (!source || source.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_PLACEMENT_UNAVAILABLE', 'Canonical public placement is unavailable');
  }
  if (source.locked) throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_PLACEMENT_LOCKED', 'Placement is locked');
  if (JSON.stringify(expectedPlacement) !== JSON.stringify(source)) {
    throw duplicateError('SYSTEM_WORKFLOW_DUPLICATE_STALE_PLACEMENT', 'Canonical placement changed before duplicate');
  }
  const usedIds = new Set(draft.grids.flatMap((candidate) => candidate.placements.map(({ id }) => id)));
  const offset = offsetGeometry(source);
  const duplicate = {
    ...structuredClone(source),
    ...offset,
    id: createSystemWorkflowPlacementId(usedIds, generatePlacementId ? { generateCandidate: generatePlacementId } : undefined),
    layer: nextOrder(grid.placements, 'layer'),
    navigationOrder: nextOrder(grid.placements, 'navigationOrder'),
  };
  grid.placements.push(duplicate);
  return Object.freeze({ draft: assertValidSystemWorkflowDraft(draft), placementId: duplicate.id });
}
