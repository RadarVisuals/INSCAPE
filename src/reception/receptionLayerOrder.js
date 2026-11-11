import { layerIds, layerMembers, reorderArtwork } from '../systemWorkflow/domain/artworkLayers.js';

function reorderMembers(layers, members, ids, direction, targetId, edge) {
  const partial = layers.filter(layer => typeof layer !== 'string' && layer.children.some(id => ids.includes(id))
    && !layer.children.every(id => ids.includes(id)));
  if (partial.length) {
    const block = partial[0];
    if (partial.length !== 1 || ids.some(id => !block.children.includes(id)))
      throw new Error('Select a whole block to move it with other layers.');
    return layers.map(layer => layer === block ? { ...block,
      children: reorderMembers(block.children, members, ids, direction, targetId, edge) } : layer);
  }
  // Replace only this cell's slots. Unrelated cells and free artwork stay put.
  const siblings = layers.filter(layer => layerMembers(layer).every(id => members.includes(id)));
  const ordered = reorderArtwork(siblings, ids, direction, targetId, edge);
  let index = 0;
  return layers.map(layer => siblings.includes(layer) ? ordered[index++] : layer);
}

export function backgroundsBehindContents(layers, cells) {
  let next = layers;
  for (const cell of cells) {
    const block = next.find(layer => typeof layer !== 'string' && layer.children.includes(cell.id));
    if (block) {
      const first = block.children.find(id => cell.members.includes(id));
      if (first && block.children.indexOf(first) < block.children.indexOf(cell.id))
        next = next.map(layer => layer === block ? { ...block,
          children: reorderArtwork(block.children, [cell.id], 'drop', first, 'before') } : layer);
    }
    const order = layerIds(next), first = order.find(id => cell.members.includes(id));
    if (first && order.indexOf(first) < order.indexOf(cell.id)) {
      const background = next.find(layer => layerMembers(layer).includes(cell.id));
      next = reorderArtwork(next, layerMembers(background), 'drop', first, 'before');
    }
  }
  const order = layerIds(next);
  if (cells.some(cell => cell.members.some(id => order.indexOf(id) < order.indexOf(cell.id))))
    throw new Error('Ungroup the block spanning these cells before changing their order.');
  return next;
}

// The saved native order remains authoritative for Editor, Preview and public
// paint. Cell backgrounds cannot cover their own content through a layer action.
export function reorderReceptionArtwork(layers, cells, ids, direction, targetId, edge) {
  const owners = new Map(cells.flatMap(cell => cell.members.map(id => [id, cell])));
  const owner = owners.get(ids[0]);
  if (ids.some(id => owners.get(id) !== owner))
    throw new Error('Reorder layers inside one cell, or select the cells themselves.');
  let next;
  if (owner) {
    const target = layers.find(layer => typeof layer !== 'string' && layer.id === targetId);
    if (direction === 'drop' && targetId === owner.id) direction = 'front';
    else if (direction === 'drop' && !owner.members.includes(targetId)
      && !target?.children.every(id => owner.members.includes(id)))
      throw new Error('Move this layer within its cell.');
    next = reorderMembers(layers, owner.members, ids, direction, targetId, edge);
  } else {
    const moving = [...new Set(ids.flatMap(id => [id, ...(cells.find(cell => cell.id === id)?.members || [])]))];
    const targetCell = cells.find(cell => cell.id === targetId) || owners.get(targetId);
    if (direction === 'drop' && targetCell) {
      const order = layerIds(layers).filter(id => id === targetCell.id || targetCell.members.includes(id));
      targetId = edge === 'after' ? order.at(-1) : order[0];
    }
    next = reorderArtwork(layers, moving, direction, targetId, edge);
  }
  return backgroundsBehindContents(next, cells);
}
