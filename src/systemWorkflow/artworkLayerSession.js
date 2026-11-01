import { artworkLayers, artworkRecords, groupArtwork, reorderArtwork } from './domain/artworkLayers.js';

export function editArtworkLayers(store, profile, action, expectedGeneration = store.getGeneration(), presentation) {
  if (store.getProfileAddress() !== profile || store.getGeneration() !== expectedGeneration)
    throw new Error('The composition changed. Select the layers again.');
  const draft = store.getDraft(), layers = artworkLayers(draft);
  let next = { ...draft }, label = 'Order artwork';
  if (action.type === 'order') next.artworkLayers = reorderArtwork(layers, action.ids, action.direction, action.targetId, action.edge);
  else if (action.type === 'group') {
    next.artworkLayers = groupArtwork(layers, action.ids, action.id, action.name); label = 'Group artwork';
  } else if (action.type === 'ungroup') {
    if (!layers.some(layer => layer.id === action.id)) throw new Error('This block is no longer available.');
    next.artworkLayers = layers.flatMap(layer => layer.id === action.id ? layer.children : [layer]); label = 'Ungroup artwork';
  } else if (action.type === 'leave') {
    next.artworkLayers = layers.flatMap(layer => {
      if (typeof layer === 'string' || !layer.children.includes(action.id)) return [layer];
      const children = layer.children.filter(id => id !== action.id);
      return [...(children.length ? [{ ...layer, children }] : []), action.id];
    }); label = 'Remove part from block';
  } else if (action.type === 'delete') {
    const ids = new Set(action.ids), records = artworkRecords(draft);
    if (!ids.size || [...ids].some(id => !records.some(item => item.id === id))) throw new Error('The selection changed. Try again.');
    // Capture live geometry before deletion so Undo restores the exact frames.
    if (presentation) next.workbench = structuredClone(presentation);
    for (const key of ['imageModules', 'texts', 'shapes']) {
      if (next[key]) next[key] = next[key].filter(item => !ids.has(item.id));
      if (next.workbench?.[key]) next.workbench = { ...next.workbench, [key]: next.workbench[key].filter(item => !ids.has(item.id)) };
    }
    // The store reconciles both block and navigation membership atomically.
    next.artworkLayers = layers;
    label = `Delete ${ids.size} artwork layer${ids.size === 1 ? '' : 's'}`;
  } else throw new Error('Unknown layer action.');
  if (JSON.stringify(next) === JSON.stringify(draft)) return true;
  if (!store.commitCompletedOperation(next, { expectedGeneration, historyLabel: label,
    ...(action.type === 'delete' && presentation ? { historyPresentation: presentation } : {}) }))
    throw new Error('Could not save the layer change. Your composition is unchanged. Try again.');
  return true;
}
