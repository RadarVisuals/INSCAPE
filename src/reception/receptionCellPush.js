import { validWorkbenchArea } from '../systemWorkflow/domain/workbenchArea.js';

const axes = { left: ['left', 'width', -1], right: ['left', 'width', 1], top: ['top', 'height', -1], bottom: ['top', 'height', 1] };
export const receptionFramesOverlap = (a, b, gap) => a.left < b.left + b.width + gap - .001 && b.left < a.left + a.width + gap - .001
  && a.top < b.top + b.height + gap - .001 && b.top < a.top + a.height + gap - .001;

// Sweep the whole edit, so a fast pointer cannot tunnel through a neighbour.
// Interpolating all four edges also keeps the opposite resize edges fixed.
export function stopReceptionCellFrame(frames, id, from, to, gap) {
  let fraction = 1;
  for (const other of frames) {
    if (other.id === id) continue;
    let enter = 0, leave = 1, possible = true;
    for (const [start, end] of [
      [from.left - other.left - other.width - gap, to.left - other.left - other.width - gap],
      [other.left - from.left - from.width - gap, other.left - to.left - to.width - gap],
      [from.top - other.top - other.height - gap, to.top - other.top - other.height - gap],
      [other.top - from.top - from.height - gap, other.top - to.top - to.height - gap],
    ]) {
      const change = end - start;
      if (Math.abs(change) < 1e-9) { if (start >= 0) possible = false; }
      else if (change < 0) enter = Math.max(enter, -start / change);
      else leave = Math.min(leave, -start / change);
    }
    if (possible && enter < leave - 1e-9 && leave > 0) fraction = Math.min(fraction, Math.max(0, enter));
  }
  // Whole-pixel authored edges round towards the last safe rectangle.
  const edge = (start, end) => start + Math.trunc((end - start) * fraction + Math.sign(end - start) * 1e-7);
  const left = edge(from.left, to.left), top = edge(from.top, to.top);
  return { left, top, width: edge(from.left + from.width, to.left + to.width) - left,
    height: edge(from.top + from.height, to.top + to.height) - top };
}

// Only the active cell changes size. Collisions propagate in one direction;
// unoccupied space and unrelated cells stay exactly where they were.
export function pushReceptionCellFrames(frames, id, frame, direction, gap) {
  if (!axes[direction] || !frames.some(item => item.id === id)
    || !['left', 'top', 'width', 'height'].every(key => Number.isFinite(frame[key]))
    || frame.width <= 0 || frame.height <= 0 || !Number.isFinite(gap) || gap < 0)
    throw new Error('Choose an available cell and valid geometry.');
  const next = frames.map(item => ({ ...item, ...(item.id === id ? frame : {}) }));
  const [position, size, sign] = axes[direction], pending = [next.find(item => item.id === id)];
  let steps = 0;
  while (pending.length) {
    const source = pending.shift();
    for (const other of next) {
      if (source === other || !receptionFramesOverlap(source, other, gap)) continue;
      if (other.id === id || ++steps > frames.length ** 3)
        throw new Error('These cells cannot be pushed in this direction.');
      other[position] = sign > 0 ? source[position] + source[size] + gap : source[position] - other[size] - gap;
      if (!pending.includes(other)) pending.push(other);
    }
  }
  return next;
}

// Grow the canvas around its contents; never scale cells to fit its bounds.
export function containReceptionFrames(area, frames, padding) {
  const left = Math.floor(Math.min(area.left, ...frames.map(r => r.left - padding)));
  const top = Math.floor(Math.min(area.top, ...frames.map(r => r.top - padding)));
  const right = Math.ceil(Math.max(area.left + area.width, ...frames.map(r => r.left + r.width + padding)));
  const bottom = Math.ceil(Math.max(area.top + area.height, ...frames.map(r => r.top + r.height + padding)));
  const next = { left, top, width: right - left, height: bottom - top };
  if (!validWorkbenchArea(next)) throw new Error('This change exceeds the maximum Bento size.');
  return next;
}
