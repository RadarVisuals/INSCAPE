import { sampleArticle } from './textPreviewModel.js';
import {
  expandPlacementGroups,
  placementGroup,
  selectedPlacementGroup,
} from '../src/systemWorkflow/domain/placementGroups.js';
import { systemWorkflowLayerOperationAvailability } from '../src/systemWorkflow/systemWorkflowLayer.js';
import {
  createEmptySystemWorkflowDraft,
  quantizeSystemWorkflowGridCoordinate as quantize,
} from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createSystemWorkflowPlacementCandidate } from '../src/systemWorkflow/systemWorkflowPlacement.js';
import { createSystemWorkflowGutterCandidate } from '../src/systemWorkflow/systemWorkflowGutters.js';

// Reference-only adapters. The workspace owns these example values; no store or persistence is created.
export const layerItems = (items) => items.filter((item) => item.parent === 'display');
export const layerGrid = (items, groups = []) => ({
  groups,
  placements: layerItems(items).map((item, layer) => ({
    ...item,
    layer,
    visibility: 'PUBLIC',
  })),
});
export const groupFor = (items, groups, id) => placementGroup(layerGrid(items, groups), id);
export const selectedGroup = (items, groups, ids) =>
  selectedPlacementGroup(layerGrid(items, groups), ids);
export const expandGroup = (items, groups, ids) =>
  expandPlacementGroups(layerGrid(items, groups), ids);
export function layerAvailability(items, groups, ids, readOnly = false) {
  const layers = layerItems(items),
    selected = layers.filter((item) => ids.includes(item.id));
  const off = { back: false, backward: false, forward: false, front: false };
  if (readOnly || !selected.length || selected.some((item) => item.locked || !item.visible))
    return off;
  if (selected.length === 1) {
    const a = systemWorkflowLayerOperationAvailability(
      layerGrid(items, groups),
      selected[0].id,
    );
    return { back: a.BACK, backward: a.BACKWARD, forward: a.FORWARD, front: a.FRONT };
  }
  if (layers.some((item) => item.locked)) return off;
  return Object.fromEntries(
    ['back', 'backward', 'forward', 'front'].map((direction) => [
      direction,
      reorderLayers(items, ids, direction).some((item, index) => item.id !== items[index].id),
    ]),
  );
}
export function reorderLayers(items, ids, direction) {
  let layers = layerItems(items);
  const selected = new Set(ids);
  if (direction === 'back')
    layers = [
      ...layers.filter((i) => selected.has(i.id)),
      ...layers.filter((i) => !selected.has(i.id)),
    ];
  else if (direction === 'front')
    layers = [
      ...layers.filter((i) => !selected.has(i.id)),
      ...layers.filter((i) => selected.has(i.id)),
    ];
  else if (direction === 'backward') {
    for (let i = 1; i < layers.length; i++)
      if (selected.has(layers[i].id) && !selected.has(layers[i - 1].id))
        [layers[i - 1], layers[i]] = [layers[i], layers[i - 1]];
  } else {
    for (let i = layers.length - 2; i >= 0; i--)
      if (selected.has(layers[i].id) && !selected.has(layers[i + 1].id))
        [layers[i + 1], layers[i]] = [layers[i], layers[i + 1]];
  }
  let index = 0;
  return items.map((item) => (item.parent === 'display' ? layers[index++] : item));
}
export function dropLayer(items, groups, sourceId, targetId, edge = 'before') {
  const layers = layerItems(items);
  if (sourceId === targetId || layers.some((item) => item.locked)) return items;
  const ids = expandGroup(items, groups, [sourceId]),
    targetIds = expandGroup(items, groups, [targetId]);
  if (ids.some((id) => targetIds.includes(id))) return items;
  const sourceIndex = layers.findIndex((i) => i.id === sourceId),
    targetIndex = layers.findIndex((i) => i.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return items;
  const moving = layers.filter((i) => ids.includes(i.id)),
    rest = layers.filter((i) => !ids.includes(i.id));
  const targetIndexes = rest.flatMap((i, index) => (targetIds.includes(i.id) ? [index] : []));
  // Rows read front-to-back; the canonical item order is back-to-front.
  const insert =
    edge === 'before' ? Math.max(...targetIndexes) + 1 : Math.min(...targetIndexes);
  rest.splice(insert, 0, ...moving);
  let index = 0;
  return items.map((item) => (item.parent === 'display' ? rest[index++] : item));
}
export function canGroup(items, groups, ids) {
  const selected = layerItems(items).filter((item) => ids.includes(item.id));
  return (
    selected.length >= 2 &&
    selected.length === ids.length &&
    selected.every(
      (item) =>
        !item.locked &&
        item.visible &&
        item.kind !== 'text' &&
        !groupFor(items, groups, item.id),
    )
  );
}
export const cleanGroups = (groups, removed) =>
  groups.filter((group) => !group.placementIds.some((id) => removed.includes(id)));
export function applyLayerGutter(items, groups, gutter) {
  const layers = layerItems(items);
  if (groups.length) throw new Error('Ungroup layers before applying composition spacing.');
  if (layers.some((i) => i.locked || !i.visible))
    throw new Error('Unlock and show all layers before applying spacing.');
  // Feed disposable geometry through the real, pure spacing validator. Text uses its frame bounds.
  let draft = createEmptySystemWorkflowDraft('0x1111111111111111111111111111111111111111');
  const gridId = draft.grids[0].id;
  for (const item of layers)
    draft = createSystemWorkflowPlacementCandidate(draft, {
      gridId,
      stableAssetId: '42:0x1111111111111111111111111111111111111111:0x01',
      generatePlacementId: () => item.id,
      destination: {
        column: quantize(item.x / 24),
        row: quantize(item.y / 24),
        columnSpan: quantize(item.width / 24),
        rowSpan: quantize(item.height / 24),
      },
    });
  const next =
    createSystemWorkflowGutterCandidate(draft, {
      gridId,
      gutter,
      expectedPlacements: draft.grids[0].placements,
    }) || draft;
  const positions = new Map(next.grids[0].placements.map((p) => [p.id, p]));
  return items.map((item) =>
    positions.has(item.id)
      ? { ...item, x: positions.get(item.id).column * 24, y: positions.get(item.id).row * 24 }
      : item,
  );
}
export function sampleLayers(mode = 'composition') {
  const base = {
    parent: 'display',
    kind: 'artwork',
    rotation: 0,
    opacity: 100,
    grain: 0,
    blur: 0,
    fit: 'contain',
    inspect: 'IN_PLACE',
    visible: true,
    locked: false,
    included: true,
  };
  if (mode === 'empty') return [];
  const result = [
    {
      ...base,
      id: 'backdrop',
      name: 'Backdrop',
      variant: 'backdrop',
      color: '#c5c1b5',
      x: 0,
      y: 0,
      width: 360,
      height: 240,
    },
    {
      ...base,
      id: 'artwork',
      name: 'Artwork · Display',
      variant: 'arch',
      color: '#a99b85',
      x: 36,
      y: 48,
      width: 144,
      height: 192,
    },
    {
      ...base,
      id: 'moon',
      name: 'Moon',
      variant: 'moon',
      color: '#f0ece1',
      x: 240,
      y: 24,
      width: 72,
      height: 72,
    },
    {
      ...base,
      id: 'foreground',
      name: 'Foreground',
      variant: 'arch',
      color: '#586657',
      x: 132,
      y: 120,
      width: 192,
      height: 120,
    },
    {
      ...base,
      id: 'text',
      kind: 'text',
      name: 'Text · Display',
      article: sampleArticle(),
      textExample: 'display',
      x: 24,
      y: 12,
      width: 192,
      height: 36,
    },
  ];
  if (mode === 'spacing')
    return result
      .slice(1, 4)
      .map((item, i) => ({ ...item, x: 24 + i * 108, y: 84, width: 84, height: 84 }));
  if (mode === 'long')
    return Array.from({ length: 24 }, (_, i) => ({
      ...result[1 + (i % 3)],
      id: 'study-' + i,
      name: 'Study ' + String(i + 1).padStart(2, '0'),
      x: (i % 6) * 60,
      y: Math.floor(i / 6) * 60,
      width: 48,
      height: 48,
    }));
  return result;
}
