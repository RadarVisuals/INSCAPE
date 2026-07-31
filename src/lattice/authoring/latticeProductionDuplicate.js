import { assertValidLatticeProductionDraft, LATTICE_PRODUCTION_VISIBILITY } from '../domain/latticeProductionDraft.js';
import { createLatticeProductionPlacementId } from './latticeProductionPlacement.js';

function duplicateError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function nextOrder(placements, key) {
  const maximum = placements.reduce((value, placement) => Math.max(value, placement[key]), -1);
  if (maximum >= Number.MAX_SAFE_INTEGER) {
    throw duplicateError('LATTICE_DUPLICATE_ORDER_EXHAUSTED', 'Placement order is exhausted');
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

export function createLatticeProductionGroupDuplicateCandidate(draftInput, {
  expectedPlacements,
  generatePlacementId,
  placementIds,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table || table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw duplicateError('LATTICE_DUPLICATE_TABLE_UNAVAILABLE', 'Canonical public table is unavailable');
  }
  if (!Array.isArray(placementIds) || placementIds.length < 1
    || new Set(placementIds).size !== placementIds.length
    || !Array.isArray(expectedPlacements) || expectedPlacements.length !== placementIds.length) {
    throw duplicateError('LATTICE_DUPLICATE_GROUP_INVALID', 'Group duplicate requires unique placement snapshots');
  }
  const expectedById = new Map(expectedPlacements.map((placement) => [placement?.id, placement]));
  const sources = placementIds.map((placementId) => {
    const source = table.placements.find((placement) => placement.id === placementId);
    if (!source || source.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
      throw duplicateError('LATTICE_DUPLICATE_PLACEMENT_UNAVAILABLE', 'Canonical public placement is unavailable');
    }
    if (source.locked) throw duplicateError('LATTICE_DUPLICATE_PLACEMENT_LOCKED', 'Placement is locked');
    if (JSON.stringify(expectedById.get(placementId)) !== JSON.stringify(source)) {
      throw duplicateError('LATTICE_DUPLICATE_STALE_PLACEMENT', 'Canonical placement changed before duplicate');
    }
    return source;
  });
  const usedIds = new Set(draft.tables.flatMap((candidate) => candidate.placements.map(({ id }) => id)));
  const offset = groupOffset(sources);
  let layer = nextOrder(table.placements, 'layer');
  let navigationOrder = nextOrder(table.placements, 'navigationOrder');
  const duplicates = sources.map((source, index) => {
    if (layer > Number.MAX_SAFE_INTEGER - index || navigationOrder > Number.MAX_SAFE_INTEGER - index) {
      throw duplicateError('LATTICE_DUPLICATE_ORDER_EXHAUSTED', 'Placement order is exhausted');
    }
    const id = createLatticeProductionPlacementId(usedIds,
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
  table.placements.push(...duplicates);
  return Object.freeze({
    draft: assertValidLatticeProductionDraft(draft),
    placementIds: Object.freeze(duplicates.map(({ id }) => id)),
  });
}

export function createLatticeProductionDuplicateCandidate(draftInput, {
  expectedPlacement,
  generatePlacementId,
  placementId,
  tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table || table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw duplicateError('LATTICE_DUPLICATE_TABLE_UNAVAILABLE', 'Canonical public table is unavailable');
  }
  const source = table.placements.find((placement) => placement.id === placementId);
  if (!source || source.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw duplicateError('LATTICE_DUPLICATE_PLACEMENT_UNAVAILABLE', 'Canonical public placement is unavailable');
  }
  if (source.locked) throw duplicateError('LATTICE_DUPLICATE_PLACEMENT_LOCKED', 'Placement is locked');
  if (JSON.stringify(expectedPlacement) !== JSON.stringify(source)) {
    throw duplicateError('LATTICE_DUPLICATE_STALE_PLACEMENT', 'Canonical placement changed before duplicate');
  }
  const usedIds = new Set(draft.tables.flatMap((candidate) => candidate.placements.map(({ id }) => id)));
  const offset = offsetGeometry(source);
  const duplicate = {
    ...structuredClone(source),
    ...offset,
    id: createLatticeProductionPlacementId(usedIds, generatePlacementId ? { generateCandidate: generatePlacementId } : undefined),
    layer: nextOrder(table.placements, 'layer'),
    navigationOrder: nextOrder(table.placements, 'navigationOrder'),
  };
  table.placements.push(duplicate);
  return Object.freeze({ draft: assertValidLatticeProductionDraft(draft), placementId: duplicate.id });
}
