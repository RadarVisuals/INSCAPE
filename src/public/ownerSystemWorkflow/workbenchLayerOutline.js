import { layerMembers } from '../../systemWorkflow/domain/artworkLayers.js';

// Place each folder at its frontmost artwork. A composition can span folders:
// keep each part editable in its own folder without changing the paint order.
export function workbenchLayerOutline(layers, groups, owners) {
  const outline = [], folders = new Map();
  const folder = group => {
    if (!folders.has(group.id)) {
      const entry = { group, children: [] };
      folders.set(group.id, entry);
      outline.push(entry);
    }
    return folders.get(group.id);
  };
  const append = (layer, group, parent) => {
    const list = group ? folder(group).children : outline;
    list.push({ layer, parent });
  };
  for (const layer of [...layers].reverse()) {
    const ids = layerMembers(layer), group = owners.get(ids[0]);
    if (ids.every(id => owners.get(id) === group)) append(layer, group);
    else for (const id of [...ids].reverse()) append(id, owners.get(id), layer.id);
  }
  for (const group of groups) folder(group);
  return outline;
}

export function cellLayerOutline(layers, cellOwners) {
  // Each block has one selectable row. A block spanning cells lives at the
  // root; its contained artwork is also reachable through its owning cell.
  const blockOwners = new Map(), outline = new Map();
  const append = (cellId, layer) => {
    if (!outline.has(cellId)) outline.set(cellId, []);
    outline.get(cellId).push(layer);
  };
  for (const layer of layers) {
    const members = layerMembers(layer), owner = cellOwners.get(members[0]);
    const sharedOwner = members.every(id => cellOwners.get(id) === owner);
    append(sharedOwner ? owner : undefined, layer);
    if (typeof layer !== 'string') for (const id of members) {
      blockOwners.set(id, layer.id);
      if (!sharedOwner && cellOwners.has(id)) append(cellOwners.get(id), id);
    }
  }
  return { outline, blockOwners };
}
