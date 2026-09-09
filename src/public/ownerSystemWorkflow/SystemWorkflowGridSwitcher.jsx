import { useState } from 'react';
import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { isSystemWorkflowWorldCoverGrid } from '../../systemWorkflow/domain/systemWorkflowDraft.js';

export default function SystemWorkflowGridSwitcher({ controller, onSelectGrid = controller.changeGrid, ...panelProps }) {
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const grids = controller.draft?.grids || [];
  const cover = grids.find(isSystemWorkflowWorldCoverGrid);
  const regularGrids = grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid));
  return <aside className="system-workflow__grid-switcher system-workflow__motion-panel" aria-label="Grids" {...panelProps}>
    <div className="system-workflow__grid-list" role="listbox" aria-label="Ordered Grids">
      {cover && <><div aria-hidden="true" className="system-workflow__grid-section-label"><strong>PUBLIC DIRECTORY</strong><span>HERO IMAGE</span></div>
        <div key={cover.id} className="system-workflow__grid-row" data-world-cover
          aria-current={cover.id === controller.selectedGridId ? 'page' : undefined}>
          <small>16:9</small>
          <button className="system-workflow__grid-activate" type="button" role="option"
            aria-selected={cover.id === controller.selectedGridId} onClick={() => onSelectGrid(cover.id)}>
            <strong>INSCAPE HERO IMAGE</strong>
            <span>Set the header image shown in Explore Worlds.</span>
          </button>
        </div></>}
      <div aria-hidden="true" className="system-workflow__grid-section-label"><strong>WORKSPACE GRIDS</strong><span>VISITOR NAVIGATION</span></div>
      {regularGrids.map((grid) => {
      const worldCover = isSystemWorkflowWorldCoverGrid(grid);
      const index = regularGrids.findIndex(({ id }) => id === grid.id);
      return <div
      key={grid.id}
      className="system-workflow__grid-row"
      data-world-cover={worldCover || undefined}
      aria-current={grid.id === controller.selectedGridId ? 'page' : undefined}
      draggable={!worldCover}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', grid.id)}
      onDragOver={(event) => { if (!worldCover) event.preventDefault(); }}
      onDrop={(event) => { if (!worldCover) controller.reorderGrid(event.dataTransfer.getData('text/plain'), index); }}
    >
      <small>{worldCover ? '16:9' : String(index + 1).padStart(2, '0')}</small>
      {editing === grid.id ? <form className="system-workflow__grid-rename" onSubmit={(event) => {
        event.preventDefault();
        controller.renameGrid(grid, event.currentTarget.elements.name.value);
        setEditing(null);
      }}><input name="name" defaultValue={grid.title} autoFocus aria-label={`Rename ${grid.title}`}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setEditing(null); } }} />
        <button aria-label="Cancel rename" title="Cancel" type="button" onClick={() => setEditing(null)}><X aria-hidden="true" size={13} /></button>
        <button aria-label="Confirm rename" title="Confirm" type="submit"><Check aria-hidden="true" size={13} /></button>
      </form> : <button className="system-workflow__grid-activate" type="button" role="option" aria-selected={grid.id === controller.selectedGridId} onClick={() => onSelectGrid(grid.id)}><strong>{grid.title}</strong><span>{worldCover ? `Directory cover · 768 × 432 · ${grid.placements.length} placements` : `${grid.visibility === 'PUBLIC' ? 'Public' : 'Private'} · ${grid.placements.length} placements`}</span></button>}
      {!worldCover && <div className="system-workflow__grid-actions" aria-label={`${grid.title} actions`}>
        <button aria-label={`Rename ${grid.title}`} title="Rename" type="button" onClick={() => setEditing(grid.id)}><Pencil size={13} /></button>
        <button aria-label={`Make ${grid.title} ${grid.visibility === 'PUBLIC' ? 'private' : 'public'}`} title={grid.visibility === 'PUBLIC' ? 'Make private' : 'Make public'} type="button" onClick={() => controller.setGridVisibility(grid, grid.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}>{grid.visibility === 'PUBLIC' ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        <button aria-label={`Delete ${grid.title}`} title="Delete" type="button" disabled={regularGrids.length === 1} onClick={() => setConfirming(grid.id)}><Trash2 size={13} /></button>
      </div>}
      {confirming === grid.id && <div className="system-workflow__confirm" role="alertdialog"><span>Delete {grid.title}? {grid.placements.length} placements</span><button type="button" onClick={() => { controller.deleteGrid(grid); setConfirming(null); }}>Confirm</button><button type="button" onClick={() => setConfirming(null)}>Cancel</button></div>}
    </div>;})}</div>
    <footer><button aria-label="New Grid" className="system-workflow__grid-new" type="button" onClick={controller.createGrid}><Plus size={13} /><span>New Grid</span></button><span>Ordered Grids <b>{String(regularGrids.length).padStart(2, '0')}</b></span></footer>
  </aside>;
}
