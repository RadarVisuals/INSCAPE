import { FIRST_WORKBENCH_ID, MAX_WORKBENCHES, assertWorkbenchName, assertWorkbenchIntroduction, assertThumbnailCrop } from '../../systemWorkflow/domain/workbenchCollection.js';

// The root is the entry canvas. Additional canvases contain composition facts
// only; profile identity, Keeper and menu appearance have one owner at the root.
export const CANVAS_CONTENT_KEYS = ['artboard', 'geometry', 'appearance', 'grids', 'metadata', 'workbench', 'displays', 'miniApps', 'texts', 'imageModules', 'shapes', 'workbenchGroups', 'workbenchIndex', 'artworkLayers'];
export function canvasContent(document) {
  const content = Object.fromEntries(CANVAS_CONTENT_KEYS.filter(key => Object.hasOwn(document, key)).map(key => [key, structuredClone(document[key])]));
  delete content.appearance.menuSurfaceId;
  return content;
}
export function canvasDetails(item) {
  return { id: item.id, name: item.name, introduction: item.introduction || '', thumbnailCrop: item.thumbnailCrop || null };
}
export function publishedCanvasEntries(document) {
  return [{ ...canvasDetails(document.canvas || { id: FIRST_WORKBENCH_ID, name: 'Canvas' }), content: canvasContent(document) }, ...(document.canvases || [])];
}
export function canvasDocument(document, entry) {
  const shared = Object.fromEntries(Object.entries(document).filter(([key]) => !CANVAS_CONTENT_KEYS.includes(key) && !['canvas', 'canvases', 'reception'].includes(key)));
  return { ...shared, ...entry.content, appearance: { ...entry.content.appearance, menuSurfaceId: document.appearance.menuSurfaceId } };
}
export function validatePublishedCanvases(document, validate, fail) {
  if (!Object.hasOwn(document, 'canvas') && !Object.hasOwn(document, 'canvases')) return;
  const details = value => {
    if (!value || Object.keys(value).length !== 4 || !/^workbench:[A-Za-z0-9_-]{1,80}$/u.test(value.id)) throw new Error('Invalid canvas identity');
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
        || !['artboard', 'geometry', 'appearance', 'grids', 'metadata'].every(key => Object.hasOwn(content, key))
        || Object.hasOwn(content.appearance || {}, 'menuSurfaceId')) throw new Error('Invalid canvas content');
      const result = validate(canvasDocument(document, entry));
      result.errors.forEach(error => fail(`canvases.${entry.id}.${error.path}`, error.code, error.message));
    } catch (error) { fail('canvases', 'invalid_canvas', error.message); }
  }
}
