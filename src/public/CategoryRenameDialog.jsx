import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import './categoryRenameDialog.css';

export default function CategoryRenameDialog({ category, onClose, onRename }) {
  const [name, setName] = useState(category?.name || category?.label || '');

  useEffect(() => setName(category?.name || category?.label || ''), [category]);
  useEffect(() => {
    if (!category) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [category, onClose]);

  if (!category || typeof document === 'undefined') return null;
  const submit = (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    onRename?.(nextName);
  };
  return createPortal(<div className="category-rename-dialog" role="presentation" onPointerDown={(event) => {
    if (event.target === event.currentTarget) onClose?.();
  }}>
    <form role="dialog" aria-modal="true" aria-labelledby="category-rename-title" onSubmit={submit}>
      <span>INDEX / CATEGORY</span>
      <h2 id="category-rename-title">RENAME CATEGORY</h2>
      <label htmlFor="category-rename-name">CATEGORY NAME</label>
      <input id="category-rename-name" autoFocus maxLength="80" value={name} onChange={(event) => setName(event.target.value)} />
      <div>
        <button type="button" onClick={onClose}>CANCEL</button>
        <button type="submit" disabled={!name.trim()}>SAVE NAME</button>
      </div>
    </form>
  </div>, document.body);
}
