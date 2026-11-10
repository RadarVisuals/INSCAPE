import { receptionModuleWindow } from './receptionEditorDocument.js';
import { receptionBentoDividers, resizeReceptionBento } from './receptionBento.js';

// Numeric dimensions use the same shared-edge operation as the canvas handles.
// Prefer the trailing edge; on the outer boundary use the leading edge instead.
export function receptionCellSizeControl(value, id, axis) {
  const frame = receptionModuleWindow(value, id), size = axis === 'x' ? 'width' : 'height';
  const dividers = receptionBentoDividers(value).filter(item => item.axis === axis);
  const divider = dividers.find(item => item.before.includes(id)) || dividers.find(item => item.after.includes(id));
  if (!frame || !divider) return null;
  const direction = divider.before.includes(id) ? 1 : -1;
  const limits = [divider.min, divider.max].map(position => frame[size] + direction * (position - divider.position));
  return { divider, direction, min: Math.min(...limits), max: Math.max(...limits), value: frame[size] };
}

export function setReceptionCellSize(value, id, dimensions) {
  if (!value.cells.some(cell => cell.id === id)) throw new Error('Select an available cell.');
  let next = value;
  for (const [size, axis] of [['width', 'x'], ['height', 'y']]) {
    if (dimensions[size] === undefined || dimensions[size] === receptionModuleWindow(next, id)[size]) continue;
    const control = receptionCellSizeControl(next, id, axis), requested = dimensions[size];
    if (!control) throw new Error(`Change the Bento ${size} to resize this outer edge.`);
    if (!Number.isFinite(requested) || requested < control.min || requested > control.max)
      throw new Error(`Cell ${size} must be between ${Math.ceil(control.min)} and ${Math.floor(control.max)} px.`);
    next = resizeReceptionBento(next, control.divider.id, control.divider.position + control.direction * (requested - control.value));
  }
  return next;
}
