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
