import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function EditorToolbarPopover({ label, trigger, triggerRef, className = '', panelClassName = '', keepMounted = false, disabled, children }) {
  const id = useId(), panel = useRef(null), [open, setOpen] = useState(false);
  useEffect(() => {
    const node = panel.current, toggle = event => setOpen(event.newState === 'open');
    node.addEventListener('toggle', toggle);
    return () => node.removeEventListener('toggle', toggle);
  }, []);
  // Gesture fields unmount on dismissal. Temporary preview width retains its range.
  return <>
    <button ref={triggerRef} type="button" className={`editor-object-toolbar-button ${className}`} disabled={disabled} popovertarget={id}
      aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog">{trigger}</button>
    {createPortal(<div id={id} ref={panel} popover="auto" role="dialog" tabIndex={-1} aria-label={label}
      className={`editor-toolbar-popover workbench-editor-panel ${panelClassName}`} data-workbench-selection-tools data-system-workflow-overlay
      data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor"
      onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      {(open || keepMounted) && !disabled && children}
    </div>, document.body)}
  </>;
}
