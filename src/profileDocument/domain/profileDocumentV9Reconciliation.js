import {
  SYSTEM_WORKFLOW_DRAFT_VERSION,
  SYSTEM_WORKFLOW_VISIBILITY,
  SYSTEM_WORKFLOW_WORLD_COVER_GRID_ID,
  assertValidSystemWorkflowDraft,
  createEmptySystemWorkflowWorldCoverGrid,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { restoreMobilePresentation } from '../../mobile/domain/mobilePresentation.js';
import { restoreMiniApps } from '../../miniApps/domain/miniApps.js';
import { createDefaultWorkbenchPresentation } from './workbenchPresentation.js';

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
      ...(asset.media.url && asset.media.type === 'image' ? { selectedMedia: {
        url: asset.media.url, width: asset.media.width, height: asset.media.height,
      } } : {}),
      visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
      locked: false,
    })),
  };
}

function restoredIdentity(identity) {
  return {
    ...(identity.card ? { card: structuredClone(identity.card) } : {}),
    alias: identity.alias,
    avatar: {
      mode: identity.avatar.mode,
      stableAssetId: identity.avatar.asset?.stableAssetId || null,
      shape: identity.avatar.shape,
      ...(identity.avatar.asset?.media?.url && identity.avatar.asset.media.type === 'image' ? { selectedMedia: {
        url: identity.avatar.asset.media.url, width: identity.avatar.asset.media.width, height: identity.avatar.asset.media.height,
      } } : {}),
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
      .filter(({ visibility, id }) => visibility === SYSTEM_WORKFLOW_VISIBILITY.PRIVATE && id !== SYSTEM_WORKFLOW_WORLD_COVER_GRID_ID && !publishedIds.has(id))
      .map((grid) => structuredClone(grid));
  }
  const worldCover = document.metadata.worldCover
    ? restoredPublicGrid(document.metadata.worldCover.grid)
    : createEmptySystemWorkflowWorldCoverGrid();
  const publishedDisplays = (document.displays || []).map(module => {
    const local = currentDraftInput?.displays?.find(item => item.id === module.id);
    const publicIds = new Set(module.grids.map(grid => grid.id));
    return { ...structuredClone(module), visibility: 'PUBLIC', grids: [...module.grids.map(restoredPublicGrid),
      ...(local?.grids || []).filter(grid => grid.visibility === 'PRIVATE' && !publicIds.has(grid.id)).map(grid => structuredClone(grid)),
      createEmptySystemWorkflowWorldCoverGrid()] };
  });
  const privateDisplays = (currentDraftInput?.displays || []).filter(module => !publishedDisplays.some(item => item.id === module.id))
    .flatMap(module => {
      if (module.visibility === 'PRIVATE') return [module];
      const grids = module.grids.filter(grid => grid.visibility === 'PRIVATE');
      return grids.length ? [{ ...module, visibility: 'PRIVATE', grids: [...grids, createEmptySystemWorkflowWorldCoverGrid()] }] : [];
    });
  const miniApps = restoreMiniApps(document.miniApps, currentDraftInput?.miniApps);
  const privateMiniAppWindows = (currentDraftInput?.workbench?.miniApps || []).filter(window =>
    miniApps.some(app => app.id === window.id && app.visibility === 'PRIVATE'));
  const workbench = document.workbench ? structuredClone(document.workbench)
    : privateMiniAppWindows.length ? createDefaultWorkbenchPresentation() : null;
  if (privateMiniAppWindows.length) workbench.miniApps = [...(workbench.miniApps || []), ...structuredClone(privateMiniAppWindows)];
  return assertValidSystemWorkflowDraft({
    profileAddress: document.profile.address,
    draftVersion: SYSTEM_WORKFLOW_DRAFT_VERSION,
    artboard: { ...document.artboard },
    geometry: { ...document.geometry },
    appearance: { ...document.appearance },
    identityPresentation: restoredIdentity(document.identityPresentation),
    ...(workbench ? { workbench } : {}),
    ...((document.miniApps || currentDraftInput?.miniApps) ? { miniApps } : {}),
    ...((document.animations || currentDraftInput?.animations) ? { animations: [
      ...(document.animations || []).map(item => ({ ...structuredClone(item), visibility: 'PUBLIC' })),
      ...(currentDraftInput?.animations || []).filter(item => item.visibility === 'PRIVATE'
        && !document.animations?.some(published => published.id === item.id)).map(item => structuredClone(item)),
    ] } : {}),
    ...((document.displays || currentDraftInput?.displays) ? { displays: [...publishedDisplays, ...structuredClone(privateDisplays)] } : {}),
    ...(document.mobile ? { mobile: restoreMobilePresentation(document.mobile, currentDraftInput?.mobile) }
      : currentDraftInput?.mobile ? { mobile: { ...structuredClone(currentDraftInput.mobile), visibility: 'PRIVATE' } } : {}),
    grids: [...document.grids.map(restoredPublicGrid), ...privateGrids, worldCover],
  });
}

export function createProfileDocumentV9RestorePlan(document, currentDraft = null) {
  const value = assertValidProfileDocumentV9(document);
  return Object.freeze({
    profileAddress: value.profile.address,
    systemWorkflowDraft: reconcileSystemWorkflowDraftFromProfileDocumentV9(value, currentDraft),
  });
}
