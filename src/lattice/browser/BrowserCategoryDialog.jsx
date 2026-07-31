import { useEffect, useRef, useState } from 'react';
import { categoryDialogInitialName } from './browserWorkspaceModel.js';

export default function BrowserCategoryDialog({ dialog, onCancel, onConfirm }) {
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
  const title = dialog.type === 'create' ? 'CREATE CATEGORY' : dialog.type === 'rename' ? 'RENAME CATEGORY' : 'DELETE CATEGORY';
  const submit = (event) => {
    event.preventDefault();
    if (!deletion && !name.trim()) return;
    onConfirm(deletion ? null : name.trim());
  };
  return (
    <div className="lattice-browser-dialog-layer" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <form aria-labelledby="lattice-browser-dialog-title" aria-modal="true" onSubmit={submit} role="dialog">
        <header><strong id="lattice-browser-dialog-title">{title}</strong></header>
        {deletion ? <p>REMOVE <strong>{dialog.category.name}</strong> AND ITS MEMBERSHIP LIST? ASSETS AND LATTICE PLACEMENTS ARE NOT AFFECTED.</p> : <label><span>CATEGORY NAME</span><input maxLength="80" ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} /></label>}
        {dialog.error && <p className="lattice-browser-dialog-error" role="alert">{dialog.error}</p>}
        <footer><button onClick={onCancel} type="button">CANCEL</button><button disabled={!deletion && !name.trim()} ref={confirmRef} type="submit">{deletion ? 'DELETE' : 'CONFIRM'}</button></footer>
      </form>
    </div>
  );
}
