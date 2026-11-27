import { workbenchArea, validWorkbenchArea, resizeWorkbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { compositionModuleWindow, withCompositionModuleWindow, compositionCellResizeReason, compositionCellSizeLimits,
  validCompositionMemberAnchor, withCompositionMemberAnchors, validCompositionInnerLines, MIN_COMPOSITION_CELL_SIZE } from './compositionEditorDocument.js';
import { positionCompositionMembers } from './editorCellGeometry.js';
import { validateCompositionBentoGeometry, COMPOSITION_LAYOUT_DEFAULTS } from './compositionLayoutGenerator.js';
import { inferredCellGap, partitionDividers } from './compositionPartition.js';
import { pushCompositionCellFrames, containCompositionFrames } from './compositionCellPush.js';

export function compositionBentoSettings(value) {
  const area = workbenchArea(value.workbench), frames = value.cells.map(cell => compositionModuleWindow(value, cell.id));
  const padding = Math.round(Math.max(0, Math.min(256, ...frames.flatMap(r => [r.left - area.left, r.top - area.top,
    area.left + area.width - r.left - r.width, area.top + area.height - r.top - r.height]))));
  const radii = new Set(value.cells.map(cell => cell.radius || 0));
  return { width: area.width, height: area.height, count: value.cells.length, radius: radii.size > 1 ? null : value.cells[0]?.radius || 0, showFrame: value.showFrame !== false, innerLines: value.innerLines ?? null,
    surfaceOpacity: value.surfaceOpacity ?? 1, frameOpacity: value.frameOpacity ?? 1, frameRadius: value.frameRadius ?? 0, surface: value.surface ?? null, frameColor: value.frameColor ?? null, backgroundColor: value.backgroundColor ?? null,
    gap: value.bento?.gap ?? (frames.length ? Math.round(inferredCellGap(frames)) : COMPOSITION_LAYOUT_DEFAULTS.gap),
    padding: value.bento?.padding ?? (frames.length ? padding : COMPOSITION_LAYOUT_DEFAULTS.padding) };
}
export const compositionBentoTiles = (value, gap) => value.cells.map(cell => {
  const frame = compositionModuleWindow(value, cell.id);
  return { id: cell.id, ...frame, width: frame.width + gap, height: frame.height + gap };
});
export const applyCompositionBentoFrames = (value, regions, gap = 0) => regions.reduce((next, r) => {
  const frame = { left: r.left, top: r.top, width: r.width - gap, height: r.height - gap };
  const reason = compositionModuleWindow(value, r.id) && compositionCellResizeReason(value, r.id, frame);
  if (reason) throw new Error(reason);
  return withCompositionModuleWindow(next, r.id, frame);
}, value);
const tiles = (value, gap) => compositionBentoTiles(value, gap).map(r => ({ id: r.id, x: r.left, y: r.top, width: r.width, height: r.height }));
const applyTiles = (value, regions, gap) => applyCompositionBentoFrames(value, regions.map(r => ({ ...r, left: r.x, top: r.y })), gap);
export function compositionBentoDividers(value) {
  const { gap } = compositionBentoSettings(value);
  return partitionDividers(tiles(value, gap), { x: MIN_COMPOSITION_CELL_SIZE.width + gap, y: MIN_COMPOSITION_CELL_SIZE.height + gap }).map(d => {
    const axis = d.axis === 'x' ? 'left' : 'top', size = d.axis === 'x' ? 'width' : 'height';
    const minKey = d.axis === 'x' ? 'minimumWidth' : 'minimumHeight', maxKey = d.axis === 'x' ? 'maximumWidth' : 'maximumHeight';
    let min = d.min, max = d.max;
    for (const id of d.before) {
      const frame = compositionModuleWindow(value, id), limits = compositionCellSizeLimits(value, id);
      min = Math.max(min, frame[axis] + limits[minKey] + gap);
      max = Math.min(max, frame[axis] + limits[maxKey] + gap);
    }
    for (const id of d.after) {
      const frame = compositionModuleWindow(value, id), limits = compositionCellSizeLimits(value, id);
      min = Math.max(min, frame[axis] + frame[size] - limits[maxKey]);
      max = Math.min(max, frame[axis] + frame[size] - limits[minKey]);
    }
    return { ...d, min: Math.ceil(min), max: Math.floor(max) };
  }).filter(d => d.min <= d.max);
}
// Explicit Merge may align neighbouring boundaries before joining them.
export function resizeCompositionBento(value, id, position) {
  const d = compositionBentoDividers(value).find(item => item.id === id);
  if (!d || !Number.isFinite(position)) throw new Error('This shared edge is no longer available.');
  const p = Math.round(Math.max(d.min, Math.min(d.max, position))), delta = p - d.position;
  const size = d.axis === 'x' ? 'width' : 'height', { gap } = compositionBentoSettings(value);
  return applyTiles(value, tiles(value, gap).map(r => d.before.includes(r.id) ? { ...r, [size]: r[size] + delta }
    : d.after.includes(r.id) ? { ...r, [d.axis]: p, [size]: r[size] - delta } : r), gap);
}
export const compositionCellFrames = value => value.cells.map(cell => ({ id: cell.id, ...compositionModuleWindow(value, cell.id) }));
export function pushCompositionBentoCell(value, id, frame, direction) {
  const { gap, padding } = compositionBentoSettings(value);
  const frames = pushCompositionCellFrames(compositionCellFrames(value), id, frame, direction, gap);
  const area = containCompositionFrames(workbenchArea(value.workbench), frames, padding);
  return applyCompositionBentoFrames({ ...value, workbench: { ...value.workbench, area } }, frames);
}
export function resizeCompositionBentoFrame(value, edge, dx, dy) {
  if (!['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].includes(edge) || !Number.isFinite(dx) || !Number.isFinite(dy))
    throw new Error('Choose a Bento frame edge.');
  const requested = resizeWorkbenchArea(workbenchArea(value.workbench), edge, { x: dx, y: dy });
  const area = containCompositionFrames(requested, compositionCellFrames(value), compositionBentoSettings(value).padding);
  return { ...value, workbench: { ...value.workbench, area } };
}
export function setCompositionBentoSettings(value, settings) {
  const old = compositionBentoSettings(value), next = { ...old, ...settings }, area = workbenchArea(value.workbench);
  const changeRadius = Object.hasOwn(settings, 'radius');
  validateCompositionBentoGeometry(next);
  if (changeRadius && (!Number.isFinite(next.radius) || next.radius < 0 || next.radius > 160))
    throw new Error('Corner radius must be between 0 and 160 px.');
  if (typeof next.showFrame !== 'boolean') throw new Error('Choose whether to show the outer frame.');
  if (next.innerLines !== null && !validCompositionInnerLines(next.innerLines)) throw new Error('Choose valid Stroke settings for the inner lines.');
  const appearance = { showFrame: next.showFrame, ...(Object.hasOwn(settings, 'innerLines') ? { innerLines: next.innerLines } : {}) };
  for (const key of ['surface', 'frameColor', 'backgroundColor']) {
    if (next[key] !== null && (typeof next[key] !== 'string' || !/^#[0-9a-f]{6}$/iu.test(next[key]))) throw new Error('Choose a valid six-digit hex color.');
    if (Object.hasOwn(settings, key)) appearance[key] = next[key];
  }
  if (!Number.isFinite(next.frameRadius) || next.frameRadius < 0 || next.frameRadius > 160) throw new Error('Frame radius must be between 0 and 160 px.');
  if (Object.hasOwn(settings, 'frameRadius')) appearance.frameRadius = next.frameRadius;
  for (const [key, label] of [['surfaceOpacity', 'Frame fill'], ['frameOpacity', 'Frame line']]) {
    if (!Number.isFinite(next[key]) || next[key] < 0 || next[key] > 1) throw new Error(`${label} opacity must be between 0 and 100%.`);
    if (Object.hasOwn(settings, key)) appearance[key] = next[key];
  }
  const targetArea = { ...area, width: next.width, height: next.height };
  if (!validWorkbenchArea(targetArea)) throw new Error('This size extends beyond the canvas editing limits.');
  // Appearance changes do not round or relayout authored rectangles.
  if (['width', 'height', 'gap', 'padding'].every(key => next[key] === old[key])) return { ...value, ...appearance,
    cells: changeRadius ? value.cells.map(cell => ({ ...cell, radius: next.radius })) : value.cells };
  // Spacing changes move cells, while frame dimensions only change available space.
  const offset = next.padding - old.padding;
  let frames = compositionCellFrames(value).map(r => ({ ...r, left: r.left + offset, top: r.top + offset }));
  if (next.gap !== old.gap) {
    const original = compositionCellFrames(value);
    for (const [position, size] of [['left', 'width'], ['top', 'height']]) {
      const ordered = [...original].sort((a, b) => a[position] - b[position]);
      for (const cell of ordered) {
        const r = frames.find(item => item.id === cell.id);
        for (const before of ordered) {
          if (before[position] + before[size] > cell[position] + .001) continue;
          const previous = frames.find(item => item.id === before.id);
          r[position] = Math.max(r[position], previous[position] + previous[size] + next.gap);
        }
      }
    }
  }
  const contained = containCompositionFrames(targetArea, frames, next.padding);
  return applyCompositionBentoFrames({ ...value, ...appearance, bento: { gap: next.gap, padding: next.padding }, workbench: { ...value.workbench, area: contained },
    cells: changeRadius ? value.cells.map(cell => ({ ...cell, radius: next.radius })) : value.cells }, frames);
}

export function setCompositionCellRadius(value, id, radius) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  if (!Number.isFinite(radius) || radius < 0 || radius > 160) throw new Error('Choose a corner radius between 0 and 160 pixels.');
  return { ...value, cells: value.cells.map(cell => cell.id === id ? { ...cell, radius } : cell) };
}

export function setCompositionCellGrain(value, id, grainOverContent) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  if (typeof grainOverContent !== 'boolean') throw new Error('Choose where to apply cell grain.');
  return { ...value, cells: value.cells.map(cell => cell.id === id ? { ...cell, grainOverContent } : cell) };
}

export function setCompositionCellClip(value, id, clipContent) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  if (typeof clipContent !== 'boolean') throw new Error('Choose whether to clip cell contents.');
  return { ...value, cells: value.cells.map(cell => cell.id === id ? { ...cell, clipContent } : cell) };
}

export function setCompositionCellSingleLine(value, id, singleLine) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  if (typeof singleLine !== 'boolean') throw new Error('Choose whether to keep text on one line.');
  return { ...value, cells: value.cells.map(cell => cell.id === id ? { ...cell, singleLine } : cell) };
}

export function setCompositionCellMemberAnchor(value, id, members, placement) {
  const cell = value.cells.find(item => item.id === id), frame = compositionModuleWindow(value, id);
  if (!cell || !frame || !Array.isArray(members) || !members.length || new Set(members).size !== members.length
    || members.some(id => !cell.members.includes(id))) throw new Error('Choose native contents in this cell.');
  const anchor = placement === null ? null : { ...placement, members: [...members] };
  if (anchor && !validCompositionMemberAnchor(anchor, cell.members)) throw new Error('Choose a cell position and horizontal/vertical padding between 0 and 512 pixels.');
  const intersecting = (cell.memberAnchors || []).filter(item => item.members.some(id => members.includes(id)));
  const affected = new Set([...members, ...intersecting.flatMap(item => item.members)]);
  if (cell.lockedMembers?.some(id => affected.has(id))) throw new Error('Unlock these contents before changing their position.');
  const retained = (cell.memberAnchors || []).filter(item => !intersecting.includes(item));
  let next = { ...value, cells: value.cells.map(item => item.id === id
    ? withCompositionMemberAnchors(item, anchor ? [...retained, anchor] : retained) : item) };
  if (anchor) {
    const frames = Object.fromEntries(members.map(id => [id, compositionModuleWindow(value, id)]));
    for (const [id, window] of Object.entries(positionCompositionMembers(frame, frames, anchor))) next = withCompositionModuleWindow(next, id, window);
  }
  return next;
}
