import { useMemo } from 'react';
import useProfileLibrary from '../../library/useProfileLibrary.js';

// Workbench contributes only its reference inventory. Library data, source
// resolution and category commands are shared with other profile editors.
export default function useOwnerWorkbenchLibrary({ draft, ...options }) {
  const avatar = draft.identityPresentation.avatar;
  const referencedAssetIds = useMemo(() =>
    avatar.mode === 'inscape' && avatar.stableAssetId ? [avatar.stableAssetId] : [], [avatar]);
  return useProfileLibrary({ ...options, curatedPicker: true, referencedAssetIds });
}
