// Private screen layout only. Mounted windows retain their own content and frames.
export const emptySideDock = () => ({ width: 320, leftWidth: 320, items: [] });
export const dockSide = item => item.side || 'right';
export function sideDockEdge(event, viewport) {
  if (!event || event.clientY < viewport.top || event.clientY > viewport.height) return null;
  if (event.clientX >= 0 && event.clientX <= 32) return 'left';
  return event.clientX >= viewport.width - 32 && event.clientX <= viewport.width ? 'right' : null;
}
export const validSideDock = value => value == null || Boolean(value && Number.isFinite(value.width)
  && value.width >= 160 && value.width <= 8000 && Array.isArray(value.items) && value.items.length <= 32
  && (value.leftWidth == null || Number.isFinite(value.leftWidth) && value.leftWidth >= 160 && value.leftWidth <= 8000)
  && value.items.every(item => item && typeof item.id === 'string' && item.id.length <= 160
    && (item.side == null || ['left', 'right'].includes(item.side))
    && Number.isFinite(item.height) && item.height > 0 && item.height <= 8000)
  && new Set(value.items.map(item => item.id)).size === value.items.length);

export function sideDockFrames(layout, windows, viewport) {
  const items = layout.items.filter(item => windows.has(item.id));
  if (!items.length) return {};
  const columns = ['left', 'right'].map(side => {
    const members = items.filter(item => dockSide(item) === side);
    return { side, members, width: members.length ? Math.max(side === 'left' ? layout.leftWidth ?? 320 : layout.width,
      ...members.map(item => windows.get(item.id).minimumWidth)) : 0 };
  });
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  // Keep a central work area when both edges are occupied, including narrow screens.
  const available = viewport.width - (columns.every(column => column.width) ? Math.min(320, viewport.width / 3) : 0);
  const ratio = Math.min(1, available / totalWidth);
  const height = Math.max(1, viewport.height - viewport.top);
  return Object.fromEntries(columns.flatMap(({ side, members, width: desiredWidth }) => {
    const width = desiredWidth * ratio;
    const minimum = Math.min(72, height / members.length);
    const extra = height - minimum * members.length, total = members.reduce((sum, item) => sum + item.height, 0);
    let top = viewport.top;
    return members.map(item => {
      const frame = { left: side === 'left' ? 0 : viewport.width - width, top, width, height: minimum + extra * item.height / total };
      top += frame.height;
      return [item.id, frame];
    });
  }));
}

export function createSideDockStore(preferences) {
  let state = { layout: preferences?.getSnapshot() || emptySideDock(), windows: new Map(),
    viewport: { width: globalThis.innerWidth || 1440, height: globalThis.innerHeight || 900, top: 0 }, preview: null, active: null };
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
    attach(id, frame, y = Infinity, side = 'right') {
      const frames = sideDockFrames(state.layout, state.windows, state.viewport);
      const items = state.layout.items.filter(item => item.id !== id);
      const index = items.findIndex(item => dockSide(item) === side && frames[item.id] && y < frames[item.id].top + frames[item.id].height / 2);
      items.splice(index < 0 ? items.length : index, 0, { id, height: frame.height, side });
      save({ ...state.layout, items });
    },
    resize(id, frame) {
      const frames = sideDockFrames(state.layout, state.windows, state.viewport), current = frames[id];
      if (!current) return;
      if (Math.abs(frame.width - current.width) < .01 && Math.abs(frame.height - current.height) < .01) return;
      const side = dockSide(state.layout.items.find(item => item.id === id));
      const ids = state.layout.items.filter(item => dockSide(item) === side && frames[item.id]).map(item => item.id);
      const adjacent = ids[ids.indexOf(id) + 1];
      const minimum = Math.min(72, (state.viewport.height - state.viewport.top) / ids.length);
      const delta = adjacent ? Math.max(minimum - current.height, Math.min(frame.height - current.height, frames[adjacent].height - minimum)) : 0;
      // Geometry is minimum + proportional extra. Store only that extra to keep
      // untouched dividers stationary after a resize, including short viewports.
      const items = state.layout.items.map(item => !ids.includes(item.id) ? item : { ...item,
        height: Math.max(.001, frames[item.id].height + (item.id === id ? delta : item.id === adjacent ? -delta : 0) - minimum) });
      const widthKey = side === 'left' ? 'leftWidth' : 'width';
      const width = Math.abs(frame.width - current.width) < .01 ? state.layout[widthKey] ?? 320 : Math.max(160, frame.width);
      save({ ...state.layout, [widthKey]: width, items });
    },
  };
}
