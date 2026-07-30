import { buildAssetReference } from '../profileDocument/domain/assetReference.js';
import { parsePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { LATTICE_PRODUCTION_VISIBILITY } from '../lattice/domain/latticeProductionDraft.js';

function assetRecordsMap(assetRecords) {
  if (assetRecords instanceof Map) return new Map(assetRecords);
  return new Map((Array.isArray(assetRecords) ? assetRecords : []).map((record) => [record?.id, record]));
}

export function isRuntimeAssetReady(asset, stableAssetId) {
  if (!asset || asset.id !== stableAssetId) return false;
  const identity = buildAssetReference(asset, stableAssetId);
  if (!identity || identity.stableAssetId !== stableAssetId) return false;
  return [asset.imageUrl, asset.originalImageUrl, asset.thumbnailUrl]
    .some((candidate) => Boolean(parsePublishedAssetUrl(candidate)));
}

export function prepareOwnerLatticeRuntimeDraft(draftInput, assetRecords) {
  const draft = structuredClone(draftInput);
  const records = assetRecordsMap(assetRecords);
  const unresolvedPlacements = [];
  const avatar = draft.identityPresentation?.avatar;
  if (avatar?.mode === 'inscape' && !isRuntimeAssetReady(records.get(avatar.stableAssetId), avatar.stableAssetId)) {
    draft.identityPresentation.avatar = { ...avatar, mode: 'official', stableAssetId: null };
  }
  draft.tables = draft.tables.map((table) => {
    if (table.visibility === LATTICE_PRODUCTION_VISIBILITY.PRIVATE) return table;
    return {
      ...table,
      placements: table.placements.filter((placement) => {
        if (placement.visibility === LATTICE_PRODUCTION_VISIBILITY.PRIVATE) return true;
        const ready = isRuntimeAssetReady(records.get(placement.stableAssetId), placement.stableAssetId);
        if (!ready) unresolvedPlacements.push({ ...structuredClone(placement), tableId: table.id });
        return ready;
      }),
    };
  });
  return { draft, unresolvedPlacements };
}
