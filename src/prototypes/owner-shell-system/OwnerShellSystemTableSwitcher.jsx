import { useRef, useState } from 'react';
import { GripVertical, MoreHorizontal, Plus } from 'lucide-react';

export default function OwnerShellSystemTableSwitcher({
  activeTable,
  activeTableId,
  actionId,
  actionRefs,
  deleteId,
  onActionIdChange,
  onAdd,
  onBeginRename,
  onCancelDelete,
  onConfirmDelete,
  onFinishRename,
  onRenameChange,
  onRequestDelete,
  onReorder,
  onReorderByOffset,
  onToggleVisibility,
  onVisit,
  phase,
  rename,
  rowRefs,
  tables,
}) {
  const [draggedTableId, setDraggedTableId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const reorderRefs = useRef(new Map());
  const clearDrag = () => { setDraggedTableId(null); setDropTarget(null); };
  const focusReorderHandle = (tableId) => requestAnimationFrame(() => reorderRefs.current.get(tableId)?.focus());
  const moveByKeyboard = (event, tableId, offset) => {
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    onReorderByOffset(tableId, offset);
    focusReorderHandle(tableId);
  };
  const handleListKeyDown = (event) => {
    const row = event.target.closest('[data-table-row]');
    if (event.target !== row) return;
    const index = tables.findIndex(({ id }) => id === row?.dataset.tableRow);
    let next = null;
    if (event.key === 'ArrowDown') next = Math.min(tables.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tables.length - 1;
    else if (event.key === 'Enter' && row) {
      event.preventDefault();
      onVisit(row.dataset.tableRow);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    rowRefs.current.get(tables[next].id)?.focus();
  };

  return <aside
    aria-hidden={phase === 'closing' || undefined}
    aria-label="Tables"
    className="owner-shell-system__table-switcher owner-shell-system__motion-panel"
    data-panel-phase={phase}
    inert={phase === 'closing' ? '' : undefined}
  >
    <div aria-label="Profile tables" className="owner-shell-system__table-list" onKeyDown={handleListKeyDown} role="listbox">
      {tables.map((table, index) => {
        const renaming = rename?.id === table.id;
        const confirming = deleteId === table.id;
        const actionsOpen = actionId === table.id;
        return <div aria-current={table.id === activeTableId ? 'page' : undefined} className="owner-shell-system__table-row"
          data-drop-position={dropTarget?.id === table.id ? dropTarget.edge : undefined}
          data-table-row={table.id} key={table.id}
          onDragOver={(event) => {
            if (!draggedTableId || draggedTableId === table.id) return;
            event.preventDefault();
            const bounds = event.currentTarget.getBoundingClientRect();
            setDropTarget({ edge: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after', id: table.id });
          }}
          onDrop={(event) => {
            event.preventDefault();
            const bounds = event.currentTarget.getBoundingClientRect();
            const edge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
            if (draggedTableId) onReorder(draggedTableId, table.id, edge);
            const movedId = draggedTableId;
            clearDrag();
            if (movedId) focusReorderHandle(movedId);
          }}
          ref={(node) => { if (node) rowRefs.current.set(table.id, node); }}
          role="option" tabIndex={table.id === activeTableId ? 0 : -1}>
          <button aria-label={`Reorder ${table.name}`} className="owner-shell-system__table-reorder" draggable
            onDragEnd={clearDrag}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', table.id);
              setDraggedTableId(table.id);
            }}
            onKeyDown={(event) => moveByKeyboard(event, table.id, event.key === 'ArrowUp' ? -1 : 1)}
            ref={(node) => { if (node) reorderRefs.current.set(table.id, node); }}
            title="Drag to reorder · Alt + ↑/↓" type="button"><GripVertical size={13} /></button>
          <small>{String(index + 1).padStart(2, '0')}</small>
          {renaming ? <div className="owner-shell-system__table-rename" data-keyboard-focus={rename.keyboardFocus || undefined}>
            <input aria-label={`Rename ${table.name}`} autoFocus maxLength="24"
              onBlur={() => onFinishRename(Boolean(rename.name.trim()))}
              onChange={(event) => onRenameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onFinishRename(true);
                if (event.key === 'Escape') { event.stopPropagation(); onFinishRename(false); }
              }} value={rename.name} />
          </div> : <button className="owner-shell-system__table-activate" onClick={() => onVisit(table.id)} type="button">
            <b>{table.name}</b><span>{table.public ? 'PUBLIC' : 'PRIVATE'}</span>
          </button>}
          <button aria-expanded={actionsOpen} aria-label={`Actions for ${table.name}`} className="owner-shell-system__table-actions-trigger"
            onClick={() => onActionIdChange(actionsOpen ? null : table.id)}
            ref={(node) => { if (node) actionRefs.current.set(table.id, node); }} type="button"><MoreHorizontal size={14} /></button>
          {actionsOpen && <div className="owner-shell-system__table-actions">
            <button onClick={(event) => onBeginRename(table, event.detail === 0)} type="button">RENAME</button>
            <button aria-describedby={tables.length === 1 ? 'final-table-explanation' : undefined} disabled={tables.length === 1}
              onClick={() => onRequestDelete(table.id)} title={tables.length === 1 ? 'The final table cannot be deleted' : `Delete ${table.name}`}
              type="button">DELETE</button>
          </div>}
          {confirming && <div className="owner-shell-system__table-delete-confirm"><span>DELETE {table.name}?</span>
            <button onClick={() => onCancelDelete(table.id)} type="button">CANCEL</button>
            <button onClick={() => onConfirmDelete(table.id)} type="button">DELETE</button>
          </div>}
        </div>;
      })}
      <span className="owner-shell-system__sr-only" id="final-table-explanation">The final remaining table cannot be deleted.</span>
    </div>
    <footer aria-label="Active table controls" className="owner-shell-system__local-rail">
      <button className="owner-shell-system__table-new" onClick={onAdd} type="button"><Plus size={13} /><span>NEW TABLE</span></button>
      <button aria-pressed={activeTable?.public} onClick={onToggleVisibility} type="button"><span>VISIBILITY</span><b>{activeTable?.public ? 'PUBLIC' : 'PRIVATE'}</b></button>
    </footer>
  </aside>;
}
