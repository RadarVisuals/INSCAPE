import { moduleEdgeMatch, modulePositionMatch, gridEdgeMatch } from '../public/ownerSystemWorkflow/workbenchEdgeSnap.js';
import { WORKBENCH_GRID_STEP } from '../public/ownerSystemWorkflow/workbenchGrid.js';
import { compositionModuleWindow } from './compositionEditorDocument.js';
import { compositionBentoSettings, compositionCellFrames } from './compositionBento.js';
import { moveCompositionBentoCell, placeCompositionBentoCells } from './compositionBentoInsertion.js';
import { resizeCompositionCell } from './compositionCellSizing.js';
import { stopCompositionCellFrame } from './compositionCellPush.js';

const edgeValue = (r, side) => side === 'right' ? r.left + r.width : side === 'bottom' ? r.top + r.height : r[side];
const scaled = (r, scale) => ({ id: r.id, left: r.left * scale, top: r.top * scale, width: r.width * scale, height: r.height * scale });
const positions = value => compositionCellFrames(value).map(({ id, left, top }) => ({ id, left, top }));

// Keep the selected cells rigid. The first neighbour encountered by any
// selected cell limits the movement of the entire selection.
export function createCellClusterGesture(origin, ids, scale, gridStep = WORKBENCH_GRID_STEP) {
  const frames = compositionCellFrames(origin), selected = new Set(ids);
  const moving = frames.filter(frame => selected.has(frame.id));
  const looseIds = [...selected].filter(id => !origin.cells.some(cell => cell.id === id || cell.members.includes(id)));
  const obstacles = frames.filter(frame => !selected.has(frame.id));
  const { gap, padding } = compositionBentoSettings(origin);
  const bounds = [...moving, ...looseIds.map(id => compositionModuleWindow(origin, id))];
  const distance = (delta, side, bypass) => {
    if (bypass || !delta) return Math.round(delta / scale);
    const edge = Math.min(...bounds.map(frame => frame[side]));
    const start = origin.workbench.area[side] + padding;
    return Math.round((edge + delta / scale - start) / gridStep) * gridStep + start - edge;
  };
  let started = false;
  return (delta, bypass = false) => {
    started ||= Math.hypot(delta.x, delta.y) >= 6;
    if (!started) return null;
    const dx = distance(delta.x, 'left', bypass), dy = distance(delta.y, 'top', bypass);
    let x = dx, y = dy;
    for (const frame of moving) {
      const stopped = stopCompositionCellFrame(obstacles, frame.id, frame,
        { ...frame, left: frame.left + dx, top: frame.top + dy }, gap);
      if (Math.abs(stopped.left - frame.left) < Math.abs(x)) x = stopped.left - frame.left;
      if (Math.abs(stopped.top - frame.top) < Math.abs(y)) y = stopped.top - frame.top;
    }
    const placements = frames.map(({ id, left, top }) => selected.has(id)
      ? { id, left: left + x, top: top + y } : { id, left, top });
    const layers = looseIds.map(id => {
      const frame = compositionModuleWindow(origin, id);
      return { id, left: frame.left + x, top: frame.top + y };
    });
    return { action: 'placeCells', args: [placements, layers], next: placeCompositionBentoCells(origin, placements, layers), guides: [] };
  };
}

// Gesture-local state only. The initial document owns Undo; the last preview
// owns movement direction and neighbour positions until release or cancellation.
export function createCompositionCellGesture(origin, id, edge, scale, gridStep = WORKBENCH_GRID_STEP) {
  const frame = compositionModuleWindow(origin, id), { gap, padding } = compositionBentoSettings(origin);
  if (!frame || !origin.cells.some(c => c.id === id) || !Number.isFinite(scale) || scale <= 0
    || edge && !['n','ne','e','se','s','sw','w','nw'].includes(edge)) throw new Error('Choose a cell gesture.');
  const gridOrigin = { left: origin.workbench.area.left + padding, top: origin.workbench.area.top + padding };
  let current = origin, matches = {}, started = false;
  return (delta, bypass = false, push = false) => {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) throw new Error('Choose a valid pointer position.');
    started ||= Math.hypot(delta.x, delta.y) >= 6;
    if (!started) return null;
    const dx = delta.x / scale, dy = delta.y / scale;
    let desired = { ...frame, left: frame.left + dx, top: frame.top + dy };
    if (edge) desired = { left: frame.left + (edge.includes('w') ? dx : 0), top: frame.top + (edge.includes('n') ? dy : 0),
      width: frame.width + (edge.includes('e') ? dx : edge.includes('w') ? -dx : 0),
      height: frame.height + (edge.includes('s') ? dy : edge.includes('n') ? -dy : 0) };
    const rect = scaled(desired, scale), targets = compositionCellFrames(edge ? origin : current).filter(c => c.id !== id).map(r => scaled(r, scale));
    const movement = !edge && !bypass ? modulePositionMatch(rect, targets, gap * scale, matches) : null;
    const nextMatches = {};
    for (const [axis, low, high, size, leading, trailing, deltaValue] of [
      ['x','left','right','width','w','e',delta.x], ['y','top','bottom','height','n','s',delta.y],
    ]) {
      if (bypass || (edge ? !edge.includes(leading) && !edge.includes(trailing) : Math.abs(deltaValue) < .001)) continue;
      const side = edge?.includes(trailing) ? high : low;
      const value = edgeValue(rect, side);
      const match = (edge ? moduleEdgeMatch(rect, targets, axis, side, value, gap * scale, matches[axis]) : movement.matches[axis])
        || gridEdgeMatch(axis, side, value, gridOrigin[low] * scale, gridStep * scale, matches[axis]);
      nextMatches[axis] = match;
      if (!edge) desired[low] = (match.value - (match.side === high ? rect[size] : 0)) / scale;
      else if (side === low) { desired[low] = match.value / scale; desired[size] = frame[low] + frame[size] - desired[low]; }
      else desired[size] = match.value / scale - frame[low];
    }
    let action, args, next;
    if (edge) {
      const x = edge.includes('w') ? desired.left - frame.left : desired.width - frame.width;
      const y = edge.includes('n') ? desired.top - frame.top : desired.height - frame.height;
      action = 'resizeCell'; args = [id, edge, x, y, push]; next = resizeCompositionCell(origin, ...args);
    } else {
      if (!push) desired = stopCompositionCellFrame(compositionCellFrames(current), id, compositionModuleWindow(current, id), desired, gap);
      const moved = moveCompositionBentoCell(current, id, desired);
      action = 'placeCells'; args = [positions(moved)]; next = placeCompositionBentoCells(origin, ...args);
    }
    const actual = scaled(compositionModuleWindow(next, id), scale);
    matches = Object.fromEntries(Object.entries(nextMatches).filter(([,m]) => Math.abs(edgeValue(actual,m.side)-m.value) <= scale * .51));
    current = next;
    return { action, args, next, guides: Object.values(matches).map(m => ({ ...m, rect: actual })) };
  };
}
