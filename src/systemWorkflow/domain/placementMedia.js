import { isValidPublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';

export function isValidPlacementMedia(media) {
  return Boolean(media && typeof media === 'object' && !Array.isArray(media)
    && Object.keys(media).length === 3 && ['url', 'width', 'height'].every((key) => Object.hasOwn(media, key))
    && isValidPublishedAssetUrl(media.url)
    && [media.width, media.height].every((value) => value === null || Number.isSafeInteger(value) && value > 0));
}

export function assetForPlacement(asset, placement) {
  const media = placement?.selectedMedia;
  if (!media || !asset) return asset;
  if (!isValidPlacementMedia(media)) throw new TypeError('Invalid placement image');
  return { ...asset, selectedMedia: media, contentReference: undefined, mediaType: 'image',
    decodedImageSource: undefined, decodedImageWidth: undefined, decodedImageHeight: undefined,
    previewSrc: media.url, src: media.url, originalImageUrl: media.url,
    imageUrl: media.url, thumbnailUrl: media.url, previewCandidates: [media.url],
    imageWidth: media.width, imageHeight: media.height, width: media.width, height: media.height };
}
