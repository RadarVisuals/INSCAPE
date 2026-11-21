import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './text.css';

const Context = createContext(null);
export const useSharedTextTools = () => useContext(Context);

// Display articles share their module's selection rather than a standalone Text
// record. This bridge supplies a portal into the Inspector, never another window.
// Editors, callbacks, unsaved recovery and article content remain module-owned.
export function SharedTextToolsProvider({ activeModuleId, onActivate, open, onOpenChange, children }) {
  const [host, setHost] = useState(null), [source, setSource] = useState(null);
  const report = useCallback(value => {
    setSource(value);
    return () => setSource(current => current?.token === value.token ? null : current);
  }, []);
  const value = useMemo(() => ({ activeModuleId, activate: onActivate, open, setOpen: onOpenChange, host, setHost, source, report }),
    [activeModuleId, onActivate, open, onOpenChange, host, source, report]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function SharedTextToolsInspectorContent({ targetId }) {
  const tools = useSharedTextTools();
  if (!tools?.open || tools.source?.targetId !== targetId || tools.activeModuleId !== targetId) return null;
  return <div ref={tools.setHost} data-text-inspector-target={targetId} />;
}

export function SharedTextToolsContent({ targetId, available = true, label, onClose, children }) {
  const tools = useSharedTextTools();
  const current = useRef(onClose); current.current = onClose;
  const token = useRef(Symbol('text-tools'));
  const enabled = Boolean(tools?.open && tools.activeModuleId === targetId && available);
  const report = tools?.report;
  useLayoutEffect(() => {
    if (!enabled) return;
    return report({ token: token.current, targetId, label, close: () => current.current?.() });
  }, [enabled, targetId, label, report]);
  return enabled && tools.host ? createPortal(children, tools.host) : null;
}
