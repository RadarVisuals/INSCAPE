import { useMemo } from 'react';
import { useProfileIdentity } from '../profileIdentity/state/useProfileIdentity.js';
import { createProductionIdentityDossierViewModel } from '../public/identity/productionIdentityDossierViewModel.js';
import useProfileLibrary from '../library/useProfileLibrary.js';
import { receptionDisplayAssetIds } from '../presentation/presentationSources.js';

// Editor-only live Library resolution; the saved reader uses embedded media.
export default function useReceptionContent({ draft, reception, collection, libraryOpen = false, reviewAssets, reviewCategories, reviewProfile, publishedDocument }) {
  const identity = useProfileIdentity(draft.profileAddress);
  const referencedAssetIds = useMemo(() => [...new Set([draft.identityPresentation.avatar.stableAssetId,
    ...reception.imageModules.flatMap(image => image.sides.map(side => side.asset.id)), ...receptionDisplayAssetIds(collection, reception)].filter(Boolean))], [draft.identityPresentation.avatar, reception, collection]);
  const library = useProfileLibrary({ profileAddress: draft.profileAddress, libraryOpen, reviewAssets, reviewCategories, referencedAssetIds });
  const model = useMemo(() => createProductionIdentityDossierViewModel({ identity: reviewProfile || identity,
    identityPresentation: draft.identityPresentation, assetRecords: library.canonicalRecords, cachedIdentity: publishedDocument?.profile.cachedIdentity }),
  [identity, reviewProfile, draft.identityPresentation, library.canonicalRecords, publishedDocument]);
  return { library, model };
}
