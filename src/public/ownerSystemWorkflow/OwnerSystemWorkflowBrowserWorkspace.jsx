import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { categoryDialogInitialName } from '../../lattice/browser/browserWorkspaceModel.js';

export function OwnerSystemWorkflowSidebarEditor({ dialog, entityLabel = 'item', onCancel, onConfirm }) {
  const initialName = categoryDialogInitialName(dialog);
  const [name, setName] = useState(initialName);
  const inputRef = useRef(null);
  useEffect(() => {
    setName(initialName);
    inputRef.current?.focus({ preventScroll: true });
  }, [initialName, dialog?.type, dialog?.category?.id, dialog?.section?.id]);
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
    <span>Delete {name}?</span>
    <button aria-label={`Cancel deleting ${name}`} onClick={onCancel} title="Cancel" type="button">
      <X aria-hidden="true" size={13} />
    </button>
    <button aria-label={`Delete ${name}`} onClick={onConfirm} title={`Confirm deletion of ${name}`} type="button">
      <Check aria-hidden="true" size={13} />
    </button>
  </div>;
}

export function OwnerSystemWorkflowWorkspaceShell({ children, className, label, phase, placing = false, rail, style, resizeHandle, header, embedded = false, palette }) {
  return <section aria-hidden={phase === 'closing' || undefined} aria-label={label}
    data-library-rail={Boolean(rail) || undefined} data-library-chrome data-library-embedded={embedded || undefined} data-library-header={Boolean(header) || undefined}
    data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette={palette}
    className={`system-workflow__workspace-window system-workflow__browser-workspace system-workflow__motion-panel ${className}`}
    data-placing={placing || undefined} style={style}
    inert={phase === 'closing' ? '' : undefined}>
    {header}
    <div className="system-workflow__browser-body">{children}</div>
    {rail && <footer className="system-workflow__local-rail">{rail}</footer>}
    {resizeHandle}
  </section>;
}
