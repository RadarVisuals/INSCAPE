import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { createSideDockStore, dockSide, sideDockFrames } from './workbenchSideDockState.js';
import './workbenchSideDock.css';

const Context = createContext(null);
export const useSideDock = () => useContext(Context);
export function WorkbenchSideDockProvider({ preferences, children }) {
  const [controller] = useState(() => createSideDockStore(preferences));
  useLayoutEffect(() => preferences?.subscribe(controller.refresh), [preferences, controller]);
  return <Context.Provider value={controller}>{children}<SideDockSurface controller={controller} /></Context.Provider>;
}

function dockPresentation(state) {
  const frames = sideDockFrames(state.layout, state.windows, state.viewport);
  const widths = Object.fromEntries(['left', 'right'].map(side => [side,
    frames[state.layout.items.find(item => dockSide(item) === side && frames[item.id])?.id]?.width || 0]));
  const collapsed = Object.fromEntries(['left', 'right'].map(side => [side, Boolean(widths[side] && state.layout.collapsed?.[side])]));
  return { widths, collapsed, left: collapsed.left ? 0 : widths.left, right: collapsed.right ? 0 : widths.right };
}

// Docked edges meet the panels flush. Only exposed workspace corners round;
// the docking store remains the sole owner of sidebar geometry and visibility.
export function WorkbenchWorkspaceFrame() {
  const controller = useSideDock();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { left, right } = dockPresentation(state);
  return <div className="editor-workspace-frame" aria-hidden="true"
    data-docked-left={Boolean(left) || undefined} data-docked-right={Boolean(right) || undefined} />;
}

function SideDockSurface({ controller }) {
  const { navigationTop = 0 } = useWorkbenchView();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useLayoutEffect(() => {
    const resize = () => controller.viewport({ width: innerWidth, height: innerHeight, top: navigationTop });
    resize(); addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, [controller, navigationTop]);
  const { widths, left: leftWidth, right: rightWidth } = dockPresentation(state);
  const host = [...state.windows.values()].find(window => window.host)?.host;
  useLayoutEffect(() => {
    host?.style.setProperty('--workbench-left-dock-width', `${leftWidth}px`);
    host?.style.setProperty('--workbench-right-dock-width', `${rightWidth}px`);
    return () => { host?.style.removeProperty('--workbench-left-dock-width'); host?.style.removeProperty('--workbench-right-dock-width'); };
  }, [host, leftWidth, rightWidth]);
  if (!host) return null;
  return createPortal(['left', 'right'].map(side => {
    const preview = state.preview === side;
    const width = widths[side];
    const collapsed = Boolean(state.layout.collapsed?.[side]);
    return (width || preview) ? <aside key={side} aria-label={`${side === 'left' ? 'Left' : 'Right'} tool dock`} className="workbench-side-dock"
      data-dock-side={side} data-workbench-selection-tools data-workflow-material="tactile" data-workflow-finish="flat"
      data-collapsed={collapsed || undefined} data-drop-preview={preview || undefined}
      style={{ top: navigationTop, width: collapsed && !preview ? 0 : width || Math.min(320, state.viewport.width), bottom: 0 }}>
      {width > 0 && <button type="button" className="workbench-side-dock-toggle" data-reopen-side={side}
        aria-label={(collapsed ? 'Expand ' : 'Collapse ') + side + ' sidebar'} aria-expanded={!collapsed}
        title={(collapsed ? 'Show ' : 'Hide ') + side + ' panels'}
        onClick={() => controller.setCollapsed(side, !collapsed)}><span /></button>}
      {preview && <div className="workbench-side-dock-hint">Dock on {side}</div>}
    </aside> : null;
  }), host);
}
