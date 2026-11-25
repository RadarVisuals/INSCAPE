import { compositionReferenceCount } from '../../composition/compositionReferenceCount.js';
import { projectCompositionEditorDocument } from '../../composition/compositionEditorDocument.js';
import { projectWorkbenchIndex } from '../../systemWorkflow/domain/workbenchIndex.js';
import { projectArtworkLayers } from '../../systemWorkflow/domain/artworkLayers.js';
import { projectPublishedWorkbenchGroups } from './publishedWorkbenchGroups.js';
import { normalizeProfileAddress } from '../../library/config.js';
import {
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
import { projectIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import { projectImageModules, imageReferenceCount } from '../../imageModule/imageModule.js';
import { projectShapes } from '../../shapes/shapes.js';
import { projectKeeperDocks, keeperReferenceCount } from '../../keeper/keeper.js';
import { projectTextModules } from '../../text/domain/article.js';

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

export function buildProfileDocumentV9({
  assetRecords = [],
  createdAt,
  documentId,
  exportedAt,
  profileAddress,
  profileIdentity,
  revision = 1,
  systemWorkflowDraft,
  workbench,
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
    ? resolveAvatarAsset(identity.avatar.stableAssetId, identity.avatar.selectedMedia)
    : null;
  const presentation = workbench || draft.workbench;
  const shapes = draft.shapes ? projectShapes(draft.shapes) : undefined;
  const keeperDocks = draft.keeperDocks ? projectKeeperDocks(draft.keeperDocks) : undefined;
  const imageModules = draft.imageModules ? projectImageModules(draft.imageModules) : undefined;
  const texts = draft.texts ? projectTextModules(draft.texts) : undefined;
  const publicWorkbench = presentation ? structuredClone(presentation) : null;
  if (publicWorkbench) {
    delete publicWorkbench.keeperDocks;
    delete publicWorkbench.lockedLayerIds;
  }
  if (publicWorkbench?.shapes) publicWorkbench.shapes = publicWorkbench.shapes.filter(item => shapes?.some(shape => shape.id === item.id));
  if (publicWorkbench?.imageModules) publicWorkbench.imageModules = publicWorkbench.imageModules.filter(item => imageModules?.some(image => image.id === item.id));
  if (publicWorkbench?.texts) publicWorkbench.texts = publicWorkbench.texts.filter(item => texts?.some(text => text.id === item.id));
  const workbenchGroups = projectPublishedWorkbenchGroups(draft.workbenchGroups, { texts, imageModules, shapes, keeperDocks });
  const workbenchIndex = projectWorkbenchIndex(draft.workbenchIndex, { workbench: publicWorkbench, workbenchGroups, texts, imageModules, shapes, keeperDocks });
  const artworkOrder = projectArtworkLayers(draft, { texts, imageModules, shapes });
  return assertValidProfileDocumentV9({
    documentType: INSCAPE_PROFILE_DOCUMENT_TYPE,
    version: INSCAPE_PROFILE_DOCUMENT_VERSION,
    documentId: documentId || `profile:${address}`,
    revision,
    createdAt: created,
    exportedAt: exported,
    network: { ...PROFILE_DOCUMENT_NETWORK },
    profile: { address, cachedIdentity: cachedIdentity(profileIdentity, address) },
    identityPresentation: {
      ...(identity.card ? { card: projectIdentityCard(identity.card) } : {}),
      alias: identity.alias,
      avatar: { mode: identity.avatar.mode, asset: avatarAsset, shape: identity.avatar.shape },
      bio: {
        mode: identity.bio.mode,
        customText: identity.bio.mode === 'inscape' ? identity.bio.customText : '',
      },
      tags: structuredClone(identity.tags),
      visibility: { ...identity.visibility },
    },
    ...(artworkOrder.length ? { artworkLayers: artworkOrder } : {}),
    ...(workbenchGroups.length ? { workbenchGroups } : {}),
    ...(workbenchIndex ? { workbenchIndex } : {}),
    ...(draft.composition ? { composition: projectCompositionEditorDocument(draft.composition) } : {}),
    ...(shapes?.length ? { shapes } : {}),
    ...(keeperDocks?.length ? { keeperDocks } : {}),
    ...(imageModules?.length ? { imageModules } : {}),
    ...(texts?.length ? { texts } : {}),
    ...(publicWorkbench ? { workbench: publicWorkbench } : {}),
  });
}

export function countProfileDocumentV9Assets(document) {
  const value = assertValidProfileDocumentV9(document);
  const countCanvas = value => imageReferenceCount(value.imageModules) + compositionReferenceCount(value.composition);
  return countCanvas(value) + (value.canvases || []).reduce((sum, item) => sum + countCanvas(item.content), 0)
    + (value.identityPresentation.avatar.asset ? 1 : 0) + keeperReferenceCount(value.keeperDocks);
}
