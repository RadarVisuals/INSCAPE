// Private screen layout only. Mounted windows retain their own content and frames.
export const emptySideDock = () => ({ width: 320, items: [] });
export const validSideDock = value => value == null || Boolean(value && Number.isFinite(value.width)
  && value.width >= 160 && value.width <= 8000 && Array.isArray(value.items) && value.items.length <= 32
  && value.items.every(item => item && typeof item.id === 'string' && item.id.length <= 160
    && Number.isFinite(item.height) && item.height > 0 && item.height <= 8000)
  && new Set(value.items.map(item => item.id)).size === value.items.length);

export function sideDockFrames(layout, windows, viewport) {
  const items = layout.items.filter(item => windows.has(item.id));
  if (!items.length) return {};
  const width = Math.min(viewport.width - viewport.left, Math.max(layout.width,
    ...items.map(item => windows.get(item.id).minimumWidth)));
  const height = Math.max(1, viewport.height - viewport.top);
  const minimum = Math.min(72, height / items.length);
  const extra = height - minimum * items.length, total = items.reduce((sum, item) => sum + item.height, 0);
  let top = viewport.top;
  return Object.fromEntries(items.map(item => {
    const frame = { left: viewport.width - width, top, width, height: minimum + extra * item.height / total };
    top += frame.height;
    return [item.id, frame];
  }));
}

export function createSideDockStore(preferences) {
  let state = { layout: preferences?.getSnapshot() || emptySideDock(), windows: new Map(),
    viewport: { width: globalThis.innerWidth || 1440, height: globalThis.innerHeight || 900, top: 0, left: 0 }, preview: null, active: null };
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const save = layout => { publish({ layout }); preferences?.update(layout); };
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh: () => { const layout = preferences?.getSnapshot(); if (layout && layout !== state.layout) publish({ layout }); },
    viewport: viewport => publish({ viewport }),
    register(id, minimumWidth, host) {
      const windows = new Map(state.windows); windows.set(id, { minimumWidth, host }); publish({ windows });
      return () => { const windows = new Map(state.windows); windows.delete(id); publish({ windows }); };
    },
    preview: point => publish({ preview: point }),
    activate: id => { if (state.active !== id) publish({ active: id }); },
    restore: save,
    detach: id => save({ ...state.layout, items: state.layout.items.filter(item => item.id !== id) }),
    retainTools(ids) {
      const items = state.layout.items.filter(item => !item.id.startsWith('tools:') || ids.includes(item.id));
      if (items.length !== state.layout.items.length) save({ ...state.layout, items });
    },
    attach(id, frame, y = Infinity) {
      const frames = sideDockFrames(state.layout, state.windows, state.viewport);
      const items = state.layout.items.filter(item => item.id !== id);
      const index = items.findIndex(item => frames[item.id] && y < frames[item.id].top + frames[item.id].height / 2);
      items.splice(index < 0 ? items.length : index, 0, { id, height: frame.height });
      save({ ...state.layout, items });
    },
    resize(id, frame) {
      const frames = sideDockFrames(state.layout, state.windows, state.viewport), current = frames[id];
      if (!current) return;
      if (Math.abs(frame.width - current.width) < .01 && Math.abs(frame.height - current.height) < .01) return;
      const ids = Object.keys(frames), adjacent = ids[ids.indexOf(id) + 1];
      const minimum = Math.min(72, (state.viewport.height - state.viewport.top) / ids.length);
      const delta = adjacent ? Math.max(minimum - current.height, Math.min(frame.height - current.height, frames[adjacent].height - minimum)) : 0;
      // Geometry is minimum + proportional extra. Store only that extra to keep
      // untouched dividers stationary after a resize, including short viewports.
      const items = state.layout.items.map(item => !frames[item.id] ? item : { ...item,
        height: Math.max(.001, frames[item.id].height + (item.id === id ? delta : item.id === adjacent ? -delta : 0) - minimum) });
      save({ width: Math.max(160, frame.width), items });
    },
  };
}
