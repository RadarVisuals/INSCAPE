import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { PROFILE_DOCUMENT_LIMITS } from '../../profileDocument/domain/constants.js';

export const SYSTEM_WORKFLOW_DRAFT_VERSION = 4;
export const SYSTEM_WORKFLOW_ARTBOARD = Object.freeze({ aspectWidth: 16, aspectHeight: 9 });
export const SYSTEM_WORKFLOW_GEOMETRY = Object.freeze({ columns: 32, rows: 18 });
export const SYSTEM_WORKFLOW_GRID_PRECISION = 9;
export const SYSTEM_WORKFLOW_GRID_DENSITY = Object.freeze({ minimum: -8, maximum: 8, default: 0 });
export const SYSTEM_WORKFLOW_WORLD_BOUNDS = Object.freeze({
  minimumColumn: -4096,
  minimumRow: -4096,
  maximumColumn: 4096,
  maximumRow: 4096,
  maximumSpan: 512,
});
export const SYSTEM_WORKFLOW_VISIBILITY = Object.freeze({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' });
export const SYSTEM_WORKFLOW_GUIDE_MODES = Object.freeze(['LINES', 'DOTS', 'NONE']);
export const SYSTEM_WORKFLOW_LABEL_ANCHORS = Object.freeze([
  'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right',
]);
export const SYSTEM_WORKFLOW_SURFACE_IDS = Object.freeze([
  'carbon', 'graphite', 'slate', 'ash', 'mist', 'paper',
]);
export const SYSTEM_WORKFLOW_FRAME_IDS = Object.freeze(['NONE', 'DOSSIER', 'CAPTION']);
export const SYSTEM_WORKFLOW_TRANSPARENCY_MODES = Object.freeze(['AUTO', 'PRESERVE_ALPHA', 'OPAQUE']);
export const SYSTEM_WORKFLOW_LIMITS = Object.freeze({
  ...PROFILE_DOCUMENT_LIMITS,
  maxGrids: 24,
  maxPlacementsPerGrid: 200,
});

const DRAFT_KEYS = ['profileAddress', 'draftVersion', 'artboard', 'geometry', 'appearance', 'identityPresentation', 'grids'];
const APPEARANCE_KEYS = ['surfaceId', 'menuSurfaceId', 'dossierSurfaceId', 'guideMode', 'guideSize', 'guideColor'];
const GRID_KEYS = ['id', 'title', 'subtitle', 'visibility', 'labelVisible', 'labelAnchor', 'labelOffset', 'placements'];
const PLACEMENT_KEYS = ['id', 'stableAssetId', 'column', 'row', 'columnSpan', 'rowSpan', 'layer', 'navigationOrder', 'crop', 'frameId', 'mat', 'backing', 'transparencyMode', 'visibility', 'locked', 'transform'];
const IDENTITY_KEYS = ['alias', 'avatar', 'bio', 'tags', 'dossierSurface', 'visibility'];
const SAFE_ID = /^[A-Za-z0-9:_-]+$/u;
const GRID_ID = /^grid:[A-Za-z0-9_-]+$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const textEncoder = new TextEncoder();
const GRID_EPSILON = 1e-7;

const record = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value, keys) => record(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const safeInteger = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
export const isSystemWorkflowGridCoordinate = (value) => Number.isFinite(value)
  && Math.abs(value * SYSTEM_WORKFLOW_GRID_PRECISION - Math.round(value * SYSTEM_WORKFLOW_GRID_PRECISION)) < GRID_EPSILON;
export const quantizeSystemWorkflowGridCoordinate = (value) => (
  Math.round(value * SYSTEM_WORKFLOW_GRID_PRECISION) / SYSTEM_WORKFLOW_GRID_PRECISION
);
export function systemWorkflowSnapStep(density) {
  if (!Number.isSafeInteger(density)
    || density < SYSTEM_WORKFLOW_GRID_DENSITY.minimum || density > SYSTEM_WORKFLOW_GRID_DENSITY.maximum) {
    throw operationError('SYSTEM_WORKFLOW_GRID_DENSITY_INVALID', 'Grid density must be an integer from -8 through 8');
  }
  return density < 0
    ? (SYSTEM_WORKFLOW_GRID_PRECISION + density) / SYSTEM_WORKFLOW_GRID_PRECISION
    : density + 1;
}
const safeText = (value, maximum, { empty = true } = {}) => typeof value === 'string'
  && (empty || value.length > 0)
  && value.length <= maximum
  && !/[\u0000-\u001f\u007f]/u.test(value);
const safeId = (value) => safeText(value, SYSTEM_WORKFLOW_LIMITS.maxIdLength, { empty: false })
  && SAFE_ID.test(value);

const sets = {
  anchors: new Set(SYSTEM_WORKFLOW_LABEL_ANCHORS),
  frames: new Set(SYSTEM_WORKFLOW_FRAME_IDS),
  guides: new Set(SYSTEM_WORKFLOW_GUIDE_MODES),
  surfaces: new Set(SYSTEM_WORKFLOW_SURFACE_IDS),
  transparency: new Set(SYSTEM_WORKFLOW_TRANSPARENCY_MODES),
  visibility: new Set(Object.values(SYSTEM_WORKFLOW_VISIBILITY)),
};

function operationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

function defaultRandomId() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw operationError('SYSTEM_WORKFLOW_ID_GENERATOR_UNAVAILABLE', 'Secure ID generation is unavailable');
  }
  return globalThis.crypto.randomUUID();
}

export function createSystemWorkflowGridId(usedIdsInput = [], { generateId = defaultRandomId } = {}) {
  const usedIds = new Set(usedIdsInput);
  if (typeof generateId !== 'function') {
    throw operationError('SYSTEM_WORKFLOW_ID_GENERATOR_INVALID', 'A secure Grid ID generator is required');
  }
  for (let attempt = 1; attempt <= 32; attempt += 1) {
    let token;
    try { token = generateId(attempt); }
    catch (error) {
      if (error?.code === 'SYSTEM_WORKFLOW_ID_GENERATOR_UNAVAILABLE') throw error;
      throw operationError('SYSTEM_WORKFLOW_ID_GENERATION_FAILED', 'Secure Grid ID generation failed');
    }
    const candidate = `grid:${String(token || '')}`;
    if (!GRID_ID.test(candidate) || candidate.length > SYSTEM_WORKFLOW_LIMITS.maxIdLength) {
      throw operationError('SYSTEM_WORKFLOW_ID_CANDIDATE_INVALID', 'Grid ID generator returned an invalid candidate');
    }
    if (!usedIds.has(candidate)) return candidate;
  }
  throw operationError('SYSTEM_WORKFLOW_ID_EXHAUSTED', 'No unused Grid ID was found within the bounded search');
}

export function createEmptySystemWorkflowIdentityPresentation() {
  return {
    alias: '',
    avatar: { mode: 'official', stableAssetId: null, shape: 'square' },
    bio: { mode: 'official', customText: '' },
    tags: { includeOfficial: true, additional: [] },
    dossierSurface: 'paper',
    visibility: { links: true, network: true, counts: true, publicationDate: true },
  };
}

export function createEmptySystemWorkflowDraft(profileAddress, options = {}) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw operationError('SYSTEM_WORKFLOW_PROFILE_INVALID', 'A valid profile address is required');
  return {
    profileAddress: profile,
    draftVersion: SYSTEM_WORKFLOW_DRAFT_VERSION,
    artboard: { ...SYSTEM_WORKFLOW_ARTBOARD },
    geometry: { ...SYSTEM_WORKFLOW_GEOMETRY },
    appearance: {
      surfaceId: 'mist', menuSurfaceId: 'mist', dossierSurfaceId: 'paper',
      guideMode: 'LINES', guideSize: SYSTEM_WORKFLOW_GRID_DENSITY.default, guideColor: '#6f746f',
    },
    identityPresentation: createEmptySystemWorkflowIdentityPresentation(),
    grids: [{
      id: createSystemWorkflowGridId([], options),
      title: 'HOME', subtitle: '', visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
      labelVisible: true, labelAnchor: 'top-left', labelOffset: { column: 0, row: 0 },
      placements: [],
    }],
  };
}

function validateIdentity(value, fail) {
  if (!exactKeys(value, IDENTITY_KEYS)) return fail('identityPresentation', 'invalid_identity_structure', 'Invalid identity');
  if (!safeText(value.alias, 80)) fail('identityPresentation.alias', 'invalid_alias', 'Invalid alias');
  if (!exactKeys(value.avatar, ['mode', 'stableAssetId', 'shape'])
    || !['official', 'inscape'].includes(value.avatar?.mode)
    || !['round', 'square'].includes(value.avatar?.shape)
    || !(value.avatar?.stableAssetId === null || parseCanonicalAssetId(value.avatar?.stableAssetId))) {
    fail('identityPresentation.avatar', 'invalid_avatar', 'Invalid avatar');
  }
  if (!exactKeys(value.bio, ['mode', 'customText'])
    || !['official', 'inscape', 'hidden'].includes(value.bio?.mode)
    || !safeText(value.bio?.customText, 480)) fail('identityPresentation.bio', 'invalid_bio', 'Invalid bio');
  if (!exactKeys(value.tags, ['includeOfficial', 'additional'])
    || typeof value.tags?.includeOfficial !== 'boolean'
    || !Array.isArray(value.tags?.additional)
    || value.tags.additional.length > 16
    || value.tags.additional.some((tag) => !safeText(tag, 48, { empty: false }))) {
    fail('identityPresentation.tags', 'invalid_tags', 'Invalid tags');
  }
  if (!sets.surfaces.has(value.dossierSurface)) fail('identityPresentation.dossierSurface', 'invalid_dossier_surface', 'Invalid dossier surface');
  if (!exactKeys(value.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(value.visibility || {}).some((entry) => typeof entry !== 'boolean')) {
    fail('identityPresentation.visibility', 'invalid_identity_visibility', 'Invalid identity visibility');
  }
}

function validateCrop(value) {
  return value === null || exactKeys(value, ['x', 'y', 'zoom'])
    && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    && Number.isFinite(value.zoom) && value.zoom >= 1 && value.zoom <= 4;
}

export function isValidSystemWorkflowPlacementGeometry(value) {
  return isSystemWorkflowGridCoordinate(value?.column)
    && isSystemWorkflowGridCoordinate(value?.row)
    && isSystemWorkflowGridCoordinate(value?.columnSpan) && value.columnSpan >= 1 / SYSTEM_WORKFLOW_GRID_PRECISION
    && isSystemWorkflowGridCoordinate(value?.rowSpan) && value.rowSpan >= 1 / SYSTEM_WORKFLOW_GRID_PRECISION
    && value.columnSpan <= SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan
    && value.rowSpan <= SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumSpan
    && value.column >= SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumColumn
    && value.row >= SYSTEM_WORKFLOW_WORLD_BOUNDS.minimumRow
    && value.column + value.columnSpan <= SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumColumn
    && value.row + value.rowSpan <= SYSTEM_WORKFLOW_WORLD_BOUNDS.maximumRow;
}

function validatePlacement(value, path, fail) {
  if (!exactKeys(value, PLACEMENT_KEYS)) return fail(path, 'invalid_placement_structure', 'Invalid placement');
  if (!safeId(value.id)) fail(`${path}.id`, 'invalid_placement_id', 'Invalid placement ID');
  if (!parseCanonicalAssetId(value.stableAssetId)) fail(`${path}.stableAssetId`, 'invalid_asset_id', 'Invalid asset ID');
  if (!isValidSystemWorkflowPlacementGeometry(value)) fail(path, 'invalid_placement_geometry', 'Invalid world geometry');
  if (!safeInteger(value.layer)) fail(`${path}.layer`, 'invalid_layer', 'Invalid layer');
  if (!safeInteger(value.navigationOrder)) fail(`${path}.navigationOrder`, 'invalid_navigation_order', 'Invalid order');
  if (!validateCrop(value.crop)) fail(`${path}.crop`, 'invalid_crop', 'Invalid crop');
  if (!sets.frames.has(value.frameId)) fail(`${path}.frameId`, 'invalid_frame', 'Invalid frame');
  if (!exactKeys(value.mat, ['enabled', 'color', 'inset'])
    || typeof value.mat?.enabled !== 'boolean' || !HEX_COLOR.test(value.mat?.color || '')
    || !exactKeys(value.mat?.inset, ['top', 'right', 'bottom', 'left'])
    || Object.values(value.mat?.inset || {}).some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 0.45)
    || value.mat.inset.left + value.mat.inset.right >= 1
    || value.mat.inset.top + value.mat.inset.bottom >= 1) fail(`${path}.mat`, 'invalid_mat', 'Invalid mat');
  if (!exactKeys(value.backing, ['enabled', 'color'])
    || typeof value.backing?.enabled !== 'boolean' || !HEX_COLOR.test(value.backing?.color || '')) fail(`${path}.backing`, 'invalid_backing', 'Invalid backing');
  if (!sets.transparency.has(value.transparencyMode)) fail(`${path}.transparencyMode`, 'invalid_transparency', 'Invalid transparency');
  if (!sets.visibility.has(value.visibility)) fail(`${path}.visibility`, 'invalid_visibility', 'Invalid visibility');
  if (typeof value.locked !== 'boolean') fail(`${path}.locked`, 'invalid_lock', 'Invalid lock');
  if (!exactKeys(value.transform, ['quarterTurns', 'mirrorX', 'mirrorY'])
    || !Number.isSafeInteger(value.transform?.quarterTurns)
    || value.transform.quarterTurns < 0 || value.transform.quarterTurns > 3
    || typeof value.transform?.mirrorX !== 'boolean' || typeof value.transform?.mirrorY !== 'boolean') {
    fail(`${path}.transform`, 'invalid_transform', 'Invalid transform');
  }
}

export function validateSystemWorkflowDraft(input) {
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  if (!exactKeys(input, DRAFT_KEYS)) {
    fail('$', 'invalid_draft_structure', 'Invalid draft');
    return { valid: false, errors, value: null };
  }
  if (!normalizeProfileAddress(input.profileAddress) || input.profileAddress !== input.profileAddress.toLowerCase()) fail('profileAddress', 'invalid_profile_address', 'Invalid profile address');
  if (input.draftVersion !== SYSTEM_WORKFLOW_DRAFT_VERSION) fail('draftVersion', 'unsupported_draft_version', 'Unsupported draft version');
  if (!exactKeys(input.artboard, ['aspectWidth', 'aspectHeight'])
    || input.artboard.aspectWidth !== 16 || input.artboard.aspectHeight !== 9) fail('artboard', 'invalid_artboard', 'Invalid artboard');
  if (!exactKeys(input.geometry, ['columns', 'rows'])
    || input.geometry.columns !== 32 || input.geometry.rows !== 18) fail('geometry', 'invalid_geometry', 'Invalid geometry');
  if (!exactKeys(input.appearance, APPEARANCE_KEYS)
    || !sets.surfaces.has(input.appearance?.surfaceId)
    || !sets.surfaces.has(input.appearance?.menuSurfaceId)
    || !sets.surfaces.has(input.appearance?.dossierSurfaceId)
    || !sets.guides.has(input.appearance?.guideMode)
    || !Number.isSafeInteger(input.appearance?.guideSize)
    || input.appearance.guideSize < SYSTEM_WORKFLOW_GRID_DENSITY.minimum
    || input.appearance.guideSize > SYSTEM_WORKFLOW_GRID_DENSITY.maximum
    || !HEX_COLOR.test(input.appearance?.guideColor || '')) fail('appearance', 'invalid_appearance', 'Invalid appearance');
  validateIdentity(input.identityPresentation, fail);
  if (!Array.isArray(input.grids) || input.grids.length < 1 || input.grids.length > SYSTEM_WORKFLOW_LIMITS.maxGrids) {
    fail('grids', 'invalid_grid_count', 'One to 24 Grids required');
  } else {
    const gridIds = new Set();
    const placementIds = new Set();
    let totalAssetReferences = input.identityPresentation.avatar.stableAssetId === null ? 0 : 1;
    input.grids.forEach((grid, gridIndex) => {
      const path = `grids[${gridIndex}]`;
      if (!exactKeys(grid, GRID_KEYS)) return fail(path, 'invalid_grid_structure', 'Invalid Grid');
      if (!GRID_ID.test(grid.id || '') || grid.id.length > SYSTEM_WORKFLOW_LIMITS.maxIdLength) fail(`${path}.id`, 'invalid_grid_id', 'Invalid Grid ID');
      if (gridIds.has(grid.id)) fail(`${path}.id`, 'duplicate_grid_id', 'Duplicate Grid ID');
      gridIds.add(grid.id);
      if (!safeText(grid.title, 80, { empty: false }) || !safeText(grid.subtitle, 160)) fail(path, 'invalid_grid_text', 'Invalid Grid text');
      if (!sets.visibility.has(grid.visibility)) fail(`${path}.visibility`, 'invalid_grid_visibility', 'Invalid Grid visibility');
      if (typeof grid.labelVisible !== 'boolean') fail(`${path}.labelVisible`, 'invalid_label_visibility', 'Invalid label');
      if (!sets.anchors.has(grid.labelAnchor)) fail(`${path}.labelAnchor`, 'invalid_label_anchor', 'Invalid anchor');
      if (!exactKeys(grid.labelOffset, ['column', 'row'])
        || !Number.isSafeInteger(grid.labelOffset.column) || Math.abs(grid.labelOffset.column) > 2
        || !Number.isSafeInteger(grid.labelOffset.row) || Math.abs(grid.labelOffset.row) > 2) fail(`${path}.labelOffset`, 'invalid_label_offset', 'Invalid offset');
      if (!Array.isArray(grid.placements) || grid.placements.length > SYSTEM_WORKFLOW_LIMITS.maxPlacementsPerGrid) {
        return fail(`${path}.placements`, 'invalid_placements', 'Invalid placements');
      }
      totalAssetReferences += grid.placements.length;
      const layers = new Set();
      const navigationOrders = new Set();
      grid.placements.forEach((placement, placementIndex) => {
        const placementPath = `${path}.placements[${placementIndex}]`;
        validatePlacement(placement, placementPath, fail);
        if (placementIds.has(placement?.id)) fail(`${placementPath}.id`, 'duplicate_placement_id', 'Duplicate placement ID');
        placementIds.add(placement?.id);
        if (layers.has(placement?.layer)) fail(`${placementPath}.layer`, 'duplicate_layer', 'Duplicate layer');
        layers.add(placement?.layer);
        if (navigationOrders.has(placement?.navigationOrder)) fail(`${placementPath}.navigationOrder`, 'duplicate_navigation_order', 'Duplicate navigation order');
        navigationOrders.add(placement?.navigationOrder);
      });
    });
    if (totalAssetReferences > SYSTEM_WORKFLOW_LIMITS.maxTotalAssetReferences) {
      fail('grids', 'too_many_asset_references', 'Too many asset references');
    }
  }
  try {
    if (textEncoder.encode(JSON.stringify(input)).byteLength > SYSTEM_WORKFLOW_LIMITS.maxJsonBytes) {
      fail('$', 'draft_too_large', 'Draft exceeds the byte limit');
    }
  } catch {
    fail('$', 'draft_not_serializable', 'Draft is not serializable');
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(input) };
}

export function assertValidSystemWorkflowDraft(input) {
  const result = validateSystemWorkflowDraft(input);
  if (!result.valid) throw Object.assign(new TypeError(result.errors[0].message), { errors: result.errors });
  return result.value;
}
