import { projectCompositionCellMembers } from './editorCellGeometry.js';
import { compositionModuleWindow } from './compositionEditorDocument.js';
const moduleKeys = ['imageModules', 'texts', 'shapes'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lockedLayerError = () => Object.assign(new Error('Unlock this layer before changing it.'), { code: 'locked' });

export function assertLockedCellMembersUnchanged(before, next, reconciliation = {}) {
  // A child lock protects direct edits; deleting its owning cell removes the whole contents.
  for (const cell of before.cells.filter(cell => next.shapes.some(shape => shape.id === cell.id))) for (const id of cell.lockedMembers || []) {
    const key = moduleKeys.find(key => before[key].some(item => item.id === id));
    const old = before[key].find(item => item.id === id), current = next[key].find(item => item.id === id);
    const content = record => key === 'imageModules' && record ? Object.fromEntries(Object.entries(record).filter(([key]) => !['width', 'height'].includes(key))) : record;
    if (!same(content(old), content(current))) throw lockedLayerError();
    const oldFrame = compositionModuleWindow(before, id), newFrame = compositionModuleWindow(next, id);
    if (same(oldFrame, newFrame)) continue;
    const oldCell = compositionModuleWindow(before, cell.id), newCell = compositionModuleWindow(next, cell.id);
    if (!oldCell || !newCell || same(oldCell, newCell)) throw lockedLayerError();
    const frames = Object.fromEntries(cell.members.map(id => [id, compositionModuleWindow(before, id)]));
    const expected = projectCompositionCellMembers(oldCell, newCell, frames, cell, reconciliation)[id];
    if (!newFrame || Object.keys(expected).some(key => Math.abs(newFrame[key] - expected[key]) > 1)) throw lockedLayerError();
  }
}
