import { compositionBentoSettings, pushCompositionBentoCell, compositionCellFrames, applyCompositionBentoFrames } from './compositionBento.js';
import { containCompositionFrames, compositionFramesOverlap } from './compositionCellPush.js';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { compositionModuleWindow, withCompositionModuleWindow } from './compositionEditorDocument.js';

export function moveCompositionBentoCell(value, id, destination) {
  const frame = compositionModuleWindow(value, id);
  if (!value.cells.some(cell => cell.id === id) || !Number.isFinite(destination?.left) || !Number.isFinite(destination?.top))
    throw new Error('Choose an available cell and position.');
  const left = Math.round(destination.left), top = Math.round(destination.top);
  const dx = left - frame.left, dy = top - frame.top;
  if (!dx && !dy) return value;
  const direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'top' : 'bottom';
  return pushCompositionBentoCell(value, id, { ...frame, left, top }, direction);
}
export function compositionBentoKeyboardTarget(value, id, side, large = false) {
  const frame = compositionModuleWindow(value, id), step = large ? 50 : 10;
  if (!frame || !['left', 'right', 'top', 'bottom'].includes(side)) return null;
  return { left: frame.left + (side === 'left' ? -step : side === 'right' ? step : 0),
    top: frame.top + (side === 'top' ? -step : side === 'bottom' ? step : 0) };
}

// Accept the final positions of a continuous drag through the same atomic save
// boundary. Sizes and contents always come from the current authored document.
export function placeCompositionBentoCells(value, positions, layers = []) {
  if (!Array.isArray(positions) || positions.length !== value.cells.length
    || new Set(positions.map(p => p?.id)).size !== positions.length
    || positions.some(p => !p || !value.cells.some(c => c.id === p.id)
      || Object.keys(p).some(key => !['id', 'left', 'top'].includes(key))
      || !Number.isFinite(p.left) || !Number.isFinite(p.top))) throw new Error('Choose valid cell positions.');
  const frames = compositionCellFrames(value).map(r => ({ ...r, ...positions.find(p => p.id === r.id) }));
  const { gap, padding } = compositionBentoSettings(value);
  if (frames.some((r, i) => frames.slice(i + 1).some(other => compositionFramesOverlap(r, other, gap))))
    throw new Error('Cells must keep their spacing.');
  const layerFrames = [];
  for (const { id, left, top } of layers) {
    const frame = compositionModuleWindow(value, id);
    if (!frame || value.cells.some(cell => cell.id === id || cell.members.includes(id)))
      throw new Error('Choose a free artwork layer.');
    const moved = { ...frame, left, top };
    value = withCompositionModuleWindow(value, id, moved);
    layerFrames.push(moved);
  }
  const area = containCompositionFrames(workbenchArea(value.workbench), [...frames, ...layerFrames], padding);
  return applyCompositionBentoFrames({ ...value, workbench: { ...value.workbench, area } }, frames);
}
