export const OWNER_RECONCILIATION_ACTION = Object.freeze({
  ADOPT_BASELINE: 'ADOPT_BASELINE',
  CONFLICT: 'CONFLICT',
  HYDRATE_PUBLICATION: 'HYDRATE_PUBLICATION',
  KEEP_LOCAL: 'KEEP_LOCAL',
  WAIT: 'WAIT'
});

export function isWorkspacePublicProjectionEmpty(workspace) {
  const publicFolders = (workspace?.folders || []).some((folder) => folder.public === true);
  const publicObjects = (workspace?.canvas?.objects || []).some((object) => object.visitorVisible === true);
  return !publicFolders && !publicObjects;
}

export function decideOwnerPublicationReconciliation({
  localRecordPresence,
  localFingerprint,
  localPublicProjectionEmpty,
  baseline,
  publishedFingerprint
}) {
  if (!publishedFingerprint || !localFingerprint) return OWNER_RECONCILIATION_ACTION.WAIT;
  if (localRecordPresence === 'absent') return OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION;

  if (!baseline) {
    if (localFingerprint === publishedFingerprint) return OWNER_RECONCILIATION_ACTION.ADOPT_BASELINE;
    // One-time repair for records produced by the previous premature-empty autosave bug.
    if (localPublicProjectionEmpty) return OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION;
    return OWNER_RECONCILIATION_ACTION.CONFLICT;
  }

  const basePublished = baseline.publishedFingerprint;
  const baseLocal = baseline.localFingerprint;
  if (!basePublished || !baseLocal) return OWNER_RECONCILIATION_ACTION.ADOPT_BASELINE;
  if (localFingerprint === publishedFingerprint) return OWNER_RECONCILIATION_ACTION.ADOPT_BASELINE;
  if (localFingerprint === baseLocal) {
    return publishedFingerprint === basePublished
      ? OWNER_RECONCILIATION_ACTION.KEEP_LOCAL
      : OWNER_RECONCILIATION_ACTION.HYDRATE_PUBLICATION;
  }
  if (publishedFingerprint === basePublished) return OWNER_RECONCILIATION_ACTION.KEEP_LOCAL;
  return OWNER_RECONCILIATION_ACTION.CONFLICT;
}
