import { ownerSystemWorkflowDecodedAsset } from './ownerSystemWorkflowAssetDimensions.js';
import { textRecoveries, TEXT_RECOVERY_MESSAGE } from '../../text/textEditRecovery.js';

export default async function prepareWorkbenchPreview({
  current,
  draft,
  store,
  profileAddress,
  workbench,
  projectionError,
  library,
  publicationProfile,
  reviewAssets,
}) {
  const { assetsById, resolveAssetDimensions, records, decodedDimensions } = library;
  const { buildOwnerSystemWorkflowPreviewDocument, preloadOwnerSystemWorkflowPreviewEntryMedia } =
    await import('../ownerSystemWorkflowPreviewDocument.js');
  if (!current()) return null;
  if (projectionError) throw new Error(projectionError);
  const referencedIds = new Set(
    [draft, ...(draft.displays || [])]
      .flatMap(module =>
        module.grids.flatMap(grid => grid.placements.map(placement => placement.stableAssetId))
      )
      .filter(Boolean)
  );
  const decodedEntries = await Promise.all(
    [...referencedIds].map(async id => {
      const asset = assetsById.get(id);
      return [id, asset ? await resolveAssetDimensions(asset) : null];
    })
  );
  if (!current()) return null;
  const previewDimensions = new Map(decodedEntries.filter(([, dimensions]) => dimensions));
  const previewRecords = records.map(asset =>
    ownerSystemWorkflowDecodedAsset(
      asset,
      previewDimensions.get(asset?.id) || decodedDimensions.get(asset?.id)
    )
  );
  const document = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: previewRecords,
    profile: publicationProfile,
    profileAddress,
    systemWorkflowDraft: draft,
    workbench,
  });
  await preloadOwnerSystemWorkflowPreviewEntryMedia(document, reviewAssets ? { timeoutMs: 500 } : undefined);
  if (textRecoveries(store, profileAddress).length) throw new Error(TEXT_RECOVERY_MESSAGE);
  return document;
}
