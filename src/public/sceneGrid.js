export const SCENE_APPEARANCE_MODES = Object.freeze({ LABEL: 'label', ICON: 'icon', ICON_LABEL: 'icon_label' });
export const LAUNCHER_SIZE_PRESETS = Object.freeze({ square: { columns: 1, rows: 1, appearanceMode: 'icon' }, compact: { columns: 2, rows: 1, appearanceMode: 'icon_label' } });
export function normalizeSpan(span, mode = 'label', geometry) { const min = mode === 'icon' ? 1 : 2; return { columns: Math.max(min, Math.min(geometry?.columns || 24, Math.round(Number(span?.columns) || (mode === 'icon' ? 1 : 3)))), rows: Math.max(1, Math.min(geometry?.rows || 128, Math.round(Number(span?.rows) || 1))) }; }
export function rectsOverlap(a, b) { return a.column < b.column + b.columns && a.column + a.columns > b.column && a.row < b.row + b.rows && a.row + a.rows > b.row; }
export function isScenePlacementAvailable(id, position, span, items, geometry) { const minColumn=geometry.minColumn||0;const minRow=geometry.minRow||0;if (!position || position.column < minColumn || position.row < minRow || position.column + span.columns > minColumn+geometry.columns || position.row + span.rows > minRow+geometry.rows) return false; const candidate = { ...position, ...span }; return items.every((item) => item.id === id || !rectsOverlap(candidate, { ...item.position, ...item.span })); }
export function findScenePlacement(id, requested, span, items, geometry) { const minColumn=geometry.minColumn||0;const minRow=geometry.minRow||0;const maxColumn=minColumn+geometry.columns-span.columns;const maxRow=minRow+geometry.rows-span.rows;const desired = { column: Math.max(minColumn, Math.min(maxColumn, Math.round(requested?.column || 0))), row: Math.max(minRow, Math.min(maxRow, Math.round(requested?.row || 0))) }; const choices = []; for (let row = minRow; row <= maxRow; row += 1) for (let column = minColumn; column <= maxColumn; column += 1) { const position = { column, row }; if (isScenePlacementAvailable(id, position, span, items,geometry)) choices.push({ position, distance: Math.abs(column - desired.column) + Math.abs(row - desired.row) }); } choices.sort((a,b) => a.distance-b.distance || a.position.row-b.position.row || a.position.column-b.position.column); return choices[0]?.position || desired; }
export function packCompactScene(items, geometry) { const packed=[]; [...items].sort((a,b)=>a.presentationOrder-b.presentationOrder || a.id.localeCompare(b.id)).forEach((item)=>{ const span=normalizeSpan({ columns:item.appearanceMode==='icon'?1:Math.min(item.span.columns,geometry.columns), rows:1 },item.appearanceMode,geometry); const position=findScenePlacement(item.id,{column:0,row:0},span,packed,geometry); packed.push({...item,span,position}); }); return packed; }

export function packCompactCanvasObjects(items, geometry) { const packed=[]; [...items].sort((a,b)=>a.presentationOrder-b.presentationOrder || a.id.localeCompare(b.id)).forEach((item)=>{ const span={columns:Math.min(geometry.columns,Math.max(2,item.span.columns)),rows:Math.max(2,Math.min(item.span.rows,geometry.rows))}; const position=findScenePlacement(item.id,{column:0,row:0},span,packed,geometry); packed.push({...item,span,position,geometry:{column:position.column,row:position.row,columnSpan:span.columns,rowSpan:span.rows}}); }); return packed; }

export function gridPixelRect(position, span, geometry, inset = 2) {
  return { left: position.column * geometry.cellWidth + inset, top: position.row * geometry.cellHeight + inset, width: span.columns * geometry.cellWidth - inset * 2, height: span.rows * geometry.cellHeight - inset * 2 };
}

function snapResizeAxis(edge, originCell, cellSize, inset, minimum, maximum) {
  const exactCells = (edge + inset) / cellSize - originCell;
  return Math.max(minimum, Math.min(maximum, Math.round(exactCells)));
}

export function resizeSpanFromPointer({ pointerX, pointerY, grabOffsetX = 0, grabOffsetY = 0, gridLeft = 0, gridTop = 0, origin, geometry, appearanceMode = 'label', minimumSpan, inset = 2 }) {
  const edgeX = pointerX - grabOffsetX - gridLeft;
  const edgeY = pointerY - grabOffsetY - gridTop;
  const minimumColumns = minimumSpan?.columns ?? (appearanceMode === 'icon' ? 1 : 2);
  const minimumRows = minimumSpan?.rows ?? 1;
  return {
    columns: snapResizeAxis(edgeX, origin.column, geometry.cellWidth, inset, minimumColumns, geometry.columns - origin.column),
    rows: snapResizeAxis(edgeY, origin.row, geometry.cellHeight, inset, minimumRows, geometry.rows - origin.row)
  };
}
