import { receptionBentoSettings, receptionBentoBandInsertion, receptionBentoBands } from './receptionBento.js';
import { fillDeletedReceptionCells } from './receptionCellDeletion.js';
import { receptionModuleWindow, withReceptionModuleWindow, receptionCellSizeLimits, receptionCellResizeReason } from './receptionEditorDocument.js';
import { validWorkbenchArea } from '../systemWorkflow/domain/workbenchArea.js';

const near = (a, b) => Math.abs(a - b) < 0.001;
const frames = value => value.cells.map(cell => ({ id: cell.id, ...receptionModuleWindow(value, cell.id) }));
// Distance to the finite boundary, including its cross-axis extent. Extending
// every boundary by a fixed tolerance lets thin neighbouring rows steal drops.
export function receptionBentoInsertionDistance(target, point, scale) {
  const along = target.axis === 'x' ? point.x : point.y, cross = target.axis === 'x' ? point.y : point.x;
  return Math.hypot(along - target.position, Math.max(target.from - cross, 0, cross - target.to)) * scale;
}
export function receptionBentoInsertionTargets(value, id) {
  const rows = receptionBentoBands(value), moving = receptionModuleWindow(value, id);
  if (!value.cells.some(cell => cell.id === id) || rows.flatMap(r => r.cells).length < 2) return [];
  const { gap } = receptionBentoSettings(value), all = frames(value);
  const left = Math.min(...all.map(r => r.left)), right = Math.max(...all.map(r => r.left + r.width));
  const fullWidth = near(moving.left, left) && near(moving.left + moving.width, right);
  const targets = [];
  for (const row of rows) {
    const others = row.cells.filter(r => r.id !== id);
    if (!others.length) continue;
    const targetId = others[0].id;
    for (const side of ['above', 'below']) targets.push({ targetId, side, axis: 'y',
      position: (side === 'above' ? row.top : row.bottom) - gap / 2, from: left, to: right });
    if (fullWidth) continue; // A horizontal strip keeps its shape when reordered.
    for (const cell of others) for (const side of ['left', 'right']) {
      const position = cell.left + (side === 'right' ? cell.width + gap : 0);
      if (row.cells.some(r => r.left < position - 0.001 && r.left + r.width + gap > position + 0.001)) continue;
      if (targets.some(t => t.axis === 'x' && near(t.position, position - gap / 2) && near(t.from, row.top))) continue;
      targets.push({ targetId: cell.id, side, axis: 'x', position: position - gap / 2, from: row.top, to: row.bottom - gap });
    }
  }
  return targets;
}

export function insertReceptionBentoCell(value, id, { targetId, side }) {
  if (id === targetId || !['left', 'right', 'above', 'below'].includes(side)) throw new Error('Choose an insertion boundary.');
  const moving = value.cells.find(cell => cell.id === id), target = value.cells.find(cell => cell.id === targetId);
  if (!moving || !target) throw new Error('This cell is no longer available.');
  const originalRows = receptionBentoBands(value), sourceRow = originalRows.find(row => row.cells.some(r => r.id === id));
  const targetRow = originalRows.find(row => row.cells.some(r => r.id === targetId));
  const horizontal = side === 'left' || side === 'right', { gap, padding } = receptionBentoSettings(value);
  const source = receptionModuleWindow(value, id);
  if (horizontal && sourceRow === targetRow) {
    const order = sourceRow.cells.slice().sort((a, b) => a.left - b.left);
    const a = order.findIndex(r => r.id === id), b = order.findIndex(r => r.id === targetId);
    if (a === b + (side === 'left' ? -1 : 1)) return value;
    // Reordering within one complete row needs translation, not removal and
    // refitting. Refitting would repeatedly grow/shrink the unpicked neighbours.
    if (order.every((r, i) => near(r.top, source.top) && near(r.height, source.height)
      && (!i || near(r.left, order[i - 1].left + order[i - 1].width + gap)))) {
      const reordered = order.filter(r => r.id !== id);
      reordered.splice(reordered.findIndex(r => r.id === targetId) + (side === 'right' ? 1 : 0), 0, order[a]);
      let left = order[0].left, next = value;
      for (const r of reordered) {
        next = withReceptionModuleWindow(next, r.id, { left, top: r.top, width: r.width, height: r.height });
        left += r.width + gap;
      }
      const cells = new Map(value.cells.map(cell => [cell.id, cell])), rowIds = new Set(order.map(r => r.id));
      let index = 0;
      return { ...next, cells: value.cells.map(cell => rowIds.has(cell.id) ? cells.get(reordered[index++].id) : cell) };
    }
  }
  if (!horizontal && sourceRow.cells.length === 1) {
    const a = originalRows.indexOf(sourceRow), b = originalRows.indexOf(targetRow);
    if (a === b + (side === 'above' ? -1 : 1)) return value;
  }
  let next = { ...value, cells: value.cells.filter(cell => cell.id !== id) };
  if (sourceRow.cells.length === 1) {
    const height = source.height + gap;
    next = frames(next).reduce((result, r) => withReceptionModuleWindow(result, r.id,
      { left: r.left, top: r.top > source.top ? r.top - height : r.top, width: r.width, height: r.height }), next);
    next = { ...next, workbench: { ...next.workbench, area: { ...next.workbench.area, height: next.workbench.area.height - height } } };
  } else next = fillDeletedReceptionCells(value, next);
  const row = receptionBentoBands(next).find(row => row.cells.some(r => r.id === targetId));
  if (horizontal) {
    const targetFrame = receptionModuleWindow(next, targetId), cut = targetFrame.left + (side === 'right' ? targetFrame.width + gap : 0);
    const regions = row.cells.map(r => ({ id: r.id, x: r.left, y: r.top, width: r.width + gap, height: r.height + gap }));
    const limits = receptionCellSizeLimits(value, id);
    const insertion = receptionBentoBandInsertion(next, regions, cut, Math.round(source.width), Math.ceil(limits.minimumWidth), Math.floor(limits.maximumWidth));
    for (const r of [...insertion.regions, { ...insertion.added, id }]) next = withReceptionModuleWindow(next, r.id,
      { left: r.x, top: r.y, width: r.width - gap, height: r.height - gap });
  } else if (sourceRow.cells.length > 1) {
    // A moved cell is not a new row: reserve its strip inside the target band.
    // Transpose the existing band allocator so the same content limits apply.
    const regions = row.cells.map(r => ({ id: r.id, x: r.top, y: r.left, width: r.height + gap, height: r.width + gap }));
    const insertion = receptionBentoBandInsertion(next, regions, side === 'above' ? row.top : row.bottom,
      source.height, source.height, source.height, 'height');
    for (const r of [...insertion.regions, { ...insertion.added, id }]) next = withReceptionModuleWindow(next, r.id,
      { left: r.y, top: r.x, width: r.height - gap, height: r.width - gap });
  } else {
    const top = side === 'above' ? row.top : row.bottom, area = next.workbench.area;
    next = frames(next).reduce((result, r) => withReceptionModuleWindow(result, r.id,
      { left: r.left, top: r.top >= top - 0.001 ? r.top + source.height + gap : r.top, width: r.width, height: r.height }), next);
    next = { ...next, workbench: { ...next.workbench, area: { ...area, height: area.height + source.height + gap } } };
    next = withReceptionModuleWindow(next, id, { left: area.left + padding, top, width: area.width - 2 * padding, height: source.height });
  }
  if (!validWorkbenchArea(next.workbench.area) || Object.keys(value.workbench.area).some(key => next.workbench.area[key] !== value.workbench.area[key]))
    throw new Error('This insertion cannot fit inside the current Bento.');
  next = { ...next, cells: [...next.cells, moving] };
  for (const cell of next.cells) {
    const reason = receptionCellResizeReason(value, cell.id, receptionModuleWindow(next, cell.id));
    if (reason) throw new Error(reason);
  }
  return { ...next, cells: next.cells.slice().sort((a, b) => {
    const x = receptionModuleWindow(next, a.id), y = receptionModuleWindow(next, b.id);
    return x.top - y.top || x.left - y.left;
  }) };
}
