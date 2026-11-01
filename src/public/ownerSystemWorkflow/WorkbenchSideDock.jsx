import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { createSideDockStore, sideDockFrames } from './workbenchSideDockState.js';
import './workbenchSideDock.css';

const Context = createContext(null);
export const useSideDock = () => useContext(Context);
export function WorkbenchSideDockProvider({ preferences, children }) {
  const [controller] = useState(() => createSideDockStore(preferences));
  useLayoutEffect(() => preferences?.subscribe(controller.refresh), [preferences, controller]);
  return <Context.Provider value={controller}>{children}<SideDockSurface controller={controller} /></Context.Provider>;
}

function SideDockSurface({ controller }) {
  const { navigationTop = 0, navigationInset = 0 } = useWorkbenchView();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useLayoutEffect(() => {
    const resize = () => controller.viewport({ width: innerWidth, height: innerHeight, top: navigationTop, left: navigationInset });
    resize(); addEventListener('resize', resize);
    return () => removeEventListener('resize', resize);
  }, [controller, navigationTop, navigationInset]);
  const frames = Object.values(sideDockFrames(state.layout, state.windows, state.viewport));
  const width = frames[0]?.width || Math.min(state.layout.width, state.viewport.width - state.viewport.left);
  const host = [...state.windows.values()].find(window => window.host)?.host;
  const reservedWidth = frames.length ? width : 0;
  useLayoutEffect(() => {
    host?.style.setProperty('--workbench-side-dock-width', `${reservedWidth}px`);
    return () => host?.style.removeProperty('--workbench-side-dock-width');
  }, [host, reservedWidth]);
  if (!frames.length && !state.preview) return null;
  if (!host) return null;
  return createPortal(<aside aria-label="Right tool dock" className="workbench-side-dock" data-workbench-selection-tools data-workflow-material="tactile" data-workflow-finish="flat"
    data-drop-preview={Boolean(state.preview) || undefined}
    style={{ top: navigationTop, width, bottom: 0 }}>
    {state.preview && <div className="workbench-side-dock-hint">Dock on right</div>}
  </aside>, host);
}
