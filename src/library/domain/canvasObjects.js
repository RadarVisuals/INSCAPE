import { parseCanonicalAssetId } from '../../profileDocument/domain/assetReference.js';
import { getCanvasObjectDefinition, normalizeCanvasObjectPresentation } from './canvasObjectRegistry.js';

export const CANVAS_OBJECT_ORDER_COMMAND = Object.freeze({
  FORWARD: 'forward', BACKWARD: 'backward', FRONT: 'front', BACK: 'back'
});

const MIN_COLUMN = -255;
const MIN_ROW = -255;
const MAX_COLUMN = 255;
const MAX_ROW = 255;
export const MAX_CANVAS_OBJECT_ID_LENGTH = 200;
export const isValidCanvasObjectId = (value) => typeof value === 'string'
  && value.length <= MAX_CANVAS_OBJECT_ID_LENGTH
  && /^canvas:artwork:[A-Za-z0-9_-]+$/.test(value);
const integer = (value, fallback) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function generatedId() {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `canvas:artwork:${suffix}`;
}

const reindexCanvasObjectOrder = (objects) => objects.map((object, presentationOrder) => ({ ...object, presentationOrder }));
export function normalizeCanvasObjectOrder(objects) {
  return reindexCanvasObjectOrder([...objects].sort((a, b) => a.presentationOrder - b.presentationOrder || a.id.localeCompare(b.id)));
}

export function normalizeCanvasObject(candidate) {
  const definition = getCanvasObjectDefinition(candidate?.kind);
  if (!definition || !isValidCanvasObjectId(candidate?.id) || !parseCanonicalAssetId(candidate?.stableAssetId)) return null;
  const columns = clamp(integer(candidate?.span?.columns, definition.defaultSpan.columns), definition.minimumSpan.columns, definition.maximumSpan.columns);
  const rows = clamp(integer(candidate?.span?.rows, definition.defaultSpan.rows), definition.minimumSpan.rows, definition.maximumSpan.rows);
  const column = clamp(integer(candidate?.placement?.column, 0), MIN_COLUMN, MAX_COLUMN - columns + 1);
  const row = clamp(integer(candidate?.placement?.row, 0), MIN_ROW, MAX_ROW - rows + 1);
  return {
    id: candidate.id,
    kind: definition.kind,
    stableAssetId: candidate.stableAssetId,
    visitorVisible: candidate.visitorVisible === true,
    placement: { column, row },
    span: { columns, rows },
    presentationOrder: Math.max(0, integer(candidate.presentationOrder, 0)),
    presentation: normalizeCanvasObjectPresentation(definition.kind, candidate.presentation)
  };
}

export function normalizeCanvasObjects(candidates) {
  const ids = new Set();
  return normalizeCanvasObjectOrder((Array.isArray(candidates) ? candidates : []).flatMap((candidate) => {
    const object = normalizeCanvasObject(candidate);
    if (!object || ids.has(object.id)) return [];
    ids.add(object.id); return [object];
  }));
}

export function createCanvasObject(workspace, { kind, stableAssetId, placement, id } = {}) {
  const definition = getCanvasObjectDefinition(kind);
  const objectId = id || generatedId();
  if (!definition || !isValidCanvasObjectId(objectId) || !parseCanonicalAssetId(stableAssetId) || workspace.canvas.objects.some((object) => object.id === objectId)) return workspace;
  const object = normalizeCanvasObject({ id: objectId, kind, stableAssetId, visitorVisible: false, placement,
    span: definition.defaultSpan, presentationOrder: workspace.canvas.objects.length, presentation: definition.defaultPresentation });
  return { ...workspace, canvas: { ...workspace.canvas, objects: normalizeCanvasObjectOrder([...workspace.canvas.objects, object]) } };
}

function updateObject(workspace, id, updater) {
  if (!workspace.canvas.objects.some((object) => object.id === id)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, objects: workspace.canvas.objects.map((object) => object.id === id ? updater(object) : object) } };
}

export function setCanvasObjectGeometry(workspace, id, geometry) {
  return updateObject(workspace, id, (object) => normalizeCanvasObject({ ...object,
    placement: { column: geometry?.column, row: geometry?.row }, span: { columns: geometry?.columnSpan, rows: geometry?.rowSpan } }));
}

export function setCanvasObjectPresentation(workspace, id, patch) {
  return updateObject(workspace, id, (object) => ({ ...object, presentation: normalizeCanvasObjectPresentation(object.kind, { ...object.presentation, ...patch }) }));
}

export function replaceCanvasObjectAsset(workspace, id, stableAssetId) {
  if (!parseCanonicalAssetId(stableAssetId)) return workspace;
  return updateObject(workspace, id, (object) => ({ ...object, stableAssetId }));
}

export function setCanvasObjectVisitorVisibility(workspace, id, visitorVisible) {
  if (typeof visitorVisible !== 'boolean') return workspace;
  return updateObject(workspace, id, (object) => ({ ...object, visitorVisible }));
}

export function removeCanvasObject(workspace, id) {
  if (!workspace.canvas.objects.some((object) => object.id === id)) return workspace;
  return { ...workspace, canvas: { ...workspace.canvas, objects: normalizeCanvasObjectOrder(workspace.canvas.objects.filter((object) => object.id !== id)) } };
}

export function reorderCanvasObject(workspace, id, command) {
  const ordered = normalizeCanvasObjectOrder(workspace.canvas.objects);
  const index = ordered.findIndex((object) => object.id === id);
  if (index < 0) return workspace;
  let target = index;
  if (command === CANVAS_OBJECT_ORDER_COMMAND.FORWARD) target = Math.min(ordered.length - 1, index + 1);
  else if (command === CANVAS_OBJECT_ORDER_COMMAND.BACKWARD) target = Math.max(0, index - 1);
  else if (command === CANVAS_OBJECT_ORDER_COMMAND.FRONT) target = ordered.length - 1;
  else if (command === CANVAS_OBJECT_ORDER_COMMAND.BACK) target = 0;
  else return workspace;
  if (target === index) return workspace;
  const next = [...ordered]; const [object] = next.splice(index, 1); next.splice(target, 0, object);
  return { ...workspace, canvas: { ...workspace.canvas, objects: reindexCanvasObjectOrder(next) } };
}
