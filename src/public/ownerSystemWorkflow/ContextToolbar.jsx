import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import './contextToolbar.css';

const Context = createContext(null);
const Target = createContext(null);
// The host owns selection and DOM destinations only. Module-owned actions stay
// mounted at their origin, with the same callbacks, save boundaries and undo.
export function ContextToolbarProvider({ target, children }) {
  const [host, setHost] = useState(null);
  const [actionHost, setActionHost] = useState(null);
  const [inspectionHost, setInspectionHost] = useState(null);
  const [content, setContent] = useState(null);
  const value = useMemo(() => ({ target, host, setHost, actionHost, setActionHost, inspectionHost, setInspectionHost, content, setContent }),
    [target, host, actionHost, inspectionHost, content]);
  // Modules need the current target, not notifications that a portal host or
  // its description changed. Both values still derive from the same owner.
  return <Target.Provider value={target}><Context.Provider value={value}>{children}</Context.Provider></Target.Provider>;
}
export const useContextToolTarget = () => useContext(Target);
const currentContent = context => context?.content?.target === context?.target ? context?.content : null;

export function ContextToolbar({ hidden, menuSurface }) {
  const context = useContext(Context), content = currentContent(context);
  const view = useWorkbenchView();
  const recoveryControls = view.entries.get(context?.target)?.querySelectorAll('[data-workbench-recovery-control]');
  return <div data-context-tools hidden={hidden || !content?.properties}>
    <WorkbenchWindow label="Properties" title={content?.label || 'Selection'} width={320} initialHeight={132} minimumHeight={64}
      initialX={Math.max(8, globalThis.innerWidth - (view.toolSources ? 1020 : 336))} initialY={view.toolSources ? 88 : 24} avoidControls={recoveryControls} fitContent fitContentFromTop resizable={false} chrome="tactile" menuSurface={menuSurface} className="context-toolbar workbench-tool-window">
      <div ref={context?.setHost} />
    </WorkbenchWindow>
  </div>;
}

function navigateActions(event) {
  if (!event.target.closest('button') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
  if (!buttons.length) return;
  event.preventDefault(); event.stopPropagation();
  const index = buttons.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus({ preventScroll: true });
  buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function ContextActionBars() {
  const context = useContext(Context), content = currentContent(context);
  return <div className="context-action-bars" data-context-action-bars hidden={!content?.actions && !content?.inspection}>
    <div className="context-action-bar" data-context-bar="inspection" ref={context?.setInspectionHost}
      role="toolbar" aria-label="Inspection and placement" hidden={!content?.inspection} />
    <div className="context-action-bar" data-context-bar="selection" ref={context?.setActionHost}
      role="toolbar" aria-label="Selection tools" hidden={!content?.actions} />
  </div>;
}

export function ContextToolContent({ target, label, available = true, actions, inspection, children }) {
  const context = useContext(Context), content = useRef(null), actionContent = useRef(null), inspectionContent = useRef(null), focused = useRef(null);
  const enabled = available && context?.target === target;
  const report = context?.setContent;
  const hasActions = Boolean(actions), hasInspection = Boolean(inspection), hasProperties = Boolean(children);
  useLayoutEffect(() => {
    if (!enabled) return;
    report({ target, label, actions: hasActions, inspection: hasInspection, properties: hasProperties });
    return () => report(previous => previous?.target === target ? null : previous);
  }, [enabled, target, label, report, hasActions, hasInspection, hasProperties]);
  useLayoutEffect(() => {
    if (!enabled) { focused.current = null; return; }
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body) {
      const surfaces = [actionContent.current, inspectionContent.current, content.current];
      surfaces.map(node => node?.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)')).find(Boolean)?.focus({ preventScroll: true });
    }
  });
  if (!enabled) return null;
  const focus = event => { focused.current = event.target; };
  return <>
    {children && context.host && createPortal(<section ref={content} data-workbench-inspection-target={target} onFocusCapture={focus} aria-label={`${label} tools`}>{children}</section>, context.host)}
    {actions && context.actionHost && createPortal(<section ref={actionContent} data-context-action-target={target} onFocusCapture={focus} onKeyDown={navigateActions}>{actions}</section>, context.actionHost)}
    {inspection && context.inspectionHost && createPortal(<section ref={inspectionContent} data-context-inspection-target={target} onFocusCapture={focus} onKeyDown={navigateActions}>{inspection}</section>, context.inspectionHost)}
  </>;
}
