import { useCallback, useMemo, useState } from 'react';
import useOwnerLatticeBrowser from '../public/useOwnerLatticeBrowser.js';
import useOwnerSystemWorkflowDevelopmentAuthorities from '../public/ownerSystemWorkflow/useOwnerSystemWorkflowDevelopmentAuthorities.js';
import {
  decodeOwnerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from '../public/ownerSystemWorkflow/ownerSystemWorkflowAssetDimensions.js';

function assetMap(assets, records) {
  const map = new Map();
  for (const asset of [...assets, ...records]) {
    const id = asset?.stableAssetId || asset?.id;
    if (id) map.set(id, { ...(map.get(id) || {}), ...asset });
  }
  return map;
}

// Profile-level browsing and media resolution. Hosts supply references and a
// destination separately; this hook knows no canvas coordinates or editor.
const EMPTY_REFERENCES = Object.freeze([]);
export default function useProfileLibrary({
  profileAddress,
  libraryOpen,
  referencedAssetIds = EMPTY_REFERENCES,
  usedAssetIds = EMPTY_REFERENCES,
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
    import.meta.env.DEV ? { usedAssetIds, profileAddress, fixtureAssets, reviewAuthorities } : null
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
  { usedAssetIds, profileAddress, fixtureAssets, reviewAuthorities }
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
            usedAssetIds,
          }
        : { ...data, assets: resolvedAssets },
    [
      data,
      usedAssetIds,
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
