export const WINDOW_GEOMETRY_VERSION=2;
export const WINDOW_MINIMUMS=Object.freeze({identity:{width:560,height:360},collection:{width:700,height:460},creations:{width:700,height:460},signals:{width:620,height:420},folder:{width:620,height:420}});
export const WINDOW_GRID_GEOMETRY_VERSION=3;
export const WINDOW_GRID_MINIMUMS=Object.freeze({identity:{columns:8,rows:7},collection:{columns:10,rows:8},creations:{columns:10,rows:8},signals:{columns:9,rows:8},folder:{columns:9,rows:8}});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function windowKind(id=''){if(id==='identity'||id==='identity-panel')return'identity';if(id==='collection'||id==='collection-panel')return'collection';if(id==='creations'||id==='creations-panel')return'creations';if(id==='signals'||id==='signals-panel')return'signals';return'folder';}
export function clampWindowRect(rect,bounds,kind='folder'){
  const minimum=WINDOW_MINIMUMS[kind]||WINDOW_MINIMUMS.folder;
  const boundWidth=Number(bounds?.width)||1;const boundHeight=Number(bounds?.height)||1;
  const minWidth=Math.min(minimum.width,boundWidth);const minHeight=Math.min(minimum.height,boundHeight);
  const width=clamp(Number(rect?.width)||minWidth,minWidth,boundWidth);
  const height=clamp(Number(rect?.height)||minHeight,minHeight,boundHeight);
  return {left:clamp(Number(rect?.left)||0,0,Math.max(0,boundWidth-width)),top:clamp(Number(rect?.top)||0,0,Math.max(0,boundHeight-height)),width,height};
}
export function defaultWindowRect(kind,bounds,anchor={left:0,top:0}){const sizes={identity:{width:680,height:430},collection:{width:860,height:580},creations:{width:860,height:580},signals:{width:760,height:540},folder:{width:760,height:540}};return clampWindowRect({left:anchor.left,top:anchor.top,...sizes[kind]},bounds,kind);}
export function moveWindowRect(rect,delta,bounds,kind){return clampWindowRect({...rect,left:rect.left+delta.x,top:rect.top+delta.y},bounds,kind);}
export function resizeWindowRect(rect,delta,bounds,kind){return clampWindowRect({...rect,width:rect.width+delta.x,height:rect.height+delta.y},bounds,kind);}
export function normalizeWindowRect(rect,bounds){return {left:rect.left/bounds.width,top:rect.top/bounds.height,width:rect.width/bounds.width,height:rect.height/bounds.height};}
export function denormalizeWindowRect(rect,bounds,kind){if(!rect)return null;return clampWindowRect({left:rect.left*bounds.width,top:rect.top*bounds.height,width:rect.width*bounds.width,height:rect.height*bounds.height},bounds,kind);}
export function encodeFreeformWindowGeometry(rects){return JSON.stringify({version:WINDOW_GEOMETRY_VERSION,rects});}
export function decodeFreeformWindowGeometry(source,bounds){try{const record=typeof source==='string'?JSON.parse(source):source;if(record?.version!==WINDOW_GEOMETRY_VERSION||!record.rects||typeof record.rects!=='object')return{};return Object.fromEntries(Object.entries(record.rects).flatMap(([id,rect])=>{if(!rect||['left','top','width','height'].some(key=>!Number.isFinite(rect[key])))return[];return[[id,normalizeWindowRect(denormalizeWindowRect(rect,bounds,windowKind(id)),bounds)]];}));}catch{return{}}}
export function migrateSpanWindowGeometry(source,positions,geometry){try{const record=typeof source==='string'?JSON.parse(source):source;if(record?.version!==1)return{};const bounds={width:geometry.usableWidth,height:geometry.usableHeight};return Object.fromEntries(Object.entries(record.spans||{}).map(([id,span])=>{const position=positions[id]||{column:0,row:0};const rect=clampWindowRect({left:position.column*geometry.cellWidth,top:position.row*geometry.cellHeight,width:span.columns*geometry.cellWidth,height:span.rows*geometry.cellHeight},bounds,windowKind(id));return[id,normalizeWindowRect(rect,bounds)];}));}catch{return{}}}

export function windowMinimumSpan(id, geometry) {
  const minimum = WINDOW_GRID_MINIMUMS[windowKind(id)] || WINDOW_GRID_MINIMUMS.folder;
  return { columns: Math.min(minimum.columns, geometry.columns), rows: Math.min(minimum.rows, geometry.rows) };
}

export function defaultWindowGridRect(id, geometry, anchor = { column: 0, row: 0 }) {
  const defaults = { identity: { columns: 11, rows: 8 }, collection: { columns: 15, rows: 10 }, creations: { columns: 15, rows: 10 }, signals: { columns: 13, rows: 9 }, folder: { columns: 13, rows: 9 } };
  const span = defaults[windowKind(id)] || defaults.folder;
  const columnSpan = Math.min(span.columns, geometry.columns);
  const rowSpan = Math.min(span.rows, geometry.rows);
  const minColumn = geometry.minColumn || 0;
  const minRow = geometry.minRow || 0;
  return { column: clamp(Math.round(anchor.column || 0), minColumn, minColumn + geometry.columns - columnSpan), row: clamp(Math.round(anchor.row || 0), minRow, minRow + geometry.rows - rowSpan), columnSpan, rowSpan };
}

export function defaultFolderWindowGridRect(geometry, launcherRect = { column: 0, row: 0, columnSpan: 1, rowSpan: 1 }) {
  const span = defaultWindowGridRect('folder', geometry);
  const minColumn = geometry.minColumn || 0;
  const maxColumn = minColumn + geometry.columns;
  const rightColumn = launcherRect.column + (launcherRect.columnSpan || 1) + 1;
  const leftColumn = launcherRect.column - span.columnSpan - 1;
  const column = rightColumn + span.columnSpan <= maxColumn
    ? rightColumn
    : leftColumn >= minColumn ? leftColumn : launcherRect.column;
  return defaultWindowGridRect('folder', geometry, { column, row: launcherRect.row });
}

export function encodeWindowGridGeometry(rects) { return JSON.stringify({ version: WINDOW_GRID_GEOMETRY_VERSION, rects }); }

function validGridRect(rect) { return rect && ['column','row','columnSpan','rowSpan'].every((key) => Number.isInteger(rect[key])) && rect.columnSpan >= 1 && rect.rowSpan >= 1; }
function clampGridRect(rect, geometry, id) {
  const minimum = windowMinimumSpan(id, geometry);
  const columnSpan = clamp(rect.columnSpan, minimum.columns, geometry.columns);
  const rowSpan = clamp(rect.rowSpan, minimum.rows, geometry.rows);
  const minColumn = geometry.minColumn || 0;
  const minRow = geometry.minRow || 0;
  return { column: clamp(rect.column, minColumn, minColumn + geometry.columns - columnSpan), row: clamp(rect.row, minRow, minRow + geometry.rows - rowSpan), columnSpan, rowSpan };
}

export function decodeWindowGridGeometry(source, geometry, legacyPositions = {}) {
  try {
    const record = typeof source === 'string' ? JSON.parse(source) : source;
    if (record?.version === WINDOW_GRID_GEOMETRY_VERSION && record.rects && typeof record.rects === 'object') {
      return Object.fromEntries(Object.entries(record.rects).flatMap(([id, rect]) => validGridRect(rect) ? [[id, clampGridRect(rect, geometry, id)]] : []));
    }
    if (record?.version === 1 && record.spans) {
      return Object.fromEntries(Object.entries(record.spans).flatMap(([id, span]) => Number.isInteger(span?.columns) && Number.isInteger(span?.rows) ? [[id, clampGridRect({ ...(legacyPositions[id] || { column: 0, row: 0 }), columnSpan: span.columns, rowSpan: span.rows }, geometry, id)]] : []));
    }
    if (record?.version === WINDOW_GEOMETRY_VERSION && record.rects) {
      return Object.fromEntries(Object.entries(record.rects).flatMap(([id, rect]) => {
        if (!rect || ['left','top','width','height'].some((key) => !Number.isFinite(rect[key]))) return [];
        return [[id, clampGridRect({ column: Math.round(rect.left * geometry.columns), row: Math.round(rect.top * geometry.rows), columnSpan: Math.round(rect.width * geometry.columns), rowSpan: Math.round(rect.height * geometry.rows) }, geometry, id)]];
      }));
    }
  } catch { /* Corrupt geometry safely falls back to defaults. */ }
  return {};
}
