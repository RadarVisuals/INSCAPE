import { useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { isSystemWorkflowWorldCoverGrid, SYSTEM_WORKFLOW_LIMITS } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import WorkbenchDestinationPanel from './WorkbenchDestinationPanel.jsx';

export default function SystemWorkflowGridSwitcher({ controller, onClose, onSelectGrid = controller?.changeGrid, ...panelProps }) {
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const deleteTrigger = useRef(null);
  const cancelDelete = () => { setConfirming(null); deleteTrigger.current?.focus({ preventScroll: true }); };
  const grids = controller?.draft?.grids || [];
  const cover = (!controller?.moduleId || controller.moduleId === 'display:primary') && grids.find(isSystemWorkflowWorldCoverGrid);
  const regularGrids = grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid));
  return <WorkbenchDestinationPanel title="Grids" onClose={onClose} className="system-workflow__grid-switcher" {...panelProps}>
    {!controller ? <p className="workbench-destination-empty" role="status">Select an existing Display to manage its Grids.</p> : <>
    <div className="system-workflow__grid-list workbench-destination-body" role="listbox" aria-label="Ordered Grids">
      {cover && <><div aria-hidden="true" className="system-workflow__grid-section-label"><strong>Public directory</strong><span>Hero image</span></div>
        <div key={cover.id} className="system-workflow__grid-row" data-world-cover
          aria-current={cover.id === controller.selectedGridId ? 'page' : undefined}>
          <small>16:9</small>
          <button className="system-workflow__grid-activate" type="button" role="option"
            aria-selected={cover.id === controller.selectedGridId} onClick={() => onSelectGrid(cover.id)}>
            <strong>INSCAPE hero image</strong>
            <span>Header image shown in Discover.</span>
          </button>
        </div></>}
      <div aria-hidden="true" className="system-workflow__grid-section-label"><strong>Workspace Grids</strong><span>Visitor navigation</span></div>
      {regularGrids.map((grid, index) => {
      return <div
      key={grid.id}
      className="system-workflow__grid-row"
      aria-current={grid.id === controller.selectedGridId ? 'page' : undefined}
      draggable={editing !== grid.id && confirming !== grid.id}
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
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setEditing(null); } }} />
        <button aria-label="Cancel rename" title="Cancel" type="button" onClick={() => setEditing(null)}><X aria-hidden="true" size={13} /></button>
        <button aria-label="Confirm rename" title="Confirm" type="submit"><Check aria-hidden="true" size={13} /></button>
      </form> : <button className="system-workflow__grid-activate" type="button" role="option" aria-selected={grid.id === controller.selectedGridId} onClick={() => onSelectGrid(grid.id)}><strong>{grid.title}</strong><span>{`${grid.visibility === 'PUBLIC' ? 'Public' : 'Private'} · ${grid.placements.length} placements`}</span></button>}
      <div className="system-workflow__grid-actions" aria-label={`${grid.title} actions`}>
        <button aria-label={`Rename ${grid.title}`} title="Rename" type="button" onClick={() => setEditing(grid.id)}><Pencil size={13} /></button>
        <button aria-label={`Duplicate ${grid.title}`} title="Duplicate Grid" type="button" disabled={regularGrids.length >= SYSTEM_WORKFLOW_LIMITS.maxGrids} onClick={() => controller.duplicateGrid(grid)}><Copy size={13} /></button>
        <button aria-label={`Make ${grid.title} ${grid.visibility === 'PUBLIC' ? 'private' : 'public'}`} title={grid.visibility === 'PUBLIC' ? 'Make private' : 'Make public'} type="button" onClick={() => controller.setGridVisibility(grid, grid.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}>{grid.visibility === 'PUBLIC' ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        <button aria-label={`Delete ${grid.title}`} title="Delete" type="button" disabled={regularGrids.length === 1} onClick={event => { deleteTrigger.current = event.currentTarget; setConfirming(grid.id); }}><Trash2 size={13} /></button>
      </div>
      {confirming === grid.id && <div data-workbench-selection-tools className="system-workflow__confirm" role="alertdialog" aria-label={`Delete ${grid.title}`} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelDelete(); } }}><span>Delete {grid.title}? {grid.placements.length} placements</span><button type="button" className="workbench-destination-action" onClick={() => { controller.deleteGrid(grid); setConfirming(null); }}>Confirm</button><button type="button" className="workbench-destination-action" onClick={cancelDelete}>Cancel</button></div>}
    </div>;})}</div>
    <footer><button aria-label="New Grid" className="system-workflow__grid-new workbench-destination-action" type="button" onClick={controller.createGrid}><Plus size={13} /><span>New Grid</span></button><span>Ordered Grids · {regularGrids.length}</span></footer>
    </>}
  </WorkbenchDestinationPanel>;
}
