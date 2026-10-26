import { assertReception, RECEPTION_EXTENT as E, RECEPTION_MIN, RECEPTION_LIMIT } from '../profileDocument/domain/receptionPresentation.js';

// A rectangular partition is authoritative. No stored split tree or computed
// pixel cache: any adjacent rectangular union can merge, including non-siblings.
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
export function moveReception(value, from, to) {
  const a = value.regions.find(r => r.id === from), b = value.regions.find(r => r.id === to);
  if (!a || !b || a === b || !a.content) return value;
  return change(value, value.regions.map(r => r === a ? { ...r, content: b.content } : r === b ? { ...r, content: a.content } : r));
}
export function canMergeReception(a, b) {
  return Boolean(a && b && a.id !== b.id && (a.y === b.y && a.height === b.height && (right(a) === b.x || right(b) === a.x)
    || a.x === b.x && a.width === b.width && (bottom(a) === b.y || bottom(b) === a.y)));
}
export function mergeReception(value, id, otherId, keep) {
  const a = value.regions.find(r => r.id === id), b = value.regions.find(r => r.id === otherId);
  if (!canMergeReception(a, b)) throw new Error('Only neighboring regions whose union is a rectangle can merge.');
  if (a.content && b.content && ![a.content, b.content].includes(keep)) throw new Error('Choose the content to retain. Both records remain available.');
  const merged = { ...a, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(right(a), right(b)) - Math.min(a.x, b.x),
    height: Math.max(bottom(a), bottom(b)) - Math.min(a.y, b.y), content: keep || a.content || b.content };
  return change(value, value.regions.filter(r => r.id !== otherId).map(r => r.id === id ? merged : r), value.mobile.filter(m => m.id !== otherId));
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
