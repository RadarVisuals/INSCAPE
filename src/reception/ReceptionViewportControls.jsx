import { ReceptionButton as Button } from './ReceptionControls.jsx';
import './receptionArrangement.css';

// Viewport width belongs to this editor session, never to the authored Reception.
export default function ReceptionViewportControls({ width, onChange }) {
  return <div className="reception-viewport-controls" role="group" aria-label="Responsive preview width">
    <Button aria-pressed={width === null} onClick={() => onChange(null)}>Fit</Button>
    {[[1440, 'Desktop'], [768, 'Tablet'], [390, 'Phone']].map(([size, label]) =>
      <Button key={size} aria-pressed={width === size} onClick={() => onChange(size)}>{label}</Button>)}
    <label><span>Preview width{width !== null && ` · ${width} px`}</span>
      <input type="range" aria-label="Preview width" min={320} max={1920} step={1} value={width ?? 1440}
        onChange={event => onChange(Number(event.target.value))} /></label>
  </div>;
}
