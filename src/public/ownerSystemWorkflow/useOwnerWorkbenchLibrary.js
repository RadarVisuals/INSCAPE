import { useCallback, useMemo, useState } from 'react';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import useOwnerSystemWorkflowDevelopmentAuthorities from './useOwnerSystemWorkflowDevelopmentAuthorities.js';
import {
  decodeOwnerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from './ownerSystemWorkflowAssetDimensions.js';

function assetMap(assets, records) {
  const map = new Map();
  for (const asset of [...assets, ...records]) {
    const id = asset?.stableAssetId || asset?.id;
    if (id) map.set(id, { ...(map.get(id) || {}), ...asset });
  }
  return map;
}

export default function useOwnerWorkbenchLibrary({
  profileAddress,
  draft,
  workbenchLayout,
  libraryOpen,
  selectedGrid,
  reviewAssets,
  reviewCategories,
}) {
  const fixtureAssets = import.meta.env.DEV ? reviewAssets : null;
  const [decodedDimensions, setDecodedDimensions] = useState(() => new Map());
  const browserEnabled = !fixtureAssets;
  const reviewAuthorities = useOwnerSystemWorkflowDevelopmentAuthorities({
    categories: reviewCategories,
    enabled: Boolean(fixtureAssets),
  });
  const referencedAssetIds = useMemo(
    () => [
      ...[...draft.grids, ...(draft.displays || []).flatMap(module => module.grids)].flatMap(grid =>
        grid.placements.map(({ stableAssetId }) => stableAssetId)
      ),
      ...(draft.identityPresentation.avatar.mode === 'inscape' &&
      draft.identityPresentation.avatar.stableAssetId
        ? [draft.identityPresentation.avatar.stableAssetId]
        : []),
      ...[workbenchLayout.display, ...(draft.workbench?.displays || []), ...(workbenchLayout.displays || [])]
        .map(display => display.shortcut.icon?.stableAssetId)
        .filter(Boolean),
    ],
    [draft.grids, draft.displays, draft.identityPresentation.avatar, draft.workbench, workbenchLayout]
  );
  const browser = useOwnerLatticeBrowser(profileAddress, libraryOpen && browserEnabled, referencedAssetIds);
  const assets = fixtureAssets || browser.data.assets;
  const records = fixtureAssets || browser.records;
  const refineAsset = useCallback(
    asset => ownerSystemWorkflowDecodedAsset(asset, decodedDimensions.get(asset?.stableAssetId || asset?.id)),
    [decodedDimensions]
  );
  const resolvedAssets = useMemo(() => assets.map(refineAsset), [assets, refineAsset]);
  const canonicalRecords = useMemo(() => records.map(refineAsset), [records, refineAsset]);
  const assetsById = useMemo(
    () => assetMap(resolvedAssets, canonicalRecords),
    [canonicalRecords, resolvedAssets]
  );
  const registerAssetDimensions = useCallback((asset, dimensions) => {
    if (asset?.selectedMedia) return dimensions;
    const id = asset?.stableAssetId || asset?.id;
    const canonicalSources = new Set([asset?.src, asset?.originalImageUrl, asset?.imageUrl].filter(Boolean));
    if (dimensions?.source && !canonicalSources.has(dimensions.source)) return dimensions;
    const refined = ownerSystemWorkflowDecodedAsset(asset, dimensions);
    if (!id || refined === asset) return null;
    const decoded = Object.freeze({
      source: refined.decodedImageSource,
      width: refined.decodedImageWidth,
      height: refined.decodedImageHeight,
    });
    setDecodedDimensions(current => {
      const previous = current.get(id);
      if (
        previous?.source === decoded.source &&
        previous.width === decoded.width &&
        previous.height === decoded.height
      )
        return current;
      const next = new Map(current);
      next.set(id, decoded);
      return next;
    });
    return decoded;
  }, []);
  const resolveAssetDimensions = useCallback(
    async asset => {
      const decoded = await decodeOwnerSystemWorkflowAssetDimensions(asset);
      return decoded ? registerAssetDimensions(asset, decoded) || decoded : null;
    },
    [registerAssetDimensions]
  );
  const libraryData = useLibraryData(
    browser.data,
    resolvedAssets,
    import.meta.env.DEV ? { selectedGrid, profileAddress, fixtureAssets, reviewAuthorities } : null
  );
  return {
    assetsById,
    resolvedAssets,
    canonicalRecords,
    records,
    decodedDimensions,
    registerAssetDimensions,
    resolveAssetDimensions,
    libraryData,
    categoryCommands: reviewAuthorities?.categoryCommands || browser.commands,
  };
}

function useLiveLibraryData(data, resolvedAssets) {
  return useMemo(() => ({ ...data, assets: resolvedAssets }), [data, resolvedAssets]);
}

function useReviewLibraryData(
  data,
  resolvedAssets,
  { selectedGrid, profileAddress, fixtureAssets, reviewAuthorities }
) {
  return useMemo(
    () =>
      fixtureAssets
        ? {
            assets: resolvedAssets,
            categories: reviewAuthorities.categories || [],
            categoryOrganization: reviewAuthorities.categoryOrganization,
            favorites: [],
            ownerContext: profileAddress,
            readOnly: true,
            rejectedAssetCount: 0,
            status: 'ready',
            usedAssetIds: selectedGrid?.placements.map(({ stableAssetId }) => stableAssetId) || [],
          }
        : { ...data, assets: resolvedAssets },
    [
      data,
      selectedGrid,
      profileAddress,
      resolvedAssets,
      fixtureAssets,
      reviewAuthorities.categories,
      reviewAuthorities.categoryOrganization,
    ]
  );
}

// Fixed for the entire build; no render-time conditional hook selection.
const useLibraryData = import.meta.env.DEV ? useReviewLibraryData : useLiveLibraryData;
