import {
  LATTICE_PRODUCTION_GRID_STATES,
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from './latticeProductionDraft.js';

export const LATTICE_PRODUCTION_HOME_GRID_ID = 'table-05';
export const LATTICE_PRODUCTION_GRID_ACTIVATION_ORDER = Object.freeze([
  'table-05', 'table-06', 'table-08', 'table-04', 'table-02',
  'table-09', 'table-07', 'table-01', 'table-03',
]);

function gridError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function activeGrid(draft, gridId) {
  const grid = draft.tables.find(({ id }) => id === gridId);
  if (!grid) throw gridError('LATTICE_GRID_UNKNOWN', 'The canonical Grid does not exist');
  if (grid.gridState !== LATTICE_PRODUCTION_GRID_STATES.ACTIVE) {
    throw gridError('LATTICE_GRID_UNUSED', 'The canonical Grid is not active');
  }
  return grid;
}

function normalizedName(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  const name = value.trim().replace(/\s+/gu, ' ');
  return name && name.length <= 80 ? name : null;
}

function resetUnusedGrid(grid) {
  Object.assign(grid, {
    gridState: LATTICE_PRODUCTION_GRID_STATES.UNUSED,
    title: '',
    subtitle: '',
    labelVisible: true,
    labelAnchor: 'top-left',
    labelOffset: { column: 0, row: 0 },
    visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE,
    placements: [],
  });
}

function nextDefaultGridTitle(draft) {
  const titles = new Set(draft.tables
    .filter(({ gridState }) => gridState === LATTICE_PRODUCTION_GRID_STATES.ACTIVE)
    .map(({ title }) => title.trim().toUpperCase()));
  for (let number = 2; number <= 9; number += 1) {
    const candidate = `GRID ${String(number).padStart(2, '0')}`;
    if (!titles.has(candidate)) return candidate;
  }
  throw gridError('LATTICE_GRID_NAME_EXHAUSTED', 'No deterministic default Grid name is available');
}

export function projectLatticeProductionActiveGrids(draftInput) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const byId = new Map(draft.tables.map((grid) => [grid.id, grid]));
  return LATTICE_PRODUCTION_GRID_ACTIVATION_ORDER
    .map((gridId) => byId.get(gridId))
    .filter((grid) => grid?.gridState === LATTICE_PRODUCTION_GRID_STATES.ACTIVE)
    .map((grid) => structuredClone(grid));
}

export function createLatticeProductionGridActivationCandidate(draftInput) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const gridId = LATTICE_PRODUCTION_GRID_ACTIVATION_ORDER.find((candidateId) => draft.tables
    .some(({ gridState, id }) => id === candidateId && gridState === LATTICE_PRODUCTION_GRID_STATES.UNUSED));
  if (!gridId) throw gridError('LATTICE_GRID_LIMIT_REACHED', 'All nine canonical Grids are already active');
  const grid = draft.tables.find(({ id }) => id === gridId);
  Object.assign(grid, {
    gridState: LATTICE_PRODUCTION_GRID_STATES.ACTIVE,
    title: nextDefaultGridTitle(draft),
    visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE,
  });
  return assertValidLatticeProductionDraft(draft);
}

export function createLatticeProductionGridRenameCandidate(draftInput, { gridId, name } = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const grid = activeGrid(draft, gridId);
  const title = normalizedName(name);
  if (!title) throw gridError('LATTICE_GRID_NAME_INVALID', 'A non-empty safe Grid name is required');
  grid.title = title;
  return assertValidLatticeProductionDraft(draft);
}

export function createLatticeProductionGridVisibilityCandidate(draftInput, { gridId, visibility } = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const grid = activeGrid(draft, gridId);
  if (!Object.values(LATTICE_PRODUCTION_VISIBILITY).includes(visibility)) {
    throw gridError('LATTICE_GRID_VISIBILITY_INVALID', 'A canonical Grid visibility is required');
  }
  grid.visibility = visibility;
  return assertValidLatticeProductionDraft(draft);
}

export function describeLatticeProductionGridDeactivation(draftInput, { gridId } = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const grid = activeGrid(draft, gridId);
  const publicPlacementCount = grid.placements.filter(({ visibility }) => visibility === LATTICE_PRODUCTION_VISIBILITY.PUBLIC).length;
  const placementCount = grid.placements.length;
  return Object.freeze({
    gridId: grid.id,
    gridFingerprint: JSON.stringify(grid),
    gridTitle: grid.title,
    placementCount,
    privatePlacementCount: placementCount - publicPlacementCount,
    publicPlacementCount,
  });
}

export function createLatticeProductionGridDeactivationCandidate(draftInput, { expectedImpact, gridId } = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  const grid = activeGrid(draft, gridId);
  if (grid.id === LATTICE_PRODUCTION_HOME_GRID_ID) {
    throw gridError('LATTICE_GRID_HOME_REQUIRED', 'The permanent HOME Grid cannot be deactivated');
  }
  const currentImpact = describeLatticeProductionGridDeactivation(draft, { gridId });
  if (!expectedImpact || expectedImpact.gridId !== currentImpact.gridId
    || expectedImpact.gridFingerprint !== currentImpact.gridFingerprint
    || expectedImpact.gridTitle !== currentImpact.gridTitle
    || expectedImpact.placementCount !== currentImpact.placementCount
    || expectedImpact.publicPlacementCount !== currentImpact.publicPlacementCount
    || expectedImpact.privatePlacementCount !== currentImpact.privatePlacementCount) {
    throw gridError('LATTICE_GRID_DEACTIVATION_STALE', 'The Grid changed before deactivation completed');
  }
  resetUnusedGrid(grid);
  return assertValidLatticeProductionDraft(draft);
}
