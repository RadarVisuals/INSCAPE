import { gridShapeFrame } from './gridShapeGeometry.js';
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
  const kind = placed?.kind ?? 'rectangle';
  if (!source && !['rectangle', 'grid'].includes(kind)) throw new Error('Choose Rectangle or Grid.');
  const appearance = kind === 'grid' ? { kind, grid: { spacing: 24, lineWidth: 1 }, color: '#b8b8b8', opacity: .4 }
    : kind === 'texture' ? { kind, texture: { scale: 1 }, color: '#ffffff', opacity: .25 }
      : { color: '#101111', opacity: 1 };
  const name = kind === 'grid' ? 'Grid' : kind === 'texture' ? 'Texture' : 'Shape';
  const record = { ...(source || { name: `${name} ${(draft.shapes?.length || 0) + 1}`, ...appearance, visibility: 'PUBLIC' }), id: `shape:${crypto.randomUUID()}` };
  if (source) record.name = `${source.name.slice(0, 43)} copy`;
  const layout = placed?.workbench || draft.workbench || createDefaultWorkbenchPresentation();
  const original = source && layout.shapes?.find(item => item.id === source.id);
  const presentation = original ? { ...structuredClone(original), id: record.id, open: true } : createShapePresentation(record.id);
  if (!original && placed?.size) {
    const { width, height } = placed.size;
    if (![width, height].every(value => Number.isFinite(value) && value >= 8 && value <= 3984))
      throw new Error('Choose a rectangle size inside the Workbench.');
    presentation.window = { ...presentation.window, width, height };
  }
  if (!original && record.kind === 'grid') presentation.window = gridShapeFrame(presentation.window, record.grid.spacing, { bounds: { right: presentation.window.left + 3984, bottom: presentation.window.top + 3984 } });
  const position = original ? { left: original.window.left + 24, top: original.window.top + 24 } : placed?.position || presentation.window;
  presentation.window = { ...presentation.window, ...clampWorkbenchPosition(position, presentation.window) };
  commit(store, profile, { ...draft, shapes: [...(draft.shapes || []), record],
    workbench: { ...layout, shapes: [...(layout.shapes || []), presentation] } }, source ? 'Duplicate Shape' : 'Add Shape');
  return record.id;
}
export function editShape(store, profile, expected, changes, presentation) {
  const draft = store.getDraft();
  if (!draft.shapes?.some(item => JSON.stringify(item) === JSON.stringify(expected))) throw new Error('This shape changed. Try again.');
  const shapes = draft.shapes.map(item => item.id === expected.id ? { ...item, ...changes, id: item.id } : item);
  let workbench = draft.workbench;
  if (expected.kind === 'grid' && changes.grid && changes.grid.spacing !== expected.grid.spacing && validShapes(shapes)) {
    workbench = presentation || workbench;
    workbench = { ...workbench, shapes: workbench.shapes.map(item => item.id === expected.id
      ? { ...item, window: gridShapeFrame(item.window, changes.grid.spacing) } : item) };
  }
  commit(store, profile, { ...draft, shapes, ...(workbench ? { workbench } : {}) }, 'Edit Shape');
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
export function prepareShapeResize(draft, { expected, gridScale }) {
  if (!draft.shapes?.some(item => JSON.stringify(item) === JSON.stringify(expected))) throw new Error('This shape changed during resizing. Try again.');
  if (expected.kind === 'grid' && gridScale != null) {
    const spacing = expected.grid.spacing * gridScale;
    if (!Number.isFinite(spacing) || spacing < 8 || spacing > 512) throw new Error('Grid cell size must stay between 8 and 512.');
    return { ...draft, shapes: draft.shapes.map(item => item.id === expected.id ? { ...item, grid: { ...item.grid, spacing } } : item) };
  }
  return draft;
}
