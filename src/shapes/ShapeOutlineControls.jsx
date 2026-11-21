import InspectorColourControls from '../colour/InspectorColourControls.jsx';
import { CommittedOpacityControl } from '../colour/CommittedColourControls.jsx';

export function PatternNumber({ label, caption = label, prefix, value, min, max, step = 1, disabled, onChange }) {
  return <div className="workbench-inspector-row"><span>{caption}</span><label><span>{prefix}</span><input key={value} aria-label={label} type="number" min={min} max={max} step={step} defaultValue={value} disabled={disabled}
    onBlur={event => {
      if (event.target.value === '' || !event.target.validity.valid) { event.target.value = value; return; }
      const next = Number(event.target.value); if (next !== value) onChange(next);
    }} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === 'Escape') { event.currentTarget.value = value; event.currentTarget.blur(); }
    }} /></label></div>;
}

// One stroke editor for rectangle outlines and Reception's shared inside edges.
export default function ShapeOutlineControls({ outline, onChange, disabled, label = 'Stroke', ...colour }) {
  return <div className="shape-inspector-properties">
    <InspectorColourControls {...colour} label={label} color={outline.color} disabled={disabled} onChange={onChange} />
    <PatternNumber label="Stroke width (px)" caption="Line width" prefix="px" value={outline.width} min={0} max={64} step={.25}
      disabled={disabled} onChange={width => onChange({ width })} />
    <CommittedOpacityControl {...colour} label="Stroke opacity" caption="Line opacity" color={outline.color}
      opacity={outline.opacity} disabled={disabled} onChange={onChange} />
  </div>;
}
