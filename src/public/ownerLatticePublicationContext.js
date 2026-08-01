import { canonicalPublicationHash, publicationContentFingerprint } from '../profileDocument/domain/profileDocumentPublication.js';

export function createOwnerLatticePublicationContext({
  cid,
  cidGeneration,
  draftFingerprint,
  draftGeneration,
  getWalletPublicationContext,
  profileAddress,
  snapshot,
  snapshotDraftFingerprint,
  snapshotGeneration,
}) {
  const wallet = getWalletPublicationContext?.() || {};
  return {
    ...wallet,
    cidGeneration,
    cidInput: cid,
    draftFingerprint,
    draftGeneration,
    ownerAuthoringEnabled: Boolean(wallet.isHostProfileOwner
      && String(wallet.hostProfileAddress || '').toLowerCase() === profileAddress),
    snapshotArtifactHash: snapshot ? canonicalPublicationHash(snapshot) : null,
    snapshotContentFingerprint: snapshot ? publicationContentFingerprint(snapshot) : null,
    snapshotGeneration,
    snapshotStale: Boolean(snapshot && snapshotDraftFingerprint !== draftFingerprint),
    viewedProfileAddress: profileAddress,
    workspaceProfileAddress: profileAddress,
  };
}
