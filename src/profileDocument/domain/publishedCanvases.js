import { hasAllowedKeys } from '../../recordValidation.js';
import { FIRST_WORKBENCH_ID, MAX_WORKBENCHES, assertWorkbenchName, assertWorkbenchIntroduction, assertThumbnailCrop } from '../../systemWorkflow/domain/workbenchCollection.js';

// The root is the entry canvas. Additional canvases contain composition facts
// only; profile identity, and Keeper have one owner at the root.
const REQUIRED_CANVAS_KEYS = ['artboard', 'geometry', 'appearance', 'grids'];
const OPTIONAL_CANVAS_KEYS = ['workbench', 'displays', 'texts', 'imageModules', 'shapes', 'workbenchGroups', 'workbenchIndex', 'artworkLayers', 'composition'];
export const CANVAS_CONTENT_KEYS = [...REQUIRED_CANVAS_KEYS, ...OPTIONAL_CANVAS_KEYS];
export function canvasContent(document) {
  const content = Object.fromEntries(CANVAS_CONTENT_KEYS.filter(key => Object.hasOwn(document, key)).map(key => [key, structuredClone(document[key])]));
  delete content.appearance.menuSurfaceId;
  return content;
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
export function publishedCompositionEntries(document, destination) {
  const entries = publishedCanvasEntries(document).map(item => ({ ...item, destinations: item.destinations || ['gallery'] }));
  if (document.reception) entries.push({ id: 'reception', name: 'Bento', reception: document.reception,
    destinations: document.receptionDestinations || ['profile'] });
  return destination ? entries.filter(item => item.destinations.includes(destination)) : entries;
}
export function canvasDocument(document, entry) {
  const shared = Object.fromEntries(Object.entries(document).filter(([key]) => !CANVAS_CONTENT_KEYS.includes(key) && !['canvas', 'canvases', 'reception', 'receptionDestinations'].includes(key)));
  return { ...shared, ...entry.content, appearance: { ...entry.content.appearance } };
}
export function validatePublishedCanvases(document, validate, fail) {
  if (!Object.hasOwn(document, 'canvas') && !Object.hasOwn(document, 'canvases')) return;
  if (document.canvas === null) {
    // A Profile may have no named compositions, including after removing its last work.
    if (!Array.isArray(document.canvases) || document.canvases.length
      || document.grids?.length
      || OPTIONAL_CANVAS_KEYS.some(key => Object.hasOwn(document, key)))
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
        || !REQUIRED_CANVAS_KEYS.every(key => Object.hasOwn(content, key))
        || Object.hasOwn(content.appearance || {}, 'menuSurfaceId')) throw new Error('Invalid canvas content');
      const result = validate(canvasDocument(document, entry));
      result.errors.forEach(error => fail(`canvases.${entry.id}.${error.path}`, error.code, error.message));
    } catch (error) { fail('canvases', 'invalid_canvas', error.message); }
  }
}
