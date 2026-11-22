import { useEffect, useMemo, useState } from 'react';
import useProfileLibrary from '../../library/useProfileLibrary.js';

// Workbench contributes only its reference inventory. Library data, source
// resolution and category commands are shared with other profile editors.
export default function useOwnerWorkbenchLibrary({ draft, workbenchLayout, selectedGrid, ...options }) {
  const referencedAssetIds = useMemo(() => [
    ...[...draft.grids, ...(draft.displays || []).flatMap(module => module.grids)]
      .flatMap(grid => grid.placements.map(({ stableAssetId }) => stableAssetId)),
    ...(draft.identityPresentation.avatar.mode === 'inscape' && draft.identityPresentation.avatar.stableAssetId
      ? [draft.identityPresentation.avatar.stableAssetId] : []),
    ...[workbenchLayout.display, ...(draft.workbench?.displays || []), ...(workbenchLayout.displays || [])]
      .map(display => display.shortcut.icon?.stableAssetId).filter(Boolean),
  ], [draft.grids, draft.displays, draft.identityPresentation.avatar, draft.workbench, workbenchLayout]);
  const usedAssetIds = useMemo(() => selectedGrid?.placements.map(({ stableAssetId }) => stableAssetId) || [], [selectedGrid]);
  // A restored open dock is presentation state, not a request to enumerate a profile.
  const {profileAddress, libraryOpen} = options;
  const [browseProfile, setBrowseProfile] = useState(() => libraryOpen ? null : profileAddress);
  useEffect(() => { if (!libraryOpen) setBrowseProfile(profileAddress); }, [libraryOpen, profileAddress]);
  const enabled = browseProfile === profileAddress;
  const library = useProfileLibrary({ ...options, libraryOpen:libraryOpen && enabled, referencedAssetIds, usedAssetIds });
  if (enabled || !libraryOpen || import.meta.env.DEV && options.reviewAssets) return library;
  return {...library, libraryData:{...library.libraryData, onLoadInventory:() => setBrowseProfile(profileAddress)}};
}
