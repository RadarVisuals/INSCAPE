import { normalizeProfileAddress } from '../../library/config.js';
import {
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import {
  INSCAPE_PROFILE_DOCUMENT_TYPE,
  INSCAPE_PROFILE_DOCUMENT_VERSION,
  PROFILE_DOCUMENT_NETWORK,
} from './constants.js';
import { parsePublishedAssetUrl } from './publishedAssetUrl.js';
import { createProfileDocumentV9AssetResolver } from './profileDocumentV9Asset.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';

function timestamp(value, label) {
  const milliseconds = value instanceof Date ? value.getTime()
    : typeof value === 'number' ? value
      : Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be a valid timestamp`);
  return new Date(milliseconds).toISOString();
}

function cachedIdentity(profileIdentity, address) {
  const name = typeof profileIdentity?.name === 'string' ? profileIdentity.name.trim().slice(0, 80) : '';
  const avatarCandidate = typeof profileIdentity?.avatarUrl === 'string'
    ? profileIdentity.avatarUrl.trim().slice(0, 2048)
    : '';
  const avatarUrl = parsePublishedAssetUrl(avatarCandidate)?.value;
  return { address, ...(name ? { name } : {}), ...(avatarUrl ? { avatarUrl } : {}) };
}

function publicationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

export function projectSystemWorkflowPublicGrids(draftInput, assetRecords = []) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const resolveAsset = createProfileDocumentV9AssetResolver(assetRecords);
  const grids = draft.grids
    .filter(({ visibility }) => visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC)
    .map((grid) => ({
      id: grid.id,
      title: grid.title,
      subtitle: grid.subtitle,
      visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
      labelVisible: grid.labelVisible,
      labelAnchor: grid.labelAnchor,
      labelOffset: { ...grid.labelOffset },
      placements: grid.placements
        .filter(({ visibility }) => visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC)
        .sort((left, right) => left.navigationOrder - right.navigationOrder || left.id.localeCompare(right.id))
        .map(({ locked: _locked, stableAssetId, ...placement }) => ({
          ...structuredClone(placement),
          visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
          asset: resolveAsset(stableAssetId),
        })),
    }));
  if (!grids.length) {
    throw publicationError('INSCAPE_PROFILE_PUBLIC_GRID_REQUIRED', 'Publication requires at least one public Grid');
  }
  return grids;
}

export function buildProfileDocumentV9({
  assetRecords = [],
  createdAt,
  documentId,
  exportedAt,
  profileAddress,
  profileIdentity,
  revision = 1,
  systemWorkflowDraft,
}) {
  const address = normalizeProfileAddress(profileAddress);
  if (!address) throw new TypeError('A valid Universal Profile address is required');
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw publicationError('INSCAPE_PROFILE_REVISION_INVALID', 'Profile document revision must be a positive integer');
  }
  const draft = assertValidSystemWorkflowDraft(systemWorkflowDraft);
  if (draft.profileAddress !== address) {
    throw new TypeError('The System Workflow draft must match the profile document authority');
  }
  const created = timestamp(createdAt ?? 0, 'Document creation time');
  const exported = timestamp(exportedAt ?? createdAt ?? 0, 'Document export time');
  if (Date.parse(created) > Date.parse(exported)) throw new TypeError('Document creation time cannot follow export time');
  const resolveAvatarAsset = createProfileDocumentV9AssetResolver(assetRecords, { compactContentReference: false });
  const identity = structuredClone(draft.identityPresentation);
  const avatarAsset = identity.avatar.mode === 'inscape' && identity.avatar.stableAssetId
    ? resolveAvatarAsset(identity.avatar.stableAssetId)
    : null;
  return assertValidProfileDocumentV9({
    documentType: INSCAPE_PROFILE_DOCUMENT_TYPE,
    version: INSCAPE_PROFILE_DOCUMENT_VERSION,
    documentId: documentId || `profile:${address}`,
    revision,
    createdAt: created,
    exportedAt: exported,
    network: { ...PROFILE_DOCUMENT_NETWORK },
    profile: { address, cachedIdentity: cachedIdentity(profileIdentity, address) },
    artboard: { ...draft.artboard },
    geometry: { ...draft.geometry },
    appearance: { ...draft.appearance },
    identityPresentation: {
      alias: identity.alias,
      avatar: { mode: identity.avatar.mode, asset: avatarAsset, shape: identity.avatar.shape },
      bio: {
        mode: identity.bio.mode,
        customText: identity.bio.mode === 'inscape' ? identity.bio.customText : '',
      },
      tags: structuredClone(identity.tags),
      dossierSurface: identity.dossierSurface,
      visibility: { ...identity.visibility },
    },
    grids: projectSystemWorkflowPublicGrids(draft, assetRecords),
    metadata: {},
  });
}

export function countProfileDocumentV9Assets(document) {
  const value = assertValidProfileDocumentV9(document);
  return value.grids.reduce((total, grid) => total + grid.placements.length, 0)
    + (value.identityPresentation.avatar.asset ? 1 : 0);
}
