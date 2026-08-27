import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { categoryDialogInitialName } from '../../lattice/browser/browserWorkspaceModel.js';

export function OwnerSystemWorkflowSidebarEditor({ dialog, entityLabel = 'item', onCancel, onConfirm }) {
  const [name, setName] = useState(() => categoryDialogInitialName(dialog));
  const inputRef = useRef(null);
  useEffect(() => {
    setName(categoryDialogInitialName(dialog));
    inputRef.current?.focus({ preventScroll: true });
  }, [dialog]);
  if (!dialog) return null;
  const submit = (event) => {
    event.preventDefault();
    const value = name.trim();
    if (value) onConfirm(value);
  };
  return <form aria-label={`${dialog.type.startsWith('rename') ? 'Rename' : 'Create'} ${entityLabel}`}
    className="system-workflow__sidebar-editor" data-error={dialog.error || undefined} onSubmit={submit}>
    <input aria-invalid={dialog.error ? 'true' : undefined} aria-label={`${entityLabel} name`} maxLength="80"
      onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
      }} placeholder={`${entityLabel[0]?.toUpperCase() || ''}${entityLabel.slice(1)} name`} ref={inputRef}
      title={dialog.error || undefined} value={name} />
  </form>;
}

export function OwnerSystemWorkflowSidebarDeleteConfirmation({ entityLabel, name, onCancel, onConfirm }) {
  return <div aria-label={`Delete ${entityLabel} ${name}`} className="system-workflow__sidebar-delete" role="alertdialog">
    <span>Delete {name}</span>
    <button aria-label={`Cancel deleting ${name}`} onClick={onCancel} title="Cancel" type="button">
      <X aria-hidden="true" size={13} />
    </button>
    <button aria-label={`Delete ${name}`} onClick={onConfirm} title={`Delete ${entityLabel}`} type="button">
      <Trash2 aria-hidden="true" size={13} />
    </button>
  </div>;
}

export function OwnerSystemWorkflowWorkspaceShell({ children, className, label, phase, placing = false, rail, sidebarCollapsed = false }) {
  const [hoverLabel, setHoverLabel] = useState(null);
  const showHoverLabel = (event) => {
    const button = event.target.closest?.('.lattice-browser-sidebar button');
    const sidebar = button?.closest?.('.lattice-browser-sidebar');
    if (!button || !sidebar || sidebar.getBoundingClientRect().width > 72) return;
    const rect = button.getBoundingClientRect();
    const workspaceRect = event.currentTarget.getBoundingClientRect();
    setHoverLabel({
      active: button.matches('[aria-pressed="true"], [data-active]'),
      height: rect.height,
      label: button.getAttribute('aria-label'),
      left: rect.right - workspaceRect.left - 1,
      top: rect.top - workspaceRect.top - 1,
    });
  };
  return <section aria-hidden={phase === 'closing' || undefined} aria-label={label}
    className={`system-workflow__workspace-window system-workflow__browser-workspace system-workflow__motion-panel ${className}`}
    data-placing={placing || undefined}
    data-sidebar-collapsed={sidebarCollapsed || undefined}
    inert={phase === 'closing' ? '' : undefined}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHoverLabel(null); }}
    onFocusCapture={showHoverLabel}
    onPointerOver={showHoverLabel} onPointerLeave={() => setHoverLabel(null)}>
    <div className="system-workflow__browser-body">{children}</div>
    <footer className="system-workflow__local-rail">{rail}</footer>
    {hoverLabel?.label && <output aria-hidden="true" className="system-workflow__sidebar-hover-label"
      data-active={hoverLabel.active || undefined}
      style={{ height: hoverLabel.height, left: hoverLabel.left, top: hoverLabel.top }}>{hoverLabel.label}</output>}
  </section>;
}

export function useOwnerSystemWorkflowSidebar(initialWidth = 174, preferences = null) {
  const [width, setWidth] = useState(() => preferences?.width || initialWidth);
  const gesture = useRef(null);
  const expandedWidth = useRef(width >= 152 ? width : initialWidth);
  const collapsed = width <= 48;
  const resize = {
    begin(event) { if (event.button !== 0) return; event.preventDefault(); gesture.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width }; event.currentTarget.setPointerCapture?.(event.pointerId); },
    update(event) { if (gesture.current?.pointerId !== event.pointerId) return; const next = Math.min(320, Math.max(48, gesture.current.startWidth + event.clientX - gesture.current.startX)); if (next >= 152) expandedWidth.current = next; setWidth(next); if (preferences) preferences.width = next; },
    finish(event) { if (gesture.current?.pointerId === event.pointerId) gesture.current = null; },
  };
  const ensureWidth = (minimum = 152) => {
    if (width >= minimum) return;
    const next = Math.max(minimum, expandedWidth.current);
    setWidth(next); if (preferences) preferences.width = next;
  };
  return { collapsed, ensureWidth, resize, width };
}

export function OwnerSystemWorkflowBrowserSidebar({ afterCreate = null, children, createLabel, editing = false, inlineEditor = null, onCreate, sidebar }) {
  return <>
    <nav aria-label="Browser navigation" className="lattice-browser-sidebar" data-collapsed={sidebar.collapsed || undefined}>
      {children}
      <div className="lattice-browser-sidebar__category-heading">
        {inlineEditor || (onCreate && <button aria-label={createLabel} className="lattice-browser-sidebar__create" onClick={onCreate} type="button"><Plus size={14} /><span>{createLabel}</span></button>)}
      </div>
      {afterCreate}
    </nav>
    <button aria-label="Resize Browser navigation" className="lattice-browser-sidebar-resize" disabled={editing} onLostPointerCapture={sidebar.resize.finish}
      onPointerDown={sidebar.resize.begin} onPointerMove={sidebar.resize.update} onPointerUp={sidebar.resize.finish} type="button" />
  </>;
}

export function OwnerSystemWorkflowCreateDialog({ initialName = '', label, onCancel, onConfirm, submitLabel = 'Create' }) {
  const [name, setName] = useState(initialName);
  return <div className="system-workflow__create-dialog" role="dialog" aria-modal="true" aria-label={label}>
    <form onSubmit={(event) => { event.preventDefault(); if (onConfirm(name)) onCancel(); }}>
      <label><span>{label}</span><input autoFocus maxLength="80" onChange={(event) => setName(event.target.value)} value={name} /></label>
      <footer><button onClick={onCancel} type="button">Cancel</button><button disabled={!name.trim()} type="submit">{submitLabel}</button></footer>
    </form>
  </div>;
}
