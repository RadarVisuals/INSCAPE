import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCollectionTokensStore } from '../creations/state/useCollectionTokensStore.js';
import { createCreationsStore } from '../creations/state/useCreationsStore.js';
import { normalizeProfileAddress } from '../library/config.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
import { adaptLatticeProductionBrowserData } from '../lattice/browser/latticeProductionBrowserAdapter.js';
import { projectLibraryAssetUnion } from '../lattice/browser/libraryAssetUnion.js';
import { createLibraryMetadataDemand } from '../library/data/libraryMetadataDemand.js';

export function createOwnerLatticeCategoryCommands(profileAddress, getStore = useLibraryStore.getState) {
  const profile = normalizeProfileAddress(profileAddress);
  const commit = (command) => getStore().commitCategoryForProfile(profile, command);
  return Object.freeze({
    createCategory: (name) => commit({ name, type: 'create' }),
    deleteCategory: (categoryId) => commit({ categoryId, type: 'delete' }),
    renameCategory: (categoryId, name) => commit({ categoryId, name, type: 'rename' }),
    setCategoryAsset: (categoryId, assetId, value, acceptedAssetIds) => commit({ acceptedAssetIds, assetId, categoryId, type: 'asset', value }),
    setCategoryAssets: (categoryId, assetIds, value, acceptedAssetIds) => commit({ acceptedAssetIds, assetIds, categoryId, type: 'assets', value }),
    setCategoryImage: (categoryId, assetId, url, value, acceptedAssetIds) => commit({ acceptedAssetIds, assetIds: [assetId], categoryId, url, type: 'image', value }),
    setCategoryPublic: (categoryId, value) => commit({ categoryId, type: 'public', value }),
    createSection: (name) => commit({ name, type: 'create-section' }),
    renameSection: (sectionId, name) => commit({ name, sectionId, type: 'rename-section' }),
    deleteSection: (sectionId) => commit({ sectionId, type: 'delete-section' }),
    moveCategory: (categoryId, sectionId = null, beforeId = null) => commit({ beforeId, categoryId, sectionId, type: 'move-category' }),
    moveSection: (sectionId, beforeId = null) => commit({ beforeId, sectionId, type: 'move-section' }),
  });
}

export function canOpenCreatorCollection(profileAddress, collectionRecord) {
  return Boolean(normalizeProfileAddress(profileAddress) && collectionRecord?.isCollection === true);
}

export function retryLibraryForProfile(profileAddress, getStore = useLibraryStore.getState) {
  const profile = normalizeProfileAddress(profileAddress);
  const state = getStore();
  if (!profile || state.profileAddress !== profile
    || normalizeProfileAddress(state.workspace?.profileAddress) !== profile) return false;
  return state.unresolvedAssetIds?.length ? state.repair() : state.load({ forceLive: true });
}

export default function useOwnerLatticeBrowser(profileAddress, inventoryEnabled = true, referencedAssetIds = []) {
  const profile = normalizeProfileAddress(profileAddress);
  const [useRelatedCreationsStore] = useState(() => createCreationsStore({ retainOnRetry: true, pageOnDemand: true }));
  const [useCollectionTokensStore] = useState(() => createCollectionTokensStore());
  const [activeCollection, setActiveCollection] = useState(null);
  const [browse, setBrowse] = useState(null);
  const [categoryLimit, setCategoryLimit] = useState(48);
  const [categoryRead, setCategoryRead] = useState({ key: '', loading: false, error: null });
  const [metadataError, setMetadataError] = useState(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const owned = useLibraryStore();
  const created = useRelatedCreationsStore();
  const collection = useCollectionTokensStore();
  const profileReady = Boolean(profile && owned.profileAddress === profile
    && normalizeProfileAddress(owned.workspace?.profileAddress) === profile);
  const createdReady = created.profileAddress === profile;
  const recordsRef = useRef([]);
  const resolvedReferences = useRef(new Set());
  const [metadata] = useState(() => createLibraryMetadataDemand({ onError: setMetadataError, onBatch(updates) {
    useLibraryStore.getState().updateMetadata(updates);
    useRelatedCreationsStore.getState().updateMetadata(updates);
    useCollectionTokensStore.getState().updateMetadata(updates);
  } }));
  useEffect(() => {
    if (profile) {
      useLibraryStore.getState().setProfileAddress(profile);
      useRelatedCreationsStore.getState().setProfileAddress(profile);
    }
    setActiveCollection(null); setMetadataError(null);
    resolvedReferences.current.clear();
    useCollectionTokensStore.getState().clear();
    return () => metadata.cancel();
  }, [profile, metadata, useRelatedCreationsStore, useCollectionTokensStore]);

  const category = profileReady && browse?.kind === 'category'
    ? owned.workspace.folders.find(folder => folder.id === browse.id) : null;
  const browseKey = browse ? JSON.stringify(browse) : '';
  useEffect(() => {
    if (!inventoryEnabled || !profileReady || !browseKey || browse.profile !== profile || activeCollection) return undefined;
    if (!category) {
      if (browse.relationship !== 'created') void useLibraryStore.getState().load();
      if (browse.relationship !== 'owned') void useRelatedCreationsStore.getState().load(profile);
    }
    return () => {
      useLibraryStore.getState().cancel(); useRelatedCreationsStore.getState().cancel(); metadata.cancel();
    };
  }, [inventoryEnabled, profileReady, profile, browseKey, browse?.profile, browse?.relationship, category, activeCollection, metadata, useRelatedCreationsStore]);
  useEffect(() => () => { useCollectionTokensStore.getState().cancel(); metadata.cancel(); }, [metadata, useCollectionTokensStore]);
  useEffect(() => { if (!inventoryEnabled) { metadata.cancel(); useCollectionTokensStore.getState().cancel(); setActiveCollection(null); } },
    [inventoryEnabled, metadata, useCollectionTokensStore]);

  const categoryKey = category ? category.id + ':' + category.assetIds.slice(0, categoryLimit).join(',') : '';
  const referencesKey = [...new Set(referencedAssetIds)].sort().join(',');
  const resolveReferences = useCallback(async (ids, signal) => {
    ids = ids.filter(id => !resolvedReferences.current.has(id));
    for (let offset = 0; offset < ids.length; offset += 48) {
      signal.throwIfAborted();
      const page = ids.slice(offset, offset + 48);
      await Promise.all([useLibraryStore.getState().loadReferencedAssets(page, { signal }),
        useRelatedCreationsStore.getState().resolveReferencedAssets(profile, page, { signal })]);
      signal.throwIfAborted();
      page.forEach(id => resolvedReferences.current.add(id));
    }
  }, [profile, useRelatedCreationsStore]);
  useEffect(() => {
    if (!profileReady || !createdReady || !referencesKey) return undefined;
    const controller = new AbortController();
    void resolveReferences(referencesKey.split(','), controller.signal).catch(() => {});
    return () => controller.abort();
  }, [profileReady, createdReady, referencesKey, resolveReferences]);
  useEffect(() => {
    if (!inventoryEnabled || !profileReady || !createdReady || !categoryKey) return undefined;
    const controller = new AbortController();
    setCategoryRead({ key: categoryKey, loading: true, error: null });
    // Category IDs are already known; fetch only this category's requested page.
    const ids = category.assetIds.slice(0, categoryLimit);
    void resolveReferences(ids, controller.signal).then(() => {
      if (!controller.signal.aborted) setCategoryRead({ key: categoryKey, loading: false, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setCategoryRead({ key: categoryKey, loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [inventoryEnabled, profileReady, createdReady, categoryKey, category?.assetIds, categoryLimit, resolveReferences, retryVersion]);

  const ownedAssets = useMemo(() => profileReady ? [...owned.assets, ...owned.referencedAssets] : [],
    [profileReady, owned.assets, owned.referencedAssets]);
  const union = useMemo(() => projectLibraryAssetUnion({ profileAddress: profile, ownedAssets,
    createdAssets: createdReady ? [...created.assets, ...created.referencedAssets] : [] }),
  [profile, ownedAssets, createdReady, created.assets, created.referencedAssets]);
  const collectionUnion = useMemo(() => activeCollection ? projectLibraryAssetUnion({ profileAddress: profile,
    createdAssets: [activeCollection, ...collection.assets],
    ownedAssets: ownedAssets.filter(asset => asset.contractAddress === activeCollection.contractAddress) })
    : { assets: [], records: [] }, [profile, activeCollection, collection.assets, ownedAssets]);
  const records = useMemo(() => [...new Map([...union.records, ...collectionUnion.records].map(record => [record.id, record])).values()],
    [union.records, collectionUnion.records]);
  recordsRef.current = records;
  const onMetadataDemand = useCallback(ids => {
    if (!inventoryEnabled || !profileReady) { metadata.cancel(); return; }
    const byId = new Map(recordsRef.current.map(record => [record.id, record]));
    metadata.set(ids.map(id => byId.get(id)).filter(Boolean));
  }, [inventoryEnabled, profileReady, metadata]);
  const onBrowse = useCallback(next => {
    setBrowse(current => {
      const value = { ...next, profile };
      return JSON.stringify(current) === JSON.stringify(value) ? current : value;
    });
  }, [profile]);
  useEffect(() => { setCategoryLimit(48); }, [browse?.id, profile]);
  const openCollection = record => {
    if (!canOpenCreatorCollection(profile, record)) return false;
    metadata.cancel(); setActiveCollection(record);
    void useCollectionTokensStore.getState().load(profile, record);
    return true;
  };
  const adapted = useMemo(() => adaptLatticeProductionBrowserData({ assets: ownedAssets, profileAddress: profile,
    workspace: profileReady ? owned.workspace : null, status: owned.status, progress: owned.progress,
    error: owned.error || owned.liveError }), [ownedAssets, profile, profileReady, owned.workspace, owned.status, owned.progress, owned.error, owned.liveError]);
  const hasMore = activeCollection ? collection.hasMore : category ? categoryLimit < category.assetIds.length
    : (browse?.relationship !== 'created' && owned.hasMore) || (browse?.relationship !== 'owned' && created.hasMore);
  const loading = activeCollection ? collection.status === 'loading' : category ? categoryRead.key !== categoryKey || categoryRead.loading
    : owned.status === 'loading' || created.status === 'loading';
  const data = {
    ...adapted, workspaceReady: profileReady, assets: activeCollection ? collectionUnion.assets.map(asset => ({ ...asset,
      collectionRole: asset.stableAssetId === activeCollection.id ? 'cover' : 'token' })) : union.assets,
    status: activeCollection ? collection.status : category ? loading ? 'loading' : categoryRead.error ? 'error' : 'ready' : owned.status,
    error: (activeCollection ? collection.error : category ? categoryRead.error : adapted.assetError) || metadataError,
    progress: activeCollection ? collection.progress : adapted.assetProgress,
    hasMore, loadingMore: loading, inventoryComplete: !hasMore && !loading,
    onMetadataDemand, onBrowse,
    onLoadMore: () => {
      if (loading) return;
      if (activeCollection) return useCollectionTokensStore.getState().loadMore();
      if (category) return setCategoryLimit(limit => limit + 48);
      return Promise.all([browse?.relationship !== 'created' && useLibraryStore.getState().loadMore(),
        browse?.relationship !== 'owned' && useRelatedCreationsStore.getState().loadMore()]);
    },
    onOpenCollection: openCollection,
    onRetry: () => {
      setMetadataError(null); metadata.retry();
      if (category) { resolvedReferences.current.clear(); return setRetryVersion(value => value + 1); }
      if (!metadataError) return retryLibraryForProfile(profile);
    },
    createdStatus: category || activeCollection ? 'ready' : created.status,
    createdError: category || activeCollection ? null : created.error || created.liveError,
    createdProgress: created.progress, createdRetained: Boolean(created.assets.length),
    onRetryCreated: created.retry,
    persistenceError: profileReady ? owned.persistenceError : null,
    ...(activeCollection ? { categories: [], categoryOrganization: { rootCategoryIds: [], sections: [] },
      collectionContext: { address: activeCollection.contractAddress, name: activeCollection.name, ...collection.progress },
      onCloseCollection: () => { metadata.cancel(); collection.cancel(); setActiveCollection(null); },
      onRetryCollection: () => { setMetadataError(null); metadata.retry(); return collection.retry(activeCollection); } } : {}),
  };
  const commands = useMemo(() => {
    const base = createOwnerLatticeCategoryCommands(profile);
    const accepted = union.assets.map(asset => asset.stableAssetId);
    return { ...base, setCategoryAsset: (id, asset, value) => base.setCategoryAsset(id, asset, value, accepted),
      setCategoryAssets: (id, assets, value) => base.setCategoryAssets(id, assets, value, accepted),
      setCategoryImage: (id, asset, url, value) => base.setCategoryImage(id, asset, url, value, accepted) };
  }, [profile, union.assets]);
  return { data, records, commands: profileReady && !activeCollection ? commands : null, retryCreated: created.retry };
}
