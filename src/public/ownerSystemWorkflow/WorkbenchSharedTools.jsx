import { useState, useSyncExternalStore } from 'react';
import { useWorkbenchView } from './WorkbenchViewContext.js';
import { useWorkbenchArea } from './WorkbenchAreaContext.jsx';
import { artworkModuleId, artworkRecords } from '../../systemWorkflow/domain/artworkLayers.js';
import { commitWorkbenchSelectionResize } from '../../systemWorkflow/resizeWorkbenchSelection.js';
import { MetadataDockContent } from './SharedDisplayTools.jsx';
import './workbenchSharedTools.css';

function TransformControls({ id, blocked }) {
  const view = useWorkbenchView(), { editingBounds } = useWorkbenchArea();
  const [error, setError] = useState('');
  const target = view.resizeTargets.get(id)?.current;
  const base = view.frames.get(id)?.current, transform = view.transforms[id];
  const frame = base && (transform?.frame || { left: base.left * (transform?.scale || 1) + (transform?.x || 0), top: base.top * (transform?.scale || 1) + (transform?.y || 0), width: base.width * (transform?.scale || 1), height: base.height * (transform?.scale || 1) });
  if (!frame || !target) return <p className="workbench-tools-empty">Open this artwork to edit its dimensions.</p>;
  const disabled = Boolean(blocked || !target.enabled || view.presentationTransforms[id]);
  const fields = [
    ['left', 'X', editingBounds.left, editingBounds.right - frame.width],
    ['top', 'Y', editingBounds.top, editingBounds.bottom - frame.height],
    ['width', 'Width', target.minimumWidth || target.minimumSize || 1, Math.min(target.maximumWidth || 7992, editingBounds.right - frame.left)],
    ['height', 'Height', target.minimumHeight || target.minimumSize || 1, Math.min(target.maximumHeight || 7992, editingBounds.bottom - frame.top)],
  ];
  const change = (name, input) => {
    if (disabled || input.value === input.defaultValue) return;
    if (input.value === '' || !input.validity.valid) { input.reportValidity(); return; }
    const value = input.valueAsNumber;
    if (value === frame[name]) return;
    let next = { ...frame, [name]: value };
    if (name === 'width' || name === 'height') next = target.constrainFrame?.(next, { bounds: editingBounds }) || next;
    if (commitWorkbenchSelectionResize([{ ...target, id, ...next, getPresentation: view.getPresentation, reportError: message => { setError(message); target.reportError?.(message); } }])) {
      view.setTransforms(current => { const updated = { ...current }; delete updated[id]; return updated; });
      target.applyFrame(next); setError('');
    }
  };
  return <>
    <div className="workbench-tools-fields">{fields.map(([name, label, min, max]) => <label key={name}>{label}<input key={`${id}:${frame[name]}`} aria-label={`Transform ${label}`} type="number" step={target.layoutKey === 'imageModules' && ['width', 'height'].includes(name) ? 1 : 'any'} min={min} max={max}
      disabled={disabled} defaultValue={Math.round(frame[name] * 1000) / 1000} onBlur={event => change(name, event.currentTarget)}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { event.currentTarget.value = frame[name]; event.currentTarget.blur(); } }} /></label>)}</div>
    {(error || blocked) && <p role="alert">{error || blocked}</p>}
  </>;
}

export default function WorkbenchSharedTools({ visible, tab, historyBlocked }) {
  const view = useWorkbenchView();
  useSyncExternalStore(view.subscribe, view.snapshot);
  useSyncExternalStore(view.subscribeTools, view.toolsSnapshot);
  const selected = view.selection, id = selected.length === 1 ? selected[0] : null;
  const moduleIds = [...new Set(selected.map(id => artworkModuleId(view.content, id)))];
  const moduleId = moduleIds.length === 1 ? moduleIds[0] : null;
  const record = artworkRecords(view.content).find(item => item.id === moduleId);
  const source = view.toolSources.get(moduleId)?.current;
  if (!visible) return null;
  if (tab === 'Info') return <MetadataDockContent />;
  if (tab === 'FX') return <div className="workbench-tools-body">
    {selected.length !== 1 || record?.key !== 'shapes' ? <p className="workbench-tools-empty">Select one Shape to edit its effects.</p>
      : source?.fx || <p className="workbench-tools-empty">Effects are unavailable.</p>}
    {record?.key === 'shapes' && !view.frames.has(moduleId) && <button className="workflow-tactile-control" type="button" onClick={() => view.openArtwork(moduleId)}>Open artwork</button>}
  </div>;
  if (tab === 'Image' || tab === 'Shape') return <div className="workbench-tools-body">
    {!selected.length || record?.key !== (tab === 'Image' ? 'imageModules' : 'shapes') ? <p className="workbench-tools-empty">Select one {tab} to edit its settings.</p>
      : source?.[tab.toLowerCase()] || <p className="workbench-tools-empty">{tab} settings are unavailable.</p>}
    {tab === 'Image' && record?.key === 'imageModules' && !view.frames.has(moduleId) && <button className="workflow-tactile-control" type="button" onClick={() => view.openArtwork(moduleId)}>Open artwork</button>}
  </div>;
  return <div className="workbench-tools-body" key={`${moduleId}:${tab}`}>
        {!selected.length ? <p className="workbench-tools-empty">Select an artwork.</p> : (tab === 'Color' ? moduleIds.length > 1 : selected.length > 1) ? <p className="workbench-tools-empty">Select one artwork to edit {tab === 'Color' ? 'its color' : 'its dimensions'}.</p>
          : !record ? <p className="workbench-tools-empty">No artwork selected.</p>
          : tab === 'Transform' ? <TransformControls id={id} blocked={historyBlocked} />
          : record.key === 'imageModules' ? <p className="workbench-tools-empty">Images have no color settings.</p>
          : source?.color || <p className="workbench-tools-empty">Color is unavailable for this artwork.</p>}
        {id && record && !view.frames.has(id) && <button className="workflow-tactile-control" type="button" onClick={() => view.openArtwork(moduleId)}>Open artwork</button>}
    </div>;
}
