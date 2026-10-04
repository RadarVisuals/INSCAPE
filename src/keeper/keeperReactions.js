// This small vocabulary is shared by the local model gateway and the character.
// Model output never becomes code, selectors, coordinates or Workbench edits.
import { keeperMetadataReference } from './keeperMetadata.js';
export const KEEPER_GESTURES = Object.freeze(['none', 'curious', 'startled', 'approach', 'retreat']);
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';

export function keeperReactionContext(value) {
  if (!value || typeof value !== 'object') return null;
  const seen = new Set();
  return { gestures: value.gestures === true, layered: value.layered === true, reducedMotion: value.reducedMotion === true,
    pointer: value.pointer === true,
    artworks: (Array.isArray(value.artworks) ? value.artworks : []).slice(0, 8).flatMap(item => {
      if (!item || !/^art-[1-8]$/.test(item.id) || seen.has(item.id)) return [];
      seen.add(item.id);
      const metadata = keeperMetadataReference(item.metadata?.stableAssetId, item.metadata?.tokenStandard);
      return [{ id: item.id, title: text(item.title, 120), direction: text(item.direction, 30), distance: item.distance === 'near' ? 'near' : 'far', ...(metadata && { metadata }) }];
    }) };
}

export function keeperReaction(value, context) {
  if (!value || !KEEPER_GESTURES.includes(value.gesture) || typeof value.target !== 'string') return null;
  if (value.gesture === 'none') return { gesture: 'none', target: 'none' };
  if (!context?.gestures || context.reducedMotion) return null;
  if (['curious', 'startled'].includes(value.gesture)) return value.target === 'none' ? { gesture: value.gesture, target: 'none' } : null;
  if (value.target === 'pointer' ? context.pointer : context.artworks.some(item => item.id === value.target))
    return { gesture: value.gesture, target: value.target };
  return null;
}
