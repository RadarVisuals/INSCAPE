import { assertReception, RECEPTION_EXTENT as E, RECEPTION_MIN, RECEPTION_LIMIT } from '../profileDocument/domain/receptionPresentation.js';

// A rectangular partition is authoritative. No stored split tree or computed
// pixel cache: move and delete derive their geometry from these cells.
const right = r => r.x + r.width, bottom = r => r.y + r.height;
const overlap = (a, b, c, d) => Math.max(a, c) < Math.min(b, d);
const change = (value, regions, mobile = value.mobile) => assertReception({ ...value, regions, mobile });
export function splitReception(value, id, axis, newId = `region:${crypto.randomUUID()}`) {
  const r = value.regions.find(r => r.id === id), key = axis === 'x' ? 'width' : 'height';
  if (!r || !['x', 'y'].includes(axis)) throw new Error('Select a region to split.');
  if (value.regions.length >= RECEPTION_LIMIT) throw new Error(`Reception supports up to ${RECEPTION_LIMIT} regions.`);
  if (r[key] < RECEPTION_MIN * 2) throw new Error('This region is too small to split. Enlarge it first.');
  const first = Math.floor(r[key] / 2), second = { ...r, id: newId, content: null, [axis]: r[axis] + first, [key]: r[key] - first };
  const mobile = value.mobile.flatMap(m => m.id === id ? [m, { id: newId, columns: 2, height: m.height }] : [m]);
  return change(value, value.regions.flatMap(item => item.id === id ? [{ ...r, [key]: first }, second] : [item]), mobile);
}
// Reordering moves cell identity and every authored cell setting. Rectangular
// positions stay a complete partition; cells between origin and destination shift.
export function reorderReception(value, from, to, mode = 'desktop') {
  const ordered = mode === 'mobile' ? value.mobile : [...value.regions].sort((a, b) => a.y - b.y || a.x - b.x);
  const first = ordered.findIndex(item => item.id === from), last = ordered.findIndex(item => item.id === to);
  if (first < 0 || last < 0 || first === last) return value;
  const next = [...ordered], [moved] = next.splice(first, 1); next.splice(last, 0, moved);
  if (mode === 'mobile') return change(value, value.regions, next);
  const regions = next.map((cell, index) => {
    const { x, y, width, height } = ordered[index];
    return { ...cell, x, y, width, height };
  });
  return change(value, regions);
}

const boundsOf = cells => ({ x: Math.min(...cells.map(r => r.x)), y: Math.min(...cells.map(r => r.y)),
  width: Math.max(...cells.map(right)) - Math.min(...cells.map(r => r.x)), height: Math.max(...cells.map(bottom)) - Math.min(...cells.map(r => r.y)) });
function fillBounds(cells, source, target) {
  return cells.map(cell => {
    const x = target.x + Math.round((cell.x - source.x) / source.width * target.width);
    const y = target.y + Math.round((cell.y - source.y) / source.height * target.height);
    return { ...cell, x, y,
      width: target.x + Math.round((right(cell) - source.x) / source.width * target.width) - x,
      height: target.y + Math.round((bottom(cell) - source.y) / source.height * target.height) - y };
  });
}
function removeFromPartition(cells, id) {
  if (cells.length === 1) return [];
  // Reconstruct only the necessary partition from its geometry. There is no
  // persisted split-tree or second layout model to synchronize.
  for (const axis of ['x', 'y']) {
    const edge = axis === 'x' ? right : bottom;
    const boundaries = [...new Set(cells.map(edge))].sort((a, b) => a - b);
    for (const point of boundaries) {
      const before = cells.filter(cell => edge(cell) <= point), after = cells.filter(cell => cell[axis] >= point);
      if (!before.length || !after.length || before.length + after.length !== cells.length) continue;
      const target = before.some(cell => cell.id === id) ? before : after, sibling = target === before ? after : before;
      const remaining = removeFromPartition(target, id);
      if (!remaining) continue;
      return remaining.length ? [...remaining, ...sibling] : fillBounds(sibling, boundsOf(sibling), boundsOf(cells));
    }
  }
  // A valid externally supplied partition can be non-slicing. Absorb the
  // removed rectangle into a complete adjacent strip when one is available.
  const removed = cells.find(cell => cell.id === id), rest = cells.filter(cell => cell.id !== id);
  for (const direction of ['left', 'right', 'top', 'bottom']) {
    const vertical = direction === 'left' || direction === 'right';
    const start = vertical ? removed.y : removed.x, finish = vertical ? bottom(removed) : right(removed);
    const neighbors = rest.filter(cell => (direction === 'left' ? right(cell) === removed.x : direction === 'right' ? cell.x === right(removed)
      : direction === 'top' ? bottom(cell) === removed.y : cell.y === bottom(removed))
      && (vertical ? cell.y >= start && bottom(cell) <= finish : cell.x >= start && right(cell) <= finish));
    if (neighbors.reduce((sum, cell) => sum + (vertical ? cell.height : cell.width), 0) !== finish - start) continue;
    return rest.map(cell => !neighbors.includes(cell) ? cell : direction === 'left' ? { ...cell, width: cell.width + removed.width }
      : direction === 'right' ? { ...cell, x: removed.x, width: cell.width + removed.width }
        : direction === 'top' ? { ...cell, height: cell.height + removed.height } : { ...cell, y: removed.y, height: cell.height + removed.height });
  }
  return null;
}
export function deleteReceptionCell(value, id) {
  const removed = value.regions.find(cell => cell.id === id);
  if (!removed) return value;
  let regions = removeFromPartition(value.regions, id);
  if (regions === null) {
    // Rare non-slicing layouts are repacked in reading order, retaining complete
    // cells and all their settings, rather than leaving holes or losing content.
    const rest = value.regions.filter(cell => cell.id !== id).sort((a, b) => a.y - b.y || a.x - b.x);
    regions = rest.map((cell, index) => ({ ...cell, x: Math.round(index * E / rest.length), y: 0,
      width: Math.round((index + 1) * E / rest.length) - Math.round(index * E / rest.length), height: E }));
  }
  const empty = !regions.length;
  if (empty) regions = [{ ...removed, x: 0, y: 0, width: E, height: E, content: null, padding: null, alignX: 'left', alignY: 'top', surface: null }];
  const ids = new Set(regions.map(cell => cell.id));
  const used = new Set(regions.map(cell => cell.content));
  if (value.branding.logo) used.add(value.branding.logo);
  return assertReception({ ...value, regions, mobile: empty ? [{ id: removed.id, columns: 2, height: 320 }] : value.mobile.filter(cell => ids.has(cell.id)),
    imageModules: value.imageModules.filter(item => used.has(item.id)), texts: value.texts.filter(item => used.has(item.id)),
    ...(value.links ? { links: value.links.filter(item => used.has(item.id)) } : {}) });
}
export function receptionDividers(value, minimum = {}) {
  const found = new Map();
  for (const axis of ['x', 'y']) {
    const cross = axis === 'x' ? 'y' : 'x', size = axis === 'x' ? 'width' : 'height', crossSize = axis === 'x' ? 'height' : 'width';
    for (const seed of value.regions) {
      const position = seed[axis] + seed[size]; if (position === E) continue;
      let from = seed[cross], to = from + seed[crossSize], previous, members;
      do {
        previous = `${from}:${to}`;
        members = value.regions.filter(r => (r[axis] === position || r[axis] + r[size] === position) && overlap(from, to, r[cross], r[cross] + r[crossSize]));
        from = Math.min(from, ...members.map(r => r[cross])); to = Math.max(to, ...members.map(r => r[cross] + r[crossSize]));
      } while (previous !== `${from}:${to}`);
      const before = members.filter(r => r[axis] + r[size] === position), after = members.filter(r => r[axis] === position);
      const id = `${axis}:${before.map(r => r.id).sort().join(',')}:${after.map(r => r.id).sort().join(',')}`;
      found.set(id, { id, axis, position, from, to, before: before.map(r => r.id), after: after.map(r => r.id),
        min: Math.max(...before.map(r => r[axis] + (minimum[axis] || RECEPTION_MIN))), max: Math.min(...after.map(r => r[axis] + r[size] - (minimum[axis] || RECEPTION_MIN))) });
    }
  }
  return [...found.values()];
}
export function resizeReception(value, dividerId, position, minimum) {
  const d = receptionDividers(value, minimum).find(d => d.id === dividerId);
  if (!d || !Number.isFinite(position)) throw new Error('This divider is no longer available.');
  if (d.min > d.max) throw new Error('The available space is too small to resize these regions.');
  const p = Math.round(Math.max(d.min, Math.min(d.max, position))), delta = p - d.position, size = d.axis === 'x' ? 'width' : 'height';
  return change(value, value.regions.map(r => d.before.includes(r.id) ? { ...r, [size]: r[size] + delta }
    : d.after.includes(r.id) ? { ...r, [d.axis]: p, [size]: r[size] - delta } : r));
}
export const receptionMinimum = (width, height, gutter) => ({
  x: Math.max(RECEPTION_MIN, Math.ceil(96 / (width + gutter) * E + gutter / (width + gutter) * E)),
  y: Math.max(RECEPTION_MIN, Math.ceil((96 + gutter) / (height + gutter) * E)),
});
export function receptionPixelRect(r, width, height, gutter) {
  return { left: r.x / E * (width + gutter), top: r.y / E * (height + gutter),
    width: Math.max(0, r.width / E * (width + gutter) - gutter), height: Math.max(0, r.height / E * (height + gutter) - gutter) };
}
