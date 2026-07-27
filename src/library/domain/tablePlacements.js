const TABLE_IDS = new Set(['identity', 'collections', 'archive', 'drops', 'index']);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));

function placementId() {
  return globalThis.crypto?.randomUUID
    ? `table:${globalThis.crypto.randomUUID()}`
    : `table:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeTablePlacements(candidate) {
  const seen = new Set();
  return (Array.isArray(candidate) ? candidate : []).flatMap((placement, index) => {
    if (!placement || typeof placement.id !== 'string' || !placement.id || seen.has(placement.id)
      || !TABLE_IDS.has(placement.tableId) || typeof placement.stableAssetId !== 'string'
      || !placement.stableAssetId || placement.stableAssetId.length > 300) return [];
    seen.add(placement.id);
    const rect = placement.rect || {};
    const crop = placement.crop || {};
    const width = clamp(rect.width || .18, .06, .8);
    const height = clamp(rect.height || .24, .08, .9);
    return [{
      id: placement.id,
      tableId: placement.tableId,
      stableAssetId: placement.stableAssetId,
      rect: {
        x: clamp(rect.x, 0, 1 - width),
        y: clamp(rect.y, 0, 1 - height),
        width,
        height
      },
      crop: {
        x: clamp(crop.x ?? .5, 0, 1),
        y: clamp(crop.y ?? .5, 0, 1),
        zoom: clamp(crop.zoom || 1, 1, 4)
      },
      layer: Number.isInteger(placement.layer) ? clamp(placement.layer, 0, 9999) : index
    }];
  }).sort((first, second) => first.layer - second.layer)
    .map((placement, layer) => ({ ...placement, layer }));
}

export function createTablePlacement(workspace, input) {
  if (!TABLE_IDS.has(input?.tableId) || typeof input?.stableAssetId !== 'string' || !input.stableAssetId) return workspace;
  const current = normalizeTablePlacements(workspace.tables?.placements);
  const placement = normalizeTablePlacements([{
    id: placementId(),
    tableId: input.tableId,
    stableAssetId: input.stableAssetId,
    rect: input.rect,
    crop: input.crop,
    layer: current.length
  }])[0];
  if (!placement) return workspace;
  return { ...workspace, tables: { placements: [...current, { ...placement, layer: current.length }] } };
}

export function updateTablePlacement(workspace, id, patch) {
  const current = normalizeTablePlacements(workspace.tables?.placements);
  if (!current.some((placement) => placement.id === id)) return workspace;
  const placements = normalizeTablePlacements(current.map((placement) => placement.id === id
    ? { ...placement, ...patch, rect: { ...placement.rect, ...patch?.rect }, crop: { ...placement.crop, ...patch?.crop } }
    : placement));
  return { ...workspace, tables: { placements } };
}

export function removeTablePlacement(workspace, id) {
  const current = normalizeTablePlacements(workspace.tables?.placements);
  if (!current.some((placement) => placement.id === id)) return workspace;
  return { ...workspace, tables: { placements: normalizeTablePlacements(current.filter((placement) => placement.id !== id)) } };
}

export function reorderTablePlacement(workspace, id, command) {
  const current = normalizeTablePlacements(workspace.tables?.placements);
  const index = current.findIndex((placement) => placement.id === id);
  if (index < 0 || !['front', 'back', 'forward', 'backward'].includes(command)) return workspace;
  const target = command === 'front' ? current.length - 1 : command === 'back' ? 0
    : command === 'forward' ? Math.min(current.length - 1, index + 1) : Math.max(0, index - 1);
  if (target === index) return workspace;
  const placements = [...current];
  const [placement] = placements.splice(index, 1);
  placements.splice(target, 0, placement);
  return { ...workspace, tables: { placements: placements.map((item, layer) => ({ ...item, layer })) } };
}
