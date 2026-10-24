// Editor-only layout. No artwork, selection or saved composition lives here.
export const WORKBENCH_TOOL_TABS = Object.freeze(['Layers', 'Transform', 'Color', 'Image', 'Shape', 'FX', 'Info']);

export const validToolFrame = value => Boolean(value && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(value[key]))
  && Math.abs(value.left) <= 100000 && Math.abs(value.top) <= 100000 && value.width >= 1 && value.width <= 8000 && value.height >= 1 && value.height <= 8000);
export function validToolDockLayout(value) {
  if (!value || !Number.isSafeInteger(value.nextId) || value.nextId < 1 || value.nextId > 1000000
    || !Array.isArray(value.groups) || !value.groups.length || value.groups.length > WORKBENCH_TOOL_TABS.length
    || !Array.isArray(value.hidden) || new Set(value.hidden).size !== value.hidden.length || value.hidden.some(tab => !WORKBENCH_TOOL_TABS.includes(tab))) return false;
  const ids = new Set(), panes = new Set(), tabs = [];
  for (const group of value.groups) {
    if (!group || typeof group.id !== 'string' || group.id.length > 80 || ids.has(group.id) || !validToolFrame(group.frame)
      || !Array.isArray(group.panes) || !group.panes.length || group.panes.length > WORKBENCH_TOOL_TABS.length) return false;
    ids.add(group.id);
    for (const pane of group.panes) {
      if (!pane || typeof pane.id !== 'string' || pane.id.length > 80 || panes.has(pane.id) || !Array.isArray(pane.tabs)
        || !pane.tabs.length || !pane.tabs.includes(pane.active) || !Number.isFinite(pane.share) || pane.share <= 0 || pane.share > 1000000) return false;
      panes.add(pane.id); tabs.push(...pane.tabs);
    }
  }
  return (value.activeGroup === null || ids.has(value.activeGroup)) && tabs.length === WORKBENCH_TOOL_TABS.length
    && new Set(tabs).size === tabs.length && WORKBENCH_TOOL_TABS.every(tab => tabs.includes(tab));
}

export function createToolDockLayout(width = 1440) {
  return { nextId: 1, activeGroup: null, hidden: width < 600 ? [...WORKBENCH_TOOL_TABS] : [],
    groups: [{ id: 'tools', panes: [{ id: 'tools', tabs: [...WORKBENCH_TOOL_TABS], active: 'Layers', share: 1 }],
      frame: { left: Math.max(8, width - 336), top: 88, width: 320, height: 480 } }] };
}

export function visibleToolTabs(layout, group) { return group.tabs.filter(tab => !layout.hidden.includes(tab)); }
export const dockTabs = group => group.panes.flatMap(pane => pane.tabs);
export const toolPane = (layout, tab) => layout.groups.flatMap(group => group.panes).find(pane => pane.tabs.includes(tab));
export function toolIsVisible(layout, tab) {
  return !layout.hidden.includes(tab) && toolPane(layout, tab)?.active === tab;
}

// Position updates notify dock subscribers, while the toolbar subscribes only
// to the derived Layers visibility. Moving a dock need not render the runtime.
export function createToolDockStore(initialLayout = createToolDockLayout()) {
  let layout = initialLayout;
  const listeners = new Set();
  return {
    getSnapshot: () => layout,
    layersVisible: () => toolIsVisible(layout, 'Layers'),
    infoVisible: () => toolIsVisible(layout, 'Info'),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    change(action) {
      const next = changeToolDock(layout, action);
      if (next === layout) return;
      layout = next; listeners.forEach(listener => listener());
    },
  };
}

export function changeToolDock(layout, action) {
  const group = layout.groups.find(item => item.id === action.group || dockTabs(item).includes(action.tab));
  if (action.type === 'open' || action.type === 'close' || action.type === 'select') {
    if (!group || !WORKBENCH_TOOL_TABS.includes(action.tab)) return layout;
    const hidden = action.type === 'close' ? [...new Set([...layout.hidden, action.tab])] : layout.hidden.filter(tab => tab !== action.tab);
    return { ...layout, hidden, activeGroup: group.id, groups: layout.groups.map(item => item !== group ? item : {
      ...item, panes: item.panes.map(pane => !pane.tabs.includes(action.tab) ? pane : { ...pane,
        active: action.type === 'close' ? pane.tabs.find(tab => !hidden.includes(tab)) || action.tab : action.tab }),
    }) };
  }
  if (action.type === 'activate') return layout.activeGroup === action.group ? layout : { ...layout, activeGroup: action.group };
  if (action.type === 'frame') {
    if (!group) return layout;
    const frame = typeof action.frame === 'function' ? action.frame(group.frame) : action.frame;
    if (Object.keys(frame).every(key => frame[key] === group.frame[key])) return layout;
    return { ...layout, groups: layout.groups.map(item => item === group ? { ...item, frame } : item) };
  }
  if (action.type === 'shares') {
    if (!group || !group.panes.some(pane => pane.id in action.shares)) return layout;
    if (Object.values(action.shares).some(value => !Number.isFinite(value) || value <= 0)) return layout;
    return { ...layout, groups: layout.groups.map(item => item !== group ? item : { ...item,
      panes: item.panes.map(pane => ({ ...pane, share: action.shares[pane.id] ?? pane.share })) }) };
  }
  if (action.type !== 'place') return layout;
  const tabs = [...new Set(action.tabs || [])].filter(tab => WORKBENCH_TOOL_TABS.includes(tab));
  if (!tabs.length) return layout;
  const source = layout.groups.find(item => dockTabs(item).includes(tabs[0]));
  const target = layout.groups.find(item => item.panes.some(pane => pane.id === action.target));
  if (!source || tabs.some(tab => !dockTabs(source).includes(tab)) || action.target && !target) return layout;
  const wholeDock = tabs.length === dockTabs(source).length;
  if (action.side && target === source && wholeDock) return layout;
  if (!target && wholeDock) {
    return { ...layout, activeGroup: source.id, groups: layout.groups.map(item => item === source ? { ...item, frame: action.frame || item.frame } : item) };
  }
  let nextId = layout.nextId;
  const id = () => `tools-${nextId++}`;
  const groups = layout.groups.map(item => ({ ...item, panes: item.panes.map(pane => {
    const remaining = pane.tabs.filter(tab => !tabs.includes(tab));
    return { ...pane, tabs: remaining, active: remaining.includes(pane.active) ? pane.active : remaining.find(tab => !layout.hidden.includes(tab)) || remaining[0] };
  }) }));
  const moving = wholeDock ? source.panes.map(pane => ({ ...pane, tabs: [...pane.tabs] })) : [{
    id: id(), tabs, active: tabs.find(tab => toolIsVisible(layout, tab)) || tabs[0], share: 1,
  }];
  const result = activeGroup => ({ ...layout, nextId, activeGroup, groups: groups.map(item => ({
    ...item, panes: item.panes.filter(pane => pane.tabs.length),
  })).filter(item => item.panes.length) });
  if (target) {
    const destination = groups.find(item => item.id === target.id), pane = destination.panes.find(item => item.id === action.target);
    if (action.side) {
      if (!pane.tabs.length) return layout;
      // Divide the target's existing space; other panes retain their proportions.
      const share = pane.share / 2, total = moving.reduce((sum, item) => sum + item.share, 0);
      pane.share = share;
      destination.panes.splice(destination.panes.indexOf(pane) + (action.side === 'below' ? 1 : 0), 0,
        ...moving.map(item => ({ ...item, share: share * item.share / total })));
    } else {
      const index = action.before ? pane.tabs.indexOf(action.before) : -1;
      pane.tabs.splice(index < 0 ? pane.tabs.length : index, 0, ...tabs);
      pane.active = moving[0].active;
    }
    return result(destination.id);
  }
  const dockId = id();
  groups.push({ id: dockId, panes: moving, frame: action.frame || source.frame });
  return result(dockId);
}
