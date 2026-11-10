export const MIN_RECEPTION_CELL_SIZE = Object.freeze({ width: 80, height: 24 });

export function projectReceptionMember(before, after, member, fitText = false) {
  const sx = after.width / before.width, sy = after.height / before.height;
  const projectedWidth = member.width * sx, projectedHeight = member.height * sy;
  const width = fitText ? member.width : projectedWidth, height = fitText ? member.height : projectedHeight;
  return {
    left: after.left + (member.left - before.left) * sx + (projectedWidth - width) / 2,
    top: after.top + (member.top - before.top) * sy + (projectedHeight - height) / 2,
    width, height,
  };
}

// Anchors are authored placement constraints, not editing locks. An anchor may
// own one member or a group whose relative positions and sizes remain intact.
export function receptionMemberAnchor(cell, members) {
  return members?.length ? cell?.memberAnchors?.find(anchor => members.every(id => anchor.members.includes(id))) ?? null : null;
}

export function positionReceptionMembers(frame, frames, anchor) {
  const members = anchor.members.filter(id => frames[id]);
  if (!members.length) return {};
  const left = Math.min(...members.map(id => frames[id].left)), top = Math.min(...members.map(id => frames[id].top));
  const width = Math.max(...members.map(id => frames[id].left + frames[id].width)) - left;
  const height = Math.max(...members.map(id => frames[id].top + frames[id].height)) - top;
  const x = Math.min(anchor.paddingX, frame.width / 2), y = Math.min(anchor.paddingY, frame.height / 2);
  const dx = frame.left + x + (frame.width - 2 * x - width) * { left: 0, center: .5, right: 1 }[anchor.alignX] - left;
  const dy = frame.top + y + (frame.height - 2 * y - height) * { top: 0, center: .5, bottom: 1 }[anchor.alignY] - top;
  return Object.fromEntries(members.map(id => [id, { ...frames[id], left: frames[id].left + dx, top: frames[id].top + dy }]));
}

// The same projection drives live cell resize, committed geometry and public
// responsive placement. A fitted label follows its relative centre at its measured size.
export function projectReceptionCellMembers(before, after, frames, cell) {
  const result = Object.fromEntries(Object.entries(frames).filter(([, frame]) => frame)
    .map(([id, frame]) => [id, projectReceptionMember(before, after, frame, cell.fitText?.includes(id))]));
  for (const anchor of cell.memberAnchors || []) Object.assign(result, positionReceptionMembers(after, frames, anchor));
  return result;
}

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
    const frames = Object.fromEntries(cell.members.map(id => [id, editorCellWindow(presentation, id, content)]));
    const projected = projectReceptionCellMembers(source, target, frames, cell);
    for (const id of cell.members) {
      // A gesture that already moves both owner and child owns both previews.
      if (transforms[id]) continue;
      const child = editorCellWindow(presentation, id, content);
      if (!child) continue;
      if (result === transforms) result = { ...transforms };
      result[id] = { scale: 1, x: 0, y: 0, frame: projected[id] };
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
