import { normalizeProfileAddress } from '../library/config.js';

export function resolveOwnerAuthoringEnabled({
  ownershipVerified,
  verifiedOwnerProfileAddress,
  workspaceProfileAddress,
  viewedProfileAddress
}) {
  const verified = normalizeProfileAddress(verifiedOwnerProfileAddress);
  const workspace = normalizeProfileAddress(workspaceProfileAddress);
  const viewed = normalizeProfileAddress(viewedProfileAddress);
  return ownershipVerified === true && Boolean(verified && workspace && viewed)
    && verified === workspace && viewed === workspace;
}

export function selectPublicProfileRoute(ownerAuthoringEnabled) {
  return ownerAuthoringEnabled === true ? 'LOCAL_OWNER' : 'PUBLISHED_VISITOR';
}

export function selectResidentActorVisible({
  actorRevealVisible,
  keeperVisible,
  ownerRuntime,
  publishedVisitorReady
}) {
  return actorRevealVisible === true
    && keeperVisible === true
    && (ownerRuntime === true || publishedVisitorReady === true);
}

export function selectLiveCanvasContent(workspace, ownerAuthoringEnabled) {
  const objects = Array.isArray(workspace?.canvas?.objects) ? workspace.canvas.objects : [];
  return { objects: ownerAuthoringEnabled ? objects : objects.filter((object) => object.visitorVisible === true) };
}

export function runOwnerAuthoringMutation(ownerAuthoringEnabled, mutation) {
  if (!ownerAuthoringEnabled || typeof mutation !== 'function') return undefined;
  return mutation();
}
