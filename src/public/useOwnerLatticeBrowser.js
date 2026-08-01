import { useEffect, useMemo } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
import { adaptLatticeProductionBrowserData } from '../lattice/browser/latticeProductionBrowserAdapter.js';

export function createOwnerLatticeCategoryCommands(profileAddress, getStore = useLibraryStore.getState) {
  const profile = normalizeProfileAddress(profileAddress);
  const commit = (command) => getStore().commitCategoryForProfile(profile, command);
  return Object.freeze({
    createCategory: (name) => commit({ name, type: 'create' }),
    deleteCategory: (categoryId) => commit({ categoryId, type: 'delete' }),
    renameCategory: (categoryId, name) => commit({ categoryId, name, type: 'rename' }),
    setCategoryAsset: (categoryId, assetId, value) => commit({ assetId, categoryId, type: 'asset', value }),
    setCategoryAssets: (categoryId, assetIds, value) => commit({ assetIds, categoryId, type: 'assets', value }),
    setCategoryPublic: (categoryId, value) => commit({ categoryId, type: 'public', value }),
  });
}

export default function useOwnerLatticeBrowser(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  const storeProfileAddress = useLibraryStore((state) => state.profileAddress);
  const workspace = useLibraryStore((state) => state.workspace);
  const assets = useLibraryStore((state) => state.assets);
  const status = useLibraryStore((state) => state.status);
  const progress = useLibraryStore((state) => state.progress);
  const error = useLibraryStore((state) => state.error || state.liveError);
  const setProfileAddress = useLibraryStore((state) => state.setProfileAddress);
  const load = useLibraryStore((state) => state.load);
  const profileReady = Boolean(profile
    && storeProfileAddress === profile
    && normalizeProfileAddress(workspace?.profileAddress) === profile);

  useEffect(() => {
    if (profile) setProfileAddress(profile);
  }, [profile, setProfileAddress]);

  useEffect(() => {
    if (profileReady && status === 'idle') load();
  }, [load, profileReady, status]);

  const data = useMemo(() => adaptLatticeProductionBrowserData({
    assets: profileReady ? assets : [],
    error: profileReady ? error : null,
    profileAddress: profile,
    progress: profileReady ? progress : null,
    status: profileReady ? status : 'idle',
    workspace: profileReady ? workspace : null,
  }), [assets, error, profile, profileReady, progress, status, workspace]);
  const commands = useMemo(() => createOwnerLatticeCategoryCommands(profile), [profile]);
  return { commands: profileReady ? commands : null, data };
}
