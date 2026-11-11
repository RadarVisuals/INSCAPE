import { receptionModuleWindow, withReceptionModuleWindow, MIN_RECEPTION_CELL_SIZE } from './receptionEditorDocument.js';

export function setReceptionTextFit(value, cellId, id, enabled) {
  const cell = value.cells.find(item => item.id === cellId);
  if (!cell?.members.includes(id) || !value.texts.some(text => text.id === id))
    throw new Error('Select a text box in this cell.');
  if (cell.lockedMembers?.includes(id)) throw new Error('Unlock this text before changing its size.');
  const { fitText = [], ...rest } = cell;
  if (fitText.includes(id) === enabled) return value;
  const ids = enabled ? [...fitText, id] : fitText.filter(member => member !== id);
  return { ...value, cells: value.cells.map(item => item === cell ? { ...rest, ...(ids.length ? { fitText: ids } : {}) } : item) };
}

// Measure in work pixels, before camera zoom. Keep the box's centre as it grows;
// the cell reconciler then applies any authored edge or group anchor.
export function fitReceptionText(value, cellId, id, measure, centreInCell = false) {
  const article = value.texts.find(item => item.id === id).article;
  const cell = receptionModuleWindow(value, cellId), previous = receptionModuleWindow(value, id);
  const empty = !article.title && article.content.content.length === 1 && article.content.content[0].type === 'paragraph'
    && !article.content.content[0].content?.length;
  const measured = empty ? MIN_RECEPTION_CELL_SIZE : measure(article, cell);
  const width = Math.max(1, Math.min(cell.width, Math.ceil(measured.width)));
  const height = Math.max(1, Math.min(cell.height, Math.ceil(measured.height)));
  const origin = centreInCell ? cell : previous;
  return withReceptionModuleWindow(value, id, { width, height,
    left: origin.left + (origin.width - width) / 2, top: origin.top + (origin.height - height) / 2 });
}
