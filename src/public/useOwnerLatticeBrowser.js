import { useEffect, useMemo, useState } from 'react';
import { createCollectionTokensStore } from '../creations/state/useCollectionTokensStore.js';
import { createCreationsStore } from '../creations/state/useCreationsStore.js';
import { normalizeProfileAddress } from '../library/config.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
import { adaptLatticeProductionBrowserData } from '../lattice/browser/latticeProductionBrowserAdapter.js';
import { projectLibraryAssetUnion } from '../lattice/browser/libraryAssetUnion.js';

export function createOwnerLatticeCategoryCommands(profileAddress, getStore = useLibraryStore.getState) {
  const profile = normalizeProfileAddress(profileAddress);
  const commit = (command) => getStore().commitCategoryForProfile(profile, command);
  return Object.freeze({
    createCategory: (name) => commit({ name, type: 'create' }),
    deleteCategory: (categoryId) => commit({ categoryId, type: 'delete' }),
    renameCategory: (categoryId, name) => commit({ categoryId, name, type: 'rename' }),
    setCategoryAsset: (categoryId, assetId, value, acceptedAssetIds) => commit({ acceptedAssetIds, assetId, categoryId, type: 'asset', value }),
    setCategoryAssets: (categoryId, assetIds, value, acceptedAssetIds) => commit({ acceptedAssetIds, assetIds, categoryId, type: 'assets', value }),
    setCategoryPublic: (categoryId, value) => commit({ categoryId, type: 'public', value }),
    createSection: (name) => commit({ name, type: 'create-section' }),
    renameSection: (sectionId, name) => commit({ name, sectionId, type: 'rename-section' }),
    deleteSection: (sectionId) => commit({ sectionId, type: 'delete-section' }),
    moveCategory: (categoryId, sectionId = null, beforeId = null) => commit({ beforeId, categoryId, sectionId, type: 'move-category' }),
    moveSection: (sectionId, beforeId = null) => commit({ beforeId, sectionId, type: 'move-section' }),
  });
}

export default function useOwnerLatticeBrowser(profileAddress, inventoryEnabled = true, referencedAssetIds = []) {
  const profile = normalizeProfileAddress(profileAddress);
  const [useRelatedCreationsStore] = useState(() => createCreationsStore({ retainOnRetry: true }));
  const [useCollectionTokensStore] = useState(() => createCollectionTokensStore());
  const [activeCollection, setActiveCollection] = useState(null);
  const storeProfileAddress = useLibraryStore((state) => state.profileAddress);
  const workspace = useLibraryStore((state) => state.workspace);
  const assets = useLibraryStore((state) => state.assets);
  const status = useLibraryStore((state) => state.status);
  const progress = useLibraryStore((state) => state.progress);
  const error = useLibraryStore((state) => state.error || state.liveError);
  const setProfileAddress = useLibraryStore((state) => state.setProfileAddress);
  const load = useLibraryStore((state) => state.load);
  const createdAssets = useRelatedCreationsStore((state) => state.assets);
  const referencedAssets = useRelatedCreationsStore((state) => state.referencedAssets);
  const createdProfileAddress = useRelatedCreationsStore((state) => state.profileAddress);
  const createdStatus = useRelatedCreationsStore((state) => state.status);
  const createdProgress = useRelatedCreationsStore((state) => state.progress);
  const createdError = useRelatedCreationsStore((state) => state.error || state.liveError);
  const loadCreated = useRelatedCreationsStore((state) => state.load);
  const retryCreated = useRelatedCreationsStore((state) => state.retry);
  const resolveReferencedAssets = useRelatedCreationsStore((state) => state.resolveReferencedAssets);
  const cancelCreated = useRelatedCreationsStore((state) => state.cancel);
  const collectionTokens = useCollectionTokensStore((state) => state.assets);
  const collectionStatus = useCollectionTokensStore((state) => state.status);
  const collectionProgress = useCollectionTokensStore((state) => state.progress);
  const collectionError = useCollectionTokensStore((state) => state.error);
  const loadCollectionTokens = useCollectionTokensStore((state) => state.load);
  const retryCollectionTokens = useCollectionTokensStore((state) => state.retry);
  const cancelCollectionTokens = useCollectionTokensStore((state) => state.cancel);
  const clearCollectionTokens = useCollectionTokensStore((state) => state.clear);
  const profileReady = Boolean(profile
    && storeProfileAddress === profile
    && normalizeProfileAddress(workspace?.profileAddress) === profile);
  const createdProfileReady = Boolean(profile && createdProfileAddress === profile);

  useEffect(() => {
    if (profile) setProfileAddress(profile);
  }, [profile, setProfileAddress]);

  useEffect(() => {
    if (inventoryEnabled && profileReady && status === 'idle') load();
  }, [inventoryEnabled, load, profileReady, status]);

  useEffect(() => {
    if (inventoryEnabled && profileReady && (!createdProfileReady || createdStatus === 'idle')) loadCreated(profile);
  }, [createdProfileReady, createdStatus, inventoryEnabled, loadCreated, profile, profileReady]);
  const referencedAssetKey = [...new Set(referencedAssetIds)].sort().join(',');
  useEffect(() => {
    if (profileReady && referencedAssetKey) resolveReferencedAssets(profile, referencedAssetKey.split(','));
  }, [profile, profileReady, referencedAssetKey, resolveReferencedAssets]);
  useEffect(() => () => cancelCreated(), [cancelCreated]);
  useEffect(() => () => cancelCollectionTokens(), [cancelCollectionTokens]);
  useEffect(() => {
    setActiveCollection(null);
    clearCollectionTokens();
  }, [clearCollectionTokens, profile]);

  const adaptedData = useMemo(() => adaptLatticeProductionBrowserData({
    assets: profileReady ? assets : [],
    error: profileReady ? error : null,
    profileAddress: profile,
    progress: profileReady ? progress : null,
    status: profileReady ? status : 'idle',
    workspace: profileReady ? workspace : null,
  }), [assets, error, profile, profileReady, progress, status, workspace]);
  const union = useMemo(() => projectLibraryAssetUnion({
    createdAssets: createdProfileReady ? createdAssets : [],
    ownedAssets: profileReady ? assets : [],
    profileAddress: profile,
  }), [assets, createdAssets, createdProfileReady, profile, profileReady]);
  const collectionUnion = useMemo(() => activeCollection ? projectLibraryAssetUnion({
    createdAssets: [activeCollection, ...collectionTokens],
    ownedAssets: (profileReady ? assets : []).filter(({ contractAddress }) => contractAddress === activeCollection.contractAddress),
    profileAddress: profile,
  }) : { assets: [], records: [] }, [activeCollection, assets, collectionTokens, profile, profileReady]);
  const collectionAssets = useMemo(() => collectionUnion.assets.map((asset) => ({
    ...asset,
    collectionRole: asset.stableAssetId === activeCollection?.id ? 'cover' : 'token',
  })).sort((left, right) => Number(right.collectionRole === 'cover') - Number(left.collectionRole === 'cover')),
  [activeCollection?.id, collectionUnion.assets]);
  const unionData = useMemo(() => Object.freeze({
    ...adaptedData,
    assets: union.assets,
    error: adaptedData.assetError,
    progress: adaptedData.assetProgress,
    status: adaptedData.assetLoadState,
    createdError: createdProfileReady ? createdError : null,
    createdProgress: createdProfileReady ? createdProgress : { failures: 0, resolved: 0, total: 0 },
    createdRetained: Boolean(createdProfileReady && createdError && createdAssets.length),
    createdStatus: createdProfileReady ? createdStatus : 'idle',
    onRetryCreated: retryCreated,
  }), [adaptedData, createdAssets.length, createdError, createdProfileReady, createdProgress, createdStatus, union.assets]);
  const closeCollection = () => { cancelCollectionTokens(); setActiveCollection(null); };
  const openCollection = (collectionRecord) => {
    if (!profileReady || collectionRecord?.isCollection !== true) return false;
    setActiveCollection(collectionRecord);
    loadCollectionTokens(profile, collectionRecord);
    return true;
  };
  const collectionData = activeCollection ? Object.freeze({
    ...adaptedData,
    assets: collectionAssets,
    categories: [],
    categoryOrganization: { rootCategoryIds: [], sections: [] },
    collectionContext: {
      address: activeCollection.contractAddress,
      name: activeCollection.name,
      resolved: collectionProgress.resolved,
      total: collectionProgress.total,
    },
    createdError: null,
    createdStatus: 'ready',
    error: collectionError,
    onCloseCollection: closeCollection,
    onOpenCollection: openCollection,
    onRetryCollection: () => retryCollectionTokens(activeCollection),
    progress: collectionProgress,
    status: collectionStatus,
  }) : null;
  const commands = useMemo(() => {
    const base = createOwnerLatticeCategoryCommands(profile);
    const acceptedAssetIds = union.assets.map(({ stableAssetId }) => stableAssetId);
    return Object.freeze({
      ...base,
      setCategoryAsset: (categoryId, assetId, value) => base.setCategoryAsset(categoryId, assetId, value, acceptedAssetIds),
      setCategoryAssets: (categoryId, assetIds, value) => base.setCategoryAssets(categoryId, assetIds, value, acceptedAssetIds),
    });
  }, [profile, union.assets]);
  const referencedUnion = useMemo(() => projectLibraryAssetUnion({
    createdAssets: createdProfileReady ? referencedAssets : [],
    ownedAssets: profileReady ? assets : [],
    profileAddress: profile,
  }), [assets, createdProfileReady, profile, profileReady, referencedAssets]);
  const records = useMemo(() => [...new Map([...union.records, ...referencedUnion.records, ...collectionUnion.records]
    .map((record) => [record.id, record])).values()], [collectionUnion.records, referencedUnion.records, union.records]);
  return { commands: profileReady && !activeCollection ? commands : null,
    data: collectionData || unionData, records, retryCreated };
}
