import { useMemo, useState } from 'react';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { projectReception } from '../profileDocument/domain/receptionPresentation.js';
import ReceptionDocumentCanvas from './ReceptionDocumentCanvas.jsx';
import ReceptionViewportControls from './ReceptionViewportControls.jsx';
import WorkspaceSwitcher from '../public/menus/WorkspaceSwitcher.jsx';
import ReceptionPresentation from './ReceptionPresentation.jsx';
import { ReceptionButton as Button } from './ReceptionControls.jsx';
import '../public/ownerSystemWorkflow/workflowTokens.css';
import '../public/ownerSystemWorkflow/workflowTactile.css';
import '../public/ownerSystemWorkflow/workflowFlat.css';
import './receptionPreview.css';

const editorChrome = { 'data-workflow-material': 'tactile', 'data-workflow-finish': 'flat', 'data-workflow-palette': 'editor' };

function NumberSetting({ label, value, min = 0, max = 16384, onCommit }) {
  return <label>{label}<input key={value} type="number" aria-label={label} defaultValue={Math.round(value * 100) / 100}
    min={min} max={max} step="any" onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    onBlur={event => {
      if (event.target.value !== '' && event.target.validity.valid) onCommit(Number(event.target.value));
      else event.target.value = value;
    }} /></label>;
}

export default function ReceptionEditorPreview({ reception, model, snapshot, assets, onClose, store, workspaceDestinations,
  label = 'Reception responsive preview', actions }) {
  const [width, setWidth] = useState(null), [selection, setSelection] = useState(null), [layout, setLayout] = useState(null), [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shown = useMemo(() => projectReception(reception), [reception]);
  const cell = reception.cells.find(item => item.id === selection?.cell);
  const cellRect = layout?.windows[cell?.id], childRect = layout?.windows[selection?.id];
  const name = id => {
    const record = [...reception.shapes, ...reception.imageModules, ...reception.texts].find(item => item.id === id);
    return record?.name || record?.article?.title || 'Layer';
  };
  const run = action => { try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const select = (cellId, id) => setSelection({ cell: cellId, id });
  const position = childRect && cellRect && { ...childRect, left: childRect.left - cellRect.left, top: childRect.top - cellRect.top };
  const move = patch => run(() => {
    const referenceWidth = cell.mobile.referenceWidth || cellRect.width;
    const factor = referenceWidth / cellRect.width;
    const window = Object.fromEntries(Object.entries({ ...position, ...patch }).map(([key, value]) => [key, value * factor]));
    store.setCellMobile(cell.id, { referenceWidth, placements: [
      ...(cell.mobile.placements || []).filter(item => item.id !== selection.id), { id: selection.id, window },
    ] });
  });
  const reorder = direction => run(() => {
    const ids = reception.cells.map(item => item.id), index = ids.indexOf(cell.id), next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]]; store.setCellMobileOrder(ids);
  });
  return <ReceptionPresentation snapshot={snapshot?.entries ? snapshot : undefined} assets={assets}>
    <section className="reception-document-preview system-workflow__token-scope" aria-label={label}
      data-workflow-material="tactile" data-workflow-finish="flat" data-system-workflow-overlay
      onKeyDownCapture={event => { if (actions && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
      <header className="reception-preview-bar" {...editorChrome}>
        <Button icon={ArrowLeft} label="Back to editing" onClick={onClose}>Back to editing</Button>
        {workspaceDestinations ? <WorkspaceSwitcher current="Reception preview" destinations={workspaceDestinations} onChoose={run} /> : <span>{label}</span>}
        <div className="reception-preview-actions"><ReceptionViewportControls width={width} measuredWidth={layout?.viewportWidth} onChange={setWidth} />
        {store && <Button icon={SlidersHorizontal} label="Phone layout settings" aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(open => !open)} />}</div>
      </header>
      {actions && <div className="reception-preview-restore">{actions}</div>}
      {error && <p role="alert">{error}</p>}
      <div className="reception-document-preview-body">
        <div className="reception-document-preview-scroll"><ReceptionDocumentCanvas reception={shown} width={width}
          model={model} address={store?.getProfileAddress()} selected={settingsOpen ? selection?.id : undefined} onSelect={store && settingsOpen ? select : undefined} onLayout={setLayout} /></div>
        {store && settingsOpen && <aside className="reception-document-preview-tools" aria-label="Responsive cell settings" {...editorChrome}>
          <p>Choose a cell to adjust its phone layout. Desktop artwork stays in place.</p>
          <label>Cell<select aria-label="Preview cell" value={cell?.id || ''} onChange={event => select(event.target.value, event.target.value)}>
            <option value="">Choose a cell</option>{shown.cells.map(item => <option key={item.id} value={item.id}>{name(item.id)}</option>)}
          </select></label>
          {cell && (layout?.mobile ? <>
            <label>Phone width<select aria-label="Phone cell width" value={cell.mobile.columns} onChange={event => run(() => store.setCellMobile(cell.id, { columns: Number(event.target.value) }))}>
              <option value={2}>Full row</option><option value={1}>Half row</option>
            </select></label>
            <NumberSetting label="Phone cell height" value={cell.mobile.height} min={80} max={1200} onCommit={height => run(() => store.setCellMobile(cell.id, { height: Math.round(height) }))} />
            <div className="reception-document-preview-order"><Button disabled={reception.cells[0]?.id === cell.id} onClick={() => reorder(-1)}>Move earlier</Button>
              <Button disabled={reception.cells.at(-1)?.id === cell.id} onClick={() => reorder(1)}>Move later</Button></div>
            {!!cell.members.length && <label>Layer<select aria-label="Phone layer" value={selection.id === cell.id ? '' : selection.id} onChange={event => select(cell.id, event.target.value || cell.id)}>
              <option value="">Choose a layer</option>{cell.members.filter(id => layout.windows[id]).map(id => <option key={id} value={id}>{name(id)}</option>)}
            </select></label>}
            {selection.id !== cell.id && position && <fieldset disabled={cell.lockedMembers?.includes(selection.id)}><legend>Phone layer position and size</legend>
              {Object.entries({ left: 'Horizontal position', top: 'Vertical position', width: 'Layer width', height: 'Layer height' }).map(([key, label]) =>
                <NumberSetting key={key} label={label} value={position[key]} min={['width', 'height'].includes(key) ? 1 : -16384} onCommit={value => move({ [key]: value })} />)}
              <Button onClick={() => run(() => store.setCellMobile(cell.id, { placements: (cell.mobile.placements || []).filter(item => item.id !== selection.id) }))}>Use desktop position</Button>
            </fieldset>}
          </> : <p>Choose Phone or a width up to 640 px to edit the narrow layout.</p>)}
        </aside>}
      </div>
    </section>
  </ReceptionPresentation>;
}
