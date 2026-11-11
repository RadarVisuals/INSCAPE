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

function SideDockSurface({ controller }) {
  const { navigationTop = 0 } = useWorkbenchView();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useLayoutEffect(() => {
    const resize = () => controller.viewport({ width: innerWidth, height: innerHeight, top: navigationTop });
    resize(); addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, [controller, navigationTop]);
  const frames = sideDockFrames(state.layout, state.windows, state.viewport);
  const widthFor = side => frames[state.layout.items.find(item => dockSide(item) === side && frames[item.id])?.id]?.width || 0;
  const leftWidth = widthFor('left'), rightWidth = widthFor('right');
  const host = [...state.windows.values()].find(window => window.host)?.host;
  useLayoutEffect(() => {
    host?.style.setProperty('--workbench-left-dock-width', `${leftWidth}px`);
    host?.style.setProperty('--workbench-right-dock-width', `${rightWidth}px`);
    return () => { host?.style.removeProperty('--workbench-left-dock-width'); host?.style.removeProperty('--workbench-right-dock-width'); };
  }, [host, leftWidth, rightWidth]);
  if (!host) return null;
  return createPortal(['left', 'right'].map(side => {
    const preview = state.preview === side;
    const width = widthFor(side);
    return (width || preview) ? <aside key={side} aria-label={`${side === 'left' ? 'Left' : 'Right'} tool dock`} className="workbench-side-dock"
      data-dock-side={side} data-workbench-selection-tools data-workflow-material="tactile" data-workflow-finish="flat"
      data-drop-preview={preview || undefined} style={{ top: navigationTop, width: width || Math.min(320, state.viewport.width), bottom: 0 }}>
      {preview && <div className="workbench-side-dock-hint">Dock on {side}</div>}
    </aside> : null;
  }), host);
}
