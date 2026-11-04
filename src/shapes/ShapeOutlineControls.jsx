import CommittedColourControls from '../colour/CommittedColourControls.jsx';

export function PatternNumber({ label, value, min, max, step = 1, disabled, onChange }) {
  return <label>{label}<input key={value} aria-label={label} type="number" min={min} max={max} step={step} defaultValue={value} disabled={disabled}
    onBlur={event => {
      if (event.target.value === '' || !event.target.validity.valid) { event.target.value = value; return; }
      const next = Number(event.target.value); if (next !== value) onChange(next);
    }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}

// One stroke editor for rectangle outlines and Reception's shared inside edges.
export default function ShapeOutlineControls({ outline, onChange, disabled, ...colour }) {
  return <>
    <div className="shape-tools"><PatternNumber label="Outline width (px)" value={outline.width} min={0} max={64} step={.25}
      disabled={disabled} onChange={width => onChange({ width })} /></div>
    <CommittedColourControls {...colour} color={outline.color} opacity={outline.opacity} disabled={disabled} onChange={onChange} />
  </>;
}
