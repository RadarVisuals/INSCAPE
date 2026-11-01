import { reorderArtwork } from '../systemWorkflow/domain/artworkLayers.js';
import { isSystemWorkflowGridCoordinate, quantizeSystemWorkflowGridCoordinate as quantize } from '../systemWorkflow/domain/gridCoordinates.js';

export const RECEPTION_SCENE_GEOMETRY = Object.freeze({ columns: 32, rows: 18 });
export const MAX_RECEPTION_LAYERS = 32;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const finite = (value, minimum, maximum) => Number.isFinite(value) && value >= minimum && value <= maximum;
const dimension = value => Number.isInteger(value) && finite(value, 1, 512);
const geometryKeys = ['column', 'row', 'columnSpan', 'rowSpan'];
const quantized = item => Object.fromEntries(geometryKeys.map(key => [key, quantize(item[key])]));
const placementKeys = ['id', ...geometryKeys, 'locked'];
const records = value => [...value.imageModules, ...value.texts, ...(value.shapes || [])];
const isContent = (value, id) => records(value).some(item => item.id === id);

// A scene owns only placement and ordering. Source records, articles and shapes
// retain their existing content models, recovery and public filtering.
export function validReceptionScene(scene, available) {
  if (!exact(scene, ['geometry', 'placements', ...Object.hasOwn(scene || {}, 'mobile') ? ['mobile'] : []]) || !exact(scene.geometry, ['columns', 'rows'])
    || !dimension(scene.geometry.columns) || !dimension(scene.geometry.rows)
    || !Array.isArray(scene.placements) || scene.placements.length > MAX_RECEPTION_LAYERS) return false;
  const ids = new Set();
  const placementsValid = scene.placements.every(item => {
    if (!exact(item, placementKeys) || !available.has(item.id) || ids.has(item.id)
      || typeof item.locked !== 'boolean' || !validReceptionPlacement(item, scene.geometry)) return false;
    ids.add(item.id); return true;
  });
  if (!placementsValid || !Object.hasOwn(scene, 'mobile')) return placementsValid;
  if (!Array.isArray(scene.mobile) || scene.mobile.length > ids.size) return false;
  const overrides = new Set();
  return scene.mobile.every(item => {
    if (!exact(item, ['id', ...geometryKeys]) || !ids.has(item.id) || overrides.has(item.id)
      || !validReceptionPlacement(item, scene.geometry)) return false;
    overrides.add(item.id); return true;
  });
}

export function validReceptionPlacement(item, geometry) {
  return geometryKeys.every(key => isSystemWorkflowGridCoordinate(item[key]))
    && finite(item.column, 0, geometry.columns) && finite(item.row, 0, geometry.rows)
    && finite(item.columnSpan, 1 / 9, geometry.columns) && finite(item.rowSpan, 1 / 9, geometry.rows)
    && item.column + item.columnSpan <= geometry.columns + 1e-7
    && item.row + item.rowSpan <= geometry.rows + 1e-7;
}

export function receptionScenePlacements(scene, mobile = false) {
  if (!mobile || !scene.mobile?.length) return scene.placements;
  const overrides = new Map(scene.mobile.map(item => [item.id, item]));
  return scene.placements.map(item => overrides.has(item.id) ? { ...item, ...overrides.get(item.id) } : item);
}

export const receptionRegionContentIds = region => [
  ...(region.content ? [region.content] : []), ...(region.scene?.placements || []).map(item => item.id),
];
export const receptionContentIds = value => new Set([
  ...value.regions.flatMap(receptionRegionContentIds), ...(value.branding.logo ? [value.branding.logo] : []),
]);
export function pruneReceptionContent(value) {
  const used = receptionContentIds(value);
  return { ...value, imageModules: value.imageModules.filter(item => used.has(item.id)),
    texts: value.texts.filter(item => used.has(item.id)), ...(value.shapes ? { shapes: value.shapes.filter(item => used.has(item.id)) } : {}),
    ...(value.links ? { links: value.links.filter(item => used.has(item.id)) } : {}) };
}
function regionOf(value, regionId) {
  const region = value.regions.find(item => item.id === regionId);
  if (!region) throw new Error('This Reception cell is no longer available.');
  return region;
}
function replaceScene(value, regionId, scene) {
  const available = new Set(records(value).map(item => item.id));
  if (!validReceptionScene(scene, available)) throw new Error('The layer must stay inside its Reception cell.');
  return { ...value, regions: value.regions.map(region => region.id === regionId ? { ...region, content: null, scene } : region) };
}
export function promoteReceptionScene(value, regionId) {
  const region = regionOf(value, regionId);
  if (region.scene) return value;
  if (region.content && !isContent(value, region.content)) throw new Error('Layers can be added to an empty, Image or Text cell.');
  const geometry = { ...RECEPTION_SCENE_GEOMETRY };
  const placements = region.content ? [{ id: region.content, column: 0, row: 0,
    columnSpan: geometry.columns, rowSpan: geometry.rows, locked: false }] : [];
  return replaceScene(value, regionId, { geometry, placements });
}
export function addReceptionScenePlacement(value, regionId, contentId, rectangle) {
  if (!isContent(value, contentId)) throw new Error('Choose an available Image, Text or Shape layer.');
  if (value.regions.some(region => receptionRegionContentIds(region).includes(contentId)))
    throw new Error('This content already belongs to a Reception cell.');
  const next = promoteReceptionScene(value, regionId), { scene } = regionOf(next, regionId);
  if (scene.placements.length >= MAX_RECEPTION_LAYERS) throw new Error(`A Reception cell holds up to ${MAX_RECEPTION_LAYERS} layers. Delete a layer before adding another.`);
  const { columns, rows } = scene.geometry;
  if (rectangle && (!exact(rectangle, geometryKeys))) throw new Error('Choose a layer position and size inside its cell.');
  const initial = rectangle || (scene.placements.length ? {
    column: columns / 8, row: rows / 8, columnSpan: columns * 3 / 4,
    rowSpan: value.texts.some(item => item.id === contentId) ? rows / 3 : rows * 3 / 4,
  } : { column: 0, row: 0, columnSpan: columns, rowSpan: rows });
  return replaceScene(next, regionId, { ...scene, placements: [...scene.placements, { id: contentId, ...quantized(initial), locked: false }] });
}
export function changeReceptionScenePlacement(value, regionId, contentId, patch, { mobile = false } = {}) {
  const { scene } = regionOf(value, regionId), item = scene?.placements.find(layer => layer.id === contentId);
  if (!item) throw new Error('Select an available layer in this Reception cell.');
  if (!patch || Object.keys(patch).some(key => ![...geometryKeys, 'locked'].includes(key))) throw new Error('Choose a layer position, size or lock setting.');
  if (item.locked && Object.keys(patch).some(key => key !== 'locked')) throw new Error('Unlock this layer before moving or resizing it.');
  const hasGeometry = geometryKeys.some(key => Object.hasOwn(patch, key));
  const updated = { ...item, ...Object.hasOwn(patch, 'locked') ? { locked: patch.locked } : {} };
  if (!mobile && hasGeometry) Object.assign(updated, quantized({ ...item, ...patch }));
  const next = { ...scene, placements: scene.placements.map(layer => layer.id === contentId ? updated : layer) };
  if (mobile && hasGeometry) {
    const current = receptionScenePlacements(scene, true).find(layer => layer.id === contentId);
    const geometry = quantized({ ...current, ...patch });
    next.mobile = (scene.mobile || []).filter(layer => layer.id !== contentId);
    if (geometryKeys.some(key => geometry[key] !== item[key])) next.mobile.push({ id: contentId, ...geometry });
  }
  return replaceScene(value, regionId, next);
}
export function resetReceptionScenePlacement(value, regionId, contentId) {
  const { scene } = regionOf(value, regionId), item = scene?.placements.find(layer => layer.id === contentId);
  if (!item) throw new Error('Select an available layer in this Reception cell.');
  if (item.locked) throw new Error('Unlock this layer before resetting its mobile placement.');
  if (!scene.mobile?.some(layer => layer.id === contentId)) return value;
  return replaceScene(value, regionId, { ...scene, mobile: scene.mobile.filter(layer => layer.id !== contentId) });
}
export function reorderReceptionScenePlacement(value, regionId, contentId, direction, targetId, edge) {
  const { scene } = regionOf(value, regionId), item = scene?.placements.find(layer => layer.id === contentId);
  if (!item) throw new Error('Select an available layer in this Reception cell.');
  if (item.locked) throw new Error('Unlock this layer before changing its order.');
  const order = reorderArtwork(scene.placements.map(layer => layer.id), [contentId], direction, targetId, edge);
  return replaceScene(value, regionId, { ...scene, placements: order.map(id => scene.placements.find(layer => layer.id === id)) });
}
export function removeReceptionScenePlacement(value, regionId, contentId) {
  const { scene } = regionOf(value, regionId), item = scene?.placements.find(layer => layer.id === contentId);
  if (!item) throw new Error('Select an available layer in this Reception cell.');
  if (item.locked) throw new Error('Unlock this layer before deleting it.');
  return pruneReceptionContent(replaceScene(value, regionId, { ...scene, placements: scene.placements.filter(layer => layer.id !== contentId),
    ...(scene.mobile ? { mobile: scene.mobile.filter(layer => layer.id !== contentId) } : {}) }));
}
