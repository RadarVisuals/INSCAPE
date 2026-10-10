export const clamp = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));

export function cuePosition(rect, offset, bounds) {
  // Allow the card's border and header padding around the same button centre.
  return { x: clamp(rect.x + rect.width * offset.x, 34, bounds.width - 34),
    y: clamp(rect.y + rect.height * offset.y, 66, bounds.height - 34) };
}

export function cueBubbleRectangle(anchor, bounds, preference = 'auto') {
  // Header button centre: 1px border + 10px horizontal / 8px vertical padding + 15px half-control.
  const insetX = 26, insetY = 24;
  const rightRoom = bounds.width - 8 - anchor.x + insetX;
  const leftRoom = anchor.x - 8 + insetX;
  let right = preference === 'right' || preference === 'auto' && rightRoom >= leftRoom;
  // Keep controls usable when a preferred direction cannot fit near an edge.
  if ((right ? rightRoom : leftRoom) < 188 && (right ? leftRoom : rightRoom) > (right ? rightRoom : leftRoom)) right = !right;
  const width = Math.min(240, Math.max(0, right ? rightRoom : leftRoom));
  const below = bounds.height - 8 - (anchor.y - insetY);
  const above = anchor.y + insetY - 42;
  const upward = below < 240 && above > below;
  return { collapseSide: right ? 'left' : 'right', upward, style: {
    left: right ? anchor.x - insetX : anchor.x - width + insetX, width,
    ...(upward ? { bottom: bounds.height - anchor.y - insetY } : { top: anchor.y - insetY }),
    maxHeight: Math.max(0, upward ? above : below),
  } };
}
