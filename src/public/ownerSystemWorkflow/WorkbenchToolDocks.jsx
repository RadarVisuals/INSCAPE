import { Fragment, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import WorkbenchToolPanel from './WorkbenchToolPanel.jsx';
import WorkbenchDockDivider from './WorkbenchDockDivider.jsx';
import WorkbenchLayers from './WorkbenchLayers.jsx';
import WorkbenchSharedTools from './WorkbenchSharedTools.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { dockTabs, toolPane, toolIsVisible, visibleToolTabs, WORKBENCH_TOOL_TABS } from './workbenchToolDockState.js';
import './workbenchToolDocks.css';

const groupName = tabs => tabs.length === 1 ? tabs[0] : `${tabs.slice(0, -1).join(', ')} and ${tabs.at(-1)}`;

// One layout owns the tools. Stable portal containers move between docks;
// docking never creates a second tool instance or changes the artwork selection.
export default function WorkbenchToolDocks({ controller, hidden, menuSurface, navigationRef, historyBlocked, hostRef }) {
  const view = useWorkbenchView(), prefix = useId();
  const layout = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [containers] = useState(() => Object.fromEntries(WORKBENCH_TOOL_TABS.map(tab => [tab, document.createElement('div')])));
  const panels = useRef(new Map()), panes = useRef(new Map()), slots = useRef(new Map()), tabs = useRef(new Map());
  const drag = useRef(null), latest = useRef(null), skipClick = useRef(false), menuRoot = useRef(null);
  const [preview, setPreview] = useState(null), [menu, setMenu] = useState(null);
  const dispatch = controller.change;
  const focusTab = tab => tabs.current.get(tab)?.focus({ preventScroll: true });
  // Keep the selected tab reachable when a narrow dock has more tabs than fit.
  useLayoutEffect(() => {
    for (const group of layout.groups) for (const pane of group.panes) {
      const tab = tabs.current.get(pane.active), strip = tab?.parentElement;
      if (!strip) continue;
      const box = tab.getBoundingClientRect(), bounds = strip.getBoundingClientRect();
      if (box.left < bounds.left) strip.scrollLeft -= bounds.left - box.left;
      else if (box.right > bounds.right) strip.scrollLeft += box.right - bounds.right;
    }
  }, [layout]);
  const place = (items, target, frame, before, keyboardFocus = true, side) => {
    dispatch({ type: 'place', tabs: items, target, frame, before, side });
    // Placement can mount a new tab; ordinary tab navigation uses existing nodes.
    if (keyboardFocus) requestAnimationFrame(() => focusTab(items[0]));
  };
  const close = tab => {
    const pane = toolPane(layout, tab), group = layout.groups.find(item => item.panes.includes(pane));
    const next = visibleToolTabs(layout, pane).find(item => item !== tab) || dockTabs(group).find(item => item !== tab && toolIsVisible(layout, item));
    const focused = document.activeElement, panel = panels.current.get(group.id);
    dispatch({ type: 'close', tab }); setMenu(null);
    requestAnimationFrame(() => {
      const active = document.activeElement;
      // A newer target, or focus already outside this dock, belongs to the user.
      if (active !== document.body && active?.isConnected && (active !== focused || !panel?.contains(active))) return;
      if (next) { focusTab(next); return; }
      const fallback = ['Layers', 'Info'].includes(tab) && hostRef.current?.querySelector(`[data-workbench-toolbar] button[aria-label="${tab === 'Info' ? 'Artwork info' : 'Layers'}"]`);
      (fallback || hostRef.current)?.focus({ preventScroll: true });
    });
  };
  const hit = (x, y, current) => {
    // Strips join tabs; pane edges stack panels. Prefer the foreground dock.
    const ordered = [...layout.groups].reverse().sort((a, b) => Number(b.id === layout.activeGroup) - Number(a.id === layout.activeGroup));
    for (const group of ordered) {
      if (current.kind === 'group' && group.id === current.source) continue;
      for (const pane of group.panes) {
        const node = panes.current.get(pane.id);
        if (!node) continue;
        const box = node.getBoundingClientRect(), header = node.querySelector('header').getBoundingClientRect();
        if (x < box.left || x > box.right || y < box.top - 8 || y > box.bottom + 8) continue;
        const side = y < box.top + 7 ? 'above' : y > box.bottom - Math.min(36, box.height / 4) ? 'below' : null;
        if (side) {
          if (pane.tabs.every(tab => current.tabs.includes(tab))) continue;
          return { id: pane.id, side };
        }
        if (y > header.bottom) return null;
        const before = visibleToolTabs(layout, pane).filter(tab => !current.tabs.includes(tab)).find(tab => {
          const rect = tabs.current.get(tab)?.getBoundingClientRect();
          return rect && x < rect.left + rect.width / 2;
        });
        return { id: pane.id, before };
      }
    }
    return null;
  };
  const release = current => {
    if (current?.element?.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
  };
  const finish = (cancelled, event) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null; setPreview(null); release(current);
    if (cancelled || !current.moved) return;
    skipClick.current = current.kind === 'tab';
    const target = event && hit(event.clientX, event.clientY, current);
    if (target) place(current.tabs, target.id, undefined, target.before, false, target.side);
    else if (current.kind === 'tab') place(current.tabs, null, { ...current.frame,
      left: event.clientX - current.offsetX, top: event.clientY - current.offsetY }, undefined, false);
  };
  const move = event => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.moved = true;
    const target = hit(event.clientX, event.clientY, current);
    setPreview({ kind: current.kind, tabs: current.tabs, target: target?.id, before: target?.before, side: target?.side,
      left: event.clientX - current.offsetX, top: event.clientY - current.offsetY, width: current.frame.width });
  };
  const start = (event, group, items, kind) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    setMenu(null); skipClick.current = false;
    const rect = panels.current.get(group.id).getBoundingClientRect();
    const tabRect = event.currentTarget.getBoundingClientRect();
    drag.current = { kind, source: group.id, tabs: items, frame: { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
      x: event.clientX, y: event.clientY, offsetX: kind === 'tab' ? event.clientX - tabRect.x : event.clientX - rect.x,
      offsetY: event.clientY - rect.y, pointerId: event.pointerId, moved: false, element: kind === 'tab' ? event.currentTarget : null };
    if (kind === 'tab') {
      // A pointer tab gesture must not leave an old keyboard focus rectangle.
      if ([...tabs.current.values()].includes(document.activeElement)) document.activeElement.blur();
      event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  latest.current = { finish };
  useLayoutEffect(() => {
    const cancel = () => latest.current.finish(true);
    const escape = event => {
      if (event.key === 'Escape' && drag.current?.kind === 'tab') { event.preventDefault(); event.stopPropagation(); cancel(); }
    };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel); window.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('blur', cancel); window.removeEventListener('resize', cancel);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('keydown', escape, true);
      const current = drag.current; drag.current = null; release(current);
    };
  }, []);
  useLayoutEffect(() => { if (hidden) { latest.current.finish(true); setMenu(null); } }, [hidden]);
  useLayoutEffect(() => {
    for (const tab of WORKBENCH_TOOL_TABS) {
      const node = containers[tab], pane = toolPane(layout, tab);
      const slot = slots.current.get(pane.id);
      if (slot && node.parentNode !== slot) slot.appendChild(node);
      node.hidden = hidden || !toolIsVisible(layout, tab);
      node.className = 'workbench-docked-content';
      node.id = `${prefix}-panel-${tab}`; node.setAttribute('role', 'tabpanel'); node.setAttribute('aria-labelledby', `${prefix}-tab-${tab}`);
      if (tab === 'Layers') node.setAttribute('data-workbench-layers', '');
    }
  }, [layout, hidden, containers, prefix]);
  useLayoutEffect(() => {
    if (!menu) return;
    menuRoot.current?.querySelector('button')?.focus();
    const outside = event => { if (!menuRoot.current?.contains(event.target)) setMenu(null); };
    const blur = () => setMenu(null);
    window.addEventListener('pointerdown', outside, true); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('pointerdown', outside, true); window.removeEventListener('blur', blur); };
  }, [menu]);
  const openMenu = (event, tab) => {
    event.preventDefault(); event.stopPropagation();
    const rect = tabs.current.get(tab).getBoundingClientRect();
    setMenu({ tab, x: Math.min(innerWidth - 228, event.type === 'contextmenu' ? event.clientX : rect.left),
      y: Math.max(8, Math.min(innerHeight - 220, event.type === 'contextmenu' ? event.clientY : rect.bottom)) });
  };
  const keyboard = (event, group, tab) => {
    if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { openMenu(event, tab); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const visible = visibleToolTabs(layout, group), index = visible.indexOf(tab);
    const next = event.key === 'Home' ? visible[0] : event.key === 'End' ? visible.at(-1) : visible[(index + (event.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
    dispatch({ type: 'select', tab: next });
    // These tabs already exist. Focus now so another key before the next
    // animation frame advances from the newly selected tab, not the old one.
    focusTab(next);
  };
  const menuPane = menu && toolPane(layout, menu.tab);
  const menuGroup = menu && layout.groups.find(group => group.panes.includes(menuPane));
  return <div data-system-workflow-overlay data-workbench-selection-tools data-workflow-material="tactile" data-workflow-finish="flat" data-lattice-menu-surface data-menu-surface={menuSurface}>
    {!hidden && layout.groups.map(group => {
      const visiblePanes = group.panes.filter(pane => visibleToolTabs(layout, pane).length);
      if (!visiblePanes.length) return null;
      const title = groupName(visiblePanes.flatMap(pane => visibleToolTabs(layout, pane))), label = title === 'Layers' ? 'Workbench Layers' : title;
      // Only an explicitly opened/activated dock rises above screen utilities.
      return <WorkbenchToolPanel key={group.id} label={label} title={title}
        className="workbench-tool-dock"
        frame={group.frame} onFrameChange={frame => dispatch({ type: 'frame', group: group.id, frame })}
        panelRef={node => { if (node) panels.current.set(group.id, node); else panels.current.delete(group.id); }}
        active={layout.activeGroup === group.id} onActivate={() => dispatch({ type: 'activate', group: group.id })}
        zIndex={layout.activeGroup === group.id ? 86 : 84}
        viewportBottom={view.toolViewportBottom} topBoundaryRef={navigationRef}
        onMoveStart={event => start(event, group, dockTabs(group), 'group')} onMove={move} onMoveEnd={finish}>
        {renderHeader => <div className="workbench-dock-stack">{visiblePanes.map((pane, index) => <Fragment key={pane.id}>
          {index > 0 && <WorkbenchDockDivider group={group.id} before={visiblePanes[index - 1]} after={pane}
            label={`Resize ${visiblePanes[index - 1].active} and ${pane.active} panels`} onChange={dispatch} />}
          <div className={`workbench-dock-pane${preview?.target === pane.id && !preview.side ? ' workbench-dock-pane--target' : ''}`}
            style={{ flexGrow: pane.share }} data-dock-pane={pane.id}
            data-drop-side={preview?.target === pane.id ? preview.side : undefined}
            ref={node => { if (node) panes.current.set(pane.id, node); else panes.current.delete(pane.id); }}>
          {renderHeader(<div className="workbench-dock-tabs" role="tablist" aria-label="Artwork tools">{visibleToolTabs(layout, pane).map(tab => <button key={tab} type="button" role="tab"
          id={`${prefix}-tab-${tab}`} data-tool-tab={tab} data-drop-before={preview?.target === pane.id && preview?.before === tab || undefined}
          ref={node => { if (node) tabs.current.set(tab, node); else tabs.current.delete(tab); }}
          aria-selected={pane.active === tab} aria-controls={`${prefix}-panel-${tab}`} tabIndex={pane.active === tab ? 0 : -1}
          title="Drag to a tab strip to join, or a panel edge to stack; right-click for options" aria-keyshortcuts="Shift+F10"
          onClick={event => { if (skipClick.current && event.detail) { skipClick.current = false; return; } dispatch({ type: 'select', tab }); }}
          onKeyDown={event => keyboard(event, pane, tab)} onContextMenu={event => openMenu(event, tab)}
          onPointerDown={event => start(event, group, [tab], 'tab')} onPointerMove={move}
          onPointerUp={event => finish(false, event)} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}>{tab}</button>)}</div>,
          () => close(pane.active), `Close ${pane.active === 'Layers' ? 'Workbench Layers' : pane.active}`)}
          <div className="workbench-dock-slot" ref={node => { if (node) slots.current.set(pane.id, node); else slots.current.delete(pane.id); }} />
          </div>
        </Fragment>)}</div>}
      </WorkbenchToolPanel>;
    })}
    {WORKBENCH_TOOL_TABS.map(tab => createPortal(tab === 'Layers'
      ? <WorkbenchLayers open={toolIsVisible(layout, tab)} hidden={hidden} onOpen={() => dispatch({ type: 'open', tab })}
          historyBlocked={historyBlocked} hostRef={hostRef} />
      : <WorkbenchSharedTools tab={tab} visible={!hidden && !preview && toolIsVisible(layout, tab)} historyBlocked={historyBlocked} />, containers[tab], tab))}
    {preview?.kind === 'tab' && <div className="workbench-dock-ghost" aria-hidden="true" style={{ left: preview.left, top: preview.top, width: preview.width }}>{groupName(preview.tabs)}</div>}
    {menu && !hidden && <div ref={menuRoot} className="workbench-dock-menu" role="menu" aria-label={`${menu.tab} panel options`} style={{ left: Math.max(8, menu.x), top: menu.y, maxHeight: innerHeight - menu.y - 8 }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenu(null); requestAnimationFrame(() => focusTab(menu.tab)); }
        const buttons = [...event.currentTarget.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
          buttons[next]?.focus();
        }
        if (event.key === 'Tab') setMenu(null);
      }}>
      {dockTabs(menuGroup).length > 1 && <button role="menuitem" type="button" onClick={() => {
        place([menu.tab], null, { ...menuGroup.frame, left: menuGroup.frame.left >= 348 ? menuGroup.frame.left - 340 : menuGroup.frame.left + 32, top: menuGroup.frame.top + 24 }); setMenu(null);
      }}>Detach {menu.tab}</button>}
      {layout.groups.flatMap(group => group.panes).filter(pane => visibleToolTabs(layout, pane).some(tab => tab !== menu.tab)).map(pane => {
        const name = groupName(visibleToolTabs(layout, pane).filter(tab => tab !== menu.tab));
        return <Fragment key={pane.id}>
          {pane !== menuPane && <button role="menuitem" type="button" onClick={() => { place([menu.tab], pane.id); setMenu(null); }}>Dock with {name}</button>}
          {['above', 'below'].map(side => <button role="menuitem" type="button" key={side}
            onClick={() => { place([menu.tab], pane.id, undefined, undefined, true, side); setMenu(null); }}>Dock {side} {name}</button>)}
        </Fragment>;
      })}
      <button role="menuitem" type="button" onClick={() => close(menu.tab)}>Close {menu.tab}</button>
    </div>}
  </div>;
}
