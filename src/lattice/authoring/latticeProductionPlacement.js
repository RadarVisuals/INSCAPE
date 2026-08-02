import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import {
  LATTICE_PRODUCTION_GEOMETRY,
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from '../domain/latticeProductionDraft.js';

export const INITIAL_LATTICE_PLACEMENT_ENVELOPE = Object.freeze({ columns: 12, rows: 10 });
export const LATTICE_PLACEMENT_PRESETS = Object.freeze({ COMPACT: 'compact', DEFAULT: 'default' });

const PLACEMENT_ID = /^[A-Za-z0-9:_-]+$/u;
const MAX_PLACEMENT_ID_LENGTH = 200;
export const LATTICE_PLACEMENT_ID_MAXIMUM_ATTEMPTS = 32;

function operationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function validPlacementId(value) {
  return typeof value === 'string' && value.length > 0
    && value.length <= MAX_PLACEMENT_ID_LENGTH && PLACEMENT_ID.test(value);
}

function defaultPlacementIdCandidate() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw operationError('LATTICE_PLACEMENT_ID_GENERATOR_UNAVAILABLE', 'Secure placement ID generation is unavailable');
  }
  return `placement-${globalThis.crypto.randomUUID()}`;
}

export function createLatticeProductionPlacementId(usedIdsInput, {
  generateCandidate = defaultPlacementIdCandidate,
  maximumAttempts = LATTICE_PLACEMENT_ID_MAXIMUM_ATTEMPTS,
} = {}) {
  const usedIds = usedIdsInput instanceof Set ? new Set(usedIdsInput) : new Set(usedIdsInput || []);
  if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1 || typeof generateCandidate !== 'function') {
    throw operationError('LATTICE_PLACEMENT_ID_SEARCH_INVALID', 'Placement ID search inputs are invalid');
  }
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let candidate;
    try { candidate = generateCandidate(attempt); }
    catch (error) {
      if (error?.code === 'LATTICE_PLACEMENT_ID_GENERATOR_UNAVAILABLE') throw error;
      throw operationError('LATTICE_PLACEMENT_ID_GENERATION_FAILED', 'Secure placement ID generation failed');
    }
    if (!validPlacementId(candidate)) {
      throw operationError('LATTICE_PLACEMENT_ID_CANDIDATE_INVALID', 'Placement ID generator returned an invalid candidate');
    }
    if (!usedIds.has(candidate)) return candidate;
  }
  throw operationError('LATTICE_PLACEMENT_ID_EXHAUSTED', 'No valid unused placement ID was found within the bounded search');
}

function nextPlacementOrder(values, field) {
  let maximum = -1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw operationError('LATTICE_PLACEMENT_ORDER_INVALID', `Placement ${field} contains an invalid value`);
    }
    if (value > maximum) maximum = value;
  }
  if (maximum === Number.MAX_SAFE_INTEGER) {
    throw operationError('LATTICE_PLACEMENT_ORDER_EXHAUSTED', `Placement ${field} is exhausted`);
  }
  return maximum + 1;
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

export function createCompactLatticeProductionPlacementGeometry(nativeWidth, nativeHeight) {
  if (!Number.isFinite(nativeWidth) || nativeWidth <= 0
    || !Number.isFinite(nativeHeight) || nativeHeight <= 0) {
    throw operationError('LATTICE_PLACEMENT_DIMENSIONS_UNAVAILABLE', 'Positive native media dimensions are required');
  }
  const ratio = nativeWidth / nativeHeight;
  let columnSpan; let rowSpan;
  if (ratio >= 1) {
    columnSpan = Math.min(4, Math.max(2, Math.round(2 * ratio)));
    rowSpan = Math.min(4, Math.max(1, Math.round(columnSpan / ratio)));
  } else {
    rowSpan = Math.min(4, Math.max(2, Math.round(2 / ratio)));
    columnSpan = Math.min(4, Math.max(1, Math.round(rowSpan * ratio)));
  }
  const column = Math.floor((LATTICE_PRODUCTION_GEOMETRY.columns - columnSpan) / 2);
  const row = Math.floor((LATTICE_PRODUCTION_GEOMETRY.rows - rowSpan) / 2);
  return Object.freeze({ column, row, columnSpan, rowSpan });
}

export function assertLatticeProductionDropGeometry(destination) {
  const geometry = {
    column: destination?.column, row: destination?.row,
    columnSpan: destination?.columnSpan, rowSpan: destination?.rowSpan,
  };
  if (!Object.values(geometry).every(Number.isSafeInteger)
    || geometry.column < 0 || geometry.row < 0 || geometry.columnSpan < 1 || geometry.rowSpan < 1
    || geometry.column + geometry.columnSpan > LATTICE_PRODUCTION_GEOMETRY.columns
    || geometry.row + geometry.rowSpan > LATTICE_PRODUCTION_GEOMETRY.rows) {
    throw operationError('LATTICE_PLACEMENT_DROP_GEOMETRY_INVALID', 'Drop geometry exceeds the canonical authored plane');
  }
  return Object.freeze(geometry);
}

export function createLatticeProductionDropGeometry(nativeWidth, nativeHeight, pointer, rectangle, {
  placementPreset = LATTICE_PLACEMENT_PRESETS.DEFAULT,
} = {}) {
  if (!Object.values(LATTICE_PLACEMENT_PRESETS).includes(placementPreset)) {
    throw operationError('LATTICE_PLACEMENT_PRESET_INVALID', 'Unknown initial placement preset');
  }
  const initial = placementPreset === LATTICE_PLACEMENT_PRESETS.COMPACT
    ? createCompactLatticeProductionPlacementGeometry(nativeWidth, nativeHeight)
    : createInitialLatticeProductionPlacementGeometry(nativeWidth, nativeHeight);
  if (!Number.isFinite(pointer?.x) || !Number.isFinite(pointer?.y)
    || !Number.isFinite(rectangle?.left) || !Number.isFinite(rectangle?.top)
    || !Number.isFinite(rectangle?.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle?.height) || rectangle.height <= 0) {
    throw operationError('LATTICE_PLACEMENT_DROP_TARGET_INVALID', 'A measurable active table drop target is required');
  }
  const centerColumn = Math.floor(((pointer.x - rectangle.left) / rectangle.width) * LATTICE_PRODUCTION_GEOMETRY.columns);
  const centerRow = Math.floor(((pointer.y - rectangle.top) / rectangle.height) * LATTICE_PRODUCTION_GEOMETRY.rows);
  return assertLatticeProductionDropGeometry({
    column: Math.max(0, Math.min(LATTICE_PRODUCTION_GEOMETRY.columns - initial.columnSpan,
      centerColumn - Math.floor(initial.columnSpan / 2))),
    row: Math.max(0, Math.min(LATTICE_PRODUCTION_GEOMETRY.rows - initial.rowSpan,
      centerRow - Math.floor(initial.rowSpan / 2))),
    columnSpan: initial.columnSpan, rowSpan: initial.rowSpan,
  });
}

export function createLatticeProductionPlacementCandidate(draftInput, {
  generatePlacementId,
  destination,
  nativeHeight,
  nativeWidth,
  stableAssetId,
  tableId,
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
    id: createLatticeProductionPlacementId(usedIds, generatePlacementId
      ? { generateCandidate: generatePlacementId }
      : undefined),
    stableAssetId,
    ...(destination ? assertLatticeProductionDropGeometry(destination)
      : createInitialLatticeProductionPlacementGeometry(nativeWidth, nativeHeight)),
    layer: nextPlacementOrder(table.placements.map(({ layer }) => layer), 'layer'),
    navigationOrder: nextPlacementOrder(
      table.placements.map(({ navigationOrder }) => navigationOrder),
      'navigation order',
    ),
    crop: null,
    frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' },
    transparencyMode: 'AUTO',
    visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC,
    locked: false,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  };
  table.placements.push(placement);
  return assertValidLatticeProductionDraft(draft);
}
