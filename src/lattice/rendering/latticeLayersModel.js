export function moveLatticeLayerEntry(entries, sourceId, targetId) {
  return moveLatticeLayerEntries(entries, [sourceId], targetId);
}

export function moveLatticeLayerEntries(entries, sourceIds, targetId) {
  const ids = new Set(Array.isArray(sourceIds) ? sourceIds : []);
  const sources = entries.filter(({ id }) => ids.has(id));
  const sourceIndex = entries.findIndex(({ id }) => ids.has(id));
  const targetIndex = entries.findIndex(({ id }) => id === targetId);
  if (!sources.length || sources.length !== ids.size || sourceIndex < 0 || targetIndex < 0 || ids.has(targetId)) return null;
  const remaining = entries.filter(({ id }) => !ids.has(id));
  remaining.splice(Math.min(targetIndex, remaining.length), 0, ...sources);
  return remaining.every((entry, index) => entry.id === entries[index]?.id) ? null : remaining;
}
