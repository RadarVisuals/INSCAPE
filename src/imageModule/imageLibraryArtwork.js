import { resolveLibraryImageAsset } from '../library/resolveLibraryImageAsset.js';
import { IMAGE_FILL_CROP } from './imageModule.js';

// Both a new Workbench Image and replacement artwork retain the Library source.
// Bento requests a complete, centred image; ordinary canvas insertion keeps Fill.
export async function resolveImageLibraryArtwork(input, decoded, fitInside = false) {
  const asset = await resolveLibraryImageAsset(input, decoded);
  return { id: `artwork:${crypto.randomUUID()}`, asset, crop: fitInside ? null : { ...IMAGE_FILL_CROP },
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
}
