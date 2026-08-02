export function projectModul8rTableUsage(tables = [], activeTableId = null) {
  return tables.map((table) => Object.freeze({
    active: table.id === activeTableId,
    count: Array.isArray(table.placements) ? table.placements.length : 0,
    coordinate: Object.freeze({ ...table.coordinate }),
    id: table.id,
    label: String(table.title || table.id || '').trim() || table.id,
  }));
}
