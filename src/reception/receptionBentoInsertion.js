import { receptionBentoSettings, pushReceptionBentoCell, receptionCellFrames, applyReceptionBentoFrames } from './receptionBento.js';
import { containReceptionFrames, receptionFramesOverlap } from './receptionCellPush.js';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { receptionModuleWindow } from './receptionEditorDocument.js';

export function moveReceptionBentoCell(value, id, destination) {
  const frame = receptionModuleWindow(value, id);
  if (!value.cells.some(cell => cell.id === id) || !Number.isFinite(destination?.left) || !Number.isFinite(destination?.top))
    throw new Error('Choose an available cell and position.');
  const left = Math.round(destination.left), top = Math.round(destination.top);
  const dx = left - frame.left, dy = top - frame.top;
  if (!dx && !dy) return value;
  const direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'top' : 'bottom';
  return pushReceptionBentoCell(value, id, { ...frame, left, top }, direction);
}
export function receptionBentoKeyboardTarget(value, id, side, large = false) {
  const frame = receptionModuleWindow(value, id), step = large ? 50 : 10;
  if (!frame || !['left', 'right', 'top', 'bottom'].includes(side)) return null;
  return { left: frame.left + (side === 'left' ? -step : side === 'right' ? step : 0),
    top: frame.top + (side === 'top' ? -step : side === 'bottom' ? step : 0) };
}

// Accept the final positions of a continuous drag through the same atomic save
// boundary. Sizes and contents always come from the current authored document.
export function placeReceptionBentoCells(value, positions) {
  if (!Array.isArray(positions) || positions.length !== value.cells.length
    || new Set(positions.map(p => p?.id)).size !== positions.length
    || positions.some(p => !p || !value.cells.some(c => c.id === p.id)
      || Object.keys(p).some(key => !['id', 'left', 'top'].includes(key))
      || !Number.isFinite(p.left) || !Number.isFinite(p.top))) throw new Error('Choose valid cell positions.');
  const frames = receptionCellFrames(value).map(r => ({ ...r, ...positions.find(p => p.id === r.id) }));
  const { gap, padding } = receptionBentoSettings(value);
  if (frames.some((r, i) => frames.slice(i + 1).some(other => receptionFramesOverlap(r, other, gap))))
    throw new Error('Cells must keep their spacing.');
  const area = containReceptionFrames(workbenchArea(value.workbench), frames, padding);
  return applyReceptionBentoFrames({ ...value, workbench: { ...value.workbench, area } }, frames);
}
