import { COMPOSITION_LAYOUT_KEYS } from '../../composition/compositionEditorDocument.js';
import { hasAllowedKeys } from '../../recordValidation.js';
import { FIRST_WORKBENCH_ID, MAX_WORKBENCHES, assertWorkbenchName, assertWorkbenchIntroduction, assertThumbnailCrop } from '../../systemWorkflow/domain/workbenchCollection.js';

// The root is the entry canvas. Additional canvases contain composition facts
// only; profile identity, and Keeper have one owner at the root.
export const CANVAS_CONTENT_KEYS = ['workbench', 'texts', 'imageModules', 'shapes', 'workbenchGroups', 'workbenchIndex', 'artworkLayers', 'composition', ...COMPOSITION_LAYOUT_KEYS];
export function canvasContent(document) {
  return Object.fromEntries(CANVAS_CONTENT_KEYS.filter(key => Object.hasOwn(document, key)).map(key => [key, structuredClone(document[key])]));
}
export function canvasDetails(item) {
  return { id: item.id, name: item.name, introduction: item.introduction || '', thumbnailCrop: item.thumbnailCrop || null,
    ...(item.destinations ? { destinations: item.destinations } : {}) };
}
export function publishedCanvasEntries(document) {
  if (document.canvas === null) return [];
  return [{ ...canvasDetails(document.canvas || { id: FIRST_WORKBENCH_ID, name: 'Canvas' }), content: canvasContent(document) }, ...(document.canvases || [])];
}
export const publicationDestinations = Object.freeze(['gallery', 'profile']);
export function validPublicationDestinations(value) {
  return Array.isArray(value) && value.length > 0 && value.length <= publicationDestinations.length
    && value.every((target, index) => publicationDestinations.includes(target) && value.indexOf(target) === index);
}
// Read placement from publication metadata without cloning any artwork into Studio.
export function publishedCompositionDestinations(document, id) {
  if (document.canvas === null) return [];
  const first = document.canvas || { id: FIRST_WORKBENCH_ID };
  const entry = first.id === id ? first : document.canvases?.find(item => item.id === id);
  return entry ? entry.destinations || ['gallery'] : [];
}

// A receipt recovered after reload has no Studio selection. Use the placements
// in its verified document. A details-only Studio publication opens Profile.
export function publicationViewDestination(document, selectedIds) {
  const ids = selectedIds ?? [
    ...(document.canvas === null ? [] : [document.canvas?.id || FIRST_WORKBENCH_ID]),
    ...(document.canvases || []).map(entry => entry.id),
  ];
  return ids.some(id => {
    const placements = publishedCompositionDestinations(document, id);
    return placements.includes('gallery') && !placements.includes('profile');
  }) ? 'gallery' : 'profile';
}

export function publishedCompositionEntries(document, destination) {
  const entries = publishedCanvasEntries(document).map(item => ({ ...item, destinations: item.destinations || ['gallery'] }));
  return destination ? entries.filter(item => item.destinations.includes(destination)) : entries;
}
export function canvasDocument(document, entry) {
  const shared = Object.fromEntries(Object.entries(document).filter(([key]) => !CANVAS_CONTENT_KEYS.includes(key) && !['canvas', 'canvases'].includes(key)));
  return { ...shared, ...entry.content };
}
export function validatePublishedCanvases(document, validate, fail) {
  if (!Object.hasOwn(document, 'canvas') && !Object.hasOwn(document, 'canvases')) return;
  if (document.canvas === null) {
    // A Profile may have no named compositions, including after removing its last work.
    if (!Array.isArray(document.canvases) || document.canvases.length
      || CANVAS_CONTENT_KEYS.some(key => Object.hasOwn(document, key)))
      fail('canvas', 'invalid_canvas', 'A publication with no named compositions cannot contain canvas artwork.');
    return;
  }
  const details = value => {
    if (!hasAllowedKeys(value, ['id', 'name', 'introduction', 'thumbnailCrop'], ['destinations'])
      || Object.hasOwn(value, 'destinations') && !validPublicationDestinations(value.destinations)
      || !/^workbench:[A-Za-z0-9_-]{1,80}$/u.test(value.id)) throw new Error('Invalid canvas identity');
    assertWorkbenchName(value.name); assertWorkbenchIntroduction(value.introduction); assertThumbnailCrop(value.thumbnailCrop);
  };
  try { details(document.canvas); } catch (error) { fail('canvas', 'invalid_canvas', error.message); }
  if (!Array.isArray(document.canvases) || document.canvases.length >= MAX_WORKBENCHES) {
    fail('canvases', 'invalid_canvases', `Publish at most ${MAX_WORKBENCHES} canvases`); return;
  }
  const ids = new Set([document.canvas?.id]);
  for (const entry of document.canvases) {
    try {
      const { content, ...info } = entry;
      details(info);
      if (ids.has(entry.id)) throw new Error('Duplicate canvas');
      ids.add(entry.id);
      if (!content || typeof content !== 'object' || Object.keys(content).some(key => !CANVAS_CONTENT_KEYS.includes(key))
        || Object.hasOwn(content.appearance || {}, 'menuSurfaceId')) throw new Error('Invalid canvas content');
      const result = validate(canvasDocument(document, entry));
      result.errors.forEach(error => fail(`canvases.${entry.id}.${error.path}`, error.code, error.message));
    } catch (error) { fail('canvases', 'invalid_canvas', error.message); }
  }
}
