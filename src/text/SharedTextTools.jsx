import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { X } from '../public/InscapeIcons.jsx';
import './text.css';

const Context = createContext(null);
export const useSharedTextTools = () => useContext(Context);

// The shared window owns only its screen position and active tool source.
// Editors, callbacks, unsaved recovery and article content remain module-owned.
export function SharedTextToolsProvider({ activeModuleId, onActivate, open, onOpenChange, children }) {
  const [host, setHost] = useState(null), [source, setSource] = useState(null);
  const report = useCallback(value => {
    setSource(value);
    return () => setSource(current => current?.token === value.token ? null : current);
  }, []);
  return <Context.Provider value={{ activeModuleId, activate: onActivate, open, setOpen: onOpenChange, host, setHost, source, report }}>{children}</Context.Provider>;
}

export function SharedTextToolsWindow({ hidden = false }) {
  const tools = useSharedTextTools();
  const { source } = tools;
  const initialAnchor = useRef(null);
  const frame = useRef(null);
  if (source && !initialAnchor.current) initialAnchor.current = source.anchor || { left: 760, right: 748, top: 72 };
  if (!initialAnchor.current || hidden || !tools.open || !source) return null;
  const anchor = initialAnchor.current;
  const width = Math.min(326, globalThis.innerWidth - 16);
  const left = anchor.right + 12 + width <= globalThis.innerWidth - 8 ? anchor.right + 12 : Math.max(8, anchor.left - width - 12);
  return <div className="text-workbench" data-shared-text-tools style={{ '--text-z': 80 }}>
    <WorkbenchWindow label="Text tools" title={source?.label || 'Select Text'} chrome="bevel" className="text-tools-window" width={326} initialHeight={620}
      titleContent={<div className="text-inspector-heading"><strong>Text</strong><span title={source?.label}>{source?.label || 'Select Text'}</span></div>}
      fitContent resizable={false} initialX={frame.current?.left ?? left} initialY={frame.current?.top ?? anchor.top} onLayoutChange={value => { frame.current = value; }}
      controls={<button type="button" className="system-workflow__window-cap" aria-label="Close Text tools" onClick={() => {
        if (source?.close() !== false) tools.setOpen(false);
      }}><X /></button>}>
      <div className="text-tools-content" ref={tools.setHost} />
    </WorkbenchWindow>
  </div>;
}

export function SharedTextToolsContent({ targetId, available = true, label, anchor, onClose, children }) {
  const tools = useSharedTextTools();
  const current = useRef({ anchor, onClose }); current.current = { anchor, onClose };
  const token = useRef(Symbol('text-tools'));
  const enabled = Boolean(tools?.open && tools.activeModuleId === targetId && available);
  const report = tools?.report;
  useLayoutEffect(() => {
    if (!enabled) return;
    return report({ token: token.current, label, anchor: current.current.anchor, close: () => current.current.onClose?.() });
  }, [enabled, label, report]);
  return enabled && tools.host ? createPortal(children, tools.host) : null;
}
