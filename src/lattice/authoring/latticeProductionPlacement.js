import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import {
  LATTICE_PRODUCTION_GEOMETRY,
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from '../domain/latticeProductionDraft.js';

export const INITIAL_LATTICE_PLACEMENT_ENVELOPE = Object.freeze({ columns: 12, rows: 10 });

const PLACEMENT_ID = /^[A-Za-z0-9:_-]+$/u;
const MAX_PLACEMENT_ID_LENGTH = 200;

function operationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function validPlacementId(value) {
  return typeof value === 'string' && value.length > 0
    && value.length <= MAX_PLACEMENT_ID_LENGTH && PLACEMENT_ID.test(value);
}

export function findFirstUnusedLatticeProductionPlacementId(usedIdsInput, {
  candidateForIndex = (index) => `placement-${index}`,
  maximumAttempts,
} = {}) {
  const usedIds = usedIdsInput instanceof Set ? new Set(usedIdsInput) : new Set(usedIdsInput || []);
  const limit = maximumAttempts ?? usedIds.size + 1;
  if (!Number.isSafeInteger(limit) || limit < 1 || typeof candidateForIndex !== 'function') {
    throw operationError('LATTICE_PLACEMENT_ID_SEARCH_INVALID', 'Placement ID search inputs are invalid');
  }
  for (let index = 1; index <= limit; index += 1) {
    const candidate = candidateForIndex(index);
    if (validPlacementId(candidate) && !usedIds.has(candidate)) return candidate;
  }
  throw operationError('LATTICE_PLACEMENT_ID_EXHAUSTED', 'No valid unused placement ID was found within the bounded search');
}

function firstUnusedNonNegative(values) {
  const used = new Set(values);
  for (let candidate = 0; candidate <= used.size; candidate += 1) {
    if (!used.has(candidate)) return candidate;
  }
  throw operationError('LATTICE_PLACEMENT_ORDER_EXHAUSTED', 'No unused placement order was found');
}

export function createInitialLatticeProductionPlacementGeometry(nativeWidth, nativeHeight) {
  if (!Number.isFinite(nativeWidth) || nativeWidth <= 0
    || !Number.isFinite(nativeHeight) || nativeHeight <= 0) {
    throw operationError('LATTICE_PLACEMENT_DIMENSIONS_UNAVAILABLE', 'Positive native media dimensions are required');
  }
  const scale = Math.min(
    INITIAL_LATTICE_PLACEMENT_ENVELOPE.columns / nativeWidth,
    INITIAL_LATTICE_PLACEMENT_ENVELOPE.rows / nativeHeight,
  );
  const columnSpan = Math.min(INITIAL_LATTICE_PLACEMENT_ENVELOPE.columns, Math.max(1, Math.round(nativeWidth * scale)));
  const rowSpan = Math.min(INITIAL_LATTICE_PLACEMENT_ENVELOPE.rows, Math.max(1, Math.round(nativeHeight * scale)));
  const column = Math.floor((LATTICE_PRODUCTION_GEOMETRY.columns - columnSpan) / 2);
  const row = Math.floor((LATTICE_PRODUCTION_GEOMETRY.rows - rowSpan) / 2);
  if (column < 0 || row < 0
    || column + columnSpan > LATTICE_PRODUCTION_GEOMETRY.columns
    || row + rowSpan > LATTICE_PRODUCTION_GEOMETRY.rows) {
    throw operationError('LATTICE_PLACEMENT_GEOMETRY_INVALID', 'Initial placement geometry exceeds the canonical authored plane');
  }
  return Object.freeze({ column, row, columnSpan, rowSpan });
}

export function createLatticeProductionPlacementCandidate(draftInput, {
  nativeHeight, nativeWidth, stableAssetId, tableId,
} = {}) {
  const draft = assertValidLatticeProductionDraft(draftInput);
  if (!parseCanonicalAssetId(stableAssetId)) {
    throw operationError('LATTICE_PLACEMENT_ASSET_INVALID', 'A canonical stable asset ID is required');
  }
  const table = draft.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw operationError('LATTICE_PLACEMENT_TABLE_UNKNOWN', 'The active canonical table does not exist');
  if (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) {
    throw operationError('LATTICE_PLACEMENT_TABLE_PRIVATE', 'Public placement is unavailable on a private table');
  }

  const usedIds = new Set(draft.tables.flatMap((candidate) => candidate.placements.map(({ id }) => id)));
  const placement = {
    id: findFirstUnusedLatticeProductionPlacementId(usedIds),
    stableAssetId,
    ...createInitialLatticeProductionPlacementGeometry(nativeWidth, nativeHeight),
    layer: firstUnusedNonNegative(table.placements.map(({ layer }) => layer)),
    navigationOrder: firstUnusedNonNegative(table.placements.map(({ navigationOrder }) => navigationOrder)),
    crop: null,
    frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' },
    transparencyMode: 'AUTO',
    visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC,
    locked: false,
  };
  table.placements.push(placement);
  return assertValidLatticeProductionDraft(draft);
}
