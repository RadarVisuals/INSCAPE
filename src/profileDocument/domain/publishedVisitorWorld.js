import { gridRectToPixelRect, normalizeGridRect } from '../../public/gridGeometry.js';
import { createModuleGridGeometry } from '../../public/moduleLayout.js';
import { normalizeSpan, packCompactCanvasObjects, packCompactScene } from '../../public/sceneGrid.js';
import { createVerticalHomeLayout } from '../../public/verticalHomeWorld.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
export const VISITOR_WINDOW_GRID_SIZE = 40;

export function createPublishedVisitorLayout(document, width, height) {
  const geometry = createModuleGridGeometry(width, height);
  const verticalLayout = createVerticalHomeLayout(geometry);
  const { world, placementGeometry, camera } = verticalLayout;
  const { x: originX, y: originY } = verticalLayout.origin;
  const authoredSpaces = [...document.spaces].sort((a, b) => a.order - b.order).map((space) => {
    const appearance = space.appearance || { mode: 'label', iconKey: space.kind === 'favorites' ? 'favorites' : 'folder', showLabel: true, columnSpan: 3, rowSpan: 1 };
    const span = normalizeSpan({ columns: appearance.columnSpan, rows: appearance.rowSpan }, appearance.mode, placementGeometry);
    const rect = normalizeGridRect({ column:space.placement.column, row:space.placement.row, columnSpan:span.columns, rowSpan:span.rows }, placementGeometry);
    return { id: space.id, space, appearance, span:{ columns:rect.columnSpan, rows:rect.rowSpan }, position:{ column:rect.column, row:rect.row }, presentationOrder:space.order };
  });
  const spaces = geometry.narrow ? packCompactScene(authoredSpaces, geometry) : authoredSpaces;
  const authoredObjects = [...document.canvasObjects].sort((a, b) => a.order - b.order).map((object) => ({
    ...object,
    presentationOrder: object.order,
    position: { ...object.placement },
    span: { ...object.span },
    geometry: normalizeGridRect({ column: object.placement.column, row: object.placement.row, columnSpan: object.span.columns, rowSpan: object.span.rows }, placementGeometry)
  }));
  const objects = geometry.narrow ? packCompactCanvasObjects(authoredObjects, geometry) : authoredObjects;
  return { geometry, placementGeometry, world, originX, originY, camera, spaces, objects };
}

export function publishedWorldTransform(layout, camera) {
  if (layout.geometry.narrow) return `translate3d(${layout.geometry.left}px,${layout.geometry.top}px,0)`;
  return `translate3d(${(layout.originX - camera.x) * camera.zoom}px,${(layout.originY - camera.y) * camera.zoom}px,0) scale(${camera.zoom})`;
}

export function publishedItemPixelRect(item, layout) {
  return gridRectToPixelRect({ column: item.position.column, row: item.position.row, columnSpan: item.span.columns, rowSpan: item.span.rows }, layout.geometry, 2);
}

export function clampVisitorWindowRect(rect, viewport) {
  const margin = viewport.width < 720 ? 12 : 24;
  const maxWidth = Math.max(1, viewport.width - margin * 2);
  const maxHeight = Math.max(1, viewport.height - Math.max(64, margin) - margin);
  const width = clamp(Number(rect?.width) || Math.min(760, maxWidth), Math.min(320, maxWidth), maxWidth);
  const height = clamp(Number(rect?.height) || Math.min(540, maxHeight), Math.min(260, maxHeight), maxHeight);
  return {
    left: clamp(Number(rect?.left) || margin, margin, Math.max(margin, viewport.width - margin - width)),
    top: clamp(Number(rect?.top) || Math.max(64, margin), Math.max(64, margin), Math.max(Math.max(64, margin), viewport.height - margin - height)),
    width,
    height
  };
}

export function snapVisitorWindowRect(rect, viewport, gridSize = VISITOR_WINDOW_GRID_SIZE) {
  const interval = Math.max(1, Number(gridSize) || VISITOR_WINDOW_GRID_SIZE);
  const snap = (value) => Math.round((Number(value) || 0) / interval) * interval;
  return clampVisitorWindowRect({
    left: snap(rect?.left),
    top: snap(rect?.top),
    width: snap(rect?.width),
    height: snap(rect?.height)
  }, viewport);
}

export function resizeVisitorWindowByKey(rect, key, viewport, gridSize = VISITOR_WINDOW_GRID_SIZE) {
  const interval = Math.max(1, Number(gridSize) || VISITOR_WINDOW_GRID_SIZE);
  const delta = {
    ArrowLeft: { width: -interval, height: 0 },
    ArrowRight: { width: interval, height: 0 },
    ArrowUp: { width: 0, height: -interval },
    ArrowDown: { width: 0, height: interval }
  }[key];
  if (!delta) return null;
  return clampVisitorWindowRect({
    ...rect,
    width: rect.width + delta.width,
    height: rect.height + delta.height
  }, viewport);
}

export function initialVisitorWindowRect(space, layout, camera) {
  const authored = space.windowGeometry;
  const launcher = layout.spaces.find((item) => item.id === space.id);
  const source = authored || (launcher ? { column: launcher.position.column + launcher.span.columns + 1, row: launcher.position.row, columnSpan: 13, rowSpan: 9 } : null);
  const rect = source ? {
    left: (layout.originX + source.column * layout.geometry.cellWidth - camera.x) * camera.zoom,
    top: (layout.originY + source.row * layout.geometry.cellHeight - camera.y) * camera.zoom,
    width: source.columnSpan * layout.geometry.cellWidth * camera.zoom,
    height: source.rowSpan * layout.geometry.cellHeight * camera.zoom
  } : null;
  return clampVisitorWindowRect(rect, { width: layout.geometry.width, height: layout.geometry.height });
}

export function createVisitorWindowState(entries = []) {
  return entries.reduce((state, entry) => visitorWindowTransition(state, { type: 'open', ...entry }), { windows: {}, zOrder: [] });
}

export function visitorWindowTransition(state, action) {
  const current = state || { windows: {}, zOrder: [] };
  const id = action?.id;
  if (typeof id !== 'string' || !id) return current;
  if (action.type === 'close') {
    const windows = { ...current.windows }; delete windows[id];
    return { windows, zOrder: current.zOrder.filter((entry) => entry !== id) };
  }
  if (action.type === 'toggle') {
    const entry = current.windows[id];
    if (!entry) return visitorWindowTransition(current, { type: 'open', id, rect: action.rect });
    if (entry.minimized) return visitorWindowTransition(current, { type: 'restore', id });
    return visitorWindowTransition(current, { type: 'close', id });
  }
  if (action.type === 'open') return {
    windows: { ...current.windows, [id]: { rect: { ...action.rect }, minimized: false } },
    zOrder: [...current.zOrder.filter((entry) => entry !== id), id]
  };
  if (!current.windows[id]) return current;
  if (action.type === 'focus') return { ...current, zOrder: [...current.zOrder.filter((entry) => entry !== id), id] };
  if (action.type === 'minimize') return { ...current, windows: { ...current.windows, [id]: { ...current.windows[id], minimized: true } } };
  if (action.type === 'restore') return {
    windows: { ...current.windows, [id]: { ...current.windows[id], minimized: false } },
    zOrder: [...current.zOrder.filter((entry) => entry !== id), id]
  };
  if (action.type === 'geometry') return { ...current, windows: { ...current.windows, [id]: { ...current.windows[id], rect: { ...action.rect } } } };
  return current;
}
