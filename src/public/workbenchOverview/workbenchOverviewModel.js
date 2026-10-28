import { createDefaultWorkbenchPresentation, createMiniAppPresentation, createTextPresentation, createNewDisplayPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createImagePresentation } from '../../imageModule/imageModule.js';
import { createShapePresentation } from '../../shapes/shapes.js';
import { artworkLayers, layerIds } from '../../systemWorkflow/domain/artworkLayers.js';
import { workbenchArea } from '../../systemWorkflow/domain/workbenchArea.js';
import { displayContent, displayModuleIds, PRIMARY_DISPLAY_ID } from '../../systemWorkflow/domain/displayModules.js';
import { passageArticle } from '../../text/scenePassages.js';

export function overviewAssetIds(draft) {
  return [...new Set(displayModuleIds(draft).flatMap(id => displayContent(draft, id).grids[0]?.placements || [])
    .filter(item => !item.asset && item.stableAssetId).map(item => item.stableAssetId))];
}

// Saved content is the only input. Browsing never needs a camera, editor scope,
// module registry or a second persisted preview document.
export function workbenchOverviewModel(draft, assets = new Map(), scenes = {}) {
  const presentation = draft.workbench || createDefaultWorkbenchPresentation();
  const area = workbenchArea(presentation), items = [], artwork = new Map();
  const add = (id, layout, source, name) => layout.open && ({ id, frame: layout.window, source, name });
  for (const [index, id] of displayModuleIds(draft).entries()) {
    const content = displayContent(draft, id);
    const layout = id === PRIMARY_DISPLAY_ID ? presentation.display
      : presentation.displays?.find(item => item.id === id) || createNewDisplayPresentation(content.geometry, index);
    const grid = scenes[id] ? content.grids.find(grid => grid.id === scenes[id].gridId) : content.grids[0];
    const item = add(id, layout, grid ? { kind: 'display', grid, geometry: content.geometry, appearance: content.appearance, assets }
      : { kind: 'unavailable', name: 'Scene unavailable' }, layout.name);
    if (item) items.push(item);
  }
  for (const [index, record] of (draft.miniApps || []).entries()) {
    const layout = presentation.miniApps?.find(item => item.id === record.id) || createMiniAppPresentation(record.id, index);
    const item = add(record.id, layout, { kind: 'interactive', name: record.name || 'Interactive artwork' });
    if (item) items.push(item);
  }
  for (const [index, record] of (draft.shapes || []).entries()) {
    const layout = presentation.shapes?.find(item => item.id === record.id) || createShapePresentation(record.id, index);
    artwork.set(record.id, add(record.id, layout, { kind: 'shape', record }));
  }
  for (const [index, record] of (draft.imageModules || []).entries()) {
    const layout = presentation.imageModules?.find(item => item.id === record.id) || createImagePresentation(record.id, index);
    artwork.set(record.id, add(record.id, { ...layout, window: { ...layout.position, width: record.width, height: record.height } },
      { kind: 'image', record, side: record.sides[0], crop: record.sides[0]?.crop }));
  }
  for (const [index, record] of (draft.texts || []).entries()) {
    const layout = presentation.texts?.find(item => item.id === record.id) || createTextPresentation(record.id, index);
    const display = record.sceneLink && displayModuleIds(draft).includes(record.sceneLink.displayId)
      ? displayContent(draft, record.sceneLink.displayId) : null;
    const gridId = scenes[record.sceneLink?.displayId]?.gridId ?? display?.grids[0]?.id ?? record.sceneLink?.gridId;
    const article = passageArticle(record, gridId, display?.grids.map(grid => grid.id));
    artwork.set(record.id, add(record.id, layout, { kind: 'text', article, frames: layout.frames || [] }));
  }
  items.push(...layerIds(artworkLayers(draft)).map(id => artwork.get(id)).filter(Boolean));
  const counts = [[draft.imageModules?.length, 'image', 'images'], [draft.texts?.length, 'text', 'texts'],
    [draft.shapes?.length, 'shape', 'shapes'], [draft.miniApps?.length, 'interactive artwork', 'interactive artworks'],
    [displayModuleIds(draft).length, 'Display', 'Displays']];
  return { area, items, contains: counts.filter(([count]) => count).map(([count, one, many]) => `${count} ${count === 1 ? one : many}`).join(' · ') || 'No content yet',
    interactive: items.some(item => item.source.kind === 'interactive') };
}
