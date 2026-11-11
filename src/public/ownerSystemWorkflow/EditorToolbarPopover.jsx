import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function EditorToolbarPopover({ label, trigger, className = '', disabled, children }) {
  const id = useId(), panel = useRef(null), [open, setOpen] = useState(false);
  useEffect(() => {
    const node = panel.current, toggle = event => setOpen(event.newState === 'open');
    node.addEventListener('toggle', toggle);
    return () => node.removeEventListener('toggle', toggle);
  }, []);
  // Only mount interactive fields while open so dismissal cancels live gestures.
  return <>
    <button type="button" className={`editor-object-toolbar-button ${className}`} disabled={disabled} popovertarget={id}
      aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog">{trigger}</button>
    {createPortal(<div id={id} ref={panel} popover="auto" role="dialog" aria-label={label}
      className="editor-toolbar-popover workbench-editor-panel" data-workbench-selection-tools data-system-workflow-overlay
      data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor"
      onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      {open && !disabled && children}
    </div>, document.body)}
  </>;
}
