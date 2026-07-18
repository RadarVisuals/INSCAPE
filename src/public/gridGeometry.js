export const GRID_RECT_KEYS = Object.freeze(['column', 'row', 'columnSpan', 'rowSpan']);
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function isGridRect(value) {
  return Boolean(value && GRID_RECT_KEYS.every((key) => Number.isInteger(value[key])) && value.column >= 0 && value.row >= 0 && value.columnSpan >= 1 && value.rowSpan >= 1);
}

export function normalizeGridRect(value, bounds, options = {}) {
  const fallback = options.fallback || { column: 0, row: 0, columnSpan: 1, rowSpan: 1 };
  const minimum = options.minimumSpan || { columns: 1, rows: 1 };
  const columns = Math.max(1, integer(bounds?.columns, 1));
  const rows = Math.max(1, integer(bounds?.rows, 1));
  const columnSpan = clamp(integer(value?.columnSpan, fallback.columnSpan), Math.min(minimum.columns, columns), columns);
  const rowSpan = clamp(integer(value?.rowSpan, fallback.rowSpan), Math.min(minimum.rows, rows), rows);
  return { column: clamp(integer(value?.column, fallback.column), 0, columns - columnSpan), row: clamp(integer(value?.row, fallback.row), 0, rows - rowSpan), columnSpan, rowSpan };
}

export function isGridRectWithinBounds(rect, bounds, minimumSpan = { columns: 1, rows: 1 }) {
  return isGridRect(rect) && rect.columnSpan >= minimumSpan.columns && rect.rowSpan >= minimumSpan.rows && rect.column + rect.columnSpan <= bounds.columns && rect.row + rect.rowSpan <= bounds.rows;
}

export function gridRectToPixelRect(rect, geometry, inset = 2) {
  return { left: rect.column * geometry.cellWidth + inset, top: rect.row * geometry.cellHeight + inset, width: Math.max(0, rect.columnSpan * geometry.cellWidth - inset * 2), height: Math.max(0, rect.rowSpan * geometry.cellHeight - inset * 2) };
}

export function clientPointerToGridLocal(pointer, gridClientRect) { return { x: pointer.x - gridClientRect.left, y: pointer.y - gridClientRect.top }; }

export function movementCandidateFromPointer({ pointer, gridClientRect, pointerGrabOffset, originGeometry, geometry, inset = 2 }) {
  const local = clientPointerToGridLocal(pointer, gridClientRect);
  return normalizeGridRect({ ...originGeometry, column: Math.round((local.x - pointerGrabOffset.x - inset) / geometry.cellWidth), row: Math.round((local.y - pointerGrabOffset.y - inset) / geometry.cellHeight) }, geometry, { fallback: originGeometry });
}

export function resizeCandidateFromPointer({ pointer, gridClientRect, pointerGrabOffset, originGeometry, geometry, minimumSpan = { columns: 1, rows: 1 }, inset = 2 }) {
  const local = clientPointerToGridLocal(pointer, gridClientRect);
  return normalizeGridRect({ ...originGeometry, columnSpan: Math.round((local.x - pointerGrabOffset.x + inset) / geometry.cellWidth) - originGeometry.column, rowSpan: Math.round((local.y - pointerGrabOffset.y + inset) / geometry.cellHeight) - originGeometry.row }, geometry, { fallback: originGeometry, minimumSpan });
}

export function gridRectsOverlap(a, b) { return a.column < b.column + b.columnSpan && a.column + a.columnSpan > b.column && a.row < b.row + b.rowSpan && a.row + a.rowSpan > b.row; }
export function launcherGeometryAvailable(id, candidate, items, bounds) { return isGridRectWithinBounds(candidate, bounds) && items.every((item) => item.id === id || !gridRectsOverlap(candidate, item.geometry)); }

export function encodeGridRectRecord(rects) { return JSON.stringify({ version: 1, rects }); }
export function decodeGridRectRecord(source, bounds) { try { const record = typeof source === 'string' ? JSON.parse(source) : source; if (record?.version !== 1 || !record.rects || typeof record.rects !== 'object') return {}; return Object.fromEntries(Object.entries(record.rects).flatMap(([id, rect]) => isGridRect(rect) ? [[id, normalizeGridRect(rect, bounds)]] : [])); } catch { return {}; } }
