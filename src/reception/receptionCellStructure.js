import { receptionBentoSettings, receptionBentoDividers, resizeReceptionBento } from './receptionBento.js';
import { receptionModuleWindow, withReceptionModuleWindow, receptionModuleSizeReason, reconcileReceptionCells } from './receptionEditorDocument.js';

const near = (a, b) => Math.abs(a - b) < 0.001;
const directions = { above: ['top', 'height', 'left', 'width', -1], below: ['top', 'height', 'left', 'width', 1],
  left: ['left', 'width', 'top', 'height', -1], right: ['left', 'width', 'top', 'height', 1] };

// Keep the selected cell's cross-axis span. Align the neighbouring strip using
// the same shared edges and content-aware limits as a manual divider resize.
export function receptionCellMerge(value, id, direction) {
  const cell = value.cells.find(item => item.id === id), frame = receptionModuleWindow(value, id);
  if (!cell || !directions[direction]) return { reason: 'Choose an available cell and merge direction.' };
  const [axis, size, cross, crossSize, sign] = directions[direction], { gap } = receptionBentoSettings(value);
  let neighbours = value.cells.filter(item => item.id !== id).map(cell => ({ cell, frame: receptionModuleWindow(value, cell.id) }))
    .filter(({ frame: r }) => near(sign > 0 ? frame[axis] + frame[size] + gap : r[axis] + r[size] + gap, sign > 0 ? r[axis] : frame[axis])
      && Math.max(frame[cross], r[cross]) < Math.min(frame[cross] + frame[crossSize], r[cross] + r[crossSize]) - 0.001)
    .sort((a, b) => a.frame[cross] - b.frame[cross]);
  if (!neighbours.length) return { reason: 'There is no neighbouring cell in this direction.' };
  let end = frame[cross];
  const completeStrip = neighbours.every(({ frame: r }) => {
    const aligned = near(r[cross], end) && near(r[size], neighbours[0].frame[size]);
    end = r[cross] + r[crossSize] + gap; return aligned;
  }) && near(end - gap, frame[cross] + frame[crossSize]);
  if (!completeStrip) {
    // A small overlap with the next column must not absorb that entire cell.
    // Align the neighbour sharing most of the selected edge instead.
    const overlap = ({ frame: r }) => Math.min(frame[cross] + frame[crossSize], r[cross] + r[crossSize]) - Math.max(frame[cross], r[cross]);
    neighbours = [neighbours.reduce((best, item) => overlap(item) > overlap(best) ? item : best)];
  }
  const cells = [cell, ...neighbours.map(item => item.cell)];
  if (cells.some(cell => !value.workbench.shapes.find(item => item.id === cell.id)?.open))
    return { reason: 'Show the neighbouring cells before merging them.' };
  const visibility = value.shapes.find(item => item.id === id).visibility;
  if (cells.some(cell => value.shapes.find(item => item.id === cell.id).visibility !== visibility))
    return { reason: 'Cells must have the same publication visibility before merging.' };
  if (new Set(cells.map(cell => cell.swipeLink).filter(Boolean)).size > 1)
    return { reason: 'Unlink the two swipe groups before merging their cells.' };
  const linkedCell = cells.find(cell => cell.swipeLink);
  if (linkedCell && cells.some(cell => (cell.slides?.length || 0) > linkedCell.slides.length))
    return { reason: 'Add slides to the linked cell before merging the longer sequence.' };
  if (cells.filter(cell => cell.content).length > 1)
    return { reason: 'These cells contain separate profile or linked-canvas content. Keep them in separate cells.' };
  let aligned = value;
  const edges = [[neighbours[0], false], [neighbours.at(-1), true]].map(([neighbour, trailing]) => {
    const position = neighbour.frame[cross] + (trailing ? neighbour.frame[crossSize] + gap : 0);
    const target = frame[cross] + (trailing ? frame[crossSize] + gap : 0);
    return { neighbour, trailing, target, expanding: trailing ? target > position : target < position };
  }).sort((a, b) => Number(b.expanding) - Number(a.expanding));
  // Make room before contracting the opposite edge when a strip shifts sideways.
  for (const { neighbour, trailing, target } of edges) {
    const r = receptionModuleWindow(aligned, neighbour.cell.id);
    const position = r[cross] + (trailing ? r[crossSize] + gap : 0);
    if (near(position, target)) continue;
    const divider = receptionBentoDividers(aligned).find(d => d.axis === (cross === 'left' ? 'x' : 'y')
      && near(d.position, position) && d[trailing ? 'before' : 'after'].includes(neighbour.cell.id)
      && ![...d.before, ...d.after].includes(id));
    if (!divider) return { reason: 'The neighbouring edge cannot move without changing the selected cell or the outer boundary.' };
    if (target < divider.min || target > divider.max || !near(target, Math.round(target)))
      return { reason: 'There is not enough room to align these cells while keeping their contents within the size limits.' };
    aligned = reconcileReceptionCells(aligned, resizeReceptionBento(aligned, divider.id, target));
  }
  const mergedFrame = { ...frame, [axis]: sign > 0 ? frame[axis] : neighbours[0].frame[axis], [size]: frame[size] + gap + neighbours[0].frame[size] };
  const reason = receptionModuleSizeReason(id, mergedFrame);
  return reason ? { reason } : { cells, frame: mergedFrame, aligned };
}

export function mergeReceptionCells(original, id, direction) {
  const plan = receptionCellMerge(original, id, direction);
  if (plan.reason) throw new Error(plan.reason);
  // Fit artwork during alignment, before transferring membership. The final
  // merge must not scale the selected cell's artwork or fit transferred art twice.
  const value = plan.aligned;
  const { cells, frame } = plan, selected = cells[0], removed = new Set(cells.slice(1).map(cell => cell.id));
  const content = cells.find(cell => cell.content), locked = cells.flatMap(cell => cell.lockedMembers || []);
  const anchors = cells.flatMap(cell => cell.memberAnchors || []);
  const fitText = cells.flatMap(cell => cell.fitText || []);
  const referenceWidth = selected.mobile.referenceWidth || (selected.mobile.columns === 2 ? 390 : 189);
  // Carry existing narrow-view overrides into the merged cell's coordinates.
  // Unoverridden artwork continues to derive its placement from desktop geometry.
  const placements = cells.flatMap(cell => {
    const r = receptionModuleWindow(value, cell.id), reference = cell.mobile.referenceWidth || (cell.mobile.columns === 2 ? 390 : 189);
    return (cell.mobile.placements || []).map(({ id, window: w }) => ({ id, window: {
      left: (r.left - frame.left + w.left / reference * r.width) / frame.width * referenceWidth,
      top: (r.top - frame.top + w.top / cell.mobile.height * r.height) / frame.height * selected.mobile.height,
      width: w.width / reference * r.width / frame.width * referenceWidth,
      height: w.height / cell.mobile.height * r.height / frame.height * selected.mobile.height,
    } }));
  });
  const extraSlides = Math.max(...cells.map(cell => cell.slides?.length || 0));
  const linked = cells.find(cell => cell.swipeLink);
  const merged = { ...selected,
    ...(linked && { swipeLink: linked.swipeLink }),
    ...(extraSlides && { slides: Array.from({ length: extraSlides }, (_, i) => cells.flatMap(cell => cell.slides?.[i] || [])) }),
    members: cells.flatMap(cell => cell.members),
    ...(locked.length ? { lockedMembers: locked } : {}),
    ...(anchors.length ? { memberAnchors: anchors } : {}),
    ...(fitText.length ? { fitText } : {}),
    ...(content ? { content: content.content, ...(content.contentLayout ? { contentLayout: content.contentLayout } : {}) } : {}),
    mobile: { ...selected.mobile, ...(placements.length ? { placements, referenceWidth } : {}) } };
  // Put the surviving background at the backmost merged background's position
  // so it cannot newly cover a neighbour's artwork. Artwork order stays intact.
  let backgroundPlaced = false;
  const mergeLayers = ids => ids.flatMap(item => {
    if (item !== id && !removed.has(item)) return [item];
    if (backgroundPlaced) return [];
    backgroundPlaced = true; return [id];
  });
  const artworkLayers = value.artworkLayers.flatMap(layer => {
    if (typeof layer === 'string') return mergeLayers([layer]);
    const children = mergeLayers(layer.children);
    return children.length ? [{ ...layer, children }] : [];
  });
  return withReceptionModuleWindow({ ...value,
    artworkLayers,
    cells: value.cells.filter(cell => !removed.has(cell.id)).map(cell => cell.id === id ? merged : cell),
    shapes: value.shapes.filter(shape => !removed.has(shape.id)),
    workbench: { ...value.workbench, shapes: value.workbench.shapes.filter(shape => !removed.has(shape.id)) },
  }, id, frame);
}

export function receptionCellStructureActions(value, id) {
  return Object.keys(directions).map(direction => ({ direction,
    ...receptionCellMerge(value, id, direction) }));
}
