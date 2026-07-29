import { validateLatticeProductionPublicAssetReference } from '../domain/latticeProductionPublication.js';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';

export const LATTICE_PRODUCTION_MEDIA_STATUS = Object.freeze({
  READY: 'ready',
  UNSUPPORTED: 'unsupported',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

export function adaptLatticeProductionMedia(asset, options) {
  if (!validateLatticeProductionPublicAssetReference(asset)) {
    return Object.freeze({ status: LATTICE_PRODUCTION_MEDIA_STATUS.INVALID, label: 'Artwork unavailable' });
  }
  const label = asset.name.trim() || asset.stableAssetId;
  if (!['image', 'animation'].includes(asset.media.type)) {
    return Object.freeze({ status: LATTICE_PRODUCTION_MEDIA_STATUS.UNSUPPORTED, label, stableAssetId: asset.stableAssetId });
  }
  const src = resolvePublishedAssetUrl(asset.media.url, options);
  if (!src) return Object.freeze({
    status: LATTICE_PRODUCTION_MEDIA_STATUS.UNAVAILABLE,
    label,
    stableAssetId: asset.stableAssetId,
  });
  const dimensions = Number.isSafeInteger(asset.media.width) && asset.media.width > 0
    && Number.isSafeInteger(asset.media.height) && asset.media.height > 0
    ? Object.freeze({ width: asset.media.width, height: asset.media.height })
    : null;
  return Object.freeze({
    status: LATTICE_PRODUCTION_MEDIA_STATUS.READY,
    dimensions,
    label,
    src,
    stableAssetId: asset.stableAssetId,
  });
}
