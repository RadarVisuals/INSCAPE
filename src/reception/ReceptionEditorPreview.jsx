import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Redo2, RotateCcw, SlidersHorizontal, Sun, Undo2 } from 'lucide-react';
import useWorkbenchPan from '../public/ownerSystemWorkflow/useWorkbenchPan.js';
import { createReceptionPreviewPan } from './receptionPreviewPan.js';
import { projectReception } from '../profileDocument/domain/receptionPresentation.js';
import ReceptionDocumentCanvas from './ReceptionDocumentCanvas.jsx';
import ReceptionViewportControls from './ReceptionViewportControls.jsx';
import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import ReceptionPresentation from './ReceptionPresentation.jsx';
import { ReceptionButton as Button } from './ReceptionControls.jsx';
import '../public/ownerSystemWorkflow/workflowTokens.css';
import '../public/ownerSystemWorkflow/workflowTactile.css';
import '../public/ownerSystemWorkflow/workflowFlat.css';
import '../public/ownerSystemWorkflow/workbenchWindowChrome.css';
import './receptionPreview.css';
import { receptionReadingOrder } from './receptionResponsiveImages.js';
import CellNumber from './CellNumber.jsx';
import ReceptionHeader from './ReceptionHeader.jsx';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import ReceptionPageSettings from './ReceptionPageSettings.jsx';
import ReceptionCellReadingControls from './ReceptionCellReadingControls.jsx';

const editorChrome = { 'data-workflow-material': 'tactile', 'data-workflow-finish': 'flat', 'data-workflow-palette': 'editor' };

export default function ReceptionEditorPreview({ reception, model, snapshot, assets, onClose, store, workspaceDestinations,
  label = 'Studio responsive preview', actions, history, onHistory, historyBlocked, saveState }) {
  const [width, setWidth] = useState(null), [selection, setSelection] = useState(null), [layout, setLayout] = useState(null), [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageSettings, setPageSettings] = useState(false), [appearancePreview, setAppearancePreview] = useState(null);
  const page = useRef(null), [pageWidth, setPageWidth] = useState(null);
  const panViewport = useRef(null), panPlane = useRef(null);
  const [pan] = useState(() => createReceptionPreviewPan({ getPlane: () => panPlane.current }));
  const { cancel: cancelPan } = useWorkbenchPan(panViewport, false, pan);
  useEffect(() => () => pan.dispose(), [pan]);
  const resetView = () => {
    cancelPan(); pan.reset();
    panViewport.current?.scrollTo({ left: 0, top: 0 });
  };
  useLayoutEffect(() => {
    const node = page.current, measure = () => setPageWidth(node.clientWidth);
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const shown = useMemo(() => projectReception(reception), [reception]);
  const cell = reception.cells.find(item => item.id === selection?.cell);
  const cellRect = layout?.windows[cell?.id], childRect = layout?.windows[selection?.id];
  const name = id => {
    const record = [...reception.shapes, ...reception.imageModules, ...reception.texts].find(item => item.id === id);
    return record?.name || record?.article?.title || 'Layer';
  };
  const run = action => { try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const select = (cellId, id) => setSelection({ cell: cellId, id });
  const historyDisabled = Boolean(historyBlocked || !store?.isCurrent() || !store?.hasWriteAccess());
  const generation = store?.getGeneration();
  const paintedAppearance = appearancePreview?.generation === generation ? appearancePreview?.patch : null;
  const pageReception = { ...shown, ...paintedAppearance };
  const restoreHistory = direction => run(() => {
    if (!onHistory(direction)) throw Error('The edit could not be saved. Your saved composition is unchanged.');
  });
  const position = childRect && cellRect && { ...childRect, left: childRect.left - cellRect.left, top: childRect.top - cellRect.top };
  const orderedCells = receptionReadingOrder(reception, reception.cells);
  const move = patch => run(() => {
    const referenceWidth = cell.mobile.referenceWidth || cellRect.width;
    const factor = referenceWidth / cellRect.width;
    const window = Object.fromEntries(Object.entries({ ...position, ...patch }).map(([key, value]) => [key, value * factor]));
    store.setCellMobile(cell.id, { referenceWidth, placements: [
      ...(cell.mobile.placements || []).filter(item => item.id !== selection.id), { id: selection.id, window },
    ] });
  });
  const reorder = direction => run(() => {
    const ids = orderedCells.map(item => item.id), index = ids.indexOf(cell.id), next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]]; store.setCellMobileOrder(ids);
  });
  const choose = action => event => {
    const target = event.currentTarget;
    target.closest('[popover]')?.hidePopover();
    run(() => action(target));
  };
  const previewControls = <div className="reception-preview-controls" role="group" aria-label="Preview controls" {...editorChrome}>
    <EditorToolbarPopover label="Studio preview controls" className="reception-preview-menu-trigger"
      panelClassName="reception-preview-menu" keepMounted trigger={<>Studio Preview<ChevronDown size={14} aria-hidden="true" /></>}>
      <strong>Preview size</strong>
      <ReceptionViewportControls width={width} measuredWidth={pageWidth} onChange={setWidth} />
      <Button icon={RotateCcw} label="Reset preview position" onClick={choose(resetView)}>Reset view</Button>
      {store && <div className="reception-preview-menu-settings">
        <Button icon={SlidersHorizontal} label="Responsive layout settings" aria-expanded={settingsOpen}
          onClick={choose(() => { setSettingsOpen(open => !open); setPageSettings(false); setAppearancePreview(null); })}>Responsive layout</Button>
        <Button icon={Sun} label="Page appearance" aria-expanded={pageSettings}
          onClick={choose(() => { setPageSettings(open => !open); setSettingsOpen(false); setAppearancePreview(null); })}>Page appearance</Button>
      </div>}
      {workspaceDestinations && <nav className="reception-preview-menu-destinations" aria-label="Preview navigation">
        {Object.entries(workspaceDestinations).filter(([, action]) => action).map(([name, action]) =>
          <Button key={name} onClick={choose(action)}>{name}</Button>)}
      </nav>}
    </EditorToolbarPopover>
    <div className="reception-preview-back"><Button icon={ArrowLeft} label="Back to editing" onClick={onClose}>Back</Button></div>
  </div>;
  return <ReceptionPresentation snapshot={snapshot?.entries ? snapshot : undefined} assets={assets}>
    <section className="reception-document-preview system-workflow__token-scope" aria-label={label}
      data-workflow-material="tactile" data-workflow-finish="flat" data-system-workflow-overlay
      onKeyDownCapture={event => { if (actions && event.key === 'Escape' && !event.target.closest('dialog[open], [popover], [aria-haspopup="dialog"][aria-expanded="true"]')) {
        event.preventDefault(); event.stopPropagation(); onClose();
      } }}>
      {actions && <div className="reception-preview-restore">{actions}</div>}
      {error && <p role="alert">{error}</p>}
      <div className="reception-document-preview-body">
        <div className="reception-document-preview-scroll"><div ref={page} className="reception-preview-page" style={{ width: width || undefined, '--reception-page-background': pageReception.backgroundColor || undefined,
          '--reception-bento-width': `${workbenchArea(shown.workbench).width}px` }}>
          <ReceptionHeader reception={pageReception} model={model} previewControls={previewControls} />
          <div ref={panViewport} tabIndex={-1} className="reception-preview-content" data-workbench-pan-surface
            aria-label="Preview canvas. Hold Space and drag to move the view.">
            <div ref={panPlane} className="reception-preview-pan-plane" data-workbench-pan-surface><ReceptionDocumentCanvas reception={shown}
            model={model} address={store?.getProfileAddress()} selected={settingsOpen ? selection?.id : undefined} onSelect={store && settingsOpen ? select : undefined} onLayout={setLayout} /></div>
          </div>
        </div></div>
        {store && (settingsOpen || pageSettings) && <aside className="reception-document-preview-tools" aria-label={pageSettings ? 'Page appearance settings' : 'Responsive cell settings'} {...editorChrome}>
          {pageSettings ? <ReceptionPageSettings reception={reception} disabled={historyDisabled} getVersion={store.getGeneration}
            onChange={patch => run(() => { store.editBento('settings', [patch], store.getGeneration()); setAppearancePreview(null); })}
            onPreview={patch => setAppearancePreview(patch ? { generation: store.getGeneration(), patch } : null)} preview={paintedAppearance} /> : <>
          <strong>Responsive editing</strong>
          <p>Layout changes save to this composition. Width only changes this view.</p>
          </>}
          <div className="reception-preview-edit-history">
            <span role="status" aria-label="Responsive edit status">{error ? 'Changes need attention' : saveState}</span>
            <div role="group" aria-label="Studio edit history">
              {[['undo', Undo2, 'Undo'], ['redo', Redo2, 'Redo']].map(([direction, Icon, label]) =>
                <Button key={direction} icon={Icon} label={label} title={history?.[direction] ? label + ': ' + history[direction] : label}
                  disabled={historyDisabled || !history?.[direction] || !onHistory} onClick={() => restoreHistory(direction)} />)}
            </div>
          </div>
          {historyBlocked && <p role="alert">{historyBlocked}</p>}
          {settingsOpen && <div className="reception-responsive-fields"><label>Cell<select aria-label="Preview cell" value={cell?.id || ''} onChange={event => select(event.target.value, event.target.value)}>
            <option value="">Choose a cell</option>{shown.cells.map(item => <option key={item.id} value={item.id}>{name(item.id)}</option>)}
          </select></label>
          {cell && <ReceptionCellReadingControls cell={cell} disabled={historyDisabled}
            onChange={enabled => run(() => store.editBento('cellSingleLine', [cell.id, enabled], store.getGeneration()))} />}
          {cell && (layout?.mobile || layout?.stacked ? <>
            {layout.mobile && <label>Phone width<select aria-label="Phone cell width" value={cell.mobile.columns} onChange={event => run(() => store.setCellMobile(cell.id, { columns: Number(event.target.value) }))}>
              <option value={2}>Full row</option><option value={1}>Half row</option>
            </select></label>}
            <CellNumber label="Stacked cell height" value={cellRect.height} min={80} max={1200} step={1} disabled={cell.singleLine}
              onChange={height => run(() => store.setCellMobile(cell.id, { height }))} />
            {cell.mobile.autoHeight === false && <Button onClick={() => run(() => store.setCellMobile(cell.id, { autoHeight: true }))}>Automatic height</Button>}
            <div className="reception-document-preview-order">{[[-1, 'Move earlier'], [1, 'Move later']].map(([direction, label]) =>
              <Button key={direction} disabled={orderedCells[direction === -1 ? 0 : orderedCells.length - 1]?.id === cell.id} onClick={() => reorder(direction)}>{label}</Button>)}</div>
            {layout.mobile && !!cell.members.length && <label>Layer<select aria-label="Phone layer" value={selection.id === cell.id ? '' : selection.id} onChange={event => select(cell.id, event.target.value || cell.id)}>
              <option value="">Choose a layer</option>{cell.members.filter(id => layout.windows[id]).map(id => <option key={id} value={id}>{name(id)}</option>)}
            </select></label>}
            {layout.mobile && selection.id !== cell.id && position && <fieldset disabled={cell.lockedMembers?.includes(selection.id)}><legend>Phone layer position and size</legend>
              {Object.entries({ left: 'Horizontal position', top: 'Vertical position', width: 'Layer width', height: 'Layer height' }).map(([key, label]) =>
                <CellNumber key={key} label={label} value={position[key]} min={['width', 'height'].includes(key) ? 1 : -16384} max={16384} onChange={value => move({ [key]: value })} />)}
              <Button onClick={() => run(() => store.setCellMobile(cell.id, { placements: (cell.mobile.placements || []).filter(item => item.id !== selection.id) }))}>Use desktop position</Button>
            </fieldset>}
          </> : <p>Choose a narrower preview.</p>)}</div>}
        </aside>}
      </div>
    </section>
  </ReceptionPresentation>;
}
