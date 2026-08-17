import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';

export const LATTICE_PRODUCTION_DRAFT_VERSION = 3;
export const LATTICE_PRODUCTION_ARTBOARD = Object.freeze({ aspectWidth: 16, aspectHeight: 9 });
export const LATTICE_PRODUCTION_GEOMETRY = Object.freeze({ columns: 32, rows: 18 });
export const LATTICE_PRODUCTION_ENTRY_COORDINATE = Object.freeze({ x: 0, y: 0 });
export const LATTICE_PRODUCTION_COORDINATES = Object.freeze(
  [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => Object.freeze({ x, y })))
);
export const LATTICE_PRODUCTION_VISIBILITY = Object.freeze({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' });
export const LATTICE_PRODUCTION_GRID_STATE_ACTIVE = 'ACTIVE';
export const LATTICE_PRODUCTION_GRID_STATE_UNUSED = 'UNUSED';
export const LATTICE_PRODUCTION_GRID_STATES = Object.freeze({
  ACTIVE: LATTICE_PRODUCTION_GRID_STATE_ACTIVE,
  UNUSED: LATTICE_PRODUCTION_GRID_STATE_UNUSED,
});
export const LATTICE_PRODUCTION_LABEL_ANCHORS = Object.freeze([
  'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
]);
export const LATTICE_PRODUCTION_SURFACE_IDS = Object.freeze([
  'carbon', 'graphite', 'slate', 'ash', 'mist', 'paper'
]);
export const LATTICE_PRODUCTION_FRAME_IDS = Object.freeze(['NONE', 'DOSSIER', 'CAPTION']);
export const LATTICE_PRODUCTION_TRANSPARENCY_MODES = Object.freeze(['AUTO', 'PRESERVE_ALPHA', 'OPAQUE']);

const DRAFT_KEYS = ['profileAddress', 'draftVersion', 'artboard', 'geometry', 'appearance', 'identityPresentation', 'tables'];
const TABLE_KEYS = ['id', 'coordinate', 'gridState', 'title', 'subtitle', 'labelVisible', 'labelAnchor', 'labelOffset', 'visibility', 'placements'];
const PLACEMENT_KEYS_V1 = ['id', 'stableAssetId', 'column', 'row', 'columnSpan', 'rowSpan', 'layer', 'navigationOrder', 'crop', 'frameId', 'mat', 'backing', 'transparencyMode', 'visibility', 'locked'];
const PLACEMENT_KEYS = [...PLACEMENT_KEYS_V1, 'transform'];
const IDENTITY_KEYS = ['alias', 'avatar', 'bio', 'tags', 'dossierSurface', 'visibility'];
const ID = /^[A-Za-z0-9:_-]+$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const sets = {
  anchors: new Set(LATTICE_PRODUCTION_LABEL_ANCHORS),
  frames: new Set(LATTICE_PRODUCTION_FRAME_IDS),
  surfaces: new Set(LATTICE_PRODUCTION_SURFACE_IDS),
  transparency: new Set(LATTICE_PRODUCTION_TRANSPARENCY_MODES),
  visibility: new Set(Object.values(LATTICE_PRODUCTION_VISIBILITY)),
};

const record = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value, keys) => record(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const safeInteger = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const text = (value, maximum, { empty = true } = {}) => typeof value === 'string'
  && (empty || value.length > 0) && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
const id = (value) => text(value, 200, { empty: false }) && ID.test(value);

export function latticeProductionTableId(coordinate) {
  const index = LATTICE_PRODUCTION_COORDINATES.findIndex(
    (candidate) => candidate.x === coordinate?.x && candidate.y === coordinate?.y
  );
  return index < 0 ? null : `table-${String(index + 1).padStart(2, '0')}`;
}

export function createEmptyLatticeProductionIdentityPresentation() {
  return {
    alias: '',
    avatar: { mode: 'official', stableAssetId: null, shape: 'square' },
    bio: { mode: 'official', customText: '' },
    tags: { includeOfficial: true, additional: [] },
    dossierSurface: 'paper',
    visibility: { links: true, network: true, counts: true, publicationDate: true },
  };
}

export function createEmptyLatticeProductionDraft(profileAddress) {
  return {
    profileAddress: normalizeProfileAddress(profileAddress) || String(profileAddress || '').toLowerCase(),
    draftVersion: LATTICE_PRODUCTION_DRAFT_VERSION,
    artboard: { ...LATTICE_PRODUCTION_ARTBOARD },
    geometry: { ...LATTICE_PRODUCTION_GEOMETRY },
    appearance: { surfaceId: 'mist', menuSurfaceId: 'mist', dossierSurfaceId: 'paper' },
    identityPresentation: createEmptyLatticeProductionIdentityPresentation(),
    tables: LATTICE_PRODUCTION_COORDINATES.map((coordinate, index) => {
      const entry = index === 4;
      return {
        id: latticeProductionTableId(coordinate),
        coordinate: { ...coordinate },
        gridState: entry ? LATTICE_PRODUCTION_GRID_STATE_ACTIVE : LATTICE_PRODUCTION_GRID_STATE_UNUSED,
        title: entry ? 'HOME' : '',
        subtitle: '',
        labelVisible: true,
        labelAnchor: 'top-left',
        labelOffset: { column: 0, row: 0 },
        visibility: entry ? LATTICE_PRODUCTION_VISIBILITY.PUBLIC : LATTICE_PRODUCTION_VISIBILITY.PRIVATE,
        placements: [],
      };
    }),
  };
}

function validateCrop(value) {
  return value === null || exactKeys(value, ['x', 'y', 'zoom'])
    && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    && Number.isFinite(value.zoom) && value.zoom >= 1 && value.zoom <= 4;
}

function validateMat(value) {
  return exactKeys(value, ['enabled', 'color', 'inset'])
    && typeof value.enabled === 'boolean' && HEX_COLOR.test(value.color)
    && exactKeys(value.inset, ['top', 'right', 'bottom', 'left'])
    && Object.values(value.inset).every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= 0.45)
    && value.inset.left + value.inset.right < 1 && value.inset.top + value.inset.bottom < 1;
}

function validateBacking(value) {
  return exactKeys(value, ['enabled', 'color'])
    && typeof value.enabled === 'boolean' && HEX_COLOR.test(value.color);
}

const validTransform = (value) => exactKeys(value, ['quarterTurns', 'mirrorX', 'mirrorY'])
  && Number.isSafeInteger(value.quarterTurns) && value.quarterTurns >= 0 && value.quarterTurns <= 3
  && typeof value.mirrorX === 'boolean' && typeof value.mirrorY === 'boolean';

export function migrateLatticeProductionDraft(input) {
  if (!record(input) || ![1, 2].includes(input.draftVersion)) return structuredClone(input);
  const migrated = structuredClone(input);
  if (Array.isArray(migrated.tables)) migrated.tables.forEach((table) => {
    if (migrated.draftVersion === 1 && Array.isArray(table?.placements)) {
      table.placements.forEach((placement) => {
        if (exactKeys(placement, PLACEMENT_KEYS_V1)) {
          placement.transform = { quarterTurns: 0, mirrorX: false, mirrorY: false };
        }
      });
    }
    if (record(table)) table.gridState = LATTICE_PRODUCTION_GRID_STATE_ACTIVE;
  });
  migrated.draftVersion = LATTICE_PRODUCTION_DRAFT_VERSION;
  return migrated;
}

function validateIdentity(value, fail) {
  if (!exactKeys(value, IDENTITY_KEYS)) return fail('identityPresentation', 'invalid_identity_structure', 'Invalid identity');
  if (!text(value.alias, 80)) fail('identityPresentation.alias', 'invalid_alias', 'Invalid alias');
  if (!exactKeys(value.avatar, ['mode', 'stableAssetId', 'shape'])
    || !['official', 'inscape'].includes(value.avatar?.mode)
    || !['round', 'square'].includes(value.avatar?.shape)
    || !(value.avatar?.stableAssetId === null || parseCanonicalAssetId(value.avatar?.stableAssetId))) {
    fail('identityPresentation.avatar', 'invalid_avatar', 'Invalid avatar');
  }
  if (!exactKeys(value.bio, ['mode', 'customText'])
    || !['official', 'inscape', 'hidden'].includes(value.bio?.mode)
    || !text(value.bio?.customText, 480)) fail('identityPresentation.bio', 'invalid_bio', 'Invalid bio');
  if (!exactKeys(value.tags, ['includeOfficial', 'additional'])
    || typeof value.tags?.includeOfficial !== 'boolean' || !Array.isArray(value.tags?.additional)
    || value.tags.additional.length > 16 || value.tags.additional.some((tag) => !text(tag, 48, { empty: false }))) {
    fail('identityPresentation.tags', 'invalid_tags', 'Invalid tags');
  }
  if (!sets.surfaces.has(value.dossierSurface)) fail('identityPresentation.dossierSurface', 'invalid_dossier_surface', 'Invalid dossier surface');
  if (!exactKeys(value.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(value.visibility || {}).some((entry) => typeof entry !== 'boolean')) {
    fail('identityPresentation.visibility', 'invalid_identity_visibility', 'Invalid identity visibility');
  }
}

function validatePlacement(value, path, fail) {
  if (!exactKeys(value, PLACEMENT_KEYS)) return fail(path, 'invalid_placement_structure', 'Invalid placement');
  if (!id(value.id)) fail(`${path}.id`, 'invalid_placement_id', 'Invalid placement ID');
  if (!parseCanonicalAssetId(value.stableAssetId)) fail(`${path}.stableAssetId`, 'invalid_asset_id', 'Invalid asset ID');
  if (!safeInteger(value.column) || !safeInteger(value.row)
    || !safeInteger(value.columnSpan, 1) || !safeInteger(value.rowSpan, 1)
    || value.column + value.columnSpan > LATTICE_PRODUCTION_GEOMETRY.columns
    || value.row + value.rowSpan > LATTICE_PRODUCTION_GEOMETRY.rows) {
    fail(path, 'invalid_placement_geometry', 'Invalid geometry');
  }
  if (!safeInteger(value.layer)) fail(`${path}.layer`, 'invalid_layer', 'Invalid layer');
  if (!safeInteger(value.navigationOrder)) fail(`${path}.navigationOrder`, 'invalid_navigation_order', 'Invalid order');
  if (!validateCrop(value.crop)) fail(`${path}.crop`, 'invalid_crop', 'Invalid crop');
  if (!sets.frames.has(value.frameId)) fail(`${path}.frameId`, 'invalid_frame', 'Invalid frame ID');
  if (!validateMat(value.mat)) fail(`${path}.mat`, 'invalid_mat', 'Invalid mat');
  if (!validateBacking(value.backing)) fail(`${path}.backing`, 'invalid_backing', 'Invalid backing');
  if (!sets.transparency.has(value.transparencyMode)) fail(`${path}.transparencyMode`, 'invalid_transparency', 'Invalid mode');
  if (!validTransform(value.transform)) fail(`${path}.transform`, 'invalid_transform', 'Invalid transform');
  if (!sets.visibility.has(value.visibility)) fail(`${path}.visibility`, 'invalid_visibility', 'Invalid visibility');
  if (typeof value.locked !== 'boolean') fail(`${path}.locked`, 'invalid_lock', 'Invalid lock');
}

export function validateLatticeProductionDraft(input) {
  input = migrateLatticeProductionDraft(input);
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  if (!exactKeys(input, DRAFT_KEYS)) {
    fail('$', 'invalid_draft_structure', 'Invalid draft');
    return { valid: false, errors, value: null };
  }
  if (!normalizeProfileAddress(input.profileAddress) || input.profileAddress !== input.profileAddress.toLowerCase()) fail('profileAddress', 'invalid_profile_address', 'Invalid profile address');
  if (input.draftVersion !== LATTICE_PRODUCTION_DRAFT_VERSION) fail('draftVersion', 'unsupported_draft_version', 'Unsupported draft version');
  if (!exactKeys(input.artboard, ['aspectWidth', 'aspectHeight'])
    || input.artboard.aspectWidth !== 16 || input.artboard.aspectHeight !== 9) fail('artboard', 'invalid_artboard', 'Invalid 16:9 artboard');
  if (!exactKeys(input.geometry, ['columns', 'rows'])
    || input.geometry.columns !== 32 || input.geometry.rows !== 18) fail('geometry', 'invalid_geometry', 'Invalid 32x18 geometry');
  if (!exactKeys(input.appearance, ['surfaceId', 'menuSurfaceId', 'dossierSurfaceId'])
    || Object.values(input.appearance || {}).some((value) => !sets.surfaces.has(value))) fail('appearance', 'invalid_appearance', 'Invalid appearance');
  validateIdentity(input.identityPresentation, fail);
  if (!Array.isArray(input.tables) || input.tables.length !== 9) {
    fail('tables', 'invalid_table_count', 'Nine slots required');
  } else {
    const coordinates = new Set();
    const placementIds = new Set();
    input.tables.forEach((table, tableIndex) => {
      const path = `tables[${tableIndex}]`;
      if (!exactKeys(table, TABLE_KEYS)) return fail(path, 'invalid_table_structure', 'Invalid Grid');
      const expectedCoordinate = LATTICE_PRODUCTION_COORDINATES[tableIndex];
      if (!exactKeys(table.coordinate, ['x', 'y'])
        || table.coordinate.x !== expectedCoordinate.x || table.coordinate.y !== expectedCoordinate.y) {
        fail(`${path}.coordinate`, 'invalid_table_order', 'Invalid Grid order');
      }
      const coordinateKey = `${table.coordinate?.x}:${table.coordinate?.y}`;
      if (coordinates.has(coordinateKey)) fail(`${path}.coordinate`, 'duplicate_coordinate', 'Duplicate coordinate');
      coordinates.add(coordinateKey);
      if (table.id !== latticeProductionTableId(table.coordinate)) fail(`${path}.id`, 'invalid_table_id', 'Invalid Grid ID');
      if (table.gridState !== LATTICE_PRODUCTION_GRID_STATE_ACTIVE
        && table.gridState !== LATTICE_PRODUCTION_GRID_STATE_UNUSED) fail(`${path}.gridState`, 'invalid_grid_state', 'Invalid Grid state');
      if (!text(table.title, 80) || !text(table.subtitle, 160)) fail(path, 'invalid_table_text', 'Invalid Grid text');
      if (typeof table.labelVisible !== 'boolean') fail(`${path}.labelVisible`, 'invalid_label_visibility', 'Invalid label');
      if (!sets.anchors.has(table.labelAnchor)) fail(`${path}.labelAnchor`, 'invalid_label_anchor', 'Invalid anchor');
      if (!exactKeys(table.labelOffset, ['column', 'row'])
        || !Number.isSafeInteger(table.labelOffset.column) || Math.abs(table.labelOffset.column) > 2
        || !Number.isSafeInteger(table.labelOffset.row) || Math.abs(table.labelOffset.row) > 2) fail(`${path}.labelOffset`, 'invalid_label_offset', 'Invalid offset');
      if (!sets.visibility.has(table.visibility)) fail(`${path}.visibility`, 'invalid_table_visibility', 'Invalid Grid visibility');
      if (!Array.isArray(table.placements)) return fail(`${path}.placements`, 'invalid_placements', 'Invalid placements');
      if (table.gridState === LATTICE_PRODUCTION_GRID_STATE_UNUSED
        && (table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PRIVATE
          || table.title || table.subtitle || !table.labelVisible
          || table.labelAnchor !== 'top-left' || table.labelOffset.column
          || table.labelOffset.row || table.placements.length)) {
        fail(path, 'invalid_unused_grid', 'Unused Grid invalid');
      }
      const layers = new Set();
      const navigationOrders = new Set();
      table.placements.forEach((placement, placementIndex) => {
        const placementPath = `${path}.placements[${placementIndex}]`;
        validatePlacement(placement, placementPath, fail);
        if (placementIds.has(placement?.id)) fail(`${placementPath}.id`, 'duplicate_placement_id', 'Duplicate placement ID');
        placementIds.add(placement?.id);
        if (layers.has(placement?.layer)) fail(`${placementPath}.layer`, 'duplicate_layer', 'Duplicate Grid layer');
        layers.add(placement?.layer);
        if (navigationOrders.has(placement?.navigationOrder)) fail(`${placementPath}.navigationOrder`, 'duplicate_navigation_order', 'Duplicate navigation order');
        navigationOrders.add(placement?.navigationOrder);
      });
    });
    if (input.tables[4]?.gridState !== LATTICE_PRODUCTION_GRID_STATE_ACTIVE) {
      fail('tables', 'inactive_entry_grid', 'HOME must remain active');
    }
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(input) };
}

export function assertValidLatticeProductionDraft(input) {
  const result = validateLatticeProductionDraft(input);
  if (!result.valid) throw Object.assign(new TypeError(result.errors[0].message), { errors: result.errors });
  return result.value;
}
