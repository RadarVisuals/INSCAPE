import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { decodeOwnerSystemWorkflowAssetDimensions } from '../public/ownerSystemWorkflow/ownerSystemWorkflowAssetDimensions.js';

// Both a new Workbench Image and an existing side retain the same Library source.
export async function resolveImageLibrarySide(input, decoded) {
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
  return { id: `side:${crypto.randomUUID()}`, asset, crop: { x: .5, y: .5, zoom: 1 },
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
}
