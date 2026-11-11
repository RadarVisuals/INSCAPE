
// Membership has one owner: the Grid. Placements retain geometry and z-order.
export const placementGroup = (grid, id) => grid?.groups?.find(group => group.placementIds.includes(id)) || null;
export const selectedPlacementGroup = (grid, ids) => grid?.groups?.find(group => group.placementIds.length === ids.length && group.placementIds.every(id => ids.includes(id))) || null;
export function expandPlacementGroups(grid, ids) {
  const expanded = new Set(ids);
  for (const group of grid?.groups || []) if (group.placementIds.some(id => expanded.has(id))) group.placementIds.forEach(id => expanded.add(id));
  return [...expanded];
}
export function validPlacementGroups(grid) {
  if (!Object.hasOwn(grid, 'groups')) return true;
  if (!Array.isArray(grid.groups) || !grid.groups.length || grid.groups.length > 100 || !Array.isArray(grid.placements)) return false;
  const ids = new Set(), members = new Set();
  return grid.groups.every(group => {
    if (!group || typeof group !== 'object' || Object.keys(group).some(key => !['id', 'placementIds'].includes(key))
      || typeof group.id !== 'string' || !/^group:[A-Za-z0-9_-]{1,100}$/.test(group.id) || ids.has(group.id)
      || !Array.isArray(group.placementIds) || group.placementIds.length < 2 || group.placementIds.length > 200) return false;
    ids.add(group.id);
    let locked;
    return group.placementIds.every(id => {
      const placement = grid.placements.find(item => item.id === id);
      if (!placement || placement.kind === 'text' || placement.visibility !== 'PUBLIC' || members.has(id)) return false;
      if (locked !== undefined && locked !== placement.locked) return false;
      locked = placement.locked;
      members.add(id); return true;
    });
  });
}

export function requireCompleteGroups(grid, ids) {
  if (expandPlacementGroups(grid, ids).length !== new Set(ids).size) throw new Error('Select the whole group, or ungroup it first.');
}

export function removePlacementGroups(grid, removedIds) {
  if (!grid.groups) return;
  grid.groups = grid.groups.filter(group => !group.placementIds.some(id => removedIds.includes(id)));
  if (!grid.groups.length) delete grid.groups;
}
