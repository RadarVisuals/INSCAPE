import { isRecord as record, hasExactKeys as exactKeys } from '../../recordValidation.js';
import { retiredInterfaceKeys, stripRetiredInterfaceAppearance } from './retiredInterfaceAppearance.js';
import { validReception, receptionReferenceCount } from '../../profileDocument/domain/receptionPresentation.js';
import { validWorkbenchIndex } from './workbenchIndex.js';
import { validArtworkLayers } from './artworkLayers.js';
import { validWorkbenchGroups } from './workbenchGroups.js';
import { DISPLAY_CANVAS_APPEARANCE_KEYS, validDisplayCanvasAppearance } from './displayAppearance.js';
import { validModuleEdges } from './moduleSurfaceAppearance.js';
import { normalizeProfileAddress } from '../../library/config.js';
import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { PROFILE_DOCUMENT_LIMITS } from '../../profileDocument/domain/constants.js';
import { isValidPlacementMedia } from './placementMedia.js';
import { isValidIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import { isValidWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { isDisplayFormat } from './displayModules.js';
import { validImageModules, imageReferenceCount } from '../../imageModule/imageModule.js';
import { validTextModules } from '../../text/domain/article.js';
import { validShapes } from '../../shapes/shapes.js';
import { validKeeperDocks, keeperReferenceCount } from '../../keeper/keeper.js';
import { SYSTEM_WORKFLOW_GRID_PRECISION, isSystemWorkflowGridCoordinate } from './gridCoordinates.js';
export { SYSTEM_WORKFLOW_GRID_PRECISION, isSystemWorkflowGridCoordinate, quantizeSystemWorkflowGridCoordinate } from './gridCoordinates.js';

export const SYSTEM_WORKFLOW_DRAFT_VERSION = 4;
export const SYSTEM_WORKFLOW_ARTBOARD = Object.freeze({ aspectWidth: 16, aspectHeight: 9 });
export const SYSTEM_WORKFLOW_GEOMETRY = Object.freeze({ columns: 32, rows: 18 });
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
export const SYSTEM_WORKFLOW_LIMITS = Object.freeze({
  ...PROFILE_DOCUMENT_LIMITS,
});

const DRAFT_KEYS = ['profileAddress', 'draftVersion', 'artboard', 'geometry', 'appearance', 'identityPresentation'];
const APPEARANCE_KEYS = ['surfaceId', 'guideMode', 'guideSize', 'guideColor'];
const IDENTITY_KEYS = ['alias', 'avatar', 'bio', 'tags', 'visibility'];
const GRID_ID = /^grid:[A-Za-z0-9_-]+$/u;
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;
const textEncoder = new TextEncoder();

export function systemWorkflowSnapStep(density) {
  if (!Number.isSafeInteger(density)
    || density < SYSTEM_WORKFLOW_GRID_DENSITY.minimum || density > SYSTEM_WORKFLOW_GRID_DENSITY.maximum) {
    throw operationError('SYSTEM_WORKFLOW_GRID_DENSITY_INVALID', 'Grid density must be an integer from -8 through 8');
  }
  return density < 0
    ? (SYSTEM_WORKFLOW_GRID_PRECISION + density) / SYSTEM_WORKFLOW_GRID_PRECISION
    : density + 1;
}
export const systemWorkflowPlacementSnapStep = appearance => appearance.snapToGrid === false
  ? 1 / SYSTEM_WORKFLOW_GRID_PRECISION : systemWorkflowSnapStep(appearance.guideSize);
const safeText = (value, maximum, { empty = true } = {}) => typeof value === 'string'
  && (empty || value.length > 0)
  && value.length <= maximum
  && !/[\u0000-\u001f\u007f]/u.test(value);

const sets = {
  guides: new Set(SYSTEM_WORKFLOW_GUIDE_MODES),
  surfaces: new Set(SYSTEM_WORKFLOW_SURFACE_IDS),
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

// The retired presentation slot must never become an ordinary public scene.
export function isSystemWorkflowGridId(id) {
  return typeof id === 'string' && id !== 'grid:world-cover'
    && GRID_ID.test(id) && id.length <= SYSTEM_WORKFLOW_LIMITS.maxIdLength;
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
    if (!isSystemWorkflowGridId(candidate)) {
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
    visibility: { links: true, network: true, counts: true, publicationDate: true },
  };
}

export function createBlankWorkbenchDraft(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw operationError('SYSTEM_WORKFLOW_PROFILE_INVALID', 'A valid profile address is required');
  return {
    profileAddress: profile,
    draftVersion: SYSTEM_WORKFLOW_DRAFT_VERSION,
    artboard: { ...SYSTEM_WORKFLOW_ARTBOARD },
    geometry: { ...SYSTEM_WORKFLOW_GEOMETRY },
    appearance: {
      surfaceId: 'mist',
      guideMode: 'LINES', guideSize: SYSTEM_WORKFLOW_GRID_DENSITY.default, guideColor: '#6f746f',
    },
    identityPresentation: createEmptySystemWorkflowIdentityPresentation(),
  };
}

export const createEmptySystemWorkflowDraft = createBlankWorkbenchDraft;

function validateIdentity(value, fail) {
  if (!exactKeys(value, [...IDENTITY_KEYS, ...['card', 'dossierSurface'].filter(key => Object.hasOwn(value || {}, key))])) return fail('identityPresentation', 'invalid_identity_structure', 'Invalid identity');
  if (Object.hasOwn(value, 'card') && !isValidIdentityCard(value.card)) fail('identityPresentation.card', 'invalid_identity_card', 'Invalid Identity card settings');
  if (!safeText(value.alias, 80)) fail('identityPresentation.alias', 'invalid_alias', 'Invalid alias');
  if (!exactKeys(value.avatar, Object.hasOwn(value.avatar || {}, 'selectedMedia') ? ['mode', 'stableAssetId', 'shape', 'selectedMedia'] : ['mode', 'stableAssetId', 'shape'])
    || (Object.hasOwn(value.avatar || {}, 'selectedMedia') && (!isValidPlacementMedia(value.avatar.selectedMedia) || value.avatar.mode !== 'inscape' || !value.avatar.stableAssetId))
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
  if (Object.hasOwn(value, 'dossierSurface') && !sets.surfaces.has(value.dossierSurface)) fail('identityPresentation.dossierSurface', 'invalid_dossier_surface', 'Invalid dossier surface');
  if (!exactKeys(value.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(value.visibility || {}).some((entry) => typeof entry !== 'boolean')) {
    fail('identityPresentation.visibility', 'invalid_identity_visibility', 'Invalid identity visibility');
  }
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

export function validateSystemWorkflowDraft(input) {
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  const allowedKeys = [...DRAFT_KEYS, 'workbench', 'texts', 'imageModules', 'shapes', 'keeperDocks', 'workbenchGroups', 'workbenchIndex', 'artworkLayers', 'reception', 'composition'];
  if (!exactKeys(input, allowedKeys.filter(key => DRAFT_KEYS.includes(key) || Object.hasOwn(input || {}, key)))) {
    const missing = DRAFT_KEYS.filter(key => !Object.hasOwn(input || {}, key));
    const unexpected = record(input) ? Object.keys(input).filter(key => !allowedKeys.includes(key)) : [];
    fail('$', 'invalid_draft_structure', `Invalid draft. Missing fields: ${missing.join(', ') || 'none'}. Unexpected fields: ${unexpected.slice(0, 20).map(key => key.slice(0, 80)).join(', ') || 'none'}.`);
    return { valid: false, errors, value: null };
  }
  if (!normalizeProfileAddress(input.profileAddress) || input.profileAddress !== input.profileAddress.toLowerCase()) fail('profileAddress', 'invalid_profile_address', 'Invalid profile address');
  if (input.draftVersion !== SYSTEM_WORKFLOW_DRAFT_VERSION) fail('draftVersion', 'unsupported_draft_version', 'Unsupported draft version');
  if (!isDisplayFormat(input.artboard, input.geometry)) fail('artboard', 'invalid_artboard', 'Invalid canvas geometry');
  if (!exactKeys(input.appearance, [...APPEARANCE_KEYS, ...retiredInterfaceKeys(input.appearance), ...['edges', 'frame', ...DISPLAY_CANVAS_APPEARANCE_KEYS].filter(key => Object.hasOwn(input.appearance || {}, key))])
    || !validDisplayCanvasAppearance(input.appearance)
    || input.appearance?.edges !== undefined && !validModuleEdges(input.appearance.edges)
    || input.appearance?.frame !== undefined && typeof input.appearance.frame !== 'boolean'
    || !sets.surfaces.has(input.appearance?.surfaceId)
    || Object.hasOwn(input.appearance || {}, 'menuSurfaceId') && !sets.surfaces.has(input.appearance.menuSurfaceId)
    || Object.hasOwn(input.appearance || {}, 'dossierSurfaceId') && !sets.surfaces.has(input.appearance.dossierSurfaceId)
    || !sets.guides.has(input.appearance?.guideMode)
    || !Number.isSafeInteger(input.appearance?.guideSize)
    || input.appearance.guideSize < SYSTEM_WORKFLOW_GRID_DENSITY.minimum
    || input.appearance.guideSize > SYSTEM_WORKFLOW_GRID_DENSITY.maximum
    || !HEX_COLOR.test(input.appearance?.guideColor || '')) fail('appearance', 'invalid_appearance', 'Invalid appearance');
  validateIdentity(input.identityPresentation, fail);
  if (Object.hasOwn(input, 'composition') && (input.composition?.version !== 3 || !validReception(input.composition)))
    fail('composition', 'invalid_composition', 'Invalid Studio composition');
  if (Object.hasOwn(input, 'reception') && !validReception(input.reception)) fail('reception', 'invalid_reception', 'Invalid Bento layout');
  if (Object.hasOwn(input, 'workbenchIndex') && !validWorkbenchIndex(input.workbenchIndex, input)) fail('workbenchIndex', 'invalid_workbench_index', 'Invalid Workbench Index');
  if (Object.hasOwn(input, 'artworkLayers') && !validArtworkLayers(input.artworkLayers, input)) fail('artworkLayers', 'invalid_artwork_layers', 'Invalid artwork order or composition block');
  if (Object.hasOwn(input, 'workbenchGroups') && !validWorkbenchGroups(input.workbenchGroups, input)) fail('workbenchGroups', 'invalid_workbench_groups', 'Invalid Workbench groups');
  if (Object.hasOwn(input, 'keeperDocks') && !validKeeperDocks(input.keeperDocks)) fail('keeperDocks', 'invalid_keepers', 'Invalid Keeper dock');
  if (Array.isArray(input.workbench?.keeperDocks) && input.workbench.keeperDocks.some(item => !Array.isArray(input.keeperDocks) || !input.keeperDocks.some(keeper => keeper?.id === item?.id))) fail('workbench.keeperDocks', 'unknown_keeper', 'Dock refers to an unavailable Keeper');
  if (Object.hasOwn(input, 'texts') && !validTextModules(input.texts)) fail('texts', 'invalid_texts', 'Invalid Text module');
  if (Object.hasOwn(input, 'shapes') && !validShapes(input.shapes)) fail('shapes', 'invalid_shapes', 'Invalid Shape');
  if (Array.isArray(input.workbench?.shapes) && input.workbench.shapes.some(item => !Array.isArray(input.shapes) || !input.shapes.some(shape => shape?.id === item?.id))) fail('workbench.shapes', 'unknown_shape', 'Window refers to an unavailable Shape');
  if (Object.hasOwn(input, 'imageModules') && !validImageModules(input.imageModules)) fail('imageModules', 'invalid_images', 'Invalid Image module');
  if (Array.isArray(input.workbench?.imageModules) && input.workbench.imageModules.some(item => !Array.isArray(input.imageModules) || !input.imageModules.some(image => image?.id === item?.id))) fail('workbench.imageModules', 'unknown_image', 'Window refers to an unavailable Image module');
  if (Array.isArray(input.workbench?.texts) && input.workbench.texts.some(item => !Array.isArray(input.texts) || !input.texts.some(text => text?.id === item?.id))) fail('workbench.texts', 'unknown_text', 'Window refers to an unavailable Text module');
  if (Object.hasOwn(input, 'workbench') && !isValidWorkbenchPresentation(input.workbench)) fail('workbench', 'invalid_workbench', 'Invalid Workbench configuration');
  const allReferences = receptionReferenceCount(input.composition) + receptionReferenceCount(input.reception)
    + keeperReferenceCount(input.keeperDocks) + imageReferenceCount(input.imageModules)
    + (input.identityPresentation?.avatar?.stableAssetId ? 1 : 0);
  if (allReferences > SYSTEM_WORKFLOW_LIMITS.maxTotalAssetReferences) fail('$', 'too_many_asset_references', 'Too many asset references');
  try {
    if (textEncoder.encode(JSON.stringify(input)).byteLength > SYSTEM_WORKFLOW_LIMITS.maxJsonBytes) {
      fail('$', 'draft_too_large', 'Draft exceeds the byte limit');
    }
  } catch {
    fail('$', 'draft_not_serializable', 'Draft is not serializable');
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : stripRetiredInterfaceAppearance(structuredClone(input)) };
}

export function assertValidSystemWorkflowDraft(input) {
  const result = validateSystemWorkflowDraft(input);
  if (!result.valid) throw Object.assign(new TypeError(result.errors[0].message), { errors: result.errors });
  return result.value;
}
