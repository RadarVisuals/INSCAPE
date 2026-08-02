export const CONTENT_MODULES = Object.freeze(['library', 'activity', 'people']);
export const MODULE_ORDER = Object.freeze(['library', 'activity', 'people', 'layers']);
export function toggleContentModule(current, requested) { return CONTENT_MODULES.includes(requested) ? (current === requested ? null : requested) : current; }
export function toggleLayers(current) { return !current; }
export function moveLayer(layers, selectedId, direction) {
  const index = layers.findIndex((layer) => layer.id === selectedId); const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= layers.length) return layers;
  const next = [...layers]; [next[index], next[destination]] = [next[destination], next[index]]; return next;
}
export function deduplicateAssets(assets) {
  const byId = new Map();
  for (const asset of assets) { const existing = byId.get(asset.id); byId.set(asset.id, existing ? { ...existing, relationships: [...new Set([...existing.relationships, ...asset.relationships])], categories: [...new Set([...existing.categories, ...asset.categories])] } : asset); }
  return [...byId.values()];
}
export function filterLibrary(assets, category, query) {
  const selected = deduplicateAssets(assets).filter((asset) => category === 'all' || (category === 'owned' || category === 'created' ? asset.relationships.includes(category.toUpperCase()) : category === 'unsorted' ? asset.categories.length === 0 : asset.categories.includes(category)));
  const needle = query.trim().toLocaleLowerCase(); return needle ? selected.filter((asset) => `${asset.name} ${asset.relationships.join(' ')} ${asset.provenance}`.toLocaleLowerCase().includes(needle)) : selected;
}
export function filterText(items, query, fields) { const needle = query.trim().toLocaleLowerCase(); return needle ? items.filter((item) => fields.some((field) => String(item[field] ?? '').toLocaleLowerCase().includes(needle))) : items; }
export function scenarioItems(items, scenario) {
  if (scenario === 'empty') return []; if (scenario === 'loading') return items.filter((item) => item.state === 'loading').slice(0, 1);
  if (scenario === 'failed') return items.filter((item) => item.state === 'failed').slice(0, 1); if (scenario === 'unresolved') return items.filter((item) => item.state === 'unresolved').slice(0, 1);
  if (scenario === 'partial') return items.slice(0, Math.max(1, Math.ceil(items.length / 2)));
  if (scenario === 'stress') return [...items, ...items.map((item) => ({ ...item, id: `${item.id}-stress`, name: item.name ? `${item.name} / extended fixture label for layout stress` : undefined }))]; return items;
}
