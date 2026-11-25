import { isRecord as record, hasExactKeys as exactKeys, hasAllowedKeys as allowedKeys } from '../../recordValidation.js';
import { compositionReferenceCount } from '../../composition/compositionReferenceCount.js';
import { validCompositionEditorDocument } from '../../composition/compositionEditorDocument.js';
import { compositionLinkProblems } from './compositionLinks.js';
import { publishedPresentationSnapshot } from '../../presentation/presentationSources.js';
import { validatePublishedCanvases } from './publishedCanvases.js';
import { validWorkbenchIndex } from '../../systemWorkflow/domain/workbenchIndex.js';
import { validArtworkLayers } from '../../systemWorkflow/domain/artworkLayers.js';
import { validPublishedWorkbenchGroups } from './publishedWorkbenchGroups.js';
import { normalizeProfileAddress } from '../../library/config.js';
import {
  SYSTEM_WORKFLOW_LIMITS,
  SYSTEM_WORKFLOW_SURFACE_IDS,
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
import { validImageModules, imageReferenceCount } from '../../imageModule/imageModule.js';
import { validShapes } from '../../shapes/shapes.js';
import { validKeeperDocks, keeperReferenceCount } from '../../keeper/keeper.js';
import { validTextModules, assertArticle, ARTICLE_TYPE } from '../../text/domain/article.js';

const DOCUMENT_KEYS = [
  'documentType', 'version', 'documentId', 'revision', 'createdAt', 'exportedAt',
  'network', 'profile', 'identityPresentation',
];
const IDENTITY_KEYS = ['alias', 'avatar', 'bio', 'tags', 'visibility'];
const ID = /^[A-Za-z0-9:_-]+$/u;
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
  surfaces: new Set(SYSTEM_WORKFLOW_SURFACE_IDS),
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

function validateIdentity(value, fail) {
  if (!allowedKeys(value, IDENTITY_KEYS, ['card', 'dossierSurface'])) return fail('identityPresentation', 'invalid_identity_structure', 'Invalid identity presentation');
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
  if (Object.hasOwn(value, 'dossierSurface') && !sets.surfaces.has(value.dossierSurface)) fail('identityPresentation.dossierSurface', 'invalid_dossier_surface', 'Invalid dossier surface');
  if (!exactKeys(value.visibility, ['links', 'network', 'counts', 'publicationDate'])
    || Object.values(value.visibility || {}).some((entry) => typeof entry !== 'boolean')) {
    fail('identityPresentation.visibility', 'invalid_identity_visibility', 'Invalid identity visibility');
  }
}

export class ProfileDocumentV9ValidationError extends Error {
  constructor(errors) {
    super(errors[0]?.message || 'Invalid INSCAPE Profile Document');
    this.name = 'ProfileDocumentV9ValidationError';
    this.errors = errors;
  }
}

export function validateProfileDocumentV9(input, options) {
  return validateDocument(input, options, true);
}
function validateDocument(input, { rawSize } = {}, checkLinks) {
  const errors = [];
  const fail = (path, code, message) => errors.push({ path, code, message });
  let measuredSize = rawSize;
  try { measuredSize ??= new TextEncoder().encode(JSON.stringify(input)).byteLength; } catch { measuredSize = Infinity; }
  if (measuredSize > SYSTEM_WORKFLOW_LIMITS.maxJsonBytes) fail('$', 'document_too_large', `Document exceeds ${SYSTEM_WORKFLOW_LIMITS.maxJsonBytes} bytes`);
  // Each additional canvas is validated as a complete composition below. Its
  // collection envelope must not consume the composition's existing depth budget.
  const depthInput = record(input) ? Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'canvases')) : input;
  if (depth(depthInput) > SYSTEM_WORKFLOW_LIMITS.maxDepth) fail('$', 'excessive_depth', 'Document nesting is too deep');
  if (!allowedKeys(input, DOCUMENT_KEYS, ['workbench', 'texts', 'imageModules', 'shapes', 'keeperDocks', 'workbenchGroups', 'workbenchIndex', 'artworkLayers', 'composition', 'canvas', 'canvases'])) {
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
  validateIdentity(input.identityPresentation, fail);
  if (Object.hasOwn(input, 'composition') && (input.composition?.version !== 3 || !validCompositionEditorDocument(input.composition, true)))
    fail('composition', 'invalid_composition', 'Invalid published Studio composition');
  if (Object.hasOwn(input, 'keeperDocks') && !validKeeperDocks(input.keeperDocks, true)) fail('keeperDocks', 'invalid_keepers', 'Invalid published Keeper dock');
  if (Array.isArray(input.workbench?.keeperDocks) && input.workbench.keeperDocks.some(item => !Array.isArray(input.keeperDocks) || !input.keeperDocks.some(keeper => keeper?.id === item?.id))) fail('workbench.keeperDocks', 'unknown_keeper', 'Dock refers to an unavailable Keeper');
  if (Object.hasOwn(input, 'texts') && !validTextModules(input.texts, true)) fail('texts', 'invalid_texts', 'Invalid published Text module');
  if (Object.hasOwn(input, 'shapes') && !validShapes(input.shapes, true)) fail('shapes', 'invalid_shapes', 'Invalid published Shape');
  if (Array.isArray(input.workbench?.shapes) && input.workbench.shapes.some(item => !Array.isArray(input.shapes) || !input.shapes.some(shape => shape?.id === item?.id))) fail('workbench.shapes', 'unknown_shape', 'Window refers to an unavailable Shape');
  if (Object.hasOwn(input, 'imageModules') && !validImageModules(input.imageModules, true)) fail('imageModules', 'invalid_images', 'Invalid published Image module');
  if (Array.isArray(input.workbench?.imageModules) && input.workbench.imageModules.some(item => !Array.isArray(input.imageModules) || !input.imageModules.some(image => image?.id === item?.id))) fail('workbench.imageModules', 'unknown_image', 'Window refers to an unavailable Image module');
  if (Array.isArray(input.workbench?.texts) && input.workbench.texts.some(item => !Array.isArray(input.texts) || !input.texts.some(text => text?.id === item?.id))) fail('workbench.texts', 'unknown_text', 'Window refers to an unavailable Text module');
  if (Object.hasOwn(input, 'workbenchIndex') && !validWorkbenchIndex(input.workbenchIndex, input, true)) fail('workbenchIndex', 'invalid_workbench_index', 'Invalid published Workbench Index');
  if (Object.hasOwn(input, 'artworkLayers') && !validArtworkLayers(input.artworkLayers, input, true)) fail('artworkLayers', 'invalid_artwork_layers', 'Invalid public artwork order');
  if (Object.hasOwn(input, 'workbenchGroups') && !validPublishedWorkbenchGroups(input.workbenchGroups, input)) fail('workbenchGroups', 'invalid_workbench_groups', 'Invalid public Workbench groups or unavailable members');
  if (Object.hasOwn(input, 'workbench') && !isValidWorkbenchPresentation(input.workbench, [], { published: true })) fail('workbench', 'invalid_workbench', 'Invalid public Workbench configuration');
  const documentAssetReferences = (input.identityPresentation?.avatar?.asset ? 1 : 0)
    + keeperReferenceCount(input.keeperDocks) + imageReferenceCount(input.imageModules) + compositionReferenceCount(input.composition);
  if (documentAssetReferences > SYSTEM_WORKFLOW_LIMITS.maxTotalAssetReferences) {
    fail('$', 'too_many_asset_references', 'Too many total asset references');
  }
  validatePublishedCanvases(input, document => validateDocument(document, {}, false), fail);
  if (checkLinks && !errors.length) {
    const linkedLayouts = [['composition', input.composition, input.canvas?.name || 'Canvas'],
      ...(input.canvases || []).map(item => ['canvases.' + item.id + '.composition', item.content.composition, item.name])]
      .filter(([, layout]) => layout?.links?.length);
    if (linkedLayouts.length) {
      const snapshot = publishedPresentationSnapshot(input);
      for (const [path, layout, compositionName] of linkedLayouts) for (const issue of compositionLinkProblems(layout, snapshot))
        errors.push({ path: path + '.links.' + issue.id, code: 'unavailable_composition_link', message: issue.reason, compositionName });
    }
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
