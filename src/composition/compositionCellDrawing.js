import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { SHAPE_ID } from '../shapes/shapes.js';
import { compositionCellSizeLimits, compositionModuleWindow } from './compositionEditorDocument.js';
import { compositionLayoutCountRange } from './compositionLayoutGenerator.js';
import { compositionBentoSettings, compositionCellFrames, pushCompositionBentoCell } from './compositionBento.js';
import { moduleEdgeMatch, modulePositionMatch, gridEdgeMatch } from '../public/ownerSystemWorkflow/workbenchEdgeSnap.js';
import { WORKBENCH_GRID_STEP } from '../public/ownerSystemWorkflow/workbenchGrid.js';
import { compositionFramesOverlap, stopCompositionCellFrame } from './compositionCellPush.js';

// One completed creation: shape, cell, neighbours and canvas are authored together.
export function drawCompositionBentoCell(value, id, frame, direction, sourceId) {
  if (!SHAPE_ID.test(id) || value.shapes.some(s => s.id === id)) throw new Error('Choose a new cell.');
  if (value.cells.length >= compositionLayoutCountRange(value).max) throw new Error('There is no room for another cell.');
  const limits = compositionCellSizeLimits(value, id);
  if (!frame || !['left','top','width','height'].every(k => Number.isFinite(frame[k]))
    || frame.width < limits.minimumWidth || frame.height < limits.minimumHeight
    || frame.width > limits.maximumWidth || frame.height > limits.maximumHeight) throw new Error('Choose a valid cell size.');
  const source = value.cells.find(c => c.id === sourceId) || value.cells.at(-1);
  const appearance = value.shapes.find(s => s.id === source?.id) || { color: '#808080', opacity: .25, visibility: 'PUBLIC' };
  const { gap, padding } = compositionBentoSettings(value);
  const cell = { id, members: [], radius: source?.radius || 0,
    mobile: { columns: 2, height: Math.max(80, Math.min(1200, Math.round(frame.height))) } };
  const next = { ...value, bento: { gap, padding }, cells: [...value.cells, cell],
    shapes: [...value.shapes, { ...appearance, id, name: 'Cell ' + (value.cells.length + 1) }],
    workbench: { ...value.workbench, shapes: [...value.workbench.shapes, { id, open: true, window: frame }] } };
  return pushCompositionBentoCell(next, id, frame, direction);
}

// The same world grid, edge magnets and screen-space retention as moving/resizing.
// This owns only a temporary proposal; the editor's existing gesture owns capture,
// cancellation and the single guarded save on release.
export function createCompositionCellDrawGesture(origin, id, start, scale, sourceId, gridStep = WORKBENCH_GRID_STEP) {
  if (![start.x,start.y,scale].every(Number.isFinite) || scale <= 0) throw new Error('Choose a valid drawing position.');
  const { gap, padding } = compositionBentoSettings(origin), area = workbenchArea(origin.workbench);
  const grid = { x: (area.left + padding) * scale, y: (area.top + padding) * scale };
  const targets = compositionCellFrames(origin).map(r => ({ ...r, left: r.left*scale, top: r.top*scale, width: r.width*scale, height: r.height*scale }));
  const limits = compositionCellSizeLimits(origin,id);
  let matches = {}, started = false;
  return (delta, bypass = false, push = false) => {
    if (![delta.x,delta.y].every(Number.isFinite)) throw new Error('Choose a valid drawing position.');
    started ||= Math.hypot(delta.x,delta.y) >= 6;
    if (!started) return null;
    const point = { left: start.x*scale, top: start.y*scale, width: 0, height: 0 };
    const anchorMatches = !bypass && modulePositionMatch(point,targets,gap*scale).matches;
    const anchor = { x: point.left, y: point.top };
    if (!bypass) for (const [axis,side] of [['x','left'],['y','top']])
      anchor[axis] = (anchorMatches[axis] || gridEdgeMatch(axis,side,anchor[axis],grid[axis],gridStep*scale)).value;
    const end = { x: start.x*scale + delta.x, y: start.y*scale + delta.y };
    const screenRect = { left: Math.min(anchor.x,end.x), top: Math.min(anchor.y,end.y), width: Math.abs(end.x-anchor.x), height: Math.abs(end.y-anchor.y) };
    const nextMatches = {}, rect = {};
    for (const [axis,low,high,size,min,max] of [['x','left','right','width',limits.minimumWidth,limits.maximumWidth],['y','top','bottom','height',limits.minimumHeight,limits.maximumHeight]]) {
      const negative = end[axis] < anchor[axis], side = negative ? low : high;
      const match = !bypass && (moduleEdgeMatch(screenRect,targets,axis,side,end[axis],gap*scale,matches[axis])
        || gridEdgeMatch(axis,side,end[axis],grid[axis],gridStep*scale,matches[axis]));
      const requested = match ? match.value : end[axis];
      const length = Math.max(min,Math.min(max,Math.round(Math.abs(requested-anchor[axis])/scale)));
      rect[low] = anchor[axis]/scale - (negative ? length : 0); rect[size] = length;
      if (match && Math.abs((negative ? rect[low] : rect[low]+length)*scale-match.value) <= .51*scale) nextMatches[axis] = match;
    }
    if (!push) {
      const minimum = { left: anchor.x / scale - (end.x < anchor.x ? limits.minimumWidth : 0),
        top: anchor.y / scale - (end.y < anchor.y ? limits.minimumHeight : 0), width: limits.minimumWidth, height: limits.minimumHeight };
      const neighbours = compositionCellFrames(origin);
      if (neighbours.some(other => compositionFramesOverlap(minimum, other, gap))) return null;
      Object.assign(rect, stopCompositionCellFrame(neighbours, id, minimum, rect, gap));
    }
    const direction = Math.abs(delta.x)>Math.abs(delta.y) ? delta.x<0?'left':'right' : delta.y<0?'top':'bottom';
    const args = [id,rect,direction,sourceId], next = drawCompositionBentoCell(origin,...args);
    matches = nextMatches;
    const frame = compositionModuleWindow(next,id), screen = { left:frame.left*scale, top:frame.top*scale, width:frame.width*scale, height:frame.height*scale };
    return { action:'drawCell', args, next, guides:Object.values(matches).map(m=>({...m,rect:screen})) };
  };
}
