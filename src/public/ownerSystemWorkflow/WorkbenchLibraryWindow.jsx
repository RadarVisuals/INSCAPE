import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, PanelLeft, X } from 'lucide-react';
import WorkbenchToolPanel from './WorkbenchToolPanel.jsx';
import LibraryWorkspace from './OwnerSystemWorkflowLibraryWorkspace.jsx';

// The same Library stays mounted while its screen host changes. Browsing,
// selection and asset placement remain owned by LibraryWorkspace.
export default function WorkbenchLibraryWindow({ windowPreferences, navigationHost, dockHost, onDock, onClose, ...props }) {
  const saved = useSyncExternalStore(windowPreferences.subscribe, windowPreferences.getSnapshot);
  const detached = saved?.detached === true;
  const [container] = useState(() => document.createElement('div'));
  const panel = useRef(null), restoreFocus = useRef(false);
  const [placing, setPlacing] = useState(false);
  const attach = useCallback(node => { node?.appendChild(container); }, [container]);
  useLayoutEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    (detached ? panel.current?.querySelector('.workbench-tool-panel-grip')
      : container.querySelector('[aria-label="Detach Library"]'))?.focus({ preventScroll: true });
  }, [detached, container]);
  const toggle = () => {
    const box = container.querySelector('.system-workflow__library')?.getBoundingClientRect();
    restoreFocus.current = true;
    if (detached) onDock?.();
    windowPreferences.update(current => ({ detached: !detached, frame: current?.frame || {
      left: box.left + 24, top: box.top + 24, width: Math.max(360, box.width), height: Math.min(640, box.height),
    } }));
  };
  const changeFrame = change => windowPreferences.update(current => ({ ...current,
    frame: typeof change === 'function' ? change(current.frame) : change }));
  const control = <button type="button" className="workbench-tool-panel-close" onClick={toggle}
    aria-label={detached ? 'Dock Library' : 'Detach Library'} title={detached ? 'Dock Library' : 'Detach Library'}>
    {detached ? <PanelLeft /> : <Maximize2 />}
  </button>;
  return <div data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor" data-lattice-menu-surface>
    {detached ? <WorkbenchToolPanel title="Library" label="Library window" chrome="flat" panelRef={panel}
      className={`workbench-library-window workbench-tool-controls workbench-editor-panel${placing ? ' is-placing' : ''}`}
      data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor"
      frame={saved.frame} onFrameChange={changeFrame} minimumWidth={300} minimumHeight={300}
      headerActions={control} onClose={onClose} closeLabel="Close Library">
      {renderHeader => <>{renderHeader()}<div className="workbench-library-slot" ref={attach} /></>}
    </WorkbenchToolPanel> : dockHost ? createPortal(<div className="workbench-library-slot" ref={attach} />, dockHost)
      : <div className="workbench-library-docked-slot" ref={attach} />}
    {createPortal(<LibraryWorkspace {...props} presentation="editor" navigationHost={detached || dockHost ? null : navigationHost}
      onClose={detached ? undefined : onClose} resizable={!detached && !dockHost} embedded={detached || Boolean(dockHost)}
      onPlacingChange={setPlacing}
      header={detached ? undefined : <header className="workbench-tool-panel-header system-workflow__library-header">
        {!dockHost && <span>Library</span>}{control}{!dockHost && <button type="button" className="workbench-tool-panel-close" aria-label="Close workspace" title="Close Library" onClick={onClose}><X /></button>}
      </header>} />, container)}
  </div>;
}
