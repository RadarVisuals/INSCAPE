import { normalizeProfileAddress } from '../../library/config.js';
import { createCanonicalAssetId, normalizeTokenId } from './assetReference.js';
import { KNOWN_KEEPER_IDS, KNOWN_STAGE_IDS, PROFILE_DOCUMENT_LIMITS as L, PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';

const ID = /^[A-Za-z0-9:_-]+$/;
const SAFE_MODULE_IDS = new Set(['identity', 'signals']);
const STANDARD = new Set(['LSP7', 'LSP8', 'UNKNOWN']);
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= L.maxIdLength && ID.test(value);
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const validTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validPosition = (value) => value === null || (exactKeys(value, ['column', 'row']) && Number.isInteger(value.column) && Number.isInteger(value.row) && value.column >= 0 && value.column <= 63 && value.row >= 0 && value.row <= 127);
const validUrl = (value) => typeof value === 'string' && value.length <= L.maxUrlLength && /^(https?:\/\/|ipfs:\/\/)/i.test(value) && !/[\u0000-\u001f\u007f]/.test(value);
function depth(value, current = 0) { if (!value || typeof value !== 'object') return current; return Object.values(value).reduce((max, child) => Math.max(max, depth(child, current + 1)), current); }

export class ProfileDocumentValidationError extends Error {
  constructor(errors) { super(errors[0]?.message || 'Invalid profile document'); this.name = 'ProfileDocumentValidationError'; this.errors = errors; }
}

export function validateProfileDocument(input, { rawSize } = {}) {
  const errors = []; const fail = (path, code, message) => errors.push({ path, code, message });
  let measuredSize = rawSize;
  try { measuredSize ??= new TextEncoder().encode(JSON.stringify(input)).length; } catch { measuredSize = Infinity; }
  if (measuredSize > L.maxJsonBytes) fail('$', 'document_too_large', `Document exceeds ${L.maxJsonBytes} bytes`);
  if (depth(input) > L.maxDepth) fail('$', 'excessive_depth', 'Document nesting is too deep');
  if (!exactKeys(input, ['documentType', 'version', 'documentId', 'revision', 'createdAt', 'exportedAt', 'network', 'profile', 'presentation', 'spaces', 'metadata'])) fail('$', 'unexpected_fields', 'Document contains unexpected or missing object structure');
  if (input?.documentType !== PROFILE_DOCUMENT_TYPE) fail('documentType', 'wrong_document_type', 'Not an OS_UNDERNEATH profile document');
  if (input?.version !== PROFILE_DOCUMENT_VERSION) fail('version', 'unsupported_version', `Unsupported profile document version: ${String(input?.version)}`);
  if (!validId(input?.documentId)) fail('documentId', 'invalid_id', 'Invalid document ID');
  if (!Number.isInteger(input?.revision) || input.revision < 1) fail('revision', 'invalid_revision', 'Revision must be a positive integer');
  if (!validTime(input?.createdAt) || !validTime(input?.exportedAt)) fail('timestamps', 'invalid_timestamp', 'Invalid document timestamp');
  if (!exactKeys(input?.network, ['name', 'chainId']) || input?.network?.name !== 'lukso-mainnet' || input?.network?.chainId !== 42) fail('network', 'invalid_network', 'Only LUKSO mainnet (42) is supported');
  const address = normalizeProfileAddress(input?.profile?.address);
  if (!exactKeys(input?.profile, ['address', 'cachedIdentity']) || !address) fail('profile', 'invalid_profile', 'Invalid Universal Profile address');
  const identity = input?.profile?.cachedIdentity;
  if (!exactKeys(identity, ['address', 'name', 'avatarUrl']) || normalizeProfileAddress(identity?.address) !== address || (identity?.name !== undefined && !validText(identity.name, L.maxNameLength)) || (identity?.avatarUrl !== undefined && !validUrl(identity.avatarUrl))) fail('profile.cachedIdentity', 'invalid_identity', 'Invalid cached public identity fallback');
  const presentation = input?.presentation;
  if (!exactKeys(presentation, ['keeperId', 'stageId', 'systemModules', 'signals']) || !KNOWN_KEEPER_IDS.includes(presentation?.keeperId) || !KNOWN_STAGE_IDS.includes(presentation?.stageId)) fail('presentation', 'invalid_presentation', 'Unknown Keeper or stage');
  if (!Array.isArray(presentation?.systemModules) || presentation.systemModules.length > 8 || new Set((presentation?.systemModules || []).map((module) => module.id)).size !== (presentation?.systemModules || []).length || presentation.systemModules.some((module) => !exactKeys(module, ['id', 'visible', 'placement']) || !SAFE_MODULE_IDS.has(module.id) || typeof module.visible !== 'boolean' || !validPosition(module.placement))) fail('presentation.systemModules', 'invalid_modules', 'Invalid public system module projection');
  if (!exactKeys(presentation?.signals, ['notifications', 'speech', 'visualEffects', 'audio']) || Object.values(presentation?.signals || {}).some((value) => typeof value !== 'boolean')) fail('presentation.signals', 'invalid_settings', 'Invalid visitor-facing Signals settings');
  if (!exactKeys(input?.metadata, [])) fail('metadata', 'unexpected_fields', 'Version 1 metadata must be empty');
  if (!Array.isArray(input?.spaces)) fail('spaces', 'invalid_spaces', 'Spaces must be an array');
  else {
    if (input.spaces.length > L.maxSpaces) fail('spaces', 'too_many_spaces', 'Too many public spaces');
    const ids = new Set(); const launcherIds = new Set(); let total = 0;
    input.spaces.forEach((space, index) => {
      const path = `spaces[${index}]`;
      if (!exactKeys(space, ['id', 'launcherId', 'kind', 'label', 'order', 'placement', 'windowPlacement', 'assets'])) fail(path, 'unexpected_fields', 'Space contains unexpected fields');
      if (!validId(space?.id) || ids.has(space.id)) fail(`${path}.id`, 'duplicate_or_invalid_id', 'Space ID must be valid and unique'); else ids.add(space.id);
      if (!validId(space?.launcherId) || launcherIds.has(space.launcherId)) fail(`${path}.launcherId`, 'duplicate_or_invalid_id', 'Launcher ID must be valid and unique'); else launcherIds.add(space.launcherId);
      if (!['folder', 'favorites'].includes(space?.kind) || !validText(space?.label, L.maxLabelLength) || !Number.isInteger(space?.order) || space.order < 0 || !validPosition(space?.placement) || !validPosition(space?.windowPlacement)) fail(path, 'invalid_space', 'Invalid public space fields');
      if (!Array.isArray(space?.assets)) { fail(`${path}.assets`, 'invalid_assets', 'Assets must be an array'); return; }
      total += space.assets.length;
      if (space.assets.length > L.maxAssetsPerSpace) fail(`${path}.assets`, 'too_many_assets', 'Too many assets in a space');
      const refs = new Set();
      space.assets.forEach((asset, assetIndex) => {
        const assetPath = `${path}.assets[${assetIndex}]`;
        if (!exactKeys(asset, ['stableAssetId', 'network', 'chainId', 'tokenStandard', 'contractAddress', 'tokenId', 'cachedName', 'cachedPreviewUrl'])) fail(assetPath, 'unexpected_fields', 'Asset reference contains unexpected fields');
        const token = asset?.tokenId === null ? null : normalizeTokenId(asset?.tokenId);
        const canonical = createCanonicalAssetId({ chainId: asset?.chainId, contractAddress: asset?.contractAddress, tokenId: token });
        if (!canonical || canonical !== asset?.stableAssetId || asset?.network !== 'lukso-mainnet' || asset?.chainId !== 42 || !STANDARD.has(asset?.tokenStandard) || (asset?.tokenStandard === 'LSP8' && !token) || (asset?.tokenStandard === 'LSP7' && token)) fail(assetPath, 'invalid_asset_reference', 'Invalid canonical asset reference');
        if (refs.has(asset?.stableAssetId)) fail(assetPath, 'duplicate_asset', 'Duplicate asset reference in one space'); else refs.add(asset?.stableAssetId);
        if (asset?.cachedName !== undefined && !validText(asset.cachedName, L.maxNameLength)) fail(`${assetPath}.cachedName`, 'unsafe_text', 'Invalid cached asset name');
        if (asset?.cachedPreviewUrl !== undefined && !validUrl(asset.cachedPreviewUrl)) fail(`${assetPath}.cachedPreviewUrl`, 'unsafe_url', 'Invalid cached preview URL');
      });
    });
    if (total > L.maxTotalAssetReferences) fail('spaces', 'too_many_asset_references', 'Too many total asset references');
  }
  return { valid: errors.length === 0, errors, value: errors.length ? null : structuredClone(input), size: measuredSize };
}
export function assertValidProfileDocument(input, options) { const result = validateProfileDocument(input, options); if (!result.valid) throw new ProfileDocumentValidationError(result.errors); return result.value; }
export function parseProfileDocumentJson(raw) {
  if (typeof raw !== 'string') throw new ProfileDocumentValidationError([{ path: '$', code: 'invalid_json', message: 'Imported document must be JSON text' }]);
  const size = new TextEncoder().encode(raw).length;
  if (size > L.maxJsonBytes) throw new ProfileDocumentValidationError([{ path: '$', code: 'document_too_large', message: `Document exceeds ${L.maxJsonBytes} bytes` }]);
  let input; try { input = JSON.parse(raw); } catch { throw new ProfileDocumentValidationError([{ path: '$', code: 'invalid_json', message: 'Malformed JSON' }]); }
  return assertValidProfileDocument(input, { rawSize: size });
}
