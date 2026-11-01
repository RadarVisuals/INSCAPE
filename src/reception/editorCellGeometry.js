// Cells reuse native Editor windows. These are temporary interaction/paint
// projections; persisted geometry remains in the Reception document's workbench.
export const editorCellForModule = (cells, id) => cells.find(cell => cell.id === id || cell.members.includes(id));

export function editorCellMoveIds(cells, ids, editingCellId, groups = []) {
  return [...new Set(ids.flatMap(id => {
    const cell = editorCellForModule(cells, id);
    if (!cell || cell.id !== id && cell.id === editingCellId) return [id];
    const group = groups.find(item => item.members.includes(cell.id));
    return (group?.members || [cell.id]).flatMap(id => { const item = cells.find(cell => cell.id === id); return item ? [id, ...item.members] : []; });
  }))];
}

export function editorCellWindow(presentation, id) {
  return ['shapes', 'imageModules', 'texts'].flatMap(key => presentation?.[key] || []).find(item => item.id === id)?.window;
}

export function transformedCellWindow(frame, transform = {}) {
  if (!frame) return null;
  const source = transform.frame || frame, scale = transform.scale || 1;
  return { left: source.left * scale + (transform.x || 0), top: source.top * scale + (transform.y || 0),
    width: source.width * scale, height: source.height * scale };
}

export function editorCellPreviewTransforms(cells, transforms, presentation, groups = []) {
  let result = transforms;
  const project = (child, source, target) => ({
    left: target.left + (child.left - source.left) * target.width / source.width,
    top: target.top + (child.top - source.top) * target.height / source.height,
    width: child.width * target.width / source.width, height: child.height * target.height / source.height,
  });
  for (const group of groups) {
    const owner = group.members.find(id => transforms[id]), source = editorCellWindow(presentation, owner);
    if (!source) continue;
    const target = transformedCellWindow(source, transforms[owner]);
    for (const id of group.members) {
      if (result[id]) continue;
      const child = editorCellWindow(presentation, id);
      if (!child) continue;
      if (result === transforms) result = { ...transforms };
      result[id] = { scale: 1, x: 0, y: 0, frame: project(child, source, target) };
    }
  }
  for (const cell of cells) {
    const transform = result[cell.id], source = editorCellWindow(presentation, cell.id);
    if (!transform || !source) continue;
    const target = transformedCellWindow(source, transform);
    for (const id of cell.members) {
      // A gesture that already moves both owner and child owns both previews.
      if (transforms[id]) continue;
      const child = editorCellWindow(presentation, id);
      if (!child) continue;
      if (result === transforms) result = { ...transforms };
      result[id] = { scale: 1, x: 0, y: 0, frame: project(child, source, target) };
    }
  }
  return result;
}

export function editorCellClip(cell, child, radius = 0, paintScale = 1) {
  if (!cell || !child || child.width <= 0 || child.height <= 0) return null;
  if (radius > 0) {
    const x = (cell.left - child.left) * paintScale, y = (cell.top - child.top) * paintScale;
    const right = x + cell.width * paintScale, bottom = y + cell.height * paintScale;
    const r = Math.min(radius, cell.width / 2, cell.height / 2) * paintScale;
    // The path retains the parent's real corners even if they lie outside this
    // member. Rounding the intersection would incorrectly round inner artwork.
    return `path('M ${x + r} ${y} H ${right - r} Q ${right} ${y} ${right} ${y + r} V ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} H ${x + r} Q ${x} ${bottom} ${x} ${bottom - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z')`;
  }
  const clamp = value => Math.max(0, Math.min(100, value));
  const top = clamp((cell.top - child.top) / child.height * 100);
  const left = clamp((cell.left - child.left) / child.width * 100);
  const right = clamp((child.left + child.width - cell.left - cell.width) / child.width * 100);
  const bottom = clamp((child.top + child.height - cell.top - cell.height) / child.height * 100);
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}
