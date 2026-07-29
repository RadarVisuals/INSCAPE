import { useEffect, useMemo } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
import { adaptLatticeProductionBrowserData } from '../lattice/browser/latticeProductionBrowserAdapter.js';

export default function useOwnerLatticeBrowser(profileAddress, open) {
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
    if (open && profileReady && status === 'idle') load();
  }, [load, open, profileReady, status]);

  return useMemo(() => adaptLatticeProductionBrowserData({
    assets: profileReady ? assets : [],
    error: profileReady ? error : null,
    profileAddress: profile,
    progress: profileReady ? progress : null,
    status: profileReady ? status : 'idle',
    workspace: profileReady ? workspace : null,
  }), [assets, error, profile, profileReady, progress, status, workspace]);
}
