import { Grid3X3 } from 'lucide-react';
import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import { useState } from 'react';
import { useEditorCells } from './EditorCellsContext.jsx';
import { receptionMemberAnchor } from './editorCellGeometry.js';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import CellNumber from './CellNumber.jsx';

export function CellPositionButton({ cellId, memberIds, disabled }) {
  return <EditorToolbarPopover label={memberIds ? 'Position text in cell' : 'Position contents in cell'} disabled={disabled}
    trigger={<Grid3X3 aria-hidden="true" />}>
    <EditorCellPositionControls cellId={cellId} memberIds={memberIds} disabled={disabled} />
  </EditorToolbarPopover>;
}

export default function EditorCellPositionControls({ cellId, memberIds, disabled, showPadding = true }) {
  const context = useEditorCells(), view = useWorkbenchView(), [error, setError] = useState('');
  const cell = context?.cells.find(item => item.id === cellId);
  if (!cell) return null;
  const ids = memberIds || cell.members, anchor = receptionMemberAnchor(cell, ids);
  const shared = anchor && anchor.members.length > ids.length;
  const blocked = disabled || !ids.length || !context.store.isCurrent() || !context.store.hasWriteAccess() || Object.keys(view.transforms).length > 0
    || ids.some(id => view.presentationTransforms?.[id])
    || ids.some(id => cell.lockedMembers?.includes(id));
  const align = patch => {
    try {
      context.store.editBento('anchorMembers', [cell.id, ids, patch === null ? null : {
        alignX: anchor?.alignX || 'center', alignY: anchor?.alignY || 'center',
        paddingX: anchor?.paddingX || 0, paddingY: anchor?.paddingY || 0, ...patch,
      }], context.store.getGeneration(), view.getPresentation());
      setError('');
    } catch (failure) { setError(failure.message); }
  };
  return <div className="workbench-inspector-placement" data-cell-position={cell.id}>
    <div className="workbench-inspector-placement-row">
      <div className="workbench-inspector-position-grid" role="group" aria-label="Position in cell">
        {['top', 'center', 'bottom'].flatMap(alignY => ['left', 'center', 'right'].map(alignX =>
          <button key={`${alignY}-${alignX}`} type="button" aria-label={`Position ${alignY === 'center' ? 'middle' : alignY} ${alignX}`}
            title={`Align ${alignY === 'center' ? 'middle' : alignY} ${alignX}; click again for free placement`} disabled={blocked}
            aria-pressed={Boolean(anchor && !shared && anchor.alignX === alignX && anchor.alignY === alignY)}
            onClick={() => align(!shared && anchor?.alignX === alignX && anchor?.alignY === alignY ? null : { alignX, alignY })}><span /></button>))}
      </div>
      <div className="workbench-inspector-muted">Alignment</div>
    </div>
    {showPadding && <div className="workbench-inspector-row"><span>Padding</span><div className="workbench-inspector-fields">
      <CellNumber label="Cell horizontal padding" prefix="H" value={anchor?.paddingX || 0} disabled={blocked || !anchor || shared}
        title={!anchor ? 'Choose a position first' : shared ? 'Select the cell Contents tab to adjust group padding' : undefined} onChange={paddingX => align({ paddingX })} />
      <CellNumber label="Cell vertical padding" prefix="V" value={anchor?.paddingY || 0} disabled={blocked || !anchor || shared}
        title={!anchor ? 'Choose a position first' : shared ? 'Select the cell Contents tab to adjust group padding' : undefined} onChange={paddingY => align({ paddingY })} />
    </div></div>}
    {memberIds?.length === 1 && memberIds[0].startsWith('text:') && <label className="workbench-inspector-row">
      <span>Fit box to text</span><input type="checkbox" checked={Boolean(cell.fitText?.includes(memberIds[0]))} disabled={blocked}
        onChange={event => {
          try {
            context.store.editBento('fitText', [cell.id, memberIds[0], event.target.checked], context.store.getGeneration(), view.getPresentation());
            setError('');
          } catch (failure) { setError(failure.message); }
        }} />
    </label>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
