import { compositionModuleWindow, compositionCellSizeLimits } from './compositionEditorDocument.js';
import { pushCompositionBentoCell, compositionBentoSettings, compositionCellFrames } from './compositionBento.js';
import { stopCompositionCellFrame } from './compositionCellPush.js';

export function compositionCellSizeControl(value, id, axis) {
  const frame = compositionModuleWindow(value, id), size = axis === 'x' ? 'width' : 'height';
  if (!frame || !value.cells.some(cell => cell.id === id)) return null;
  const limits = compositionCellSizeLimits(value, id);
  return { value: frame[size], min: Math.ceil(limits[axis === 'x' ? 'minimumWidth' : 'minimumHeight']),
    max: Math.floor(limits[axis === 'x' ? 'maximumWidth' : 'maximumHeight']) };
}
export function setCompositionCellSize(value, id, dimensions) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  let next = value;
  for (const [size, axis, direction] of [['width', 'x', 'right'], ['height', 'y', 'bottom']]) {
    if (dimensions[size] === undefined) continue;
    const control = compositionCellSizeControl(next, id, axis), requested = dimensions[size];
    if (!Number.isFinite(requested) || requested < control.min || requested > control.max)
      throw new Error('Cell ' + size + ' must be between ' + control.min + ' and ' + control.max + ' px.');
    const frame = compositionModuleWindow(next, id), rounded = Math.round(requested);
    if (rounded !== frame[size]) next = pushCompositionBentoCell(next, id, { ...frame, [size]: rounded }, direction);
  }
  return next;
}
// Opposite edges stay fixed. Corner gestures resolve each axis independently.
export function resizeCompositionCell(value, id, edge, dx, dy, push = true) {
  if (!['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].includes(edge) || !Number.isFinite(dx) || !Number.isFinite(dy))
    throw new Error('Choose a cell resize handle.');
  let next = value;
  for (const [axis, position, size, leading, trailing, delta, before, after] of [
    ['x', 'left', 'width', 'w', 'e', dx, 'left', 'right'], ['y', 'top', 'height', 'n', 's', dy, 'top', 'bottom'],
  ]) {
    if (!edge.includes(leading) && !edge.includes(trailing)) continue;
    const control = compositionCellSizeControl(next, id, axis);
    if (!control) throw new Error('Select an available cell.');
    const frame = compositionModuleWindow(next, id), fromStart = edge.includes(leading);
    const length = Math.max(control.min, Math.min(control.max, Math.round(frame[size] + (fromStart ? -delta : delta))));
    if (length === frame[size]) continue;
    let requested = { ...frame, [size]: length,
      [position]: frame[position] + (fromStart ? frame[size] - length : 0) };
    if (!push) requested = stopCompositionCellFrame(compositionCellFrames(next), id, frame, requested, compositionBentoSettings(next).gap);
    next = pushCompositionBentoCell(next, id, requested, fromStart ? before : after);
  }
  return next;
}
