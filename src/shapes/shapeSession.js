import { MAX_SHAPES, validShapes, createShapePresentation } from './shapes.js';
import { createDefaultWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { clampWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';

function commit(store, profile, draft, label) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  if (!validShapes(draft.shapes)) throw new Error('The shape settings are invalid.');
  if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration(), historyLabel: label }))
    throw new Error('The shape could not be saved. Your saved work is unchanged; try again.');
}
export function addShape(store, profile, placed, source = null) {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft();
  if ((draft.shapes?.length || 0) >= MAX_SHAPES) throw new Error('At most 32 shapes are supported.');
  if (source && !draft.shapes?.some(item => JSON.stringify(item) === JSON.stringify(source))) throw new Error('This shape changed. Try again.');
  const record = { ...(source || { name: `Shape ${(draft.shapes?.length || 0) + 1}`, color: '#101111', opacity: 1, visibility: 'PUBLIC' }), id: `shape:${crypto.randomUUID()}` };
  if (source) record.name = `${source.name.slice(0, 43)} copy`;
  const layout = placed?.workbench || draft.workbench || createDefaultWorkbenchPresentation();
  const original = source && layout.shapes?.find(item => item.id === source.id);
  const presentation = original ? { ...structuredClone(original), id: record.id, open: true } : createShapePresentation(record.id);
  const position = original ? { left: original.window.left + 24, top: original.window.top + 24 } : placed?.position || presentation.window;
  presentation.window = { ...presentation.window, ...clampWorkbenchPosition(position, presentation.window) };
  commit(store, profile, { ...draft, shapes: [...(draft.shapes || []), record],
    workbench: { ...layout, shapes: [...(layout.shapes || []), presentation] } }, source ? 'Duplicate Shape' : 'Add Shape');
  return record.id;
}
export function editShape(store, profile, expected, changes) {
  const draft = store.getDraft();
  if (!draft.shapes?.some(item => JSON.stringify(item) === JSON.stringify(expected))) throw new Error('This shape changed. Try again.');
  commit(store, profile, { ...draft, shapes: draft.shapes.map(item => item.id === expected.id ? { ...item, ...changes, id: item.id } : item) }, 'Edit Shape');
}
export function reorderShape(store, profile, id, direction) {
  const draft = store.getDraft(), shapes = [...(draft.shapes || [])], index = shapes.findIndex(item => item.id === id);
  if (index < 0) throw new Error('This shape is no longer available.');
  const target = { back: 0, backward: Math.max(0, index - 1), forward: Math.min(shapes.length - 1, index + 1), front: shapes.length - 1 }[direction];
  if (target === undefined) throw new Error('Choose a shape order.');
  if (target === index) return;
  shapes.splice(target, 0, ...shapes.splice(index, 1));
  commit(store, profile, { ...draft, shapes }, 'Reorder Shape');
}
export function prepareShapeResize(draft, { expected }) {
  if (!draft.shapes?.some(item => JSON.stringify(item) === JSON.stringify(expected))) throw new Error('This shape changed during resizing. Try again.');
  return draft;
}
