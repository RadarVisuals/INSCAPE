import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import { createProductionIdentityDossierViewModel } from '../../public/identity/productionIdentityDossierViewModel.js';

function publishedAvatarAsset(identityPresentation) {
  const asset = identityPresentation?.avatar?.mode === 'inscape' ? identityPresentation.avatar.asset : null;
  const imageUrl = resolvePublishedAssetUrl(asset?.media?.url);
  if (!asset?.stableAssetId || !imageUrl) return [];
  return [{
    id: asset.stableAssetId,
    imageUrl,
    originalImageUrl: imageUrl,
    thumbnailUrl: imageUrl,
  }];
}

export function createPublishedIdentityRackViewModel({ contractFacts, document, identity, locationLike = globalThis.location } = {}) {
  if (!document?.lattice?.identityPresentation) return null;
  const publishedPresentation = document.lattice.identityPresentation;
  const identityPresentation = {
    ...publishedPresentation,
    avatar: {
      mode: publishedPresentation.avatar.mode,
      shape: publishedPresentation.avatar.shape,
      stableAssetId: publishedPresentation.avatar.asset?.stableAssetId || null,
    },
  };
  return createProductionIdentityDossierViewModel({
    assetRecords: publishedAvatarAsset(publishedPresentation),
    cachedIdentity: document.profile.cachedIdentity,
    contractFacts,
    identity,
    identityPresentation,
    locationLike,
    presentationScope: 'published',
    publishedResolution: { status: 'RESOLVED', document },
  });
}
