export function createDisclosureModuleTracks(items, activeId, containerHeight, headerHeight) {
  const safeHeight = Math.max(0, Number(containerHeight) || 0);
  const collapsedTotal = Math.max(0, items.length - 1) * headerHeight;
  const expandedHeight = Math.max(headerHeight, safeHeight - collapsedTotal);
  let top = 0;

  return new Map(items.map(({ id }) => {
    const height = id === activeId ? expandedHeight : headerHeight;
    const track = { height, top };
    top += height;
    return [id, track];
  }));
}
