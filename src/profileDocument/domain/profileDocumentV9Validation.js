import { validPlacementAnimation } from '../../systemWorkflow/domain/placementAnimation.js';
import { validModuleEdges } from '../../systemWorkflow/domain/moduleSurfaceAppearance.js';
import { normalizeProfileAddress } from '../../library/config.js';
import {
  SYSTEM_WORKFLOW_FRAME_IDS,
  SYSTEM_WORKFLOW_GRID_DENSITY,
  SYSTEM_WORKFLOW_GUIDE_MODES,
  SYSTEM_WORKFLOW_LABEL_ANCHORS,
  SYSTEM_WORKFLOW_LIMITS,
  SYSTEM_WORKFLOW_SURFACE_IDS,
  SYSTEM_WORKFLOW_TRANSPARENCY_MODES,
  SYSTEM_WORKFLOW_VISIBILITY,
  SYSTEM_WORKFLOW_WORLD_COVER_GRID_ID,
  SYSTEM_WORKFLOW_WORLD_COVER_SIZE,
  isValidSystemWorkflowPlacementGeometry,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import {
  INSCAPE_PROFILE_DOCUMENT_TYPE,
  INSCAPE_PROFILE_DOCUMENT_VERSION,
  PROFILE_DOCUMENT_NETWORK,
} from './constants.js';
import { isValidPublishedAssetUrl } from './publishedAssetUrl.js';
import { validateProfileDocumentV9Asset } from './profileDocumentV9Asset.js';
import { isValidIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import { isValidWorkbenchPresentation } from './workbenchPresentation.js';
import { DISPLAY_CONTENT_KEYS, MAX_DISPLAY_MODULES, PRIMARY_DISPLAY_ID, isDisplayFormat } from '../../systemWorkflow/domain/displayModules.js';
import { validMiniApps } from '../../miniApps/domain/miniApps.js';
import { validTextModules, assertArticle, ARTICLE_TYPE } from '../../text/domain/article.js';
import { DISPLAY_TEXT_KEYS, isTextPlacement, validDisplayText } from '../../systemWorkflow/domain/displayText.js';
import { validMobilePresentation, mobileReferenceCount } from '../../mobile/domain/mobilePresentation.js';
import { canUseMobileRenderer } from '../../mobile/domain/customPresentation.js';

const DOCUMENT_KEYS = [
  'documentType', 'version', 'documentId', 'revision', 'createdAt', 'exportedAt',
  'network', 'profile', 'artboard', 'geometry', 'appearance', 'identityPresentation',
  'grids', 'metadata',
];
const APPEARANCE_KEYS = ['surfaceId', 'menuSurfaceId', 'dossierSurfaceId', 'guideMode', 'guideSize', 'guideColor'];
const GRID_KEYS = ['id', 'title', 'subtitle', 'visibility', 'labelVisible', 'labelAnchor', 'labelOffset', 'placements'];
const PLACEMENT_KEYS = [
  'id', 'asset', 'column', 'row', 'columnSpan', 'rowSpan', 'layer', 'navigationOrder',
  'crop', 'frameId', 'mat', 'backing', 'transparencyMode', 'visibility', 'transform',
];
const IDENTITY_KEYS = ['alias', 'avatar', 'bio', 'tags', 'dossierSurface', 'visibility'];
const WORLD_COVER_KEYS = ['width', 'height', 'grid'];
const ID = /^[A-Za-z0-9:_-]+$/u;
const GRID_ID = /^grid:[A-Za-z0-9_-]+$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const record = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value, keys) => record(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const allowedKeys = (value, required, optional) => record(value)
  && required.every((key) => Object.hasOwn(value, key))
  && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
const safeText = (value, maximum, { empty = true } = {}) => typeof value === 'string'
  && (empty || value.length > 0)
  && value.length <= maximum
  && !/[\u0000-\u001f\u007f]/u.test(value);
const safeId = (value) => safeText(value, SYSTEM_WORKFLOW_LIMITS.maxIdLength, { empty: false }) && ID.test(value);
const safeInteger = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const validIsoTime = (value) => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
};
const sets = {
  anchors: new Set(SYSTEM_WORKFLOW_LABEL_ANCHORS),
  frames: new Set(SYSTEM_WORKFLOW_FRAME_IDS),
  guides: new Set(SYSTEM_WORKFLOW_GUIDE_MODES),
  surfaces: new Set(SYSTEM_WORKFLOW_SURFACE_IDS),
  transparency: new Set(SYSTEM_WORKFLOW_TRANSPARENCY_MODES),
};

function depth(value, current = 0) {
  if (!value || typeof value !== 'object') return current;
  // Articles enforce their own bounded rich-text depth/node/byte limits. Their
  // internal tree is not extra nesting in the surrounding document envelope.
  if (value.documentType === ARTICLE_TYPE) {
    try { assertArticle(value); return current; } catch { /* Report invalid trees through normal validation. */ }
  }
  if (current > SYSTEM_WORKFLOW_LIMITS.maxDepth) return current;
  return Object.values(value).reduce((maximum, child) => Math.max(maximum, depth(child, current + 1)), current);
}

function validCrop(value) {
  return value === null || exactKeys(value, ['x', 'y', 'zoom'])
    && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    && Number.isFinite(value.zoom) && value.zoom >= 1 && value.zoom <= 4;
}

function validateIdentity(value, fail) {
  if (!allowedKeys(value, IDENTITY_KEYS, ['card'])) return fail('identityPresentation', 'invalid_identity_structure', 'Invalid identity presentation');
  if (Object.hasOwn(value, 'card') && !isValidIdentityCard(value.card, { published: true })) fail('identityPresentation.card', 'invalid_identity_card', 'Invalid public Identity card');
  if (!safeText(value.alias, 80)) fail('identityPresentation.alias', 'invalid_alias', 'Invalid identity alias');
  if (!exactKeys(value.avatar, ['mode', 'asset', 'shape'])
    || !['official', 'inscape'].includes(value.avatar?.mode)
    || !['round', 'square'].includes(value.avatar?.shape)
    || !(value.avatar?.asset === null || validateProfileDocumentV9Asset(value.avatar.asset))
    || value.avatar?.mode !== 'inscape' && value.avatar?.asset !== null) {
    fail('identityPresentation.avatar', 'invalid_avatar', 'Invalid public avatar');
  }
  if (!exactKeys(value.bio, ['mode', 'customText'])
    || !['official', 'inscape', 'hidden'].includes(value.bio?.mode)
    || !safeText(value.bio?.customText, 480)
    || value.bio?.mode !== 'inscape' && value.bio?.customText !== '') {
    fail('identityPresentation.bio', 'invalid_bio', 'Invalid public bio');
  }
  if (!exactKeys(value.tags, ['includeOfficial', 'additional'])
    || typeof value.tags?.includeOfficial !== 'boolean'
    || !Array.isArray(value.tags?.additional)
    || value.tags.additional.length > 16
    || value.tags.additional.some((tag) => !safeText(tag, 48, { empty: false }))) {
    fail('identityPresentation.tags', 'invalid_tags', 'Invalid public tags');
  }
  if (!sets.surfaces.has(value.dossierSurface)) fail('identityPresentation.dossierSurface', 'invalid_dossier_surface', 'Invalid dossier surface');
  if (!exactKeys(value.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(value.visibility || {}).some((entry) => typeof entry !== 'boolean')) {
    fail('identityPresentation.visibility', 'invalid_identity_visibility', 'Invalid identity visibility');
  }
}

function validatePlacement(value, path, fail) {
  if (isTextPlacement(value)) {
    if (!exactKeys(value, DISPLAY_TEXT_KEYS) || !validDisplayText(value.text)) return fail(path, 'invalid_text_placement', 'Invalid public text layer');
    if (!safeId(value.id) || !isValidSystemWorkflowPlacementGeometry(value) || !safeInteger(value.layer) || !safeInteger(value.navigationOrder)
      || value.visibility !== 'PUBLIC' || !exactKeys(value.transform, ['quarterTurns', 'mirrorX', 'mirrorY'])
      || ![0, 1, 2, 3].includes(value.transform.quarterTurns) || typeof value.transform.mirrorX !== 'boolean' || typeof value.transform.mirrorY !== 'boolean') fail(path, 'invalid_text_geometry', 'Invalid public text geometry');
    return;
  }
  if (!exactKeys(value, [...PLACEMENT_KEYS, ...['inspectionMode', 'mediaFrameRatio', 'animation'].filter(key => Object.hasOwn(value || {}, key))])) return fail(path, 'invalid_placement_structure', 'Invalid public placement');
  if (Object.hasOwn(value, 'animation') && !validPlacementAnimation(value.animation)) fail(`${path}.animation`, 'invalid_animation', 'Invalid placement animation');
  if (Object.hasOwn(value, 'mediaFrameRatio') && (!Number.isFinite(value.mediaFrameRatio) || value.mediaFrameRatio < 1 / 512 || value.mediaFrameRatio > 512)) fail(`${path}.mediaFrameRatio`, 'invalid_media_frame_ratio', 'Invalid media frame ratio');
  if (Object.hasOwn(value, 'inspectionMode') && !['IN_PLACE', 'LIFT'].includes(value.inspectionMode)) fail(`${path}.inspectionMode`, 'invalid_inspection_mode', 'Invalid artwork inspection mode');
  if (!safeId(value.id)) fail(`${path}.id`, 'invalid_placement_id', 'Invalid placement ID');
  if (!validateProfileDocumentV9Asset(value.asset)) fail(`${path}.asset`, 'invalid_asset_reference', 'Invalid canonical asset reference');
  if (!isValidSystemWorkflowPlacementGeometry(value)) {
    fail(path, 'invalid_placement_geometry', 'Invalid placement geometry');
  }
  if (!safeInteger(value.layer)) fail(`${path}.layer`, 'invalid_layer', 'Invalid placement layer');
  if (!safeInteger(value.navigationOrder)) fail(`${path}.navigationOrder`, 'invalid_navigation_order', 'Invalid placement navigation order');
  if (!validCrop(value.crop)) fail(`${path}.crop`, 'invalid_crop', 'Invalid placement crop');
  if (!sets.frames.has(value.frameId)) fail(`${path}.frameId`, 'invalid_frame', 'Invalid placement frame');
  if (!exactKeys(value.mat, ['enabled', 'color', 'inset'])
    || typeof value.mat?.enabled !== 'boolean' || !HEX_COLOR.test(value.mat?.color || '')
    || !exactKeys(value.mat?.inset, ['top', 'right', 'bottom', 'left'])
    || Object.values(value.mat?.inset || {}).some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 0.45)
    || value.mat.inset.left + value.mat.inset.right >= 1
    || value.mat.inset.top + value.mat.inset.bottom >= 1) fail(`${path}.mat`, 'invalid_mat', 'Invalid placement mat');
  if (!exactKeys(value.backing, ['enabled', 'color'])
    || typeof value.backing?.enabled !== 'boolean'
    || !HEX_COLOR.test(value.backing?.color || '')) fail(`${path}.backing`, 'invalid_backing', 'Invalid placement backing');
  if (!sets.transparency.has(value.transparencyMode)) fail(`${path}.transparencyMode`, 'invalid_transparency', 'Invalid placement transparency');
  if (value.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) fail(`${path}.visibility`, 'private_placement', 'Only public placements are allowed');
  if (!exactKeys(value.transform, ['quarterTurns', 'mirrorX', 'mirrorY'])
    || !Number.isSafeInteger(value.transform?.quarterTurns)
    || value.transform.quarterTurns < 0 || value.transform.quarterTurns > 3
    || typeof value.transform?.mirrorX !== 'boolean'
    || typeof value.transform?.mirrorY !== 'boolean') fail(`${path}.transform`, 'invalid_transform', 'Invalid placement transform');
}

function validateWorldCover(value, fail) {
  if (!exactKeys(value, WORLD_COVER_KEYS)
    || value.width !== SYSTEM_WORKFLOW_WORLD_COVER_SIZE.width
    || value.height !== SYSTEM_WORKFLOW_WORLD_COVER_SIZE.height) {
    fail('metadata.worldCover', 'invalid_world_cover', 'World Cover must use the canonical 768 by 432 aperture');
    return 0;
  }
  const grid = value.grid;
  if (!exactKeys(grid, GRID_KEYS)
    || grid.id !== SYSTEM_WORKFLOW_WORLD_COVER_GRID_ID
    || grid.title !== 'WORLD COVER' || grid.subtitle !== ''
    || grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC
    || grid.labelVisible !== false || grid.labelAnchor !== 'top-left'
    || !exactKeys(grid.labelOffset, ['column', 'row'])
    || grid.labelOffset.column !== 0 || grid.labelOffset.row !== 0
    || !Array.isArray(grid.placements)
    || grid.placements.length > SYSTEM_WORKFLOW_LIMITS.maxPlacementsPerGrid) {
    fail('metadata.worldCover.grid', 'invalid_world_cover_grid', 'Invalid canonical World Cover Grid');
    return 0;
  }
  const ids = new Set();
  const layers = new Set();
  const navigationOrders = new Set();
  let previousNavigationOrder = -1;
  grid.placements.forEach((placement, index) => {
    const path = `metadata.worldCover.grid.placements[${index}]`;
    validatePlacement(placement, path, fail);
    if (ids.has(placement?.id)) fail(`${path}.id`, 'duplicate_placement_id', 'Duplicate World Cover placement ID');
    ids.add(placement?.id);
    if (layers.has(placement?.layer)) fail(`${path}.layer`, 'duplicate_layer', 'Duplicate World Cover layer');
    layers.add(placement?.layer);
    if (navigationOrders.has(placement?.navigationOrder)) fail(`${path}.navigationOrder`, 'duplicate_navigation_order', 'Duplicate World Cover navigation order');
    navigationOrders.add(placement?.navigationOrder);
    if (placement?.navigationOrder <= previousNavigationOrder) fail(`${path}.navigationOrder`, 'non_canonical_navigation_order', 'World Cover placements must be sorted by navigation order');
    previousNavigationOrder = placement?.navigationOrder;
  });
  return grid.placements.length;
}

export class ProfileDocumentV9ValidationError extends Error {
  constructor(errors) {
    super(errors[0]?.message || 'Invalid INSCAPE Profile Document');
    this.name = 'ProfileDocumentV9ValidationError';
    this.errors = errors;
  }
}

export function validateProfileDocumentV9(input, { rawSize } = {}) {
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  let measuredSize = rawSize;
  try { measuredSize ??= new TextEncoder().encode(JSON.stringify(input)).byteLength; } catch { measuredSize = Infinity; }
  if (measuredSize > SYSTEM_WORKFLOW_LIMITS.maxJsonBytes) fail('$', 'document_too_large', `Document exceeds ${SYSTEM_WORKFLOW_LIMITS.maxJsonBytes} bytes`);
  if (depth(input) > SYSTEM_WORKFLOW_LIMITS.maxDepth) fail('$', 'excessive_depth', 'Document nesting is too deep');
  if (!allowedKeys(input, DOCUMENT_KEYS, ['workbench', 'displays', 'mobile', 'miniApps', 'texts'])) {
    fail('$', 'unexpected_fields', 'Document contains unexpected or missing fields');
    return { valid: false, errors, value: null, size: measuredSize };
  }
  if (input.documentType !== INSCAPE_PROFILE_DOCUMENT_TYPE) fail('documentType', 'wrong_document_type', 'Not an INSCAPE profile document');
  if (input.version !== INSCAPE_PROFILE_DOCUMENT_VERSION) fail('version', 'unsupported_version', `Unsupported profile document version: ${String(input.version)}`);
  if (!safeId(input.documentId)) fail('documentId', 'invalid_id', 'Invalid document ID');
  if (!safeInteger(input.revision, 1)) fail('revision', 'invalid_revision', 'Revision must be a positive integer');
  if (!validIsoTime(input.createdAt) || !validIsoTime(input.exportedAt)
    || Date.parse(input.createdAt) > Date.parse(input.exportedAt)) fail('timestamps', 'invalid_timestamp', 'Invalid document timestamps');
  if (!exactKeys(input.network, ['name', 'chainId'])
    || input.network.name !== PROFILE_DOCUMENT_NETWORK.name
    || input.network.chainId !== PROFILE_DOCUMENT_NETWORK.chainId) fail('network', 'invalid_network', 'Only LUKSO mainnet (42) is supported');
  const address = normalizeProfileAddress(input.profile?.address);
  if (!exactKeys(input.profile, ['address', 'cachedIdentity']) || !address || input.profile.address !== address) {
    fail('profile', 'invalid_profile', 'Invalid Universal Profile authority');
  }
  const cached = input.profile?.cachedIdentity;
  if (!allowedKeys(cached, ['address'], ['name', 'avatarUrl'])
    || normalizeProfileAddress(cached?.address) !== address || cached?.address !== address
    || Object.hasOwn(cached || {}, 'name') && !safeText(cached.name, 80, { empty: false })
    || Object.hasOwn(cached || {}, 'avatarUrl') && !(safeText(cached.avatarUrl, SYSTEM_WORKFLOW_LIMITS.maxUrlLength, { empty: false }) && isValidPublishedAssetUrl(cached.avatarUrl))) {
    fail('profile.cachedIdentity', 'invalid_identity', 'Invalid cached public identity fallback');
  }
  if (!isDisplayFormat(input.artboard, input.geometry)) fail('artboard', 'invalid_artboard', 'Invalid Display format');
  if (!exactKeys(input.appearance, [...APPEARANCE_KEYS, ...['edges', 'frame'].filter(key => Object.hasOwn(input.appearance || {}, key))])
    || input.appearance?.edges !== undefined && !validModuleEdges(input.appearance.edges)
    || input.appearance?.frame !== undefined && typeof input.appearance.frame !== 'boolean'
    || !sets.surfaces.has(input.appearance.surfaceId)
    || !sets.surfaces.has(input.appearance.menuSurfaceId)
    || !sets.surfaces.has(input.appearance.dossierSurfaceId)
    || !sets.guides.has(input.appearance.guideMode)
    || !Number.isSafeInteger(input.appearance.guideSize)
    || input.appearance.guideSize < SYSTEM_WORKFLOW_GRID_DENSITY.minimum
    || input.appearance.guideSize > SYSTEM_WORKFLOW_GRID_DENSITY.maximum
    || !HEX_COLOR.test(input.appearance.guideColor || '')) fail('appearance', 'invalid_appearance', 'Invalid public appearance');
  validateIdentity(input.identityPresentation, fail);
  if (Object.hasOwn(input, 'miniApps') && !validMiniApps(input.miniApps, true)) fail('miniApps', 'invalid_mini_apps', 'Invalid published mini app');
  if (Object.hasOwn(input, 'texts') && !validTextModules(input.texts, true)) fail('texts', 'invalid_texts', 'Invalid published Text module');
  if (Array.isArray(input.workbench?.texts) && input.workbench.texts.some(item => !Array.isArray(input.texts) || !input.texts.some(text => text?.id === item?.id))) fail('workbench.texts', 'unknown_text', 'Window refers to an unavailable Text module');
  if (Array.isArray(input.workbench?.miniApps) && input.workbench.miniApps.some(item => !Array.isArray(input.miniApps)
    || !input.miniApps.some(app => app?.id === item?.id))) fail('workbench.miniApps', 'unknown_mini_app', 'Window refers to an unavailable mini app');
  if (Object.hasOwn(input, 'mobile') && (!validMobilePresentation(input.mobile, true) || !canUseMobileRenderer(input.mobile, input.profile?.address))) fail('mobile', 'invalid_mobile', 'Invalid published Mobile presentation');
  let moduleReferences = 0;
  if (Object.hasOwn(input, 'displays')) {
    if (!Array.isArray(input.displays) || input.displays.length > MAX_DISPLAY_MODULES - 1) {
      fail('displays', 'invalid_display_count', 'Invalid Display count');
    } else {
      const ids = new Set([PRIMARY_DISPLAY_ID]);
      const { displays: _displays, workbench: _workbench, mobile: _mobile, miniApps: _miniApps, texts: _texts, ...shared } = input;
      for (const module of input.displays) {
        if (!exactKeys(module, ['id', ...DISPLAY_CONTENT_KEYS]) || !/^display:[A-Za-z0-9_-]{1,80}$/u.test(module?.id) || ids.has(module.id)) {
          fail('displays', 'invalid_display', 'Invalid or duplicate Display'); continue;
        }
        ids.add(module.id);
        const { id, ...content } = module;
        if (!content.grids?.length) fail('displays', 'invalid_grid_count', 'An additional Display must contain Grids');
        const result = validateProfileDocumentV9({ ...shared, ...content, metadata: {} });
        result.errors.forEach(error => fail(`displays.${id}.${error.path}`, error.code, error.message));
        moduleReferences += (module.grids || []).reduce((sum, grid) => sum + (grid?.placements?.length || 0), 0);
      }
      if (input.workbench?.displays?.some(module => !ids.has(module.id))) fail('workbench.displays', 'unknown_display', 'Window refers to an unavailable Display');
    }
  } else if (input.workbench?.displays?.length) fail('workbench.displays', 'unknown_display', 'Window refers to an unavailable Display');
  if (Object.hasOwn(input, 'workbench') && !isValidWorkbenchPresentation(input.workbench)) fail('workbench', 'invalid_workbench', 'Invalid public Workbench configuration');
  if (!Array.isArray(input.grids) || input.grids.length > SYSTEM_WORKFLOW_LIMITS.maxGrids) {
    fail('grids', 'invalid_grid_count', 'One to 24 public Grids required');
  } else {
    const gridIds = new Set();
    const placementIds = new Set();
    let totalAssetReferences = input.identityPresentation?.avatar?.asset == null ? 0 : 1;
    if (input.workbench?.display?.shortcut?.icon) totalAssetReferences += 1;
    input.grids.forEach((grid, gridIndex) => {
      const path = `grids[${gridIndex}]`;
      if (!exactKeys(grid, GRID_KEYS)) return fail(path, 'invalid_grid_structure', 'Invalid public Grid');
      if (!GRID_ID.test(grid.id || '') || grid.id.length > SYSTEM_WORKFLOW_LIMITS.maxIdLength) fail(`${path}.id`, 'invalid_grid_id', 'Invalid Grid ID');
      if (gridIds.has(grid.id)) fail(`${path}.id`, 'duplicate_grid_id', 'Duplicate Grid ID');
      gridIds.add(grid.id);
      if (!safeText(grid.title, 80, { empty: false }) || !safeText(grid.subtitle, 160)) fail(path, 'invalid_grid_text', 'Invalid Grid text');
      if (grid.visibility !== SYSTEM_WORKFLOW_VISIBILITY.PUBLIC) fail(`${path}.visibility`, 'private_grid', 'Only public Grids are allowed');
      if (typeof grid.labelVisible !== 'boolean') fail(`${path}.labelVisible`, 'invalid_label_visibility', 'Invalid Grid label visibility');
      if (!sets.anchors.has(grid.labelAnchor)) fail(`${path}.labelAnchor`, 'invalid_label_anchor', 'Invalid Grid label anchor');
      if (!exactKeys(grid.labelOffset, ['column', 'row'])
        || !Number.isSafeInteger(grid.labelOffset.column) || Math.abs(grid.labelOffset.column) > 2
        || !Number.isSafeInteger(grid.labelOffset.row) || Math.abs(grid.labelOffset.row) > 2) fail(`${path}.labelOffset`, 'invalid_label_offset', 'Invalid Grid label offset');
      if (!Array.isArray(grid.placements) || grid.placements.length > SYSTEM_WORKFLOW_LIMITS.maxPlacementsPerGrid) {
        return fail(`${path}.placements`, 'invalid_placements', 'Invalid public placements');
      }
      totalAssetReferences += grid.placements.length;
      const layers = new Set();
      const navigationOrders = new Set();
      let previousNavigationOrder = -1;
      grid.placements.forEach((placement, placementIndex) => {
        const placementPath = `${path}.placements[${placementIndex}]`;
        validatePlacement(placement, placementPath, fail);
        if (placementIds.has(placement?.id)) fail(`${placementPath}.id`, 'duplicate_placement_id', 'Duplicate placement ID');
        placementIds.add(placement?.id);
        if (layers.has(placement?.layer)) fail(`${placementPath}.layer`, 'duplicate_layer', 'Duplicate placement layer');
        layers.add(placement?.layer);
        if (navigationOrders.has(placement?.navigationOrder)) fail(`${placementPath}.navigationOrder`, 'duplicate_navigation_order', 'Duplicate navigation order');
        navigationOrders.add(placement?.navigationOrder);
        if (placement?.navigationOrder <= previousNavigationOrder) fail(`${placementPath}.navigationOrder`, 'non_canonical_navigation_order', 'Placements must be sorted by navigation order');
        previousNavigationOrder = placement?.navigationOrder;
      });
    });
    if (totalAssetReferences > SYSTEM_WORKFLOW_LIMITS.maxTotalAssetReferences) fail('grids', 'too_many_asset_references', 'Too many total asset references');
  }
  let worldCoverAssetReferences = 0;
  if (exactKeys(input.metadata, [])) {
    // Older v9 publications without an authored World Cover remain valid.
  } else if (exactKeys(input.metadata, ['worldCover'])) {
    if (input.grids?.length === 0) fail('metadata.worldCover', 'invalid_world_cover', 'An absent Display cannot retain a World Cover');
    worldCoverAssetReferences = validateWorldCover(input.metadata.worldCover, fail);
  } else {
    fail('metadata', 'unexpected_fields', 'Profile metadata contains unsupported fields');
  }
  const documentAssetReferences = (input.grids || []).reduce((total, grid) => total + (grid?.placements?.length || 0), 0)
    + worldCoverAssetReferences + (input.identityPresentation?.avatar?.asset ? 1 : 0) + moduleReferences
    + (input.workbench?.display?.shortcut?.icon ? 1 : 0) + (input.workbench?.displays || []).filter(module => module.shortcut?.icon).length
    + mobileReferenceCount(input.mobile);
  if (documentAssetReferences > SYSTEM_WORKFLOW_LIMITS.maxTotalAssetReferences) {
    fail('metadata.worldCover', 'too_many_asset_references', 'Too many total asset references');
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(input), size: measuredSize };
}

export function assertValidProfileDocumentV9(input, options) {
  const result = validateProfileDocumentV9(input, options);
  if (!result.valid) throw new ProfileDocumentV9ValidationError(result.errors);
  return result.value;
}

export function parseProfileDocumentV9Json(raw) {
  if (typeof raw !== 'string') throw new ProfileDocumentV9ValidationError([{ path: '$', code: 'invalid_json', message: 'Imported document must be JSON text' }]);
  const size = new TextEncoder().encode(raw).byteLength;
  if (size > SYSTEM_WORKFLOW_LIMITS.maxJsonBytes) {
    throw new ProfileDocumentV9ValidationError([{ path: '$', code: 'document_too_large', message: `Document exceeds ${SYSTEM_WORKFLOW_LIMITS.maxJsonBytes} bytes` }]);
  }
  let input;
  try { input = JSON.parse(raw); } catch {
    throw new ProfileDocumentV9ValidationError([{ path: '$', code: 'invalid_json', message: 'Malformed JSON' }]);
  }
  return assertValidProfileDocumentV9(input, { rawSize: size });
}
