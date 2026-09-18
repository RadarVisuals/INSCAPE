import { defaultModuleEdges } from '../../systemWorkflow/domain/moduleSurfaceAppearance.js';
import './moduleSurface.css';
export default function ModuleSurfaceControls({ value, onChange, frame, onFrameChange, display = false, disabled = false }) {
  const edges = value || defaultModuleEdges(display);
  const change = patch => onChange({ ...edges, ...patch });
  return <fieldset className="module-surface-controls" disabled={disabled}>
    <legend>Edges and texture</legend>
    <label>Corners<select aria-label="Module corners" value={edges.corners.every(v => v === 0) ? 'square' : edges.corners.every(v => v === edges.corners[0]) ? 'rounded' : 'custom'}
      onChange={e => change({ corners: e.target.value === 'square' ? [0, 0, 0, 0] : e.target.value === 'rounded' ? [8, 8, 8, 8] : [8, 0, 0, 8] })}>
      <option value="square">Square</option><option value="rounded">Rounded</option><option value="custom">Individual corners</option>
    </select></label>
    <div className="module-corner-controls">{['Top left', 'Top right', 'Bottom right', 'Bottom left'].map((label, i) => <label key={label}>{label}
      <input type="number" min={0} max={64} step={1} aria-label={`${label} corner radius`} value={edges.corners[i]} onChange={e => {
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v) && v >= 0 && v <= 64) change({ corners: edges.corners.map((old, index) => index === i ? v : old) });
      }} /></label>)}</div>
    <label className="module-surface-check"><input type="checkbox" checked={frame} onChange={e => onFrameChange(e.target.checked)} />Show border</label>
    <label className="module-surface-check"><input type="checkbox" checked={edges.shadow} onChange={e => change({ shadow: e.target.checked })} />Show shadow</label>
    <label>Grain strength <output>{Math.round(edges.grain * 100)}%</output><input aria-label="Grain strength" type="range" min={0} max={1} step={.01} value={edges.grain} onChange={e => change({ grain: Number(e.target.value) })} /></label>
  </fieldset>;
}
