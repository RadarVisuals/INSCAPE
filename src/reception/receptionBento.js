import { workbenchArea, validWorkbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { receptionModuleWindow, withReceptionModuleWindow, receptionCellResizeReason, receptionCellSizeLimits,
  validReceptionMemberAnchor, withReceptionMemberAnchors, validReceptionInnerLines, MIN_RECEPTION_CELL_SIZE } from './receptionEditorDocument.js';
import { positionReceptionMembers } from './editorCellGeometry.js';
import { receptionLayoutCountRange, validateReceptionBentoGeometry } from './receptionLayoutGenerator.js';
import { inferredCellGap, partitionDividers } from './receptionPartition.js';

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
  return partitionDividers(tiles(value, gap), { x: MIN_RECEPTION_CELL_SIZE.width + gap, y: MIN_RECEPTION_CELL_SIZE.height + gap }).map(d => {
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
// Only snap a shared edge when both neighbouring strips have common outer
// boundaries. A T junction with unequal outer edges has no single equal split.
export function receptionBentoEqualPosition(value, divider) {
  const axis = divider.axis === 'x' ? 'left' : 'top', size = divider.axis === 'x' ? 'width' : 'height';
  const before = divider.before.map(id => receptionModuleWindow(value, id)[axis]);
  const after = divider.after.map(id => { const r = receptionModuleWindow(value, id); return r[axis] + r[size]; });
  if (!before.every(p => p === before[0]) || !after.every(p => p === after[0])) return null;
  const position = Math.round((before[0] + after[0] + receptionBentoSettings(value).gap) / 2);
  return position >= divider.min && position <= divider.max ? position : null;
}
export function resizeReceptionBento(value, id, position) {
  const d = receptionBentoDividers(value).find(item => item.id === id);
  if (!d || !Number.isFinite(position)) throw new Error('This shared edge is no longer available.');
  const p = Math.round(Math.max(d.min, Math.min(d.max, position))), delta = p - d.position;
  const size = d.axis === 'x' ? 'width' : 'height', { gap } = receptionBentoSettings(value);
  return applyTiles(value, tiles(value, gap).map(r => d.before.includes(r.id) ? { ...r, [size]: r[size] + delta }
    : d.after.includes(r.id) ? { ...r, [d.axis]: p, [size]: r[size] - delta } : r), gap);
}
// A spanning cell joins the rows it crosses. Only complete, unbroken boundaries
// are insertion targets; no persisted row tree or parallel layout is introduced.
export function receptionBentoBands(value) {
  const { gap } = receptionBentoSettings(value), result = [];
  for (const r of value.cells.map(cell => ({ id: cell.id, ...receptionModuleWindow(value, cell.id) })).sort((a, b) => a.top - b.top || a.left - b.left)) {
    const previous = result.at(-1);
    if (previous && r.top < previous.bottom - 0.001) {
      previous.cells.push(r); previous.bottom = Math.max(previous.bottom, r.top + r.height + gap);
    } else result.push({ top: r.top, bottom: r.top + r.height + gap, cells: [r] });
  }
  return result;
}
// Shared by new-cell creation and drag insertion: preserve complete band
// boundaries while reserving space within the existing content-aware limits.
export function receptionBentoBandInsertion(value, regions, position, width, minimum = MIN_RECEPTION_CELL_SIZE.width, maximum = Infinity, axis = 'width') {
  const { gap } = receptionBentoSettings(value);
  if (regions.some(r => r.x < position - 0.001 && r.x + r.width > position + 0.001)) throw new Error('A spanning cell crosses this insertion boundary.');
  const left = Math.min(...regions.map(r => r.x)), right = Math.max(...regions.map(r => r.x + r.width));
  const edges = [...new Set(regions.flatMap(r => [r.x, r.x + r.width]))].sort((a, b) => a - b);
  const offsets = new Map([[left, 0]]);
  for (let i = 1; i < edges.length; i++) offsets.set(edges[i], Math.max(offsets.get(edges[i - 1]),
    ...regions.filter(r => r.x + r.width === edges[i]).map(r => offsets.get(r.x) + Math.ceil(receptionCellSizeLimits(value, r.id)[axis === 'height' ? 'minimumHeight' : 'minimumWidth']) + gap)));
  const available = right - left - offsets.get(right);
  const reserved = Math.min(Math.max(minimum, width), maximum, available - gap) + gap;
  if (reserved < minimum + gap) throw new Error(axis === 'height'
    ? 'There is not enough room in this row band for the cell. Make room inside the Bento first.'
    : 'This row is too full. There is not enough room for this cell. Use less gutter or a wider Bento.');
  const extra = available - reserved;
  const map = x => left + offsets.get(x) + Math.round((x - left) * extra / (right - left));
  const top = Math.min(...regions.map(r => r.y)), bottom = Math.max(...regions.map(r => r.y + r.height));
  return { regions: regions.map(r => ({ ...r, x: map(r.x) + (r.x >= position - 0.001 ? reserved : 0), width: map(r.x + r.width) - map(r.x) })),
    added: { x: map(position), y: top, width: reserved, height: bottom - top } };
}
export function addReceptionBentoCell(value, id, newId = `shape:${crypto.randomUUID()}`, side = 'right') {
  const cell = value.cells.find(item => item.id === id), frame = receptionModuleWindow(value, id);
  if (!cell || !frame) throw new Error('Select a row by choosing one of its cells.');
  if (value.cells.length >= receptionLayoutCountRange(value).max) throw new Error('There is no room for another cell.');
  const { gap } = receptionBentoSettings(value);
  const band = receptionBentoBands(value).find(row => row.cells.some(cell => cell.id === id));
  const row = band.cells.map(r => ({ id: r.id, x: r.left, y: r.top, width: r.width + gap, height: r.height + gap }));
  const left = Math.min(...row.map(r => r.x)), right = Math.max(...row.map(r => r.x + r.width));
  const width = right - left;
  const insertion = receptionBentoBandInsertion(value, row, side === 'left' ? left : right,
    Math.round(width * (frame.width + gap) / (width + frame.width + gap)) - gap);
  const resized = insertion.regions, added = { ...insertion.added, id: newId };
  const after = (side === 'left' ? Math.min : Math.max)(...row.map(r => value.cells.findIndex(item => item.id === r.id)));
  const addedCell = { id: newId, members: [], radius: cell.radius || 0, mobile: { columns: 2, height: cell.mobile.height } };
  const next = { ...value, shapes: [...value.shapes, { id: newId, name: `Cell ${value.cells.length + 1}`, color: '#808080', opacity: 0.25, visibility: 'PUBLIC' }],
    cells: value.cells.flatMap((item, index) => index === after ? (side === 'left' ? [addedCell, item] : [item, addedCell]) : [item]) };
  return applyTiles(next, [...resized, added], gap);
}
export const prependReceptionBentoCell = (value, id, newId) => addReceptionBentoCell(value, id, newId, 'left');
export function appendReceptionBentoRow(value, newId = `shape:${crypto.randomUUID()}`, side = 'below') {
  if (!value.cells.length) throw new Error('Create a layout before adding a row.');
  if (value.cells.length >= receptionLayoutCountRange(value).max) throw new Error('There is no room for another cell.');
  const { gap, padding, radius } = receptionBentoSettings(value), rows = receptionBentoBands(value);
  const row = side === 'above' ? rows[0] : rows.at(-1);
  const regions = row.cells.map(r => ({ id:r.id, x:r.top, y:r.left, width:r.height + gap, height:r.width + gap }));
  const insertion = receptionBentoBandInsertion(value, regions, side === 'above' ? row.top : row.bottom,
    Math.floor((row.bottom - row.top - 2 * gap) / 2), MIN_RECEPTION_CELL_SIZE.height, Infinity, 'height');
  const height = insertion.added.width - gap;
  const addedCell = { id: newId, members: [], radius: radius ?? 0, mobile: { columns: 2, height: Math.max(80, Math.min(1200, height)) } };
  const next = { ...value, bento: { gap, padding },
    shapes: [...value.shapes, { id: newId, name: `Cell ${value.cells.length + 1}`, color: '#808080', opacity: 0.25, visibility: 'PUBLIC' }],
    cells: side === 'above' ? [addedCell, ...value.cells] : [...value.cells, addedCell] };
  return applyTiles(next, [...insertion.regions, { ...insertion.added, id: newId }].map(r =>
    ({ id:r.id, x:r.y, y:r.x, width:r.height, height:r.width })), gap);
}
export const prependReceptionBentoRow = (value, newId) => appendReceptionBentoRow(value, newId, 'above');
export function setReceptionBentoSettings(value, settings) {
  const old = receptionBentoSettings(value), next = { ...old, ...settings }, area = workbenchArea(value.workbench);
  const changeRadius = Object.hasOwn(settings, 'radius');
  validateReceptionBentoGeometry(next);
  if (changeRadius && (!Number.isFinite(next.radius) || next.radius < 0 || next.radius > 160))
    throw new Error('Corner radius must be between 0 and 160 px.');
  if (typeof next.showFrame !== 'boolean') throw new Error('Choose whether to show the outer frame.');
  if (next.innerLines !== null && !validReceptionInnerLines(next.innerLines)) throw new Error('Choose valid Stroke settings for the inner lines.');
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
  for (const axis of ['width', 'height']) {
    const minimum = MIN_RECEPTION_CELL_SIZE[axis];
    const cell = regions.find(region => region[axis] - next.gap < minimum);
    if (cell) {
      const name = value.shapes.find(shape => shape.id === cell.id)?.name || 'This cell';
      const available = Math.max(0, cell[axis] - next.gap);
      throw new Error(`${name} needs at least ${minimum} px of ${axis}. These settings leave ${available} px. Use a larger bento, reduce the gutter or outer margin, or ${axis === 'width' ? 'widen this cell' : 'make this cell taller'} first.`);
    }
  }
  return applyTiles({ ...value, ...appearance, bento: { gap: next.gap, padding: next.padding }, workbench: { ...value.workbench, area: targetArea },
    cells: changeRadius ? value.cells.map(cell => ({ ...cell, radius: next.radius })) : value.cells }, regions, next.gap);
}

export function setReceptionCellRadius(value, id, radius) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  if (!Number.isFinite(radius) || radius < 0 || radius > 160) throw new Error('Choose a corner radius between 0 and 160 pixels.');
  return { ...value, cells: value.cells.map(cell => cell.id === id ? { ...cell, radius } : cell) };
}

export function setReceptionCellClip(value, id, clipContent) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  if (typeof clipContent !== 'boolean') throw new Error('Choose whether to clip cell contents.');
  return { ...value, cells: value.cells.map(cell => cell.id === id ? { ...cell, clipContent } : cell) };
}

export function setReceptionCellMemberAnchor(value, id, members, placement) {
  const cell = value.cells.find(item => item.id === id), frame = receptionModuleWindow(value, id);
  if (!cell || !frame || !Array.isArray(members) || !members.length || new Set(members).size !== members.length
    || members.some(id => !cell.members.includes(id))) throw new Error('Choose native contents in this cell.');
  const anchor = placement === null ? null : { ...placement, members: [...members] };
  if (anchor && !validReceptionMemberAnchor(anchor, cell.members)) throw new Error('Choose a cell position and horizontal/vertical padding between 0 and 512 pixels.');
  const intersecting = (cell.memberAnchors || []).filter(item => item.members.some(id => members.includes(id)));
  const affected = new Set([...members, ...intersecting.flatMap(item => item.members)]);
  if (cell.lockedMembers?.some(id => affected.has(id))) throw new Error('Unlock these contents before changing their position.');
  const retained = (cell.memberAnchors || []).filter(item => !intersecting.includes(item));
  let next = { ...value, cells: value.cells.map(item => item.id === id
    ? withReceptionMemberAnchors(item, anchor ? [...retained, anchor] : retained) : item) };
  if (anchor) {
    const frames = Object.fromEntries(members.map(id => [id, receptionModuleWindow(value, id)]));
    for (const [id, window] of Object.entries(positionReceptionMembers(frame, frames, anchor))) next = withReceptionModuleWindow(next, id, window);
  }
  return next;
}
