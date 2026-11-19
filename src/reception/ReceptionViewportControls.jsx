import { ReceptionButton as Button } from './ReceptionControls.jsx';
import CellNumber from './CellNumber.jsx';
import { useLayoutEffect, useState } from 'react';

// Viewport width belongs to this editor session, never to the authored Reception.
export default function ReceptionViewportControls({ width, measuredWidth, onChange }) {
  const pixels = Math.round(measuredWidth ?? width ?? 1440);
  const [largestWidth, setLargestWidth] = useState(() => Math.max(1920, pixels));
  useLayoutEffect(() => {
    setLargestWidth(previous => Math.max(previous, pixels, Math.round(measuredWidth || 0)));
  }, [pixels, measuredWidth]);
  const min = Math.min(320, pixels), max = Math.max(largestWidth, pixels);
  return <div className="reception-viewport-controls" role="group" aria-label="Responsive preview width">
    <div className="reception-viewport-presets">
      {[[null, 'Fit'], [1440, 'Desktop'], [768, 'Tablet'], [390, 'Phone']].map(([size, label]) =>
        <Button key={label} aria-pressed={width === size} onClick={() => onChange(size)}>{label}</Button>)}
    </div>
    <div className="reception-viewport-width">
      <input type="range" aria-label="Preview width" min={min} max={max} value={pixels}
        onChange={event => onChange(event.target.valueAsNumber)} />
      <CellNumber label="Preview width in pixels" prefix="" suffix="px" value={pixels} min={min} max={max} step={1} onChange={onChange} />
    </div>
  </div>;
}
