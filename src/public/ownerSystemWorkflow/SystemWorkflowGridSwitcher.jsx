import { useState } from 'react';
import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';

export default function SystemWorkflowGridSwitcher({ controller, onSelectGrid = controller.changeGrid, ...panelProps }) {
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const grids = controller.draft?.grids || [];
  return <aside className="system-workflow__grid-switcher system-workflow__motion-panel" aria-label="Grids" {...panelProps}>
    <div className="system-workflow__grid-list" role="listbox" aria-label="Ordered Grids">{grids.map((grid, index) => <div
      key={grid.id}
      className="system-workflow__grid-row"
      aria-current={grid.id === controller.selectedGridId ? 'page' : undefined}
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', grid.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => controller.reorderGrid(event.dataTransfer.getData('text/plain'), index)}
    >
      <small>{String(index + 1).padStart(2, '0')}</small>
      {editing === grid.id ? <form className="system-workflow__grid-rename" onSubmit={(event) => {
        event.preventDefault();
        controller.renameGrid(grid, event.currentTarget.elements.name.value);
        setEditing(null);
      }}><input name="name" defaultValue={grid.title} autoFocus aria-label={`Rename ${grid.title}`}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setEditing(null); } }} />
        <button aria-label="Cancel rename" title="Cancel" type="button" onClick={() => setEditing(null)}><X aria-hidden="true" size={13} /></button>
        <button aria-label="Confirm rename" title="Confirm" type="submit"><Check aria-hidden="true" size={13} /></button>
      </form> : <button className="system-workflow__grid-activate" type="button" role="option" aria-selected={grid.id === controller.selectedGridId} onClick={() => onSelectGrid(grid.id)}><strong>{grid.title}</strong><span>{grid.visibility === 'PUBLIC' ? 'Public' : 'Private'} · {grid.placements.length} placements</span></button>}
      <div className="system-workflow__grid-actions" aria-label={`${grid.title} actions`}>
        <button aria-label={`Rename ${grid.title}`} title="Rename" type="button" onClick={() => setEditing(grid.id)}><Pencil size={13} /></button>
        <button aria-label={`Make ${grid.title} ${grid.visibility === 'PUBLIC' ? 'private' : 'public'}`} title={grid.visibility === 'PUBLIC' ? 'Make private' : 'Make public'} type="button" onClick={() => controller.setGridVisibility(grid, grid.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}>{grid.visibility === 'PUBLIC' ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        <button aria-label={`Delete ${grid.title}`} title="Delete" type="button" disabled={grids.length === 1} onClick={() => setConfirming(grid.id)}><Trash2 size={13} /></button>
      </div>
      {confirming === grid.id && <div className="system-workflow__confirm" role="alertdialog"><span>Delete {grid.title}? {grid.placements.length} placements</span><button type="button" onClick={() => { controller.deleteGrid(grid); setConfirming(null); }}>Confirm</button><button type="button" onClick={() => setConfirming(null)}>Cancel</button></div>}
    </div>)}</div>
    <footer><button aria-label="New Grid" className="system-workflow__grid-new" type="button" onClick={controller.createGrid}><Plus size={13} /><span>New Grid</span></button><span>Ordered Grids <b>{String(grids.length).padStart(2, '0')}</b></span></footer>
  </aside>;
}
