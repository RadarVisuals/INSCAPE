import { receptionModuleWindow, withReceptionModuleWindow } from './receptionEditorDocument.js';

export function setReceptionTextFit(value, cellId, id, enabled) {
  const cell = value.cells.find(item => item.id === cellId);
  if (!cell?.members.includes(id) || !value.texts.some(text => text.id === id))
    throw new Error('Select text in this cell.');
  if (cell.lockedMembers?.includes(id)) throw new Error('Unlock text to resize.');
  const { fitText = [], ...rest } = cell;
  if (fitText.includes(id) === enabled) return value;
  const ids = enabled ? [...fitText, id] : fitText.filter(member => member !== id);
  return { ...value, cells: value.cells.map(item => item === cell ? { ...rest, ...(ids.length ? { fitText: ids } : {}) } : item) };
}

// Measure in work pixels, before camera zoom. Keep the box's centre as it grows;
// the cell reconciler then applies any authored edge or group anchor.
export function fitReceptionText(value, cellId, id, measure) {
  const article = value.texts.find(item => item.id === id).article;
  const cell = receptionModuleWindow(value, cellId), previous = receptionModuleWindow(value, id);
  const measured = measure(article, cell);
  if (!measured.width || !measured.height) return value;
  const width = Math.max(1, Math.min(cell.width, Math.ceil(measured.width)));
  const height = Math.max(1, Math.min(cell.height, Math.ceil(measured.height)));
  return withReceptionModuleWindow(value, id, { width, height,
    left: previous.left + (previous.width - width) / 2, top: previous.top + (previous.height - height) / 2 });
}
