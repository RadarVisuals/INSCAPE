import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';

export const LATTICE_CONTRACT_VERSION = 1;
export const LATTICE_ENTRY_COORDINATE = Object.freeze({ x: 0, y: 0 });
export const CANONICAL_LATTICE_ARTBOARD = Object.freeze({ aspectWidth: 16, aspectHeight: 9 });
export const MAX_TABLE_LABEL_OFFSET_CELLS = 2;
export const LATTICE_COORDINATES = Object.freeze(
  [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => Object.freeze({ x, y })))
);
export const TABLE_LABEL_ANCHORS = Object.freeze([
  'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
]);
export const TABLE_VISIBILITY = Object.freeze({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' });
export const FRAME_IDS = Object.freeze({ NONE: 'NONE', DOSSIER: 'DOSSIER', CAPTION: 'CAPTION' });
export const TRANSPARENCY_MODES = Object.freeze({
  AUTO: 'AUTO', PRESERVE_ALPHA: 'PRESERVE_ALPHA', OPAQUE: 'OPAQUE'
});

const PROFILE_KEYS = ['contractVersion', 'profileAddress', 'artboard', 'geometry', 'identityPresentation', 'tables'];
const TABLE_KEYS = ['id', 'coordinate', 'title', 'subtitle', 'labelVisible', 'labelAnchor', 'labelOffset', 'visibility', 'placements'];
const PLACEMENT_KEYS = ['id', 'stableAssetId', 'x', 'y', 'width', 'height', 'layer', 'navigationOrder', 'crop', 'frameId', 'transparencyMode', 'visitorVisible'];
const IDENTITY_KEYS = ['alias', 'avatar', 'bio', 'tags', 'dossierSurface', 'visibility'];
const PROFILE_ADDRESS = /^0x[0-9a-f]{40}$/iu;
const FRAME_ID_VALUES = new Set(Object.values(FRAME_IDS));
const TRANSPARENCY_MODE_VALUES = new Set(Object.values(TRANSPARENCY_MODES));
const TABLE_VISIBILITY_VALUES = new Set(Object.values(TABLE_VISIBILITY));
const LABEL_ANCHOR_VALUES = new Set(TABLE_LABEL_ANCHORS);

const exactKeys = (value, keys) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key)));
const integer = (value) => Number.isSafeInteger(value);
const nonNegativeInteger = (value) => integer(value) && value >= 0;
const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;

export const latticeCoordinateKey = (coordinate) => `${coordinate?.x}:${coordinate?.y}`;

export function latticeTableId(coordinate) {
  const index = LATTICE_COORDINATES.findIndex(
    (candidate) => candidate.x === coordinate?.x && candidate.y === coordinate?.y
  );
  return index < 0 ? null : `table-${String(index + 1).padStart(2, '0')}`;
}

export function latticeTableFallbackTitle(coordinate) {
  const id = latticeTableId(coordinate);
  return id ? `TABLE ${id.slice(-2)}` : '';
}

export function tableDisplayTitle(table) {
  if (table?.visibility === TABLE_VISIBILITY.PRIVATE) return '';
  const authoredTitle = typeof table?.title === 'string' ? table.title.trim() : '';
  return authoredTitle || latticeTableFallbackTitle(table?.coordinate);
}

export function createEmptyIdentityPresentation() {
  return {
    alias: '',
    avatar: { mode: 'official', assetReference: null, shape: 'round' },
    bio: { mode: 'official', customText: '' },
    tags: { includeOfficial: true, additional: [] },
    dossierSurface: 'paper',
    visibility: { links: true, network: true, counts: true, publicationDate: true }
  };
}

export function createEmptyLatticeProfile({ profileAddress, columns, rows }) {
  return {
    contractVersion: LATTICE_CONTRACT_VERSION,
    profileAddress: String(profileAddress || '').toLowerCase(),
    artboard: { ...CANONICAL_LATTICE_ARTBOARD },
    geometry: { columns, rows },
    identityPresentation: createEmptyIdentityPresentation(),
    tables: LATTICE_COORDINATES.map((coordinate) => ({
      id: latticeTableId(coordinate), coordinate: { ...coordinate }, title: '', subtitle: '',
      labelVisible: true, labelAnchor: 'top-left', labelOffset: { column: 0, row: 0 },
      visibility: TABLE_VISIBILITY.PUBLIC, placements: []
    }))
  };
}

function validateIdentityPresentation(value, fail) {
  if (!exactKeys(value, IDENTITY_KEYS)) {
    fail('identityPresentation', 'invalid_identity_presentation', 'Identity presentation has an invalid structure');
    return;
  }
  if (typeof value.alias !== 'string') fail('identityPresentation.alias', 'invalid_alias', 'Alias must be text');
  if (!exactKeys(value.avatar, ['mode', 'assetReference', 'shape'])
    || !['official', 'inscape'].includes(value.avatar?.mode)
    || !['round', 'square'].includes(value.avatar?.shape)
    || !(value.avatar?.assetReference === null || nonEmptyString(value.avatar?.assetReference))) {
    fail('identityPresentation.avatar', 'invalid_avatar_presentation', 'Avatar presentation is invalid');
  }
  if (!exactKeys(value.bio, ['mode', 'customText'])
    || !['official', 'inscape', 'hidden'].includes(value.bio?.mode)
    || typeof value.bio?.customText !== 'string') {
    fail('identityPresentation.bio', 'invalid_bio_presentation', 'Bio presentation is invalid');
  }
  if (!exactKeys(value.tags, ['includeOfficial', 'additional'])
    || typeof value.tags?.includeOfficial !== 'boolean'
    || !Array.isArray(value.tags?.additional)
    || value.tags.additional.some((tag) => typeof tag !== 'string')) {
    fail('identityPresentation.tags', 'invalid_tag_presentation', 'Tag presentation is invalid');
  }
  if (typeof value.dossierSurface !== 'string' || !value.dossierSurface) {
    fail('identityPresentation.dossierSurface', 'invalid_dossier_surface', 'Dossier surface must be a semantic ID');
  }
  if (!exactKeys(value.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(value.visibility || {}).some((setting) => typeof setting !== 'boolean')) {
    fail('identityPresentation.visibility', 'invalid_identity_visibility', 'Identity visibility is invalid');
  }
}

function validatePlacement(placement, tableIndex, placementIndex, fail) {
  const path = `tables[${tableIndex}].placements[${placementIndex}]`;
  if (!exactKeys(placement, PLACEMENT_KEYS)) {
    fail(path, 'invalid_placement_structure', 'Placement has an invalid structure');
    return;
  }
  if (!nonEmptyString(placement.id)) fail(`${path}.id`, 'invalid_placement_id', 'Placement ID is required');
  if (!parseCanonicalAssetId(placement.stableAssetId)) fail(`${path}.stableAssetId`, 'invalid_asset_reference', 'A canonical stable asset ID is required');
  if (!Number.isFinite(placement.x) || placement.x < 0 || placement.x > 1
    || !Number.isFinite(placement.y) || placement.y < 0 || placement.y > 1
    || !Number.isFinite(placement.width) || placement.width <= 0 || placement.width > 1
    || !Number.isFinite(placement.height) || placement.height <= 0 || placement.height > 1
    || placement.x + placement.width > 1
    || placement.y + placement.height > 1) {
    fail(path, 'invalid_placement_geometry', 'Placement bounds must fit within the canonical artboard');
  }
  if (!nonNegativeInteger(placement.layer)) fail(`${path}.layer`, 'invalid_layer', 'Layer must be a non-negative integer');
  if (!nonNegativeInteger(placement.navigationOrder)) fail(`${path}.navigationOrder`, 'invalid_navigation_order', 'Navigation order must be a non-negative integer');
  if (!(placement.crop === null || exactKeys(placement.crop, ['x', 'y', 'zoom'])
    && Number.isFinite(placement.crop.x) && placement.crop.x >= 0 && placement.crop.x <= 1
    && Number.isFinite(placement.crop.y) && placement.crop.y >= 0 && placement.crop.y <= 1
    && Number.isFinite(placement.crop.zoom) && placement.crop.zoom >= 1 && placement.crop.zoom <= 4)) {
    fail(`${path}.crop`, 'invalid_crop', 'Crop must be null or a numeric crop record');
  }
  if (!FRAME_ID_VALUES.has(placement.frameId)) fail(`${path}.frameId`, 'unknown_frame', 'Unknown frame ID');
  if (!TRANSPARENCY_MODE_VALUES.has(placement.transparencyMode)) fail(`${path}.transparencyMode`, 'unknown_transparency_mode', 'Unknown transparency mode');
  if (typeof placement.visitorVisible !== 'boolean') fail(`${path}.visitorVisible`, 'invalid_visitor_visibility', 'Visitor visibility must be boolean');
}

export function validateLatticeProfile(input) {
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  if (!exactKeys(input, PROFILE_KEYS)) {
    fail('$', 'invalid_profile_structure', 'Lattice profile has an invalid structure');
    return { valid: false, errors, value: null };
  }
  if (input.contractVersion !== LATTICE_CONTRACT_VERSION) fail('contractVersion', 'unsupported_contract_version', 'Unsupported lattice contract version');
  if (!PROFILE_ADDRESS.test(input.profileAddress)) fail('profileAddress', 'invalid_profile_address', 'A canonical Universal Profile address is required');
  if (!exactKeys(input.artboard, ['aspectWidth', 'aspectHeight'])
    || input.artboard.aspectWidth !== CANONICAL_LATTICE_ARTBOARD.aspectWidth
    || input.artboard.aspectHeight !== CANONICAL_LATTICE_ARTBOARD.aspectHeight) {
    fail('artboard', 'invalid_artboard', 'The lattice artboard must use the canonical 16:9 aspect ratio');
  }
  const geometryValid = exactKeys(input.geometry, ['columns', 'rows'])
    && integer(input.geometry.columns) && input.geometry.columns >= 1
    && integer(input.geometry.rows) && input.geometry.rows >= 1;
  if (!geometryValid) fail('geometry', 'invalid_geometry', 'Configurable table geometry requires positive integer columns and rows');
  validateIdentityPresentation(input.identityPresentation, fail);
  if (!Array.isArray(input.tables) || input.tables.length !== LATTICE_COORDINATES.length) {
    fail('tables', 'invalid_table_count', 'All nine lattice tables must exist');
  } else {
    const seenCoordinates = new Set();
    const seenPlacementIds = new Set();
    input.tables.forEach((table, tableIndex) => {
      const path = `tables[${tableIndex}]`;
      if (!exactKeys(table, TABLE_KEYS)) {
        fail(path, 'invalid_table_structure', 'Table has an invalid structure');
        return;
      }
      const coordinateKey = latticeCoordinateKey(table.coordinate);
      const expectedId = latticeTableId(table.coordinate);
      if (!expectedId || seenCoordinates.has(coordinateKey)) fail(`${path}.coordinate`, 'invalid_or_duplicate_coordinate', 'Table coordinate must be one unique lattice slot');
      else seenCoordinates.add(coordinateKey);
      if (table.id !== expectedId) fail(`${path}.id`, 'invalid_table_id', 'Table ID must match its permanent coordinate slot');
      if (typeof table.title !== 'string' || typeof table.subtitle !== 'string') fail(path, 'invalid_table_text', 'Table title and subtitle must be text');
      if (typeof table.labelVisible !== 'boolean') fail(`${path}.labelVisible`, 'invalid_label_visibility', 'Label visibility must be boolean');
      if (!LABEL_ANCHOR_VALUES.has(table.labelAnchor)) fail(`${path}.labelAnchor`, 'unknown_label_anchor', 'Unknown table label anchor');
      const maximumColumnOffset = geometryValid
        ? Math.min(MAX_TABLE_LABEL_OFFSET_CELLS, input.geometry.columns - 1)
        : MAX_TABLE_LABEL_OFFSET_CELLS;
      const maximumRowOffset = geometryValid
        ? Math.min(MAX_TABLE_LABEL_OFFSET_CELLS, input.geometry.rows - 1)
        : MAX_TABLE_LABEL_OFFSET_CELLS;
      if (!exactKeys(table.labelOffset, ['column', 'row'])
        || !integer(table.labelOffset?.column) || Math.abs(table.labelOffset.column) > maximumColumnOffset
        || !integer(table.labelOffset?.row) || Math.abs(table.labelOffset.row) > maximumRowOffset) {
        fail(`${path}.labelOffset`, 'invalid_label_offset', 'Label offset exceeds the semantic or configured geometry bound');
      }
      if (!TABLE_VISIBILITY_VALUES.has(table.visibility)) fail(`${path}.visibility`, 'invalid_table_visibility', 'Unknown table visibility');
      if (!Array.isArray(table.placements)) {
        fail(`${path}.placements`, 'invalid_placements', 'Table placements must be an array');
        return;
      }
      const navigationOrders = new Set();
      table.placements.forEach((placement, placementIndex) => {
        validatePlacement(placement, tableIndex, placementIndex, fail);
        if (nonEmptyString(placement?.id)) {
          if (seenPlacementIds.has(placement.id)) fail(`${path}.placements[${placementIndex}].id`, 'duplicate_placement_id', 'Placement IDs must be globally unique');
          seenPlacementIds.add(placement.id);
        }
        if (nonNegativeInteger(placement?.navigationOrder)) {
          if (navigationOrders.has(placement.navigationOrder)) fail(`${path}.placements[${placementIndex}].navigationOrder`, 'duplicate_navigation_order', 'Navigation order must be explicit and unique within a table');
          navigationOrders.add(placement.navigationOrder);
        }
      });
    });
    if (seenCoordinates.size !== LATTICE_COORDINATES.length) fail('tables', 'incomplete_topology', 'Every coordinate in the 3 x 3 topology must exist exactly once');
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(input) };
}

export function assertValidLatticeProfile(input) {
  const result = validateLatticeProfile(input);
  if (!result.valid) throw Object.assign(new TypeError(result.errors[0].message), { errors: result.errors });
  return result.value;
}

export function orderedTablePlacements(table, { publicOnly = false } = {}) {
  return [...(Array.isArray(table?.placements) ? table.placements : [])]
    .filter((placement) => !publicOnly || placement.visitorVisible === true)
    .sort((first, second) => first.navigationOrder - second.navigationOrder || first.id.localeCompare(second.id));
}

export function stackedTablePlacements(table, { publicOnly = false } = {}) {
  return [...(Array.isArray(table?.placements) ? table.placements : [])]
    .filter((placement) => !publicOnly || placement.visitorVisible === true)
    .sort((first, second) => first.layer - second.layer || first.id.localeCompare(second.id));
}

export function projectPublicIdentityPresentation(identityPresentation) {
  const identity = structuredClone(identityPresentation);
  if (identity.avatar.mode !== 'inscape') identity.avatar.assetReference = null;
  if (identity.bio.mode !== 'inscape') identity.bio.customText = '';
  return identity;
}

export function projectPublicLatticeProfile(input) {
  const profile = assertValidLatticeProfile(input);
  return {
    ...profile,
    identityPresentation: projectPublicIdentityPresentation(profile.identityPresentation),
    tables: profile.tables.map((table) => table.visibility === TABLE_VISIBILITY.PUBLIC
      ? { ...table, placements: orderedTablePlacements(table, { publicOnly: true }) }
      : {
          id: table.id, coordinate: { ...table.coordinate }, title: '', subtitle: '',
          labelVisible: false, labelAnchor: 'top-left', labelOffset: { column: 0, row: 0 },
          visibility: TABLE_VISIBILITY.PRIVATE, placements: []
        })
  };
}
