import { useEffect, useMemo, useRef, useState } from 'react';

export function useGallerySelection(items, enabled) {
  const [checked, setChecked] = useState(null);
  const eligibleIds = useMemo(() => items.map(item => item.id), [items]);
  const selectedIds = eligibleIds.filter(id => checked?.has(id));
  useEffect(() => {
    setChecked(current => {
      if (!enabled || !current) return null;
      const remaining = eligibleIds.filter(id => current.has(id));
      if (remaining.length === current.size) return current;
      return remaining.length ? new Set(remaining) : null;
    });
  }, [eligibleIds, enabled]);
  const toggle = id => setChecked(current => {
    if (!current || !eligibleIds.includes(id)) return current;
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const all = selectedIds.length === eligibleIds.length;
  return { active: enabled && checked !== null, checked, selectedIds, all, toggle,
    start: () => setChecked(new Set()), cancel: () => setChecked(null),
    toggleAll: () => setChecked(new Set(all ? [] : eligibleIds)) };
}

export function GallerySelectionTools({ selection, onRemove }) {
  const firstButton = useRef(null);
  const cancel = () => {
    selection.cancel();
    requestAnimationFrame(() => firstButton.current?.focus({ preventScroll: true }));
  };
  return <div className="gallery-selection-tools" role="group" aria-label="Gallery selection">
    <button ref={firstButton} type="button" onClick={selection.active ? selection.toggleAll : selection.start}>
      {selection.active ? (selection.all ? 'Deselect all' : 'Select all') : 'Select'}
    </button>
    {selection.active && <>
      <button type="button" onClick={cancel}>Cancel</button>
      <button type="button" disabled={!selection.selectedIds.length} className="gallery-selection-remove"
        onClick={event => onRemove(selection.selectedIds, event.currentTarget)}>
        Remove selected ({selection.selectedIds.length})
      </button>
    </>}
  </div>;
}
