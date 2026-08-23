import {
  SYSTEM_WORKFLOW_DRAFT_VERSION,
  SYSTEM_WORKFLOW_VISIBILITY,
  assertValidSystemWorkflowDraft,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';

function restoredPublicGrid(grid) {
  return {
    id: grid.id,
    title: grid.title,
    subtitle: grid.subtitle,
    visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
    labelVisible: grid.labelVisible,
    labelAnchor: grid.labelAnchor,
    labelOffset: { ...grid.labelOffset },
    placements: grid.placements.map(({ asset, ...placement }) => ({
      ...structuredClone(placement),
      stableAssetId: asset.stableAssetId,
      visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
      locked: false,
    })),
  };
}

function restoredIdentity(identity) {
  return {
    alias: identity.alias,
    avatar: {
      mode: identity.avatar.mode,
      stableAssetId: identity.avatar.asset?.stableAssetId || null,
      shape: identity.avatar.shape,
    },
    bio: { ...identity.bio },
    tags: structuredClone(identity.tags),
    dossierSurface: identity.dossierSurface,
    visibility: { ...identity.visibility },
  };
}

/**
 * Rebuilds draft-v4 public state from one validated v9 document. Private local
 * Grids survive, but they never influence the recovered public order.
 */
export function reconcileSystemWorkflowDraftFromProfileDocumentV9(documentInput, currentDraftInput = null) {
  const document = assertValidProfileDocumentV9(documentInput);
  let privateGrids = [];
  if (currentDraftInput !== null) {
    const current = assertValidSystemWorkflowDraft(currentDraftInput);
    if (current.profileAddress !== document.profile.address) {
      throw new TypeError('The local draft and published document belong to different profiles');
    }
    const publishedIds = new Set(document.grids.map(({ id }) => id));
    privateGrids = current.grids
      .filter(({ visibility, id }) => visibility === SYSTEM_WORKFLOW_VISIBILITY.PRIVATE && !publishedIds.has(id))
      .map((grid) => structuredClone(grid));
  }
  return assertValidSystemWorkflowDraft({
    profileAddress: document.profile.address,
    draftVersion: SYSTEM_WORKFLOW_DRAFT_VERSION,
    artboard: { ...document.artboard },
    geometry: { ...document.geometry },
    appearance: { ...document.appearance },
    identityPresentation: restoredIdentity(document.identityPresentation),
    grids: [...document.grids.map(restoredPublicGrid), ...privateGrids],
  });
}

export function createProfileDocumentV9RestorePlan(document, currentDraft = null) {
  const value = assertValidProfileDocumentV9(document);
  return Object.freeze({
    profileAddress: value.profile.address,
    systemWorkflowDraft: reconcileSystemWorkflowDraftFromProfileDocumentV9(value, currentDraft),
  });
}
