import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import WorkbenchToolPanel from '../public/ownerSystemWorkflow/WorkbenchToolPanel.jsx';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import './text.css';

const Context = createContext(null);
export const useSharedTextTools = () => useContext(Context);

// The shared window owns only its screen position and active tool source.
// Editors, callbacks, unsaved recovery and article content remain module-owned.
const noSubscription = () => () => {};
export function SharedTextToolsProvider({ activeModuleId, onActivate, open, onOpenChange, menuSurface, children, editorPreferences }) {
  const [host, setHost] = useState(null), [source, setSource] = useState(null);
  const [localSection, setLocalSection] = useState('format');
  const storedSection = editorPreferences?.section('textSection'), framePreferences = editorPreferences?.section('textFrame');
  const section = useSyncExternalStore(storedSection?.subscribe || noSubscription, storedSection?.getSnapshot || (() => localSection));
  const setSection = storedSection?.update || setLocalSection;
  const report = useCallback(value => {
    setSource(value);
    return () => setSource(current => current?.token === value.token ? null : current);
  }, []);
  const value = useMemo(() => ({ activeModuleId, activate: onActivate, open, setOpen: onOpenChange, menuSurface, host, setHost, source, report, section, setSection, framePreferences }),
    [activeModuleId, onActivate, open, onOpenChange, menuSurface, host, source, report, section, setSection, framePreferences]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function SharedTextToolsWindow({ hidden = false, navigationRef }) {
  const tools = useSharedTextTools();
  const view = useWorkbenchView();
  const { source } = tools;
  const [localFrame, setLocalFrame] = useState(null);
  const frame = useSyncExternalStore(tools.framePreferences?.subscribe || noSubscription, tools.framePreferences?.getSnapshot || (() => localFrame));
  const setFrame = tools.framePreferences?.update || setLocalFrame;
  useLayoutEffect(() => {
    if (!source || frame || (view.setToolViewportBottom && view.toolViewportBottom == null)) return;
    const anchor = source.anchor || { left: 760, right: 748, top: 72 };
    const width = Math.min(326, innerWidth - 16);
    const left = anchor.right + 12 + width <= innerWidth - 8 ? anchor.right + 12 : Math.max(8, anchor.left - width - 12);
    setFrame({ left, top: anchor.top, width, height: Math.min(620, Math.max(240, (view.toolViewportBottom ?? innerHeight - 48) - anchor.top - 8)) });
  }, [source, frame, setFrame, view.setToolViewportBottom, view.toolViewportBottom]);
  if (!frame || hidden || !tools.open || !source) return null;
  return <div data-shared-text-tools data-workbench-inspection-target={tools.activeModuleId}
    data-system-workflow-overlay data-workflow-material="tactile" data-workflow-finish="flat" data-lattice-menu-surface data-menu-surface={tools.menuSurface}>
    <WorkbenchToolPanel label={`Text tools: ${source.label}`} title="Text" moveLabel="Move Text tools window" closeLabel="Close Text tools" className="text-tools-window"
      titleContent={<span className="text-inspector-heading"><strong>Text</strong><span title={source.label}>{source.label}</span></span>}
      frame={frame} onFrameChange={setFrame} minimumWidth={300} zIndex={81} viewportBottom={view.toolViewportBottom} topBoundaryRef={navigationRef} fitFromTop
      onClose={() => {
        if (source?.close() !== false) tools.setOpen(false);
      }}>
      <div className="text-tools-content" ref={tools.setHost} />
    </WorkbenchToolPanel>
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
