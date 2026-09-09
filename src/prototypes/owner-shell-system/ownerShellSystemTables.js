export function createOwnerShellSystemTable(tables, stamp) {
  return {
    id: `table-${stamp}`,
    name: `TABLE ${String(tables.length + 1).padStart(2, '0')}`,
    public: false,
  };
}

export function updateOwnerShellSystemTable(tables, tableId, patch) {
  return tables.map((table) => table.id === tableId ? { ...table, ...patch } : table);
}

export function moveOwnerShellSystemTable(tables, tableId, targetIndex) {
  const sourceIndex = tables.findIndex(({ id }) => id === tableId);
  if (sourceIndex < 0) return tables;
  const boundedTarget = Math.max(0, Math.min(tables.length - 1, targetIndex));
  if (sourceIndex === boundedTarget) return tables;
  const next = [...tables];
  const [table] = next.splice(sourceIndex, 1);
  next.splice(boundedTarget, 0, table);
  return next;
}

export function placeOwnerShellSystemTable(tables, tableId, targetId, edge = 'before') {
  if (tableId === targetId) return tables;
  const table = tables.find(({ id }) => id === tableId);
  if (!table || !tables.some(({ id }) => id === targetId)) return tables;
  const next = tables.filter(({ id }) => id !== tableId);
  const targetIndex = next.findIndex(({ id }) => id === targetId);
  next.splice(targetIndex + (edge === 'after' ? 1 : 0), 0, table);
  return next;
}

export function removeOwnerShellSystemTable(tables, activeTableId, tableId) {
  if (tables.length <= 1 || !tables.some(({ id }) => id === tableId)) {
    return { activeTableId, focusTableId: null, removed: false, tables };
  }
  const index = tables.findIndex(({ id }) => id === tableId);
  const survivors = tables.filter(({ id }) => id !== tableId);
  const fallback = survivors[Math.min(index, survivors.length - 1)];
  return {
    activeTableId: activeTableId === tableId ? fallback.id : activeTableId,
    focusTableId: fallback.id,
    removed: true,
    tables: survivors,
  };
}
