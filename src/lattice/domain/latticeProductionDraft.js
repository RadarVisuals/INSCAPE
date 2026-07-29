import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';

export const LATTICE_PRODUCTION_DRAFT_VERSION = 1;
export const LATTICE_PRODUCTION_ARTBOARD = Object.freeze({ aspectWidth: 16, aspectHeight: 9 });
export const LATTICE_PRODUCTION_GEOMETRY = Object.freeze({ columns: 32, rows: 18 });
export const LATTICE_PRODUCTION_ENTRY_COORDINATE = Object.freeze({ x: 0, y: 0 });
export const LATTICE_PRODUCTION_COORDINATES = Object.freeze(
  [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => Object.freeze({ x, y })))
);
export const LATTICE_PRODUCTION_VISIBILITY = Object.freeze({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' });
export const LATTICE_PRODUCTION_LABEL_ANCHORS = Object.freeze([
  'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
]);
export const LATTICE_PRODUCTION_SURFACE_IDS = Object.freeze([
  'carbon', 'graphite', 'slate', 'ash', 'mist', 'paper'
]);
export const LATTICE_PRODUCTION_FRAME_IDS = Object.freeze(['NONE', 'DOSSIER', 'CAPTION']);
export const LATTICE_PRODUCTION_TRANSPARENCY_MODES = Object.freeze(['AUTO', 'PRESERVE_ALPHA', 'OPAQUE']);

const DRAFT_KEYS = ['profileAddress', 'draftVersion', 'artboard', 'geometry', 'appearance', 'identityPresentation', 'tables'];
const TABLE_KEYS = ['id', 'coordinate', 'title', 'subtitle', 'labelVisible', 'labelAnchor', 'labelOffset', 'visibility', 'placements'];
const PLACEMENT_KEYS = ['id', 'stableAssetId', 'column', 'row', 'columnSpan', 'rowSpan', 'layer', 'navigationOrder', 'crop', 'frameId', 'mat', 'backing', 'transparencyMode', 'visibility', 'locked'];
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
    appearance: { surfaceId: 'carbon', menuSurfaceId: 'carbon', dossierSurfaceId: 'paper' },
    identityPresentation: createEmptyLatticeProductionIdentityPresentation(),
    tables: LATTICE_PRODUCTION_COORDINATES.map((coordinate) => ({
      id: latticeProductionTableId(coordinate),
      coordinate: { ...coordinate },
      title: '',
      subtitle: '',
      labelVisible: true,
      labelAnchor: 'top-left',
      labelOffset: { column: 0, row: 0 },
      visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC,
      placements: [],
    })),
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

function validateIdentity(value, fail) {
  if (!exactKeys(value, IDENTITY_KEYS)) return fail('identityPresentation', 'invalid_identity_structure', 'Identity presentation has an invalid structure');
  if (!text(value.alias, 80)) fail('identityPresentation.alias', 'invalid_alias', 'Alias must be safe text');
  if (!exactKeys(value.avatar, ['mode', 'stableAssetId', 'shape'])
    || !['official', 'inscape'].includes(value.avatar?.mode)
    || !['round', 'square'].includes(value.avatar?.shape)
    || !(value.avatar?.stableAssetId === null || parseCanonicalAssetId(value.avatar?.stableAssetId))) {
    fail('identityPresentation.avatar', 'invalid_avatar', 'Avatar presentation is invalid');
  }
  if (!exactKeys(value.bio, ['mode', 'customText'])
    || !['official', 'inscape', 'hidden'].includes(value.bio?.mode)
    || !text(value.bio?.customText, 480)) fail('identityPresentation.bio', 'invalid_bio', 'Bio presentation is invalid');
  if (!exactKeys(value.tags, ['includeOfficial', 'additional'])
    || typeof value.tags?.includeOfficial !== 'boolean' || !Array.isArray(value.tags?.additional)
    || value.tags.additional.length > 16 || value.tags.additional.some((tag) => !text(tag, 48, { empty: false }))) {
    fail('identityPresentation.tags', 'invalid_tags', 'Tags presentation is invalid');
  }
  if (!sets.surfaces.has(value.dossierSurface)) fail('identityPresentation.dossierSurface', 'invalid_dossier_surface', 'Unknown dossier surface');
  if (!exactKeys(value.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(value.visibility || {}).some((entry) => typeof entry !== 'boolean')) {
    fail('identityPresentation.visibility', 'invalid_identity_visibility', 'Identity visibility is invalid');
  }
}

function validatePlacement(value, path, fail) {
  if (!exactKeys(value, PLACEMENT_KEYS)) return fail(path, 'invalid_placement_structure', 'Placement has an invalid structure');
  if (!id(value.id)) fail(`${path}.id`, 'invalid_placement_id', 'Placement ID is invalid');
  if (!parseCanonicalAssetId(value.stableAssetId)) fail(`${path}.stableAssetId`, 'invalid_asset_id', 'A canonical stable asset ID is required');
  if (!safeInteger(value.column) || !safeInteger(value.row)
    || !safeInteger(value.columnSpan, 1) || !safeInteger(value.rowSpan, 1)
    || value.column + value.columnSpan > LATTICE_PRODUCTION_GEOMETRY.columns
    || value.row + value.rowSpan > LATTICE_PRODUCTION_GEOMETRY.rows) {
    fail(path, 'invalid_placement_geometry', 'Placement must use bounded integer grid cells');
  }
  if (!safeInteger(value.layer)) fail(`${path}.layer`, 'invalid_layer', 'Layer must be a non-negative integer');
  if (!safeInteger(value.navigationOrder)) fail(`${path}.navigationOrder`, 'invalid_navigation_order', 'Navigation order must be a non-negative integer');
  if (!validateCrop(value.crop)) fail(`${path}.crop`, 'invalid_crop', 'Crop is invalid');
  if (!sets.frames.has(value.frameId)) fail(`${path}.frameId`, 'invalid_frame', 'Unknown frame ID');
  if (!validateMat(value.mat)) fail(`${path}.mat`, 'invalid_mat', 'Mat is invalid');
  if (!validateBacking(value.backing)) fail(`${path}.backing`, 'invalid_backing', 'Backing is invalid');
  if (!sets.transparency.has(value.transparencyMode)) fail(`${path}.transparencyMode`, 'invalid_transparency', 'Unknown transparency mode');
  if (!sets.visibility.has(value.visibility)) fail(`${path}.visibility`, 'invalid_visibility', 'Unknown placement visibility');
  if (typeof value.locked !== 'boolean') fail(`${path}.locked`, 'invalid_lock', 'Locked must be boolean');
}

export function validateLatticeProductionDraft(input) {
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  if (!exactKeys(input, DRAFT_KEYS)) {
    fail('$', 'invalid_draft_structure', 'Production lattice draft has an invalid structure');
    return { valid: false, errors, value: null };
  }
  if (!normalizeProfileAddress(input.profileAddress) || input.profileAddress !== input.profileAddress.toLowerCase()) fail('profileAddress', 'invalid_profile_address', 'A canonical lowercase profile address is required');
  if (input.draftVersion !== LATTICE_PRODUCTION_DRAFT_VERSION) fail('draftVersion', 'unsupported_draft_version', 'Unsupported lattice draft version');
  if (!exactKeys(input.artboard, ['aspectWidth', 'aspectHeight'])
    || input.artboard.aspectWidth !== 16 || input.artboard.aspectHeight !== 9) fail('artboard', 'invalid_artboard', 'Artboard must be 16:9');
  if (!exactKeys(input.geometry, ['columns', 'rows'])
    || input.geometry.columns !== 32 || input.geometry.rows !== 18) fail('geometry', 'invalid_geometry', 'Geometry must be 32 by 18 cells');
  if (!exactKeys(input.appearance, ['surfaceId', 'menuSurfaceId', 'dossierSurfaceId'])
    || Object.values(input.appearance || {}).some((value) => !sets.surfaces.has(value))) fail('appearance', 'invalid_appearance', 'Appearance contains an unknown surface');
  validateIdentity(input.identityPresentation, fail);
  if (!Array.isArray(input.tables) || input.tables.length !== 9) {
    fail('tables', 'invalid_table_count', 'Exactly nine tables are required');
  } else {
    const coordinates = new Set();
    const placementIds = new Set();
    input.tables.forEach((table, tableIndex) => {
      const path = `tables[${tableIndex}]`;
      if (!exactKeys(table, TABLE_KEYS)) return fail(path, 'invalid_table_structure', 'Table has an invalid structure');
      const expectedCoordinate = LATTICE_PRODUCTION_COORDINATES[tableIndex];
      if (!exactKeys(table.coordinate, ['x', 'y'])
        || table.coordinate.x !== expectedCoordinate.x || table.coordinate.y !== expectedCoordinate.y) {
        fail(`${path}.coordinate`, 'invalid_table_order', 'Tables must use the permanent row-major coordinate order');
      }
      const coordinateKey = `${table.coordinate?.x}:${table.coordinate?.y}`;
      if (coordinates.has(coordinateKey)) fail(`${path}.coordinate`, 'duplicate_coordinate', 'Table coordinates must be unique');
      coordinates.add(coordinateKey);
      if (table.id !== latticeProductionTableId(table.coordinate)) fail(`${path}.id`, 'invalid_table_id', 'Table ID must match its permanent coordinate');
      if (!text(table.title, 80) || !text(table.subtitle, 160)) fail(path, 'invalid_table_text', 'Table title or subtitle is invalid');
      if (typeof table.labelVisible !== 'boolean') fail(`${path}.labelVisible`, 'invalid_label_visibility', 'Label visibility must be boolean');
      if (!sets.anchors.has(table.labelAnchor)) fail(`${path}.labelAnchor`, 'invalid_label_anchor', 'Unknown label anchor');
      if (!exactKeys(table.labelOffset, ['column', 'row'])
        || !Number.isSafeInteger(table.labelOffset.column) || Math.abs(table.labelOffset.column) > 2
        || !Number.isSafeInteger(table.labelOffset.row) || Math.abs(table.labelOffset.row) > 2) fail(`${path}.labelOffset`, 'invalid_label_offset', 'Label offset must be within two cells');
      if (!sets.visibility.has(table.visibility)) fail(`${path}.visibility`, 'invalid_table_visibility', 'Unknown table visibility');
      if (!Array.isArray(table.placements)) return fail(`${path}.placements`, 'invalid_placements', 'Placements must be an array');
      const layers = new Set();
      const navigationOrders = new Set();
      table.placements.forEach((placement, placementIndex) => {
        const placementPath = `${path}.placements[${placementIndex}]`;
        validatePlacement(placement, placementPath, fail);
        if (placementIds.has(placement?.id)) fail(`${placementPath}.id`, 'duplicate_placement_id', 'Placement IDs must be globally unique');
        placementIds.add(placement?.id);
        if (layers.has(placement?.layer)) fail(`${placementPath}.layer`, 'duplicate_layer', 'Layers must be unique within a table');
        layers.add(placement?.layer);
        if (navigationOrders.has(placement?.navigationOrder)) fail(`${placementPath}.navigationOrder`, 'duplicate_navigation_order', 'Navigation order must be unique within a table');
        navigationOrders.add(placement?.navigationOrder);
      });
    });
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(input) };
}

export function assertValidLatticeProductionDraft(input) {
  const result = validateLatticeProductionDraft(input);
  if (!result.valid) throw Object.assign(new TypeError(result.errors[0].message), { errors: result.errors });
  return result.value;
}
