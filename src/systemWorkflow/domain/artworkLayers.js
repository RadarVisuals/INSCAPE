// Back-to-front authored order. A block owns its contiguous children; there is
// no second member-order list. Text continuation frames travel with their Text.
export const ARTWORK_KEYS = ['shapes', 'imageModules', 'texts'];
export const artworkRecords = draft => ARTWORK_KEYS.flatMap(key => (Array.isArray(draft?.[key]) ? draft[key] : []).filter(record => record && typeof record.id === 'string').map(record => ({
  id: record.id, key, record, name: record.name || record.article?.title || ({ shapes: 'Shape', imageModules: 'Image', texts: 'Text' })[key],
})));
export const layerIds = layers => layers.flatMap(layer => typeof layer === 'string' ? [layer] : layer.children);
export const artworkLayers = draft => draft?.artworkLayers || artworkRecords(draft).map(item => item.id);
export const layerMembers = layer => typeof layer === 'string' ? [layer] : layer.children;
export function artworkModuleId(draft, id) {
  return draft?.workbench?.texts?.find(text => text.frames?.some(frame => frame.id === id))?.id || id;
}
export function artworkWindowIds(draft, ids) {
  return ids.flatMap(id => [id, ...(draft?.workbench?.texts?.find(text => text.id === id)?.frames || []).map(frame => frame.id)]);
}
export function validArtworkLayers(layers, draft, publicOnly = false) {
  if (!Array.isArray(layers)) return false;
  const available = new Set(artworkRecords(draft).map(item => item.id)), seen = new Set(), groups = new Set();
  for (const layer of layers) {
    if (typeof layer !== 'string') {
      if (publicOnly || !layer || Object.keys(layer).length !== 3
        || !/^composition:[A-Za-z0-9_-]{1,80}$/u.test(layer.id) || groups.has(layer.id)
        || typeof layer.name !== 'string' || !layer.name.trim() || layer.name !== layer.name.trim()
        || layer.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(layer.name)
        || !Array.isArray(layer.children) || !layer.children.length) return false;
      groups.add(layer.id);
    }
    for (const id of layerMembers(layer)) {
      if (typeof id !== 'string' || !available.has(id) || seen.has(id)) return false;
      seen.add(id);
    }
  }
  return seen.size === available.size && groups.size <= 32;
}
// Only completed module additions/removals adjust an existing order. Bad input
// at load remains an error. Existing local compositions need no destructive reset.
export function reconcileArtworkLayers(previous, candidate) {
  if (!Array.isArray(candidate?.artworkLayers) || candidate.artworkLayers.some(layer => typeof layer !== 'string' && !Array.isArray(layer?.children))) return candidate;
  const before = new Set(artworkRecords(previous).map(item => item.id));
  const after = new Set(artworkRecords(candidate).map(item => item.id));
  const removed = new Set([...before].filter(id => !after.has(id)));
  const present = new Set(layerIds(candidate.artworkLayers));
  const added = [...after].filter(id => !before.has(id) && !present.has(id));
  if (!removed.size && !added.length) return candidate;
  const layers = candidate.artworkLayers.flatMap(layer => {
    if (typeof layer === 'string') return removed.has(layer) ? [] : [layer];
    const children = layer.children.filter(id => !removed.has(id));
    return children.length ? [{ ...layer, children }] : [];
  });
  return { ...candidate, artworkLayers: [...layers, ...added] };
}
export function projectArtworkLayers(draft, publicContent) {
  const allowed = new Set(artworkRecords(publicContent).map(item => item.id));
  return layerIds(artworkLayers(draft)).filter(id => allowed.has(id));
}

export function groupArtwork(layers, ids, id, name) {
  const selected = new Set(ids), order = layerIds(layers);
  if (selected.size < 2 || layers.some(layer => typeof layer !== 'string' && layer.children.some(child => selected.has(child))))
    throw new Error('Choose at least two ungrouped layers. Ungroup an existing block first.');
  const children = order.filter(child => selected.has(child));
  if (children.length !== selected.size) throw new Error('The selection changed. Select the layers again.');
  return layers.flatMap(layer => layer === children.at(-1) ? [{ id, name, children }] : selected.has(layer) ? [] : [layer]);
}

export function reorderArtwork(layers, ids, direction, targetId, edge = 'before') {
  const selected = new Set(ids);
  const partial = layers.filter(layer => typeof layer !== 'string' && layer.children.some(id => selected.has(id))
    && !layer.children.every(id => selected.has(id)));
  if (partial.length) {
    const block = partial[0];
    if (partial.length !== 1 || ids.some(id => !block.children.includes(id))) throw new Error('Select a whole block to move it with other layers.');
    return layers.map(layer => layer === block ? { ...block, children: reorderArtwork(block.children, ids, direction, targetId, edge) } : layer);
  }
  const chosen = layer => layerMembers(layer).every(id => selected.has(id));
  const moving = layers.filter(chosen);
  if (!moving.length) throw new Error('Select a layer first.');
  if (direction === 'drop') {
    const target = layers.find(layer => (typeof layer === 'string' ? layer : layer.id) === targetId || layerMembers(layer).includes(targetId));
    if (!target) throw new Error('Move within this block, or leave it first.');
    if (chosen(target)) return layers;
    const rest = layers.filter(layer => !chosen(layer)), index = rest.indexOf(target);
    return [...rest.slice(0, index + (edge === 'after' ? 1 : 0)), ...moving, ...rest.slice(index + (edge === 'after' ? 1 : 0))];
  }
  if (direction === 'front') return [...layers.filter(layer => !chosen(layer)), ...moving];
  if (direction === 'back') return [...moving, ...layers.filter(layer => !chosen(layer))];
  const next = [...layers];
  if (direction === 'forward') {
    for (let i = next.length - 2; i >= 0; i--) if (chosen(next[i]) && !chosen(next[i + 1])) [next[i], next[i + 1]] = [next[i + 1], next[i]];
  } else if (direction === 'backward') {
    for (let i = 1; i < next.length; i++) if (chosen(next[i]) && !chosen(next[i - 1])) [next[i], next[i - 1]] = [next[i - 1], next[i]];
  } else throw new Error('Unknown layer action.');
  return next;
}
