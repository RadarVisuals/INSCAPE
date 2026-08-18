import { parseCanonicalAssetId } from '../profileDocument/domain/assetReference.js';
import {
  SYSTEM_WORKFLOW_GEOMETRY,
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
} from './domain/systemWorkflowDraft.js';

export const INITIAL_SYSTEM_WORKFLOW_PLACEMENT_ENVELOPE = Object.freeze({ columns: 12, rows: 10 });
export const SYSTEM_WORKFLOW_PLACEMENT_PRESETS = Object.freeze({ COMPACT: 'compact', DEFAULT: 'default' });

const PLACEMENT_ID = /^[A-Za-z0-9:_-]+$/u;
const MAX_PLACEMENT_ID_LENGTH = 200;
export const SYSTEM_WORKFLOW_PLACEMENT_ID_MAXIMUM_ATTEMPTS = 32;

function operationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function validPlacementId(value) {
  return typeof value === 'string' && value.length > 0
    && value.length <= MAX_PLACEMENT_ID_LENGTH && PLACEMENT_ID.test(value);
}

function defaultPlacementIdCandidate() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ID_GENERATOR_UNAVAILABLE', 'Secure placement ID generation is unavailable');
  }
  return `placement-${globalThis.crypto.randomUUID()}`;
}

export function createSystemWorkflowPlacementId(usedIdsInput, {
  generateCandidate = defaultPlacementIdCandidate,
  maximumAttempts = SYSTEM_WORKFLOW_PLACEMENT_ID_MAXIMUM_ATTEMPTS,
} = {}) {
  const usedIds = usedIdsInput instanceof Set ? new Set(usedIdsInput) : new Set(usedIdsInput || []);
  if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1 || typeof generateCandidate !== 'function') {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ID_SEARCH_INVALID', 'Placement ID search inputs are invalid');
  }
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let candidate;
    try { candidate = generateCandidate(attempt); }
    catch (error) {
      if (error?.code === 'SYSTEM_WORKFLOW_PLACEMENT_ID_GENERATOR_UNAVAILABLE') throw error;
      throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ID_GENERATION_FAILED', 'Secure placement ID generation failed');
    }
    if (!validPlacementId(candidate)) {
      throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ID_CANDIDATE_INVALID', 'Placement ID generator returned an invalid candidate');
    }
    if (!usedIds.has(candidate)) return candidate;
  }
  throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ID_EXHAUSTED', 'No valid unused placement ID was found within the bounded search');
}

function nextPlacementOrder(values, field) {
  let maximum = -1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ORDER_INVALID', `Placement ${field} contains an invalid value`);
    }
    if (value > maximum) maximum = value;
  }
  if (maximum === Number.MAX_SAFE_INTEGER) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ORDER_EXHAUSTED', `Placement ${field} is exhausted`);
  }
  return maximum + 1;
}

export function createInitialSystemWorkflowPlacementGeometry(nativeWidth, nativeHeight) {
  if (!Number.isFinite(nativeWidth) || nativeWidth <= 0
    || !Number.isFinite(nativeHeight) || nativeHeight <= 0) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_DIMENSIONS_UNAVAILABLE', 'Positive native media dimensions are required');
  }
  const scale = Math.min(
    INITIAL_SYSTEM_WORKFLOW_PLACEMENT_ENVELOPE.columns / nativeWidth,
    INITIAL_SYSTEM_WORKFLOW_PLACEMENT_ENVELOPE.rows / nativeHeight,
  );
  const columnSpan = Math.min(INITIAL_SYSTEM_WORKFLOW_PLACEMENT_ENVELOPE.columns, Math.max(1, Math.round(nativeWidth * scale)));
  const rowSpan = Math.min(INITIAL_SYSTEM_WORKFLOW_PLACEMENT_ENVELOPE.rows, Math.max(1, Math.round(nativeHeight * scale)));
  const column = Math.floor((SYSTEM_WORKFLOW_GEOMETRY.columns - columnSpan) / 2);
  const row = Math.floor((SYSTEM_WORKFLOW_GEOMETRY.rows - rowSpan) / 2);
  if (column < 0 || row < 0
    || column + columnSpan > SYSTEM_WORKFLOW_GEOMETRY.columns
    || row + rowSpan > SYSTEM_WORKFLOW_GEOMETRY.rows) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_GEOMETRY_INVALID', 'Initial placement geometry exceeds the canonical authored plane');
  }
  return Object.freeze({ column, row, columnSpan, rowSpan });
}

export function createCompactSystemWorkflowPlacementGeometry(nativeWidth, nativeHeight) {
  if (!Number.isFinite(nativeWidth) || nativeWidth <= 0
    || !Number.isFinite(nativeHeight) || nativeHeight <= 0) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_DIMENSIONS_UNAVAILABLE', 'Positive native media dimensions are required');
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
  const column = Math.floor((SYSTEM_WORKFLOW_GEOMETRY.columns - columnSpan) / 2);
  const row = Math.floor((SYSTEM_WORKFLOW_GEOMETRY.rows - rowSpan) / 2);
  return Object.freeze({ column, row, columnSpan, rowSpan });
}

export function assertSystemWorkflowDropGeometry(destination) {
  const geometry = {
    column: destination?.column, row: destination?.row,
    columnSpan: destination?.columnSpan, rowSpan: destination?.rowSpan,
  };
  if (!Object.values(geometry).every(Number.isSafeInteger)
    || geometry.column < 0 || geometry.row < 0 || geometry.columnSpan < 1 || geometry.rowSpan < 1
    || geometry.column + geometry.columnSpan > SYSTEM_WORKFLOW_GEOMETRY.columns
    || geometry.row + geometry.rowSpan > SYSTEM_WORKFLOW_GEOMETRY.rows) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_DROP_GEOMETRY_INVALID', 'Drop geometry exceeds the canonical authored plane');
  }
  return Object.freeze(geometry);
}

export function createSystemWorkflowDropGeometry(nativeWidth, nativeHeight, pointer, rectangle, {
  placementPreset = SYSTEM_WORKFLOW_PLACEMENT_PRESETS.DEFAULT,
} = {}) {
  if (!Object.values(SYSTEM_WORKFLOW_PLACEMENT_PRESETS).includes(placementPreset)) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_PRESET_INVALID', 'Unknown initial placement preset');
  }
  const initial = placementPreset === SYSTEM_WORKFLOW_PLACEMENT_PRESETS.COMPACT
    ? createCompactSystemWorkflowPlacementGeometry(nativeWidth, nativeHeight)
    : createInitialSystemWorkflowPlacementGeometry(nativeWidth, nativeHeight);
  if (!Number.isFinite(pointer?.x) || !Number.isFinite(pointer?.y)
    || !Number.isFinite(rectangle?.left) || !Number.isFinite(rectangle?.top)
    || !Number.isFinite(rectangle?.width) || rectangle.width <= 0
    || !Number.isFinite(rectangle?.height) || rectangle.height <= 0) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_DROP_TARGET_INVALID', 'A measurable active grid drop target is required');
  }
  const centerColumn = Math.floor(((pointer.x - rectangle.left) / rectangle.width) * SYSTEM_WORKFLOW_GEOMETRY.columns);
  const centerRow = Math.floor(((pointer.y - rectangle.top) / rectangle.height) * SYSTEM_WORKFLOW_GEOMETRY.rows);
  return assertSystemWorkflowDropGeometry({
    column: Math.max(0, Math.min(SYSTEM_WORKFLOW_GEOMETRY.columns - initial.columnSpan,
      centerColumn - Math.floor(initial.columnSpan / 2))),
    row: Math.max(0, Math.min(SYSTEM_WORKFLOW_GEOMETRY.rows - initial.rowSpan,
      centerRow - Math.floor(initial.rowSpan / 2))),
    columnSpan: initial.columnSpan, rowSpan: initial.rowSpan,
  });
}

export function createSystemWorkflowPlacementCandidate(draftInput, {
  generatePlacementId,
  destination,
  nativeHeight,
  nativeWidth,
  stableAssetId,
  gridId,
} = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  if (!parseCanonicalAssetId(stableAssetId)) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_ASSET_INVALID', 'A canonical stable asset ID is required');
  }
  const grid = draft.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw operationError('SYSTEM_WORKFLOW_PLACEMENT_GRID_UNKNOWN', 'The active canonical grid does not exist');
  if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) {
    throw operationError('SYSTEM_WORKFLOW_PLACEMENT_GRID_PRIVATE', 'Public placement is unavailable on a private grid');
  }

  const usedIds = new Set(draft.grids.flatMap((candidate) => candidate.placements.map(({ id }) => id)));
  const placement = {
    id: createSystemWorkflowPlacementId(usedIds, generatePlacementId
      ? { generateCandidate: generatePlacementId }
      : undefined),
    stableAssetId,
    ...(destination ? assertSystemWorkflowDropGeometry(destination)
      : createInitialSystemWorkflowPlacementGeometry(nativeWidth, nativeHeight)),
    layer: nextPlacementOrder(grid.placements.map(({ layer }) => layer), 'layer'),
    navigationOrder: nextPlacementOrder(
      grid.placements.map(({ navigationOrder }) => navigationOrder),
      'navigation order',
    ),
    crop: null,
    frameId: 'NONE',
    mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#d8d4ca' },
    transparencyMode: 'AUTO',
    visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
    locked: false,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  };
  grid.placements.push(placement);
  return assertValidSystemWorkflowDraft(draft);
}
