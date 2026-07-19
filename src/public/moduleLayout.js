export const MODULE_IDS = Object.freeze(['identity', 'collection', 'creations', 'signals']);
export const MODULE_LAYOUT_STORAGE_KEY = 'human-underneath.module-grid.prototype.v4';
export const LEGACY_MODULE_LAYOUT_STORAGE_KEY = 'human-underneath.module-grid.prototype.v3';
export const MODULE_LAYOUT_VERSION = 4;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function createModuleGridGeometry(width, height) {
  const safeWidth = Math.max(280, Number(width) || 0);
  const safeHeight = Math.max(320, Number(height) || 0);
  const narrow = safeWidth < 720;
  const baseLeft = narrow ? 12 : 24;
  const right = narrow ? 12 : 24;
  const top = narrow ? 64 : safeHeight < 560 ? 58 : 64;
  const bottom = narrow ? 12 : 24;
  const availableWidth = Math.max(1, safeWidth - baseLeft - right);
  const availableHeight = Math.max(1, safeHeight - top - bottom);
  const columns = narrow ? 4 : 24;
  // Public spatial-world geometry uses a stable 40px authored unit. The visual
  // surface emphasizes every second line to reproduce the gallery's 80px rhythm.
  const cellSize = narrow ? availableWidth / columns : 40;
  const rows = Math.max(narrow ? 10 : 8, Math.floor(availableHeight / cellSize));
  const usableWidth = cellSize * columns;
  const usableHeight = cellSize * rows;
  const left = baseLeft + Math.max(0, Math.floor((availableWidth - usableWidth) / 2));
  const majorRows = rows;

  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    left,
    top,
    usableWidth,
    usableHeight,
    columns,
    majorRows,
    rows,
    cellWidth: cellSize,
    majorCellHeight: cellSize,
    cellHeight: cellSize,
    narrow
  });
}

export function getIdentitySpan(geometry) {
  if (geometry.narrow) return { columns: geometry.columns, rows: geometry.rows };
  return { columns: Math.min(geometry.columns, Math.max(8, Math.ceil(680 / geometry.cellWidth))), rows: Math.min(geometry.rows, Math.max(7, Math.ceil(430 / geometry.cellHeight))) };
}

export function getCollectionSpan(geometry) {
  if (geometry.narrow) return { columns: geometry.columns, rows: geometry.rows };
  return { columns: Math.min(geometry.columns, Math.max(10, Math.ceil(860 / geometry.cellWidth))), rows: Math.min(geometry.rows, Math.max(8, Math.ceil(580 / geometry.cellHeight))) };
}

export function getCanvasSpaceSpan(geometry) {
  if (geometry.narrow) return { columns: geometry.columns, rows: geometry.rows };
  return { columns: Math.min(geometry.columns, Math.max(9, Math.ceil(760 / geometry.cellWidth))), rows: Math.min(geometry.rows, Math.max(8, Math.ceil(540 / geometry.cellHeight))) };
}

export function getDefaultModulePositions(geometry) {
  if (geometry.narrow) {
    return {
      identity: { column: 0, row: 0 }, collection: { column: 1, row: 0 }, creations: { column: 2, row: 0 }, signals: { column: 3, row: 0 }
    };
  }

  return {
    identity: { column: 0, row: 0 },
    collection: { column: geometry.columns - 3, row: 0 },
    creations: { column: 0, row: Math.min(geometry.rows - 1, Math.ceil(geometry.rows * 0.6)) },
    signals: { column: geometry.columns - 3, row: geometry.rows - 1 }
  };
}

export function clampModulePosition(position, span, geometry) {
  const minColumn = geometry.minColumn || 0;
  const minRow = geometry.minRow || 0;
  return {
    column: clamp(Math.round(Number(position?.column) || 0), minColumn, minColumn + geometry.columns - span.columns),
    row: clamp(Math.round(Number(position?.row) || 0), minRow, minRow + geometry.rows - span.rows)
  };
}

export function moduleRectsOverlap(firstPosition, firstSpan, secondPosition, secondSpan) {
  return firstPosition.column < secondPosition.column + secondSpan.columns &&
    firstPosition.column + firstSpan.columns > secondPosition.column &&
    firstPosition.row < secondPosition.row + secondSpan.rows &&
    firstPosition.row + firstSpan.rows > secondPosition.row;
}

export function isModulePlacementAvailable(id, position, span, positions, geometry) {
  const clamped = clampModulePosition(position, span, geometry);
  if (clamped.column !== position.column || clamped.row !== position.row) return false;

  return Object.keys(positions).every((otherId) => {
    if (otherId === id || !positions[otherId]) return true;
    return !moduleRectsOverlap(position, span, positions[otherId], { columns: 1, rows: 1 });
  });
}

export function findNearestAvailableModulePosition(id, requestedPosition, span, positions, geometry) {
  const requested = clampModulePosition(requestedPosition, span, geometry);
  const candidates = [];
  for (let row = geometry.minRow || 0; row <= (geometry.minRow || 0) + geometry.rows - span.rows; row += 1) {
    for (let column = geometry.minColumn || 0; column <= (geometry.minColumn || 0) + geometry.columns - span.columns; column += 1) {
      const position = { column, row };
      if (!isModulePlacementAvailable(id, position, span, positions, geometry)) continue;
      const distance = Math.abs(column - requested.column) + Math.abs(row - requested.row);
      candidates.push({ position, distance });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance || a.position.row - b.position.row || a.position.column - b.position.column);
  return candidates[0]?.position ?? requested;
}

export function isExpandedModulePlacementAvailable(position, span, positions, geometry) {
  const clamped = clampModulePosition(position, span, geometry);
  if (clamped.column !== position.column || clamped.row !== position.row) return false;

  return Object.values(positions).every((launcherPosition) => (
    !moduleRectsOverlap(position, span, launcherPosition, { columns: 1, rows: 1 })
  ));
}

export function findNearestExpandedModulePosition(requestedPosition, span, positions, geometry) {
  const requested = clampModulePosition(requestedPosition, span, geometry);
  const candidates = [];

  for (let row = geometry.minRow || 0; row <= (geometry.minRow || 0) + geometry.rows - span.rows; row += 1) {
    for (let column = geometry.minColumn || 0; column <= (geometry.minColumn || 0) + geometry.columns - span.columns; column += 1) {
      const position = { column, row };
      const overlapCount = Object.values(positions).filter((launcherPosition) => (
        moduleRectsOverlap(position, span, launcherPosition, { columns: 1, rows: 1 })
      )).length;
      const distance = Math.abs(column - requested.column) + Math.abs(row - requested.row);
      candidates.push({ position, overlapCount, distance });
    }
  }

  candidates.sort((first, second) => (
    first.overlapCount - second.overlapCount ||
    first.distance - second.distance ||
    first.position.row - second.position.row ||
    first.position.column - second.position.column
  ));

  return candidates[0]?.position ?? requested;
}

export function normalizeModulePositions(candidate, geometry) {
  const defaults = getDefaultModulePositions(geometry);
  if (geometry.narrow || !candidate || typeof candidate !== 'object') return defaults;

  const normalized = {};
  for (const id of MODULE_IDS) {
    const position = candidate[id];
    if (!position || !Number.isInteger(position.column) || !Number.isInteger(position.row)) return defaults;
    const clamped = clampModulePosition(position, { columns: 1, rows: 1 }, geometry);
    normalized[id] = findNearestAvailableModulePosition(
      id,
      clamped,
      { columns: 1, rows: 1 },
      normalized,
      geometry
    );
  }
  return normalized;
}

export function decodeModuleLayout(source, geometry) {
  let record;
  try {
    record = typeof source === 'string' ? JSON.parse(source) : source;
  } catch {
    return getDefaultModulePositions(geometry);
  }
  if (record?.version !== MODULE_LAYOUT_VERSION) return getDefaultModulePositions(geometry);
  return normalizeModulePositions(record.positions, geometry);
}

export function encodeModuleLayout(positions) {
  return JSON.stringify({ version: MODULE_LAYOUT_VERSION, positions });
}

export function normalizeWindowSpans(candidate, geometry) {
  if (!candidate || typeof candidate !== 'object') return {};
  return Object.fromEntries(Object.entries(candidate).flatMap(([id, span]) => {
    if (typeof id !== 'string' || !Number.isInteger(span?.columns) || !Number.isInteger(span?.rows)) return [];
    return [[id, { columns: clamp(span.columns, 6, geometry.columns), rows: clamp(span.rows, 5, geometry.rows) }]];
  }));
}

export function decodeWindowGeometry(source, geometry) {
  try { const record=typeof source==='string'?JSON.parse(source):source; return record?.version===1?normalizeWindowSpans(record.spans,geometry):{}; } catch { return {}; }
}

export function encodeWindowGeometry(spans) { return JSON.stringify({version:1,spans}); }
