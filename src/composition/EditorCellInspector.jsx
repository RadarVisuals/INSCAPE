import { useEffect, useId, useState } from 'react';
import { slideOf, slideIndex, slideCount, swipeOffsets } from './cellSlides.js';
import LayerThumbnail from '../public/ownerSystemWorkflow/LayerThumbnail.jsx';
import { Lock, LockOpen, Eye, EyeOff, Image, Type, Link2, CornerDownRight, Grid2X2, SlidersHorizontal } from 'lucide-react';
import { useEditorCells, editorCellStructureActions } from './EditorCellsContext.jsx';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { OwnerSystemWorkflowSelectMenu } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import { artworkRecords, layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { compositionModuleWindow, compositionModuleSizeReason } from './compositionEditorDocument.js';
import { compositionCellSizeControl } from './compositionCellSizing.js';
import EditorCellPositionControls from './EditorCellPositionControls.jsx';
import CellNumber from './CellNumber.jsx';
import CompositionCellReadingControls from './CompositionCellReadingControls.jsx';

export default function EditorCellInspector({ record, change, disabled, historyBlocked, section, appearance, effects, innerLines, requestedSection, request }) {
  const context = useEditorCells(), view = useWorkbenchView(), tabsId = useId();
  const [tab, setTab] = useState('Cell'), [ratio, setRatio] = useState(null), [error, setError] = useState('');
  useEffect(() => { if (['Cell', 'Contents', 'Color', 'FX'].includes(requestedSection)) setTab(requestedSection === 'Contents' ? 'Contents' : 'Cell'); }, [requestedSection, request]);
  const cell = context.cells.find(item => item.id === record.id), composition = context.store.getComposition();
  // Undo/delete can remove the cell before its registered inspector source is
  // replaced. The next source will render the Shape inspector or empty state.
  if (!cell) return null;
  const frame = compositionModuleWindow(composition, cell.id), records = artworkRecords(view.content);
  const blocked = disabled || historyBlocked || Object.keys(view.transforms).length > 0;
  const run = (action, args) => {
    if (blocked) return;
    try { context.store.editBento(action, args, context.store.getGeneration(), view.getPresentation()); setError(''); return true; }
    catch (failure) { setError(failure.message); }
  };
  const size = (axis, label) => {
    const control = compositionCellSizeControl(composition, cell.id, axis), key = axis === 'x' ? 'width' : 'height';
    return <CellNumber prefix={label} label={`Cell ${key}`} value={frame[key]} min={control?.min || frame[key]} max={control?.max || frame[key]}
      disabled={blocked || !control} title={'Resizes this cell and pushes neighbours without changing their sizes'}
      onChange={value => run('cellSize', [cell.id, { [key]: value, ...(ratio ? axis === 'x' ? { height: Math.round(value / ratio) } : { width: Math.round(value * ratio) } : {}) }])} />;
  };
  const selectMember = id => { if (cell.slides) context.store.showSlide(cell.id, slideOf(cell, id)); context.store.setEditingCell(cell.id); view.selectLayers([id], false, null); };
  const members = <div className="workbench-inspector-members">{layerIds(view.layers).filter(id => cell.members.includes(id)).reverse().map(id => {
    const member = records.find(item => item.id === id), hidden = view.editorHiddenIds.includes(id), locked = cell.lockedMembers?.includes(id) || false;
    return <div key={id}><button type="button" className="workbench-inspector-member" aria-label={`Select ${member?.name || 'Untitled'}`} onClick={() => selectMember(id)}><LayerThumbnail items={[member]} /><span>{member?.name || 'Untitled'}</span></button>
      {cell.slides && <select aria-label={`Slide for ${member?.name || 'layer'}`} value={slideOf(cell, id)} disabled={blocked || locked}
        onChange={event => run('slides', [cell.id, 'assign', Number(event.target.value), id])}>
        {Array.from({ length: slideCount(cell) }, (_, i) => <option key={i} value={i}>Slide {i + 1}</option>)}</select>}
      <button type="button" className="workbench-inspector-icon" disabled={blocked} aria-label={`${locked ? 'Unlock' : 'Lock'} ${member?.name || 'layer'}`} aria-pressed={locked}
        onClick={() => { try { context.store.setArtworkLocks([id], !locked); setError(''); } catch (failure) { setError(failure.message); } }}>{locked ? <Lock /> : <LockOpen />}</button>
      <button type="button" className="workbench-inspector-icon" aria-label={`${hidden ? 'Show' : 'Hide'} ${member?.name || 'layer'} in editor`} aria-pressed={hidden}
        title="Show or hide while editing; publication stays unchanged" onClick={() => view.setEditorHiddenIds(current => hidden ? current.filter(item => item !== id) : [...current, id])}>{hidden ? <EyeOff /> : <Eye />}</button></div>;
  })}{!cell.members.length && <p className="workbench-inspector-muted">No content yet.</p>}</div>;
  const cellTab = <>
    <div className="workbench-inspector-row"><span>Name</span><input aria-label="Cell name" key={record.name} defaultValue={record.name} maxLength={48} disabled={blocked}
      onBlur={event => { const name = event.target.value.trim(); if (name && name !== record.name) change({ name }); else event.target.value = record.name; }}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = record.name; event.currentTarget.blur(); } }} /></div>
    <div className="workbench-inspector-row"><span>Size</span><div className="workbench-inspector-fields">{size('x', 'W')}
      <button type="button" className="workflow-tactile-control" aria-label="Keep cell proportions" aria-pressed={Boolean(ratio)} title={ratio ? 'Unlink width and height' : 'Link width and height'}
        disabled={blocked || !compositionCellSizeControl(composition, cell.id, 'x') || !compositionCellSizeControl(composition, cell.id, 'y')} onClick={() => setRatio(ratio ? null : frame.width / frame.height)}><Link2 /></button>{size('y', 'H')}</div></div>
    <p className="workbench-inspector-muted">Resize this cell; neighbours move aside and keep their size.</p>
    <div className="workbench-inspector-row"><span>Radius</span><CellNumber label="Cell corner radius (px)" prefix="" value={cell.radius || 0} max={160} disabled={blocked} onChange={value => run('cellRadius', [cell.id, value])} /></div>
    <label className="workbench-inspector-check"><input type="checkbox" checked={cell.clipContent !== false} disabled={blocked} onChange={event => run('cellClip', [cell.id, event.target.checked])} />Clip content</label>
    {section('Structure', <div className="workbench-inspector-actions">{editorCellStructureActions(context.store, cell.id, view).map(action =>
      <OwnerSystemWorkflowSelectMenu key={action.id} flat compact palette="editor" className="workflow-tactile-control" label={action.label} triggerPrefix="Merge" defaultValue="" value=""
        disabled={blocked} options={action.children.map(item => ({ value: item.id, label: item.label, disabled: item.disabled, reason: item.reason }))}
        onChange={id => { try { action.children.find(item => item.id === id)?.run(); setError(''); } catch (failure) { setError(failure.message); } }} />)}</div>, 'Structure', true)}
  </>;
  const peers = context.cells.filter(other => cell.swipeLink && other.id !== cell.id && other.swipeLink === cell.swipeLink);
  const choices = Array.from({ length: slideCount(cell) }, (_, i) => <option key={i} value={i}>Slide {i + 1}</option>);
  const contentsTab = <>
    {section('Slides', <fieldset disabled={blocked} className="cell-slide-settings">
      {cell.slides && <label>Editing <select aria-label="Editing slide" value={slideIndex(cell, context.slidePositions)}
        onChange={event => context.store.showSlide(cell.id, Number(event.target.value))}>{choices}</select></label>}
      <div className="cell-slide-actions">
        <button type="button" className="workflow-tactile-control" disabled={slideCount(cell) >= 32}
          onClick={() => { if (run('slides', [cell.id, 'add'])) context.store.showSlide(cell.id, slideCount(cell)); }}>Add slide</button>
        <button type="button" className="workflow-tactile-control" disabled={slideCount(cell) >= 32}
          title={peers.length ? 'Duplicate this slide in all linked cells' : 'Duplicate the current slide'}
          onClick={() => {
            const index = slideIndex(cell, context.slidePositions);
            if (run('duplicateSlide', [cell.id, index])) context.store.showSlide(cell.id, index + 1);
          }}>Duplicate slide</button>
      </div>
      {cell.slides && <button type="button" className="workflow-tactile-control" title="Remove the last slide when empty in every linked cell"
        disabled={[cell, ...peers].some(item => item.slides.at(-1).length)} onClick={() => run('slides', [cell.id, 'remove'])}>Remove empty last slide</button>}
      {cell.slides && <label>Swipe to advance <select value={cell.swipeDirection || 'left'}
        onChange={event => run('slides', [cell.id, 'direction', event.target.value])}>
        {Object.keys(swipeOffsets).map(dir => <option key={dir} value={dir}>{dir[0].toUpperCase() + dir.slice(1)}</option>)}</select></label>}
      {context.cells.length > 1 && <label>Link swiping with <select value="" onChange={event => run('slides', [cell.id, 'link', event.target.value])}>
        <option value="">Choose cell…</option>{context.cells.filter(other => other.id !== cell.id && !peers.some(peer => peer.id === other.id)).map(other =>
          <option key={other.id} value={other.id}>{records.find(item => item.id === other.id)?.name || 'Cell'}</option>)}</select></label>}
      {peers.length > 0 && <><span>Linked to {peers.map(other => records.find(item => item.id === other.id)?.name || 'Cell').join(', ')}</span>
        <button type="button" className="workflow-tactile-control" onClick={() => run('slides', [cell.id, 'unlink'])}>Unlink this cell</button></>}
    </fieldset>, 'Cell slides', true)}
    {section('Members', <>{members}<div className="workbench-inspector-actions">
      <button type="button" className="workflow-tactile-control" disabled={blocked || Boolean(compositionModuleSizeReason('text:new', frame))} onClick={() => context.addText(cell.id)}><Type />Text</button>
      <button type="button" className="workflow-tactile-control" disabled={blocked || Boolean(compositionModuleSizeReason('image:new', frame))} onClick={() => context.addImage(cell.id)}><Image />Image</button>
    </div><button type="button" className="workflow-tactile-control workbench-inspector-full" disabled={!cell.members.length} onClick={() => { context.store.setEditingCell(cell.id); view.selectLayers(cell.members, false, null); }}><CornerDownRight />Select contents</button></>, 'Layers in this cell', true)}
  </>;
  return <>
    <div className="workbench-inspector-tabs" role="tablist" aria-label="Cell settings">{['Cell', 'Contents'].map(name => <button type="button" key={name} id={`${tabsId}-${name}`} aria-controls={`${tabsId}-panel`} role="tab" aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
      onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'Cell' : event.key === 'End' ? 'Contents' : tab === 'Cell' ? 'Contents' : 'Cell'; setTab(next); document.getElementById(`${tabsId}-${next}`)?.focus(); } }} onClick={() => setTab(name)}>{name}</button>)}</div>
    <div key={tab} className="workbench-inspector-cell-panel" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
      {cell.members.length > 0 && <EditorCellPositionControls cellId={cell.id} disabled={blocked} showPadding={tab === 'Contents'} />}
      {tab === 'Cell' ? cellTab : contentsTab}
      {tab === 'Cell' && section('Responsive', <CompositionCellReadingControls cell={cell} disabled={blocked}
        onChange={enabled => run('cellSingleLine', [cell.id, enabled])} />, 'Responsive reading')}
      {section('Color', appearance, tab === 'Cell' ? 'Appearance' : 'Cell appearance', tab === 'Cell')}
      {section('FX', <>{effects}<label className="workbench-inspector-check"><input type="checkbox" checked={cell.grainOverContent !== false} disabled={blocked}
        onChange={event => run('cellGrain', [cell.id, event.target.checked])} />Grain over entire cell</label></>, 'Effects')}
      {section('Bento', <><button type="button" className="workflow-tactile-control workbench-inspector-full" onClick={() => context.openSettings(cell.id)}><Grid2X2 />Whole Bento settings</button>
        {innerLines ? <details className="workbench-inspector-inline"><summary><SlidersHorizontal />Inner-line style</summary>{innerLines}</details>
          : <button type="button" className="workflow-tactile-control workbench-inspector-full" onClick={() => context.openSettings(cell.id)}><SlidersHorizontal />Enable inner lines</button>}</>, 'Bento', true)}
      {tab === 'Cell' && <label className="workbench-inspector-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} disabled={blocked}
        onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>}
      {error && <p role="alert">{error}</p>}
    </div>
  </>;
}
