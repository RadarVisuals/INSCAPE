import { useState } from 'react';
import { ReceptionButton as Button } from './ReceptionControls.jsx';

// Viewport width belongs to this editor session, never to the authored Reception.
export default function ReceptionViewportControls({ width, measuredWidth, onChange }) {
  const pixels = Math.round(width ?? measuredWidth ?? 1440);
  const min = Math.min(320, pixels), max = Math.max(1920, pixels);
  const [draft, setDraft] = useState(null);
  return <div className="reception-viewport-controls" role="group" aria-label="Responsive preview width">
    <div className="reception-viewport-presets">
      {[[null, 'Fit'], [1440, 'Desktop'], [768, 'Tablet'], [390, 'Phone']].map(([size, label]) =>
        <Button key={label} aria-pressed={width === size} onClick={() => onChange(size)}>{label}</Button>)}
    </div>
    <div className="reception-viewport-width">
      <input type="range" aria-label="Preview width" min={min} max={max} value={pixels}
        onChange={event => onChange(event.target.valueAsNumber)} />
      <label><input type="number" aria-label="Preview width in pixels" min={min} max={max}
        value={draft ?? pixels} onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); setDraft(null); }
          if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        }}
        onBlur={event => {
          const input = event.currentTarget;
          if (draft !== null && input.validity.valid && Number.isFinite(input.valueAsNumber) && input.valueAsNumber !== pixels)
            onChange(input.valueAsNumber);
          setDraft(null);
        }} /><span aria-hidden="true">px</span></label>
    </div>
  </div>;
}
