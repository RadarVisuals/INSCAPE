import { createDefaultWorkbenchPresentation, createTextPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createImagePresentation } from '../../imageModule/imageModule.js';
import { createShapePresentation } from '../../shapes/shapes.js';
import { artworkLayers, layerIds } from '../../systemWorkflow/domain/artworkLayers.js';
import { workbenchArea } from '../../systemWorkflow/domain/workbenchArea.js';

// Saved content is the only input. Browsing never needs a camera, editor scope,
// module registry or a second persisted preview document.
export function workbenchOverviewModel(draft) {
  const composition = draft.composition;
  if (composition?.version === 2) return { composition, area: { left: 0, top: 0, width: 1440, height: composition.height }, items: [],
    contains: `${composition.regions.length} cells` };
  if (composition) draft = composition;
  const presentation = draft.workbench || createDefaultWorkbenchPresentation();
  const area = workbenchArea(presentation), artwork = new Map();
  const add = (id, layout, source) => layout.open && ({ id, frame: layout.window, source });
  for (const [index, record] of (draft.shapes || []).entries()) {
    const layout = presentation.shapes?.find(item => item.id === record.id) || createShapePresentation(record.id, index);
    artwork.set(record.id, add(record.id, layout, { kind: 'shape', record }));
  }
  for (const [index, record] of (draft.imageModules || []).entries()) {
    const layout = presentation.imageModules?.find(item => item.id === record.id) || createImagePresentation(record.id, index);
    artwork.set(record.id, add(record.id, { ...layout, window: { ...layout.position, width: record.width, height: record.height } },
      { kind: 'image', record, artwork: record.artwork, crop: record.artwork?.crop }));
  }
  for (const [index, record] of (draft.texts || []).entries()) {
    const layout = presentation.texts?.find(item => item.id === record.id) || createTextPresentation(record.id, index);
    artwork.set(record.id, add(record.id, layout, { kind: 'text', article: record.article, frames: layout.frames || [] }));
  }
  const items = layerIds(artworkLayers(draft)).map(id => artwork.get(id)).filter(Boolean);
  const counts = [[draft.imageModules?.length, 'image', 'images'], [draft.texts?.length, 'text', 'texts'],
    [draft.shapes?.length, 'shape', 'shapes']];
  if (composition?.cells.length) counts.unshift([composition.cells.length, 'cell', 'cells']);
  return { ...(composition && { composition }), area, items, contains: counts.filter(([count]) => count).map(([count, one, many]) => `${count} ${count === 1 ? one : many}`).join(' · ') || 'No content yet' };
}
