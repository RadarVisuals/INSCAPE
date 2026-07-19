import { normalizeProfileAddress } from '../../library/config.js';
import { isGridRectWithinBounds, normalizeGridRect } from '../gridGeometry.js';

export const RUNTIME_WINDOW_STATE_VERSION = 1;
export const RUNTIME_WINDOW_KEY_PREFIX = 'os-underneath.runtime-windows.v1:';

const validRect = (rect) => rect && ['column', 'row', 'columnSpan', 'rowSpan'].every((key) => Number.isInteger(rect[key]))
  && rect.columnSpan >= 1 && rect.rowSpan >= 1;
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 240;

export function runtimeWindowKey(profileAddress) {
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile) throw new TypeError('A valid profile address is required');
  return `${RUNTIME_WINDOW_KEY_PREFIX}${profile}`;
}

export function createRuntimeWindowState(initial = {}) {
  const openIds = [...new Set((initial.openIds || []).filter(validId))];
  const zOrder = [...new Set((initial.zOrder || openIds).filter((id) => openIds.includes(id)))];
  openIds.forEach((id) => { if (!zOrder.includes(id)) zOrder.push(id); });
  const rects = Object.fromEntries(Object.entries(initial.rects || {}).flatMap(([id, rect]) => validId(id) && validRect(rect) ? [[id, { ...rect }]] : []));
  return { version: RUNTIME_WINDOW_STATE_VERSION, openIds, zOrder, rects };
}

export function normalizeRuntimeWindowGeometry(state, bounds) {
  const current = createRuntimeWindowState(state);
  let changed = false;
  const rects = Object.fromEntries(Object.entries(current.rects).map(([id, rect]) => {
    if (isGridRectWithinBounds(rect, bounds)) return [id, rect];
    changed = true;
    return [id, normalizeGridRect(rect, bounds, { fallback: rect })];
  }));
  return changed ? { ...current, rects } : current;
}

export function updateRuntimeWindowState(state, action) {
  const current = createRuntimeWindowState(state);
  const id = action?.id;
  if (action?.type === 'close-all') return { ...current, openIds: [], zOrder: [] };
  if (action?.type === 'reset') return createRuntimeWindowState(action.initial);
  if (!validId(id)) return current;
  if (action.type === 'open' || action.type === 'focus') {
    const openIds = current.openIds.includes(id) ? current.openIds : [...current.openIds, id];
    return { ...current, openIds, zOrder: [...current.zOrder.filter((entry) => entry !== id), id] };
  }
  if (action.type === 'close') return { ...current, openIds: current.openIds.filter((entry) => entry !== id), zOrder: current.zOrder.filter((entry) => entry !== id) };
  if (action.type === 'geometry' && validRect(action.rect)) return { ...current, rects: { ...current.rects, [id]: { ...action.rect } } };
  if (action.type === 'reset-window') {
    const rects = { ...current.rects };
    if (validRect(action.rect)) rects[id] = { ...action.rect }; else delete rects[id];
    return { ...current, rects };
  }
  return current;
}

export function loadRuntimeWindowState(storage, profileAddress, legacySource = null) {
  try {
    const source = storage?.getItem?.(runtimeWindowKey(profileAddress));
    if (source) return createRuntimeWindowState(JSON.parse(source));
    const legacy = typeof legacySource === 'string' ? JSON.parse(legacySource) : legacySource;
    return createRuntimeWindowState({ rects: legacy?.rects || {} });
  } catch { return createRuntimeWindowState(); }
}

export function saveRuntimeWindowState(storage, profileAddress, state) {
  try { storage?.setItem?.(runtimeWindowKey(profileAddress), JSON.stringify(createRuntimeWindowState(state))); return true; }
  catch { return false; }
}

export function windowZIndex(state, id, base = 20) {
  const index = createRuntimeWindowState(state).zOrder.indexOf(id);
  return base + Math.max(0, index);
}
