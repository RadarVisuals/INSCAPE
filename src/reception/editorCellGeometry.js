import { workbenchSelectionBounds } from '../public/ownerSystemWorkflow/workbenchViewScale.js';
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

export function positionReceptionMembers(frame, frames, anchor, preferredScale = 1, { reflowText = true, textScaleX = 1 } = {}) {
  const members = anchor.members.filter(id => frames[id]);
  if (!members.length) return {};
  const { left, top, width, height } = workbenchSelectionBounds(members.map(id => frames[id]));
  const x = Math.min(anchor.paddingX, frame.width / 2), y = Math.min(anchor.paddingY, frame.height / 2);
  // Alignment controls position. Oversized contents still shrink together to fit.
  let sx = Math.min(preferredScale, Math.max(1, frame.width - 2 * x) / width);
  let sy = Math.min(preferredScale, Math.max(1, frame.height - 2 * y) / height);
  // Text reflows in width; narrowing its cell must not also shrink its height
  // and recenter it vertically. Likewise a height edit cannot change its width.
  if (reflowText && members.length === 1 && members[0].startsWith('text:')) {
    sx = Math.min(textScaleX, Math.max(1, frame.width - 2 * x) / width); sy = 1;
  // A single Image has a flexible frame; groups preserve their proportions.
  } else if (members.length !== 1 || !members[0].startsWith('image:')) sx = sy = Math.min(sx, sy);
  const targetX = frame.left + x + (frame.width - 2 * x - width * sx) * { left: 0, center: .5, right: 1 }[anchor.alignX];
  const targetY = frame.top + y + (frame.height - 2 * y - height * sy) * { top: 0, center: .5, bottom: 1 }[anchor.alignY];
  return Object.fromEntries(members.map(id => [id, { ...frames[id], left: targetX + (frames[id].left - left) * sx,
    top: targetY + (frames[id].top - top) * sy, width: frames[id].width * sx, height: frames[id].height * sy }]));
}

// A divider crops stationary Text; a structural edit carries its local offset.
// The command supplies that intent to both preview and commit. A change of
// height alone cannot tell us whether a cell was moved or its edge was cropped.
export function projectReceptionCellMembers(before, after, frames, cell,
  { responsive = false, moveContents = false, anchorScale = Math.min(1, after.width / before.width, after.height / before.height) } = {}) {
  const result = Object.fromEntries(Object.entries(frames).filter(([, frame]) => frame)
    .map(([id, frame]) => {
      const fitted = cell.fitText?.includes(id), projected = projectReceptionMember(before, after, frame, fitted);
      if (!responsive && id.startsWith('text:') && !fitted && (moveContents || before.height !== after.height))
        Object.assign(projected, { top: frame.top + (moveContents ? after.top - before.top : 0), height: frame.height });
      return [id, projected];
    }));
  for (const anchor of cell.memberAnchors || []) Object.assign(result, positionReceptionMembers(after, frames, anchor, anchorScale,
    { reflowText: !responsive, textScaleX: after.width / before.width }));
  return result;
}

// Cells reuse native Editor windows. These are temporary interaction/paint
// projections; persisted geometry remains in the Reception document's workbench.
export const editorCellForModule = (cells, id) => cells.find(cell => cell.id === id || cell.members.includes(id));

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
    const transform = result[cell.id];
    if (!transform) continue;
    const source = editorCellWindow(presentation, cell.id, content);
    if (!source) continue;
    const target = transformedCellWindow(source, transform);
    const frames = Object.fromEntries(cell.members.map(id => [id, editorCellWindow(presentation, id, content)]));
    const projected = projectReceptionCellMembers(source, target, frames, cell, { moveContents: transform.cellMoveContents === true });
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
