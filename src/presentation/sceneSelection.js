// Temporary selection only. Content, persistence and animation have other owners.
export function createSceneSelection(grids = [], initialGridId) {
  let ids = [], order = [], selected = initialGridId, snapshot;
  const listeners = new Set();
  const publish = (notify = true) => {
    if (snapshot?.gridId === selected && JSON.stringify(snapshot.gridOrder) === JSON.stringify(order)
      && JSON.stringify(snapshot.selectableIds) === JSON.stringify(ids)) return;
    snapshot = Object.freeze({ gridId: selected, gridOrder: Object.freeze([...order]), selectableIds: Object.freeze([...ids]) });
    if (notify) listeners.forEach(listener => listener());
  };
  const reconcile = (grids, notify = true) => {
    ids = grids.map(grid => grid.id);
    order = grids.filter(grid => grid.id !== 'grid:world-cover').map(grid => grid.id);
    if (!ids.includes(selected)) selected = order[0] ?? null;
    publish(notify);
    return selected;
  };
  reconcile(grids, false);
  const select = id => {
    if (!ids.includes(id)) return false;
    selected = id; publish(); return true;
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    reconcile, select,
    next(direction = 'next') {
      if (!['next', 'previous'].includes(direction) || !order.includes(selected) || order.length < 2) return false;
      return select(order[(order.indexOf(selected) + (direction === 'next' ? 1 : order.length - 1)) % order.length]);
    },
    reset: () => order.length ? select(order[0]) : false,
  });
}
