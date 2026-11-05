import { resolveLibraryImageAsset } from '../library/resolveLibraryImageAsset.js';
import { IMAGE_FILL_CROP } from './imageModule.js';

// Both a new Workbench Image and an existing side retain the same Library source.
// Bento requests a complete, centred image; ordinary canvas insertion keeps Fill.
export async function resolveImageLibrarySide(input, decoded, fitInside = false) {
  const asset = await resolveLibraryImageAsset(input, decoded);
  return { id: `side:${crypto.randomUUID()}`, asset, crop: fitInside ? null : { ...IMAGE_FILL_CROP },
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
}
