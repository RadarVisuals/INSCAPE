// Temporary viewport-space trial geometry. The room supplies rectangles;
// Keeper owns its body footprint and movement response, never artwork pixels.
export function moveKeeperWithWalls(state, dx, dy, walls = [], radius = 0) {
  const boxes = walls.map(wall => ({ left: wall.left - radius, right: wall.right + radius,
    top: wall.top - radius, bottom: wall.bottom + radius }));
  // Resize or a moved dock can leave the body inside a wall. Recover to the
  // closest face before sweeping the next small integration step.
  for (const box of boxes) {
    if (state.x > box.left && state.x < box.right && state.y > box.top && state.y < box.bottom) {
      const faces = [
        { gap: state.x - box.left, x: box.left, y: state.y },
        { gap: box.right - state.x, x: box.right, y: state.y },
        { gap: state.y - box.top, x: state.x, y: box.top },
        { gap: box.bottom - state.y, x: state.x, y: box.bottom },
      ].sort((a, b) => a.gap - b.gap);
      Object.assign(state, { x: faces[0].x, y: faces[0].y, vx: 0, vy: 0 });
    }
  }
  let x = state.x + dx;
  for (const box of boxes) if (state.y > box.top && state.y < box.bottom) {
    if (dx > 0 && state.x <= box.left && x > box.left) x = Math.min(x, box.left);
    if (dx < 0 && state.x >= box.right && x < box.right) x = Math.max(x, box.right);
  }
  if (x !== state.x + dx) state.vx = 0;
  state.x = x;
  let y = state.y + dy;
  for (const box of boxes) if (state.x > box.left && state.x < box.right) {
    if (dy > 0 && state.y <= box.top && y > box.top) y = Math.min(y, box.top);
    if (dy < 0 && state.y >= box.bottom && y < box.bottom) y = Math.max(y, box.bottom);
  }
  if (y !== state.y + dy) state.vy = 0;
  state.y = y;
}
