import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { decodeOwnerSystemWorkflowAssetDimensions } from '../public/ownerSystemWorkflow/ownerSystemWorkflowAssetDimensions.js';

// Canonical source metadata belongs to Library; each receiving module adds its
// own placement/behavior only after resolution. No cache or extra saved copy.
export async function resolveLibraryImageAsset(input, decoded) {
  const id = input.stableAssetId || input.id;
  let asset = createProfileDocumentV9AssetResolver([{ ...(input.assetRecord || input), id }], { compactContentReference: false })(id, input.selectedMedia);
  if (asset.media.type !== 'image' || !asset.media.url) throw new Error('Choose a Library image.');
  if (!asset.media.width || !asset.media.height) {
    const src = resolvePublishedAssetUrl(asset.media.url);
    const dimensions = decoded?.source === src || decoded?.source === asset.media.url
      ? decoded : await decodeOwnerSystemWorkflowAssetDimensions({ src });
    if (!dimensions) throw new Error('The artwork dimensions could not be read. Try dropping the image again.');
    asset = { ...asset, media: { ...asset.media, width: dimensions.width, height: dimensions.height } };
  }
  return asset;
}
