import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import './contextToolbar.css';

const Context = createContext(null);
// The host owns only the selected target and movable dock. Module-owned React
// content stays mounted at its origin; actions never move into a global store.
export function ContextToolbarProvider({ target, children }) {
  const [host, setHost] = useState(null);
  const [label, setLabel] = useState(null);
  return <Context.Provider value={{ target, host, setHost, label, setLabel }}>{children}</Context.Provider>;
}
export const useContextToolTarget = () => useContext(Context)?.target;
export function ContextToolbar({ hidden, menuSurface }) {
  const context = useContext(Context);
  return <div data-context-tools hidden={hidden || !context?.label}>
    <WorkbenchWindow label="Properties" title={context?.label || 'Selection'} width={320} initialHeight={132} minimumHeight={64}
      initialX={Math.max(8, globalThis.innerWidth - 336)} initialY={24} fitContent fitContentFromTop resizable={false} chrome="tactile" menuSurface={menuSurface} className="context-toolbar workbench-tool-window">
      <div ref={context?.setHost} />
    </WorkbenchWindow>
  </div>;
}
export function ContextToolContent({ target, label, available = true, children }) {
  const context = useContext(Context);
  const content = useRef(null);
  const focused = useRef(null);
  const enabled = available && context?.target === target;
  const report = context?.setLabel;
  useLayoutEffect(() => {
    if (!enabled) return;
    report(label);
    return () => report(null);
  }, [enabled, label, report]);
  useLayoutEffect(() => {
    if (!enabled) { focused.current = null; return; }
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body) {
      content.current?.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true });
    }
  });
  return enabled && context.host
    ? createPortal(<section ref={content} data-workbench-inspection-target={target} onFocusCapture={event => { focused.current = event.target; }} aria-label={`${label} tools`}>{children}</section>, context.host) : null;
}
