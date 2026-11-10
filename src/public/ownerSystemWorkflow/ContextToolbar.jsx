import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import ArtworkActionControls from './ArtworkActionControls.jsx';
import { useSideDock } from './WorkbenchSideDock.jsx';
import { dockSide, sideDockFrames } from './workbenchSideDockState.js';
import './contextToolbar.css';

const Context = createContext(null);
const Target = createContext(null);
const noSubscribe = () => () => {}, noSnapshot = () => null;
// The host owns selection and DOM destinations only. Module-owned actions stay
// mounted at their origin, with the same callbacks, save boundaries and undo.
export function ContextToolbarProvider({ target, children }) {
  const [host, setHost] = useState(null);
  const [content, setContent] = useState(null);
  const value = useMemo(() => ({ target, host, setHost, content, setContent }),
    [target, host, content]);
  // Modules need the current target, not notifications that a portal host or
  // its description changed. Both values still derive from the same owner.
  return <Target.Provider value={target}><Context.Provider value={value}>{children}</Context.Provider></Target.Provider>;
}
export const useContextToolTarget = () => useContext(Target);
const currentContent = context => context?.content?.target === context?.target ? context?.content : null;

export function ContextToolbar({ hidden }) {
  const context = useContext(Context), content = currentContent(context);
  const view = useWorkbenchView();
  const sideDock = useSideDock();
  const dockState = useSyncExternalStore(sideDock?.subscribe || noSubscribe, sideDock?.getSnapshot || noSnapshot);
  const frames = dockState ? sideDockFrames(dockState.layout, dockState.windows, dockState.viewport) : {};
  const insets = { left: 0, right: 0 };
  for (const item of dockState?.layout.items || []) {
    if (frames[item.id]) insets[dockSide(item)] = frames[item.id].width;
  }
  const recoveryControls = view.entries.get(context?.target)?.querySelectorAll('[data-workbench-recovery-control]');
  return <div data-context-tools hidden={hidden || !content?.properties}>
    <WorkbenchWindow label="Properties" title={content?.label || 'Selection'} width={320} initialHeight={132} minimumHeight={64} viewportInsets={insets}
      initialX={Math.max(8, globalThis.innerWidth - (view.toolSources ? 1020 : 336))} initialY={view.toolSources ? 88 : 24} avoidControls={recoveryControls} fitContent fitContentFromTop resizable={false} chrome="flat" className="context-toolbar workbench-tool-window">
      <div ref={context?.setHost} />
    </WorkbenchWindow>
  </div>;
}

export function ContextToolContent({ target, label, available = true, actions, inspection, children }) {
  const context = useContext(Context), content = useRef(null), focused = useRef(null);
  const enabled = available && context?.target === target;
  const report = context?.setContent;
  const hasProperties = Boolean(children || actions || inspection);
  useLayoutEffect(() => {
    if (!enabled) return;
    report({ target, label, properties: hasProperties });
    return () => report(previous => previous?.target === target ? null : previous);
  }, [enabled, target, label, report, hasProperties]);
  useLayoutEffect(() => {
    if (!enabled) { focused.current = null; return; }
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body) {
      content.current?.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true });
    }
  });
  if (!enabled) return null;
  const focus = event => { focused.current = event.target; };
  return context.host && createPortal(<section ref={content} data-workbench-inspection-target={target} onFocusCapture={focus} aria-label={`${label} tools`}>
    <ArtworkActionControls key={target} actions={actions} inspection={inspection} />
    {children}
  </section>, context.host);
}
