export function projectPublishedInventoryRack(document) {
  const spaces = Array.isArray(document?.spaces) ? document.spaces : [];
  const modules = [...spaces]
    .sort((first, second) => first.order - second.order || first.id.localeCompare(second.id))
    .map((space) => ({
      id: space.id,
      label: space.label,
      order: space.order,
      startOpen: space.startOpen === true,
      space
    }));
  if (!modules.length) return null;
  return { id: 'inventory', label: 'INVENTORY', subtitle: 'PUBLIC COLLECTION', modules };
}
