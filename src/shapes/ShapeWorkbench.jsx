import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkbenchWindow } from '../public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx';
import { ContextToolContent, useContextToolTarget } from '../public/ownerSystemWorkflow/ContextToolbar.jsx';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { ModuleGrainControl } from '../public/ownerSystemWorkflow/ModuleSurfaceControls.jsx';
import { moduleGrainStyle } from '../systemWorkflow/domain/moduleSurfaceAppearance.js';
import { createShapePresentation, MAX_SHAPES } from './shapes.js';
import { addShape, editShape, reorderShape, prepareShapeResize } from './shapeSession.js';
import '../public/ownerSystemWorkflow/displayInstruments.css';
import './shapes.css';

function ShapeInstance({ record, records, index, initialPresentation, store, profileAddress, onPresentationChange, onActivate, suspended, windowSnap }) {
  const [presentation, setPresentation] = useState(() => initialPresentation || createShapePresentation(record.id, index));
  const [committedFrame, setCommittedFrame] = useState(null), [error, setError] = useState('');
  const active = useContextToolTarget() === record.id;
  const view = useWorkbenchView();
  const editable = Boolean(store) && !suspended && !view.presentationTransforms?.[record.id];
  const layout = useCallback(window => setPresentation(current => JSON.stringify(current.window) === JSON.stringify(window) ? current : { ...current, window }), []);
  const applyFrame = useCallback(frame => { setCommittedFrame(frame); layout(frame); }, [layout]);
  const resizeTarget = useMemo(() => ({ enabled: editable, reflow: true, continuousGeometry: true,
    expected: record, store, profileAddress, layoutKey: 'shapes', commit: commitWorkbenchSelectionResize,
    prepare: prepareShapeResize, applyFrame, reportError: setError,
    minimumWidth: 8, minimumHeight: 8, maximumWidth: 7992, maximumHeight: 7992,
  }), [editable, record, store, profileAddress, applyFrame]);
  useEffect(() => { onPresentationChange?.(record.id, presentation); }, [record.id, presentation, onPresentationChange]);
  useEffect(() => () => onPresentationChange?.(record.id, null), [record.id, onPresentationChange]);
  const run = action => { if (!editable) return; try { action(); setError(''); } catch (failure) { setError(failure.message); } };
  const change = changes => run(() => editShape(store, profileAddress, record, changes));
  const select = id => { onActivate?.(id); view.setSelection?.([id]); };
  const resize = (width, height) => {
    if (![width, height].every(value => Number.isFinite(value) && value >= 8 && value <= 7992)) { setError('Choose dimensions from 8 to 7992 pixels.'); return; }
    const frame = view.getPresentation()?.shapes?.find(item => item.id === record.id)?.window || presentation.window;
    if (commitWorkbenchSelectionResize([{ ...resizeTarget, id: record.id, ...frame, width, height, getPresentation: view.getPresentation }])) {
      view.setTransforms(values => { const next = { ...values }; delete next[record.id]; return next; });
      applyFrame({ ...frame, width, height });
    }
  };
  return <>
    <div className="shape-instance" data-editable={editable || undefined} data-active={active || undefined}
      onPointerDownCapture={() => editable && onActivate?.(record.id)} onFocusCapture={() => editable && onActivate?.(record.id)}>
      {presentation.open && <WorkbenchWindow label="Shape" title={record.name} className="shape-window" chrome="bevel"
        viewId={record.id} active={active} placementModule={editable} snapToGrid={editable && windowSnap} moveFromContent={editable}
        minimumWidth={8} minimumHeight={8} resizableWidth resizable={editable}
        width={presentation.window.width} initialHeight={presentation.window.height} initialX={presentation.window.left} initialY={presentation.window.top}
        onLayoutChange={layout} resizeTarget={resizeTarget} committedFrame={committedFrame}
        surfaceStyle={{ zIndex: index + 1 }}>
        <div className="shape-fill" style={{ backgroundColor: record.color, opacity: record.opacity, ...moduleGrainStyle(record.grain) }}>
          {record.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
        </div>
      </WorkbenchWindow>}
    </div>
    {editable && <ContextToolContent target={record.id} label={record.name}>
      <div className="shape-tools">
        <label>Shape<select aria-label="Choose shape" value={record.id} onChange={event => select(event.target.value)}>
          {[...records].reverse().map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Name<input key={record.name} aria-label="Shape name" defaultValue={record.name} maxLength={48}
          onBlur={event => { const name = event.target.value.trim(); if (name && name !== record.name) change({ name }); }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        <div className="shape-tools-row">
          <label>Colour<input type="color" aria-label="Shape colour" value={record.color} onChange={event => change({ color: event.target.value })} /></label>
          <label>Opacity<input key={record.opacity} type="number" min="0" max="100" aria-label="Shape opacity" defaultValue={Math.round(record.opacity * 100)}
            onBlur={event => { if (event.target.value !== '' && event.target.validity.valid) change({ opacity: Number(event.target.value) / 100 }); }}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
        </div>
        <ModuleGrainControl value={record.grain} onChange={grain => change({ grain })} />
        <form key={`${presentation.window.width}:${presentation.window.height}`} onSubmit={event => {
          event.preventDefault(); const values = new FormData(event.currentTarget); resize(Number(values.get('width')), Number(values.get('height')));
        }}>
          <div className="shape-tools-row">
            <label>Width<input aria-label="Shape width" name="width" type="number" min="8" max="7992" step="any" required defaultValue={presentation.window.width} /></label>
            <label>Height<input aria-label="Shape height" name="height" type="number" min="8" max="7992" step="any" required defaultValue={presentation.window.height} /></label>
          </div>
          <div className="shape-tools-row"><button type="submit">Apply size</button><button type="button" onClick={() => resize(presentation.window.width, presentation.window.width)}>Make square</button></div>
        </form>
        <div className="shape-layer-label">Layer {index + 1} / {records.length} · below modules</div>
        <div className="shape-tools-row shape-order">
          {[['back', 'To back'], ['backward', 'Lower'], ['forward', 'Raise'], ['front', 'To front']].map(([direction, label]) =>
            <button type="button" key={direction} disabled={['back', 'backward'].includes(direction) ? index === 0 : index === records.length - 1}
              onClick={() => run(() => reorderShape(store, profileAddress, record.id, direction))}>{label}</button>)}
        </div>
        <label className="shape-check"><input type="checkbox" checked={presentation.open} onChange={event => setPresentation(p => ({ ...p, open: event.target.checked }))} />Show shape</label>
        <label className="shape-check"><input type="checkbox" checked={record.visibility === 'PUBLIC'} onChange={event => change({ visibility: event.target.checked ? 'PUBLIC' : 'PRIVATE' })} />Include in publication</label>
        <div className="shape-tools-row"><button type="button" disabled={records.length >= MAX_SHAPES} onClick={() => run(() => select(addShape(store, profileAddress, { workbench: view.getPresentation() }, record)))}>Duplicate</button>
          <button type="button" onClick={() => run(() => {
            if (!removeWorkbenchModule(store, profileAddress, 'shape', record)) throw new Error('The shape could not be deleted. Try again.');
            onActivate?.(records.find(item => item.id !== record.id)?.id || null);
          })}>Delete shape</button></div>
        {error && <p role="alert">{error}</p>}
      </div>
    </ContextToolContent>}
  </>;
}

export default function ShapeWorkbench({ records, presentations, store, profileAddress, onPresentationChange, onActivate, suspended = false, windowSnap = false }) {
  return <div className="shape-workbench" data-workbench-module="shape">
    {records.map((record, index) => <ShapeInstance key={`${profileAddress}:${record.id}`} {...{ record, records, index, store, profileAddress, onPresentationChange, onActivate, suspended, windowSnap }}
      initialPresentation={presentations?.find(item => item.id === record.id)} />)}
  </div>;
}
