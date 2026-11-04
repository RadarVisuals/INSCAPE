import { ReceptionButton as Button } from './ReceptionControls.jsx';
import './receptionArrangement.css';

// Viewport width belongs to this editor session, never to the authored Reception.
export default function ReceptionViewportControls({ width, measuredWidth, onChange }) {
  const effectiveWidth = width ?? measuredWidth;
  return <div className="reception-viewport-controls" role="group" aria-label="Responsive preview width">
    <Button aria-pressed={width === null} onClick={() => onChange(null)}>Fit</Button>
    {[[1440, 'Desktop'], [768, 'Tablet'], [390, 'Phone']].map(([size, label]) =>
      <Button key={size} aria-pressed={width === size} onClick={() => onChange(size)}>{label}</Button>)}
    <label><span>Preview width{effectiveWidth != null && ` · ${Math.round(effectiveWidth)} px`}</span>
      <input type="range" aria-label="Preview width" min={Math.min(320, effectiveWidth ?? 320)} max={Math.max(1920, effectiveWidth ?? 1920)} step={1} value={effectiveWidth ?? 1440}
        onChange={event => onChange(Number(event.target.value))} /></label>
  </div>;
}
