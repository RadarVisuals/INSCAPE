export const projectReceptionMember = (before, after, member) => ({
  left: after.left + (member.left - before.left) * after.width / before.width,
  top: after.top + (member.top - before.top) * after.height / before.height,
  width: member.width * after.width / before.width, height: member.height * after.height / before.height,
});

// Cells reuse native Editor windows. These are temporary interaction/paint
// projections; persisted geometry remains in the Reception document's workbench.
export const editorCellForModule = (cells, id) => cells.find(cell => cell.id === id || cell.members.includes(id));

export function editorCellMoveIds(cells, ids, editingCellId) {
  return [...new Set(ids.flatMap(id => {
    const cell = editorCellForModule(cells, id);
    if (!cell || cell.id !== id && cell.id === editingCellId) return [id];
    return [cell.id, ...cell.members];
  }))];
}

export function editorCellWindow(presentation, id, content) {
  const image = content?.imageModules?.find(item => item.id === id);
  if (image) {
    const position = presentation?.imageModules?.find(item => item.id === id)?.position;
    return position ? { ...position, width: image.width, height: image.height } : null;
  }
  return presentation?.shapes?.find(item => item.id === id)?.window
    || presentation?.texts?.find(item => item.id === id)?.window;
}

export function transformedCellWindow(frame, transform = {}) {
  if (!frame) return null;
  const source = transform.frame || frame, scale = transform.scale || 1;
  return { left: source.left * scale + (transform.x || 0), top: source.top * scale + (transform.y || 0),
    width: source.width * scale, height: source.height * scale };
}

export function editorCellPreviewTransforms(cells, transforms, presentation, content) {
  let result = transforms;
  for (const cell of cells) {
    const transform = result[cell.id], source = editorCellWindow(presentation, cell.id, content);
    if (!transform || !source) continue;
    const target = transformedCellWindow(source, transform);
    for (const id of cell.members) {
      // A gesture that already moves both owner and child owns both previews.
      if (transforms[id]) continue;
      const child = editorCellWindow(presentation, id, content);
      if (!child) continue;
      if (result === transforms) result = { ...transforms };
      result[id] = { scale: 1, x: 0, y: 0, frame: projectReceptionMember(source, target, child) };
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
