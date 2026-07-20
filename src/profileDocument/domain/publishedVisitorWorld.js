import { clampHomeWorldCamera } from '../../public/homeWorldCamera.js';
import { gridRectToPixelRect, normalizeGridRect } from '../../public/gridGeometry.js';
import { createModuleGridGeometry } from '../../public/moduleLayout.js';
import { normalizeSpan, packCompactCanvasObjects, packCompactScene } from '../../public/sceneGrid.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function createPublishedVisitorLayout(document, width, height) {
  const geometry = createModuleGridGeometry(width, height);
  const originX = Math.round((geometry.width + geometry.left) / 40) * 40;
  const originY = Math.round((geometry.height + geometry.top) / 40) * 40;
  const world = { width: geometry.width * 3, height: geometry.height * 3, viewportWidth: geometry.width, viewportHeight: geometry.height };
  const placementGeometry = geometry.narrow ? geometry : {
    ...geometry,
    minColumn: -Math.floor(originX / geometry.cellWidth),
    minRow: -Math.floor(originY / geometry.cellHeight),
    columns: Math.floor(world.width / geometry.cellWidth),
    rows: Math.floor(world.height / geometry.cellHeight),
    usableWidth: world.width,
    usableHeight: world.height
  };
  const authoredSpaces = [...document.spaces].sort((a, b) => a.order - b.order).map((space) => {
    const appearance = space.appearance || { mode: 'label', iconKey: space.kind === 'favorites' ? 'favorites' : 'folder', showLabel: true, columnSpan: 3, rowSpan: 1 };
    const span = normalizeSpan({ columns: appearance.columnSpan, rows: appearance.rowSpan }, appearance.mode, placementGeometry);
    return { id: space.id, space, appearance, span, position: { ...space.placement }, presentationOrder: space.order };
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
  const camera = geometry.narrow ? { x: 0, y: 0, zoom: 1 } : clampHomeWorldCamera({ x: geometry.width, y: geometry.height, zoom: 1 }, world);
  return { geometry, placementGeometry, world, originX, originY, camera, spaces, objects };
}

export function publishedWorldTransform(layout, camera) {
  if (layout.geometry.narrow) return `translate3d(${layout.geometry.left}px,${layout.geometry.top}px,0)`;
  return `translate3d(${(layout.originX - camera.x) * camera.zoom}px,${(layout.originY - camera.y) * camera.zoom}px,0) scale(${camera.zoom})`;
}

export function publishedItemPixelRect(item, layout) {
  return gridRectToPixelRect({ column: item.position.column, row: item.position.row, columnSpan: item.span.columns, rowSpan: item.span.rows }, layout.geometry, 2);
}

export function publishedNavigatorLocations(layout) {
  return [
    ...layout.spaces.map((item) => ({ id: item.id, label: item.space.label, kind: 'launcher', x: layout.originX + item.position.column * layout.geometry.cellWidth, y: layout.originY + item.position.row * layout.geometry.cellHeight })),
    ...layout.objects.map((item) => ({ id: item.id, label: item.asset.cachedName || 'Artwork', kind: 'artwork', x: layout.originX + item.position.column * layout.geometry.cellWidth, y: layout.originY + item.position.row * layout.geometry.cellHeight }))
  ];
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

export function initialVisitorWindowRect(space, layout, camera) {
  const authored = space.windowGeometry;
  const launcher = layout.spaces.find((item) => item.id === space.id);
  const source = authored || (launcher ? { column: launcher.position.column + launcher.span.columns + 1, row: launcher.position.row, columnSpan: 13, rowSpan: 9 } : null);
  const rect = source ? {
    left: layout.originX + source.column * layout.geometry.cellWidth - camera.x * camera.zoom,
    top: layout.originY + source.row * layout.geometry.cellHeight - camera.y * camera.zoom,
    width: source.columnSpan * layout.geometry.cellWidth,
    height: source.rowSpan * layout.geometry.cellHeight
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
  if (action.type === 'open') return {
    windows: { ...current.windows, [id]: { rect: { ...action.rect }, minimized: false } },
    zOrder: [...current.zOrder.filter((entry) => entry !== id), id]
  };
  if (!current.windows[id]) return current;
  if (action.type === 'focus') return { ...current, zOrder: [...current.zOrder.filter((entry) => entry !== id), id] };
  if (action.type === 'minimize') return { ...current, windows: { ...current.windows, [id]: { ...current.windows[id], minimized: !current.windows[id].minimized } } };
  if (action.type === 'geometry') return { ...current, windows: { ...current.windows, [id]: { ...current.windows[id], rect: { ...action.rect } } } };
  return current;
}
