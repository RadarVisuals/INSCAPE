// Editor-only layout. No artwork, selection or saved composition lives here.
export const WORKBENCH_TOOL_TABS = Object.freeze(['Layers', 'Inspector']);
export const WORKBENCH_INSPECTOR_SECTIONS = Object.freeze(['Transform', 'Color', 'Image', 'Text', 'Shape', 'Cell', 'Contents', 'FX', 'Info']);

export const validToolFrame = value => Boolean(value && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(value[key]))
  && Math.abs(value.left) <= 100000 && Math.abs(value.top) <= 100000 && value.width >= 1 && value.width <= 8000 && value.height >= 1 && value.height <= 8000);
function validDockLayout(value, allowedTabs) {
  if (!value || !Number.isSafeInteger(value.nextId) || value.nextId < 1 || value.nextId > 1000000
    || !Array.isArray(value.groups) || !value.groups.length || value.groups.length > allowedTabs.length
    || !Array.isArray(value.hidden) || new Set(value.hidden).size !== value.hidden.length || value.hidden.some(tab => !allowedTabs.includes(tab))) return false;
  const ids = new Set(), panes = new Set(), tabs = [];
  for (const group of value.groups) {
    if (!group || typeof group.id !== 'string' || group.id.length > 80 || ids.has(group.id) || !validToolFrame(group.frame)
      || !Array.isArray(group.panes) || !group.panes.length || group.panes.length > allowedTabs.length) return false;
    ids.add(group.id);
    for (const pane of group.panes) {
      if (!pane || typeof pane.id !== 'string' || pane.id.length > 80 || panes.has(pane.id) || !Array.isArray(pane.tabs)
        || !pane.tabs.length || !pane.tabs.includes(pane.active) || !Number.isFinite(pane.share) || pane.share <= 0 || pane.share > 1000000) return false;
      panes.add(pane.id); tabs.push(...pane.tabs);
    }
  }
  return (value.activeGroup === null || ids.has(value.activeGroup)) && tabs.length === allowedTabs.length
    && new Set(tabs).size === tabs.length && allowedTabs.every(tab => tabs.includes(tab));
}
export function validToolDockLayout(value) {
  return validDockLayout(value, WORKBENCH_TOOL_TABS)
    && (value.inspectorSection === undefined || WORKBENCH_INSPECTOR_SECTIONS.includes(value.inspectorSection))
    && (value.inspectorRequest === undefined || Number.isSafeInteger(value.inspectorRequest) && value.inspectorRequest >= 0);
}

// Preserve the founder's current seven-tab layout while consolidating its six
// selection tools. This is the current preference transition, not a versioned
// compatibility framework. Artwork and the rest of the preference record stay out.
export function consolidateCurrentToolDockLayout(value) {
  if (validToolDockLayout(value)) return value;
  const previousSections = ['Transform', 'Color', 'Image', 'Shape', 'FX', 'Info'];
  if (!validDockLayout(value, ['Layers', ...previousSections])) return null;
  const layerGroup = value.groups.find(group => dockTabs(group).includes('Layers'));
  const layerPane = layerGroup.panes.find(pane => pane.tabs.includes('Layers'));
  const selectionGroups = value.groups.filter(group => group !== layerGroup);
  const selectionGroup = selectionGroups.find(group => group.id === value.activeGroup)
    || selectionGroups.find(group => group.panes.some(pane => !value.hidden.includes(pane.active)))
    || selectionGroups[0];
  const selectionPane = selectionGroup?.panes.find(pane => !value.hidden.includes(pane.active))
    || selectionGroup?.panes[0]
    || layerGroup.panes.find(pane => pane !== layerPane)
    || layerPane;
  let nextId = value.nextId;
  const usedIds = new Set(value.groups.flatMap(group => [group.id, ...group.panes.map(pane => pane.id)]));
  const id = () => {
    let next;
    do { next = `tools-${nextId++}`; } while (usedIds.has(next));
    usedIds.add(next); return next;
  };
  const inspectorId = selectionGroup?.id || id();
  const frame = selectionGroup?.frame || { ...layerGroup.frame,
    left: Math.max(8, layerGroup.frame.left - layerGroup.frame.width - 12) };
  const inspectorSection = WORKBENCH_INSPECTOR_SECTIONS.includes(selectionPane.active) ? selectionPane.active : undefined;
  const groups = [
    { ...layerGroup, panes: [{ ...layerPane, tabs: ['Layers'], active: 'Layers' }] },
    { id: inspectorId, frame, panes: [{ ...selectionPane, id: selectionPane === layerPane ? id() : selectionPane.id,
      tabs: ['Inspector'], active: 'Inspector' }] },
  ];
  const hidden = [
    ...(value.hidden.includes('Layers') ? ['Layers'] : []),
    ...(previousSections.every(tab => value.hidden.includes(tab)) ? ['Inspector'] : []),
  ];
  const result = { ...value, nextId, groups, hidden, inspectorSection, inspectorRequest: 0,
    activeGroup: value.activeGroup === null ? null : value.activeGroup === layerGroup.id ? layerGroup.id : inspectorId };
  return validToolDockLayout(result) ? result : null;
}

export function createToolDockLayout(width = 1440) {
  return { nextId: 1, activeGroup: null, hidden: width < 600 ? [...WORKBENCH_TOOL_TABS] : [], inspectorRequest: 0,
    groups: [
      { id: 'tools', panes: [{ id: 'tools', tabs: ['Layers'], active: 'Layers', share: 1 }],
        frame: { left: 16, top: 88, width: 290, height: 480 } },
      { id: 'inspector', panes: [{ id: 'inspector', tabs: ['Inspector'], active: 'Inspector', share: 1 }],
        frame: { left: Math.max(8, width - 306), top: 88, width: 290, height: 640 } },
    ] };
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
    infoVisible: () => toolIsVisible(layout, 'Inspector'),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    change(action) {
      const next = changeToolDock(layout, action);
      if (next === layout) return;
      layout = next; listeners.forEach(listener => listener());
    },
  };
}

export function changeToolDock(layout, action) {
  if (action.type === 'collapse-section') return action.tab === 'Inspector' && layout.inspectorSection === action.section
    ? { ...layout, inspectorSection: undefined } : layout;
  const group = layout.groups.find(item => item.id === action.group || dockTabs(item).includes(action.tab));
  if (action.type === 'open' || action.type === 'close' || action.type === 'select') {
    if (!group || !WORKBENCH_TOOL_TABS.includes(action.tab)) return layout;
    const request = action.type === 'open' && action.tab === 'Inspector';
    if (request && (action.section !== undefined && !WORKBENCH_INSPECTOR_SECTIONS.includes(action.section)
      || (layout.inspectorRequest || 0) === Number.MAX_SAFE_INTEGER)) return layout;
    const hidden = action.type === 'close' ? [...new Set([...layout.hidden, action.tab])] : layout.hidden.filter(tab => tab !== action.tab);
    return { ...layout, ...(request ? { inspectorSection: action.section ?? layout.inspectorSection,
      inspectorRequest: (layout.inspectorRequest || 0) + 1 } : {}), hidden, activeGroup: group.id, groups: layout.groups.map(item => item !== group ? item : {
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
