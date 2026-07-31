import { createCanonicalAssetId, normalizeTokenId } from '../../profileDocument/domain/assetReference.js';
import { isValidPublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import {
  LATTICE_PRODUCTION_ARTBOARD,
  LATTICE_PRODUCTION_COORDINATES,
  LATTICE_PRODUCTION_GEOMETRY,
  LATTICE_PRODUCTION_FRAME_IDS,
  LATTICE_PRODUCTION_LABEL_ANCHORS,
  LATTICE_PRODUCTION_SURFACE_IDS,
  LATTICE_PRODUCTION_TRANSPARENCY_MODES,
  LATTICE_PRODUCTION_VISIBILITY,
  latticeProductionTableId,
} from './latticeProductionDraft.js';

export const LATTICE_PRODUCTION_SCHEMA_VERSION = 2;

const PUBLICATION_KEYS = ['latticeVersion', 'artboard', 'geometry', 'appearance', 'identityPresentation', 'lastPublished', 'tables'];
const PUBLIC_TABLE_KEYS = ['id', 'coordinate', 'title', 'subtitle', 'labelVisible', 'labelAnchor', 'labelOffset', 'visibility', 'placements'];
const PRIVATE_TABLE_KEYS = ['id', 'coordinate', 'visibility'];
const PLACEMENT_KEYS = ['id', 'asset', 'column', 'row', 'columnSpan', 'rowSpan', 'layer', 'navigationOrder', 'crop', 'frameId', 'mat', 'backing', 'transparencyMode', 'visibility', 'transform'];
const LEGACY_PLACEMENT_KEYS = PLACEMENT_KEYS.filter((key) => key !== 'transform');
const ASSET_KEYS = ['stableAssetId', 'network', 'chainId', 'tokenStandard', 'contractAddress', 'tokenId', 'name', 'description', 'collectionName', 'media', 'creators', 'attributes'];
const record = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const safeText = (value, maximum, nullable = false) => nullable && value === null || typeof value === 'string' && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
const validTime = (value) => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
};
const surfaceIds = new Set(LATTICE_PRODUCTION_SURFACE_IDS);
const anchors = new Set(LATTICE_PRODUCTION_LABEL_ANCHORS);
const frameIds = new Set(LATTICE_PRODUCTION_FRAME_IDS);
const transparencyModes = new Set(LATTICE_PRODUCTION_TRANSPARENCY_MODES);
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

export function migrateLatticeProductionPublication(input) {
  if (!record(input) || input.latticeVersion !== 1 || !Array.isArray(input.tables)) return input;
  const publication = structuredClone(input);
  publication.latticeVersion = LATTICE_PRODUCTION_SCHEMA_VERSION;
  publication.tables.forEach((table) => {
    if (!Array.isArray(table?.placements)) return;
    table.placements.forEach((placement) => {
      if (exactKeys(placement, LEGACY_PLACEMENT_KEYS)) {
        placement.transform = { quarterTurns: 0, mirrorX: false, mirrorY: false };
      }
    });
  });
  return publication;
}

const validCrop = (value) => value === null || exactKeys(value, ['x', 'y', 'zoom'])
  && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
  && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
  && Number.isFinite(value.zoom) && value.zoom >= 1 && value.zoom <= 4;
const validMat = (value) => exactKeys(value, ['enabled', 'color', 'inset'])
  && typeof value.enabled === 'boolean' && HEX_COLOR.test(value.color)
  && exactKeys(value.inset, ['top', 'right', 'bottom', 'left'])
  && Object.values(value.inset).every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= 0.45)
  && value.inset.left + value.inset.right < 1 && value.inset.top + value.inset.bottom < 1;
const validBacking = (value) => exactKeys(value, ['enabled', 'color'])
  && typeof value.enabled === 'boolean' && HEX_COLOR.test(value.color);
const validTransform = (value) => exactKeys(value, ['quarterTurns', 'mirrorX', 'mirrorY'])
  && Number.isSafeInteger(value.quarterTurns) && value.quarterTurns >= 0 && value.quarterTurns <= 3
  && typeof value.mirrorX === 'boolean' && typeof value.mirrorY === 'boolean';

export function validateLatticeProductionPublicAssetReference(asset) {
  if (!exactKeys(asset, ASSET_KEYS)) return false;
  const tokenId = asset.tokenId === null ? null : normalizeTokenId(asset.tokenId);
  const stableAssetId = createCanonicalAssetId({ chainId: asset.chainId, contractAddress: asset.contractAddress, tokenId });
  if (!stableAssetId || stableAssetId !== asset.stableAssetId || asset.chainId !== 42 || asset.network !== 'lukso-mainnet'
    || !['LSP7', 'LSP8', 'UNKNOWN'].includes(asset.tokenStandard)
    || asset.tokenStandard === 'LSP8' && !tokenId || asset.tokenStandard === 'LSP7' && tokenId) return false;
  if (!safeText(asset.name, 80) || !safeText(asset.description, 2000) || !safeText(asset.collectionName, 80, true)) return false;
  if (!exactKeys(asset.media, ['url', 'width', 'height', 'type']) || !isValidPublishedAssetUrl(asset.media.url)
    || !(asset.media.width === null || Number.isSafeInteger(asset.media.width) && asset.media.width > 0)
    || !(asset.media.height === null || Number.isSafeInteger(asset.media.height) && asset.media.height > 0)
    || !['image', 'animation', 'unknown'].includes(asset.media.type)) return false;
  if (!Array.isArray(asset.creators) || asset.creators.length > 32 || asset.creators.some((creator) => !exactKeys(creator, ['address', 'name'])
    || !/^0x[0-9a-f]{40}$/u.test(creator.address) || !safeText(creator.name, 80, true))) return false;
  return Array.isArray(asset.attributes) && asset.attributes.length <= 128 && asset.attributes.every((attribute) => exactKeys(attribute, ['key', 'value', 'type'])
    && safeText(attribute.key, 80) && safeText(attribute.value, 400) && safeText(attribute.type, 40, true));
}

export function validateLatticeProductionPublication(input) {
  input = migrateLatticeProductionPublication(input);
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  if (!exactKeys(input, PUBLICATION_KEYS)) {
    fail('$', 'invalid_publication_structure', 'Published lattice has an invalid structure');
    return { valid: false, errors, value: null };
  }
  if (input.latticeVersion !== LATTICE_PRODUCTION_SCHEMA_VERSION) fail('latticeVersion', 'unsupported_lattice_version', 'Unsupported published lattice schema version');
  if (!exactKeys(input.artboard, ['aspectWidth', 'aspectHeight']) || input.artboard.aspectWidth !== LATTICE_PRODUCTION_ARTBOARD.aspectWidth || input.artboard.aspectHeight !== LATTICE_PRODUCTION_ARTBOARD.aspectHeight) fail('artboard', 'invalid_artboard', 'Published artboard must be 16:9');
  if (!exactKeys(input.geometry, ['columns', 'rows']) || input.geometry.columns !== LATTICE_PRODUCTION_GEOMETRY.columns || input.geometry.rows !== LATTICE_PRODUCTION_GEOMETRY.rows) fail('geometry', 'invalid_geometry', 'Published geometry must be 32 by 18');
  if (!exactKeys(input.appearance, ['surfaceId', 'menuSurfaceId', 'dossierSurfaceId']) || Object.values(input.appearance || {}).some((value) => !surfaceIds.has(value))) fail('appearance', 'invalid_appearance', 'Published appearance is invalid');
  const identity = input.identityPresentation;
  if (!exactKeys(identity, ['alias', 'avatar', 'bio', 'tags', 'dossierSurface', 'visibility'])
    || !safeText(identity?.alias, 80) || !exactKeys(identity?.avatar, ['mode', 'asset', 'shape'])
    || !['official', 'inscape'].includes(identity?.avatar?.mode) || !['round', 'square'].includes(identity?.avatar?.shape)
    || !(identity?.avatar?.asset === null || validateLatticeProductionPublicAssetReference(identity.avatar.asset))
    || identity?.avatar?.mode !== 'inscape' && identity?.avatar?.asset !== null
    || !exactKeys(identity?.bio, ['mode', 'customText']) || !['official', 'inscape', 'hidden'].includes(identity?.bio?.mode)
    || !safeText(identity?.bio?.customText, 480) || identity?.bio?.mode !== 'inscape' && identity?.bio?.customText !== ''
    || !exactKeys(identity?.tags, ['includeOfficial', 'additional']) || typeof identity?.tags?.includeOfficial !== 'boolean'
    || !Array.isArray(identity?.tags?.additional) || identity.tags.additional.length > 16 || identity.tags.additional.some((tag) => !safeText(tag, 48))
    || !surfaceIds.has(identity?.dossierSurface) || !exactKeys(identity?.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(identity?.visibility || {}).some((value) => typeof value !== 'boolean')) fail('identityPresentation', 'invalid_identity', 'Published identity presentation is invalid');
  if (!validTime(input.lastPublished)) fail('lastPublished', 'invalid_last_published', 'Last Published must be a document timestamp');
  if (!Array.isArray(input.tables) || input.tables.length !== 9) fail('tables', 'invalid_table_count', 'Published lattice must preserve all nine slots');
  else {
    const globalPlacementIds = new Set();
    input.tables.forEach((table, tableIndex) => {
    const path = `tables[${tableIndex}]`;
    const coordinate = LATTICE_PRODUCTION_COORDINATES[tableIndex];
    if (!exactKeys(table?.coordinate, ['x', 'y']) || table.coordinate.x !== coordinate.x || table.coordinate.y !== coordinate.y || table.id !== latticeProductionTableId(coordinate)) fail(path, 'invalid_table_slot', 'Published tables must preserve permanent row-major slots');
    if (table?.visibility === LATTICE_PRODUCTION_VISIBILITY.PRIVATE) {
      if (!exactKeys(table, PRIVATE_TABLE_KEYS)) fail(path, 'private_table_leak', 'Private table contains authored data');
      return;
    }
    if (!exactKeys(table, PUBLIC_TABLE_KEYS) || table.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC) return fail(path, 'invalid_public_table', 'Public table has an invalid structure');
    if (!safeText(table.title, 80) || !safeText(table.subtitle, 160) || typeof table.labelVisible !== 'boolean' || !anchors.has(table.labelAnchor)
      || !exactKeys(table.labelOffset, ['column', 'row']) || !Number.isSafeInteger(table.labelOffset.column) || Math.abs(table.labelOffset.column) > 2 || !Number.isSafeInteger(table.labelOffset.row) || Math.abs(table.labelOffset.row) > 2) fail(path, 'invalid_table_presentation', 'Public table presentation is invalid');
    if (!Array.isArray(table.placements)) return fail(`${path}.placements`, 'invalid_placements', 'Public placements must be an array');
    let previousOrder = -1;
    const layers = new Set();
    table.placements.forEach((placement, placementIndex) => {
      const placementPath = `${path}.placements[${placementIndex}]`;
      if (!exactKeys(placement, PLACEMENT_KEYS) || placement.visibility !== LATTICE_PRODUCTION_VISIBILITY.PUBLIC
        || !validateLatticeProductionPublicAssetReference(placement.asset)
        || typeof placement.id !== 'string' || !/^[A-Za-z0-9:_-]+$/u.test(placement.id)
        || !Number.isSafeInteger(placement.column) || placement.column < 0 || !Number.isSafeInteger(placement.row) || placement.row < 0
        || !Number.isSafeInteger(placement.columnSpan) || placement.columnSpan < 1 || !Number.isSafeInteger(placement.rowSpan) || placement.rowSpan < 1
        || placement.column + placement.columnSpan > 32 || placement.row + placement.rowSpan > 18
        || !Number.isSafeInteger(placement.layer) || placement.layer < 0 || !Number.isSafeInteger(placement.navigationOrder) || placement.navigationOrder < 0
        || !validCrop(placement.crop) || !frameIds.has(placement.frameId) || !validMat(placement.mat)
        || !validBacking(placement.backing) || !transparencyModes.has(placement.transparencyMode)
        || !validTransform(placement.transform)) fail(placementPath, 'invalid_public_placement', 'Published placement is invalid');
      if (globalPlacementIds.has(placement.id)) fail(`${placementPath}.id`, 'duplicate_placement_id', 'Published placement IDs must be globally unique');
      globalPlacementIds.add(placement.id);
      if (layers.has(placement.layer)) fail(`${placementPath}.layer`, 'duplicate_layer', 'Published layers must be unique within a table');
      layers.add(placement.layer);
      if (placement.navigationOrder <= previousOrder) fail(`${placementPath}.navigationOrder`, 'non_deterministic_order', 'Published placements must be sorted by navigation order');
      previousOrder = placement.navigationOrder;
    });
    });
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(input) };
}

export function assertValidLatticeProductionPublication(input) {
  const result = validateLatticeProductionPublication(input);
  if (!result.valid) throw Object.assign(new TypeError(result.errors[0].message), { errors: result.errors });
  return result.value;
}
