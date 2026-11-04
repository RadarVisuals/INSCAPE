import { workbenchArea, validWorkbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { receptionModuleWindow, withReceptionModuleWindow, receptionCellResizeReason, receptionCellSizeLimits, MIN_RECEPTION_CELL_SIZE } from './receptionEditorDocument.js';
import { receptionLayoutCountRange } from './receptionLayoutGenerator.js';
import { inferredCellGap, partitionDividers } from './receptionPartition.js';
import { validShapeOutline } from '../shapes/shapes.js';

export function receptionBentoSettings(value) {
  const area = workbenchArea(value.workbench), frames = value.cells.map(cell => receptionModuleWindow(value, cell.id));
  const padding = Math.round(Math.max(0, Math.min(256, ...frames.flatMap(r => [r.left - area.left, r.top - area.top,
    area.left + area.width - r.left - r.width, area.top + area.height - r.top - r.height]))));
  const radii = new Set(value.cells.map(cell => cell.radius || 0));
  return { width: area.width, height: area.height, count: value.cells.length, radius: radii.size > 1 ? null : value.cells[0]?.radius || 0, showFrame: value.showFrame !== false, innerLines: value.innerLines ?? null,
    gap: value.bento?.gap ?? Math.round(inferredCellGap(frames)), padding: value.bento?.padding ?? padding };
}
const tiles = (value, gap) => value.cells.map(cell => {
  const frame = receptionModuleWindow(value, cell.id);
  return { id: cell.id, x: frame.left, y: frame.top, width: frame.width + gap, height: frame.height + gap };
});
const applyTiles = (value, regions, gap) => regions.reduce((next, r) => {
  const frame = { left: r.x, top: r.y, width: r.width - gap, height: r.height - gap };
  const reason = receptionModuleWindow(value, r.id) && receptionCellResizeReason(value, r.id, frame);
  if (reason) throw new Error(reason);
  return withReceptionModuleWindow(next, r.id, frame);
}, value);
export function receptionBentoDividers(value) {
  const { gap } = receptionBentoSettings(value);
  return partitionDividers(tiles(value, gap), { x: MIN_RECEPTION_CELL_SIZE + gap, y: MIN_RECEPTION_CELL_SIZE + gap }).map(d => {
    const axis = d.axis === 'x' ? 'left' : 'top', size = d.axis === 'x' ? 'width' : 'height';
    const minKey = d.axis === 'x' ? 'minimumWidth' : 'minimumHeight', maxKey = d.axis === 'x' ? 'maximumWidth' : 'maximumHeight';
    let min = d.min, max = d.max;
    for (const id of d.before) {
      const frame = receptionModuleWindow(value, id), limits = receptionCellSizeLimits(value, id);
      min = Math.max(min, frame[axis] + limits[minKey] + gap);
      max = Math.min(max, frame[axis] + limits[maxKey] + gap);
    }
    for (const id of d.after) {
      const frame = receptionModuleWindow(value, id), limits = receptionCellSizeLimits(value, id);
      min = Math.max(min, frame[axis] + frame[size] - limits[maxKey]);
      max = Math.min(max, frame[axis] + frame[size] - limits[minKey]);
    }
    return { ...d, min: Math.ceil(min), max: Math.floor(max) };
  }).filter(d => d.min <= d.max);
}
export function resizeReceptionBento(value, id, position) {
  const d = receptionBentoDividers(value).find(item => item.id === id);
  if (!d || !Number.isFinite(position)) throw new Error('This shared edge is no longer available.');
  const p = Math.round(Math.max(d.min, Math.min(d.max, position))), delta = p - d.position;
  const size = d.axis === 'x' ? 'width' : 'height', { gap } = receptionBentoSettings(value);
  return applyTiles(value, tiles(value, gap).map(r => d.before.includes(r.id) ? { ...r, [size]: r[size] + delta }
    : d.after.includes(r.id) ? { ...r, [d.axis]: p, [size]: r[size] - delta } : r), gap);
}
export function swapReceptionBentoCells(value, first, second) {
  if (first === second) return value;
  if (![first, second].every(id => value.cells.some(cell => cell.id === id))) throw new Error('Choose two available cells.');
  for (const [id, target] of [[first, second], [second, first]]) {
    const reason = receptionCellResizeReason(value, id, receptionModuleWindow(value, target));
    if (reason) throw new Error(reason);
  }
  let next = withReceptionModuleWindow(value, first, receptionModuleWindow(value, second));
  next = withReceptionModuleWindow(next, second, receptionModuleWindow(value, first));
  return { ...next, cells: value.cells.map(cell => cell.id === first ? value.cells.find(c => c.id === second)
    : cell.id === second ? value.cells.find(c => c.id === first) : cell) };
}
export function addReceptionBentoCell(value, id, newId = `shape:${crypto.randomUUID()}`) {
  const cell = value.cells.find(item => item.id === id), frame = receptionModuleWindow(value, id);
  if (!cell || !frame) throw new Error('Select a row by choosing one of its cells.');
  if (value.cells.length >= receptionLayoutCountRange(value).max) throw new Error('There is no room for another cell.');
  const { gap } = receptionBentoSettings(value), regions = tiles(value, gap);
  let top = frame.top, bottom = top + frame.height + gap, row, previous;
  // A cell spanning several rows joins them into one band. Shrink that band
  // together so adding its rightmost cell cannot tear a T junction apart.
  do {
    previous = `${top}:${bottom}`;
    row = regions.filter(r => r.y < bottom && r.y + r.height > top);
    top = Math.min(...row.map(r => r.y)); bottom = Math.max(...row.map(r => r.y + r.height));
  } while (previous !== `${top}:${bottom}`);
  const left = Math.min(...row.map(r => r.x)), right = Math.max(...row.map(r => r.x + r.width));
  const width = right - left, minimum = MIN_RECEPTION_CELL_SIZE + gap;
  const edges = [...new Set(row.flatMap(r => [r.x, r.x + r.width]))].sort((a, b) => a - b);
  const offsets = new Map([[left, 0]]);
  for (let i = 1; i < edges.length; i++) offsets.set(edges[i], Math.max(offsets.get(edges[i - 1]),
    ...row.filter(r => r.x + r.width === edges[i]).map(r => offsets.get(r.x) + Math.ceil(receptionCellSizeLimits(value, r.id).minimumWidth) + gap)));
  const available = width - offsets.get(right);
  if (available < minimum) throw new Error('This row is too full. Add a row below, use less gutter or make the bento wider.');
  const addedWidth = Math.max(minimum, Math.min(available, Math.round(width * (frame.width + gap) / (width + frame.width + gap))));
  const extra = available - addedWidth;
  const map = x => left + offsets.get(x) + Math.round((x - left) * extra / width);
  const resized = row.map(r => ({ ...r, x: map(r.x), width: map(r.x + r.width) - map(r.x) }));
  const added = { id: newId, x: right - addedWidth, y: top, width: addedWidth, height: bottom - top };
  if ([...resized, added].some(r => r.width - gap < MIN_RECEPTION_CELL_SIZE || r.height - gap < MIN_RECEPTION_CELL_SIZE))
    throw new Error('This row is too full. Add a row below, use less gutter or make the bento wider.');
  const after = Math.max(...row.map(r => value.cells.findIndex(item => item.id === r.id)));
  const next = { ...value, shapes: [...value.shapes, { id: newId, name: `Cell ${value.cells.length + 1}`, color: '#808080', opacity: 0.25, visibility: 'PUBLIC' }],
    cells: value.cells.flatMap((item, index) => index === after ? [item, { id: newId, members: [], radius: cell.radius || 0,
      mobile: { columns: 2, height: cell.mobile.height } }] : [item]) };
  return applyTiles(next, [...resized, added], gap);
}
export function appendReceptionBentoRow(value, newId = `shape:${crypto.randomUUID()}`) {
  if (!value.cells.length) throw new Error('Create a layout before adding a row.');
  if (value.cells.length >= receptionLayoutCountRange(value).max) throw new Error('There is no room for another cell.');
  const { gap, padding, radius } = receptionBentoSettings(value), area = workbenchArea(value.workbench);
  const frames = value.cells.map(cell => receptionModuleWindow(value, cell.id));
  const bottom = Math.max(...frames.map(r => r.top + r.height));
  const lastRow = frames.filter(r => r.top + r.height === bottom);
  const height = Math.round(Math.max(MIN_RECEPTION_CELL_SIZE, Math.min(...lastRow.map(r => r.height))));
  const top = Math.max(area.top + area.height - padding, bottom) + gap;
  const targetArea = { ...area, height: Math.ceil(top + height + padding - area.top) };
  if (!validWorkbenchArea(targetArea)) throw new Error('There is no room for another row within the canvas editing limits.');
  const width = area.width - 2 * padding;
  if (width < MIN_RECEPTION_CELL_SIZE) throw new Error('Use a wider bento or less outer margin before adding a row.');
  const next = { ...value, bento: { gap, padding }, workbench: { ...value.workbench, area: targetArea },
    shapes: [...value.shapes, { id: newId, name: `Cell ${value.cells.length + 1}`, color: '#808080', opacity: 0.25, visibility: 'PUBLIC' }],
    cells: [...value.cells, { id: newId, members: [], radius: radius ?? 0, mobile: { columns: 2, height: Math.min(1200, height) } }] };
  return withReceptionModuleWindow(next, newId, { left: area.left + padding, top, width, height });
}
export function setReceptionBentoSettings(value, settings) {
  const old = receptionBentoSettings(value), next = { ...old, ...settings }, area = workbenchArea(value.workbench);
  const changeRadius = Object.hasOwn(settings, 'radius');
  if (![next.width, next.height].every(n => Number.isInteger(n) && n >= 320 && n <= 16384)
    || ![next.gap, next.padding].every(n => Number.isInteger(n) && n >= 0 && n <= 256)
    || changeRadius && (!Number.isFinite(next.radius) || next.radius < 0 || next.radius > 160) || typeof next.showFrame !== 'boolean')
    throw new Error('Choose a valid size, spacing and corner radius.');
  if (next.innerLines !== null && !validShapeOutline(next.innerLines)) throw new Error('Choose valid Outline settings for the inner lines.');
  const appearance = { showFrame: next.showFrame, ...(Object.hasOwn(settings, 'innerLines') ? { innerLines: next.innerLines } : {}) };
  const targetArea = { ...area, width: next.width, height: next.height };
  if (!validWorkbenchArea(targetArea)) throw new Error('This size extends beyond the canvas editing limits.');
  // Appearance changes do not round or relayout authored rectangles.
  if (['width', 'height', 'gap', 'padding'].every(key => next[key] === old[key])) return { ...value, ...appearance,
    cells: changeRadius ? value.cells.map(cell => ({ ...cell, radius: next.radius })) : value.cells };
  const scale = axis => (next[axis] - 2 * next.padding + next.gap) / (old[axis] - 2 * old.padding + old.gap);
  const map = (position, axis, size) => area[axis] + next.padding + Math.round((position - area[axis] - old.padding) * scale(size));
  const regions = tiles(value, old.gap).map(r => {
    const x = map(r.x, 'left', 'width'), y = map(r.y, 'top', 'height');
    return { ...r, x, y, width: map(r.x + r.width, 'left', 'width') - x, height: map(r.y + r.height, 'top', 'height') - y };
  });
  if (regions.some(r => r.width - next.gap < MIN_RECEPTION_CELL_SIZE || r.height - next.gap < MIN_RECEPTION_CELL_SIZE))
    throw new Error('Use a larger bento or less spacing. Each cell needs at least 80 × 80 pixels.');
  return applyTiles({ ...value, ...appearance, bento: { gap: next.gap, padding: next.padding }, workbench: { ...value.workbench, area: targetArea },
    cells: changeRadius ? value.cells.map(cell => ({ ...cell, radius: next.radius })) : value.cells }, regions, next.gap);
}

export function setReceptionCellRadius(value, id, radius) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  if (!Number.isFinite(radius) || radius < 0 || radius > 160) throw new Error('Choose a corner radius between 0 and 160 pixels.');
  return { ...value, cells: value.cells.map(cell => cell.id === id ? { ...cell, radius } : cell) };
}
