import { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, Image, Type, Square, Link2, CornerDownRight, Grid2X2, SlidersHorizontal } from 'lucide-react';
import { useEditorCells, editorCellStructureActions } from './EditorCellsContext.jsx';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import { artworkRecords, layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { receptionModuleWindow, receptionModuleSizeReason } from './receptionEditorDocument.js';
import { receptionCellSizeControl } from './receptionCellSizing.js';
import EditorCellPositionControls, { CellNumber } from './EditorCellPositionControls.jsx';

export default function EditorCellInspector({ record, change, disabled, historyBlocked, section, appearance, effects, innerLines, requestedSection, request }) {
  const context = useEditorCells(), view = useWorkbenchView(), tabsId = useId();
  const [tab, setTab] = useState('Cell'), [ratio, setRatio] = useState(null), [error, setError] = useState('');
  useEffect(() => { if (['Cell', 'Contents', 'Color', 'FX'].includes(requestedSection)) setTab(requestedSection === 'Contents' ? 'Contents' : 'Cell'); }, [requestedSection, request]);
  const cell = context.cells.find(item => item.id === record.id), reception = context.store.getReception();
  // Undo/delete can remove the cell before its registered inspector source is
  // replaced. The next source will render the Shape inspector or empty state.
  if (!cell) return null;
  const frame = receptionModuleWindow(reception, cell.id), records = artworkRecords(view.content);
  const blocked = disabled || historyBlocked || Object.keys(view.transforms).length > 0;
  const run = (action, args) => {
    if (blocked) return;
    try { context.store.editBento(action, args, context.store.getGeneration(), view.getPresentation()); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  const size = (axis, label) => {
    const control = receptionCellSizeControl(reception, cell.id, axis), key = axis === 'x' ? 'width' : 'height';
    return <CellNumber prefix={label} label={`Cell ${key}`} value={frame[key]} min={control?.min || frame[key]} max={control?.max || frame[key]}
      disabled={blocked || !control} title={!control ? `Use Whole Bento settings to change this outer ${key}` : 'Resizes the shared edge and adjacent cells'}
      onChange={value => run('cellSize', [cell.id, { [key]: value, ...(ratio ? axis === 'x' ? { height: Math.round(value / ratio) } : { width: Math.round(value * ratio) } : {}) }])} />;
  };
  const selectMember = id => { context.store.setEditingCell(cell.id); view.selectLayers([id], false, null); };
  const members = <div className="workbench-inspector-members">{layerIds(view.layers).filter(id => cell.members.includes(id)).reverse().map(id => {
    const member = records.find(item => item.id === id), hidden = view.editorHiddenIds.includes(id), Icon = member?.key === 'texts' ? Type : member?.key === 'imageModules' ? Image : Square;
    return <div key={id}><button type="button" className="workbench-inspector-member" aria-label={`Select ${member?.name || 'Untitled'}`} onClick={() => selectMember(id)}><Icon /><span>{member?.name || 'Untitled'}</span></button>
      <button type="button" className="workbench-inspector-icon" aria-label={`${hidden ? 'Show' : 'Hide'} ${member?.name || 'layer'} in editor`} aria-pressed={hidden}
        title="Show or hide while editing; publication stays unchanged" onClick={() => view.setEditorHiddenIds(current => hidden ? current.filter(item => item !== id) : [...current, id])}>{hidden ? <EyeOff /> : <Eye />}</button></div>;
  })}{!cell.members.length && <p className="workbench-inspector-muted">No content yet.</p>}</div>;
  const cellTab = <>
    <div className="workbench-inspector-row"><span>Name</span><input aria-label="Cell name" key={record.name} defaultValue={record.name} maxLength={48} disabled={blocked}
      onBlur={event => { const name = event.target.value.trim(); if (name && name !== record.name) change({ name }); else event.target.value = record.name; }}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = record.name; event.currentTarget.blur(); } }} /></div>
    <div className="workbench-inspector-row"><span>Size</span><div className="workbench-inspector-fields">{size('x', 'W')}
      <button type="button" className="workflow-tactile-control" aria-label="Keep cell proportions" aria-pressed={Boolean(ratio)} title={ratio ? 'Unlink width and height' : 'Link width and height'}
        disabled={blocked || !receptionCellSizeControl(reception, cell.id, 'x') || !receptionCellSizeControl(reception, cell.id, 'y')} onClick={() => setRatio(ratio ? null : frame.width / frame.height)}><Link2 /></button>{size('y', 'H')}</div></div>
    <div className="workbench-inspector-row"><span>Radius</span><CellNumber label="Cell corner radius (px)" prefix="" value={cell.radius || 0} max={160} disabled={blocked} onChange={value => run('cellRadius', [cell.id, value])} /></div>
    <label className="workbench-inspector-check"><input type="checkbox" checked={cell.clipContent !== false} disabled={blocked} onChange={event => run('cellClip', [cell.id, event.target.checked])} />Clip content</label>
    {section('Structure', <div className="workbench-inspector-actions">{editorCellStructureActions(context.store, cell.id, view).reverse().map(action =>
      <OwnerSystemWorkflowSelectMenu key={action.id} flat compact palette="editor" className="workflow-tactile-control" label={action.label} triggerPrefix={action.id === 'cell-split' ? 'Split' : 'Merge'} defaultValue="" value=""
        disabled={blocked} options={action.children.map(item => ({ value: item.id, label: item.label, disabled: item.disabled, reason: item.reason }))}
        onChange={id => { try { action.children.find(item => item.id === id)?.run(); setError(''); } catch (failure) { setError(failure.message); } }} />)}</div>, 'Structure', true)}
  </>;
  const contentsTab = <>
    {section('Members', <>{members}<div className="workbench-inspector-actions">
      <button type="button" className="workflow-tactile-control" disabled={blocked || Boolean(receptionModuleSizeReason('text:new', frame))} onClick={() => context.addText(cell.id)}><Type />Text</button>
      <button type="button" className="workflow-tactile-control" disabled={blocked || Boolean(receptionModuleSizeReason('image:new', frame))} onClick={() => context.addImage(cell.id)}><Image />Image</button>
    </div><button type="button" className="workflow-tactile-control workbench-inspector-full" disabled={!cell.members.length} onClick={() => { context.store.setEditingCell(cell.id); view.selectLayers(cell.members, false, null); }}><CornerDownRight />Select contents</button></>, 'Layers in this cell', true)}
  </>;
  return <>
    <div className="workbench-inspector-tabs" role="tablist" aria-label="Cell settings">{['Cell', 'Contents'].map(name => <button type="button" key={name} id={`${tabsId}-${name}`} aria-controls={`${tabsId}-panel`} role="tab" aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
      onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'Cell' : event.key === 'End' ? 'Contents' : tab === 'Cell' ? 'Contents' : 'Cell'; setTab(next); document.getElementById(`${tabsId}-${next}`)?.focus(); } }} onClick={() => setTab(name)}>{name}</button>)}</div>
    <div key={tab} className="workbench-inspector-cell-panel" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
      {cell.members.length > 0 && <EditorCellPositionControls cellId={cell.id} disabled={blocked} showPadding={tab === 'Contents'} />}
      {tab === 'Cell' ? cellTab : contentsTab}
      {section('Color', appearance, tab === 'Cell' ? 'Appearance' : 'Cell appearance', tab === 'Cell')}
      {section('FX', effects, 'Effects')}
      {section('Bento', <><button type="button" className="workflow-tactile-control workbench-inspector-full" onClick={() => context.openSettings(cell.id)}><Grid2X2 />Whole Bento settings</button>
        {innerLines ? <details className="workbench-inspector-inline"><summary><SlidersHorizontal />Inner-line style</summary>{innerLines}</details>
          : <button type="button" className="workflow-tactile-control workbench-inspector-full" onClick={() => context.openSettings(cell.id)}><SlidersHorizontal />Enable inner lines</button>}</>, 'Bento', true)}
      {tab === 'Cell' && <label className="workbench-inspector-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} disabled={blocked}
        onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>}
      {error && <p role="alert">{error}</p>}
    </div>
  </>;
}
