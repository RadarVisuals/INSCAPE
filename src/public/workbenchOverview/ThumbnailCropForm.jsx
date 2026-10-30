import { useEffect, useRef, useState } from 'react';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import { normalizeCropForMask } from '../../lattice/rendering/latticeCrop.js';
import { createSystemWorkflowCropPanGesture, updateSystemWorkflowCropPanGesture, SYSTEM_WORKFLOW_DEFAULT_CROP } from '../../systemWorkflow/systemWorkflowCrop.js';
import './thumbnailCrop.css';

export default function ThumbnailCropForm({ selected, model, ratio, onSave, onCancel }) {
  const [crop, setCrop] = useState(selected.thumbnailCrop), [error, setError] = useState('');
  const preview = useRef(null), drag = useRef(null);
  useEffect(() => { preview.current?.focus(); }, []);
  const mask = () => {
    const { width, height } = preview.current.getBoundingClientRect();
    return { left: 0, top: 0, width, height };
  };
  const update = value => setCrop(normalizeCropForMask(value, mask(), model.area));
  const value = crop || SYSTEM_WORKFLOW_DEFAULT_CROP;
  return <form className="workbench-thumbnail-crop" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
  }} onSubmit={event => { event.preventDefault(); try { onSave(crop); } catch (failure) { setError(failure.message); } }}>
    <h2>Thumbnail crop</h2>
    <p id="thumbnail-crop-help">Drag to position, then zoom to frame your cover. Arrow keys also move it.</p>
    <button ref={preview} type="button" className="workbench-thumbnail-crop-preview" aria-label="Reposition thumbnail" aria-describedby="thumbnail-crop-help"
      style={{ '--thumbnail-ratio': ratio }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, start: crop, gesture: createSystemWorkflowCropPanGesture({
          mask: mask(), media: model.area, previewCrop: normalizeCropForMask(value, mask(), model.area),
        }, { x: event.clientX, y: event.clientY }) };
      }}
      onPointerMove={event => {
        if (drag.current?.id !== event.pointerId) return;
        drag.current.gesture = updateSystemWorkflowCropPanGesture(drag.current.gesture, { x: event.clientX, y: event.clientY });
        if (drag.current.gesture.activated) setCrop(drag.current.gesture.previewCrop);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { if (drag.current) setCrop(drag.current.start); drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        const directions = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault(); const step = event.shiftKey ? .05 : .01;
        const current = normalizeCropForMask(value, mask(), model.area);
        update({ ...current, x: Math.max(0, Math.min(1, current.x + direction[0] * step)), y: Math.max(0, Math.min(1, current.y + direction[1] * step)) });
      }}>
      <WorkbenchOverviewPreview model={model} name={selected.name} surfaceId={selected.draft.appearance.surfaceId} thumbnail crop={crop} />
    </button>
    <label className="workbench-thumbnail-crop-zoom"><span>Zoom <output>{Math.round(value.zoom * 100)}%</output></span>
      <input type="range" aria-label="Thumbnail zoom" min="1" max="4" step=".05" value={value.zoom} onChange={event => update({ ...value, zoom: Number(event.target.value) })} /></label>
    <p className="workbench-thumbnail-crop-note">Only the gallery thumbnail changes. Your full canvas stays intact.</p>
    {error && <p role="alert">{error}</p>}
    <div className="workbench-overview-actions">
      <button type="submit" className="workbench-overview-primary">Save crop</button>
      <button type="button" onClick={() => setCrop(null)}>Auto fill</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}
