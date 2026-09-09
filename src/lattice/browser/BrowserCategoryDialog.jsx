import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { categoryDialogInitialName } from './browserWorkspaceModel.js';

const displayLabel = (value) => `${String(value || '').charAt(0).toUpperCase()}${String(value || '').slice(1)}`;

export default function BrowserCategoryDialog({ deleteMessage, dialog, entityLabel = 'category', inline = false, onCancel, onConfirm }) {
  const [name, setName] = useState(() => categoryDialogInitialName(dialog));
  const inputRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    setName(categoryDialogInitialName(dialog));
    if (dialog?.type === 'delete') confirmRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, [dialog]);

  if (!dialog) return null;
  const deletion = dialog.type === 'delete';
  const inlineEditor = inline && !deletion;
  const title = `${dialog.type === 'create' ? 'Create' : dialog.type === 'rename' ? 'Rename' : 'Delete'} ${entityLabel}`;
  const submit = (event) => {
    event.preventDefault();
    if (!deletion && !name.trim()) return;
    onConfirm(deletion ? null : name.trim());
  };
  return (
    <div className={inlineEditor ? 'lattice-browser-inline-dialog' : 'lattice-browser-dialog-layer'}
      onPointerDown={inlineEditor ? undefined : (event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <form aria-label={deletion ? undefined : title} aria-labelledby={deletion ? 'lattice-browser-dialog-title' : undefined}
        aria-modal={inlineEditor ? undefined : 'true'} className="lattice-browser-dialog-form"
        data-mode={deletion ? 'delete' : 'edit'} onSubmit={submit} role="dialog">
        {deletion && <header><strong id="lattice-browser-dialog-title">{title}</strong></header>}
        {deletion ? <p>{deleteMessage ? deleteMessage(dialog.category) : <>Remove <strong>{dialog.category.name}</strong> and its membership list? Assets and Grid placements are not affected.</>}</p> : <label>{!inlineEditor && <span>{displayLabel(entityLabel)}</span>}<input aria-label={`${entityLabel} name`} maxLength="80" placeholder={inlineEditor ? `${displayLabel(entityLabel)} name` : undefined} ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} /></label>}
        {dialog.error && <p className="lattice-browser-dialog-error" role="alert">{dialog.error}</p>}
        <footer><button aria-label="Cancel" onClick={onCancel} title="Cancel" type="button">{deletion ? 'Cancel' : <X aria-hidden="true" size={14} />}</button><button aria-label={deletion ? 'Delete' : 'Confirm'} disabled={!deletion && !name.trim()} ref={confirmRef} title={deletion ? 'Delete' : 'Confirm'} type="submit">{deletion ? 'Delete' : <Check aria-hidden="true" size={14} />}</button></footer>
      </form>
    </div>
  );
}
