import { receptionDividers, receptionMinimum, receptionPixelRect } from './receptionLayout.js';
import { RECEPTION_EXTENT } from '../profileDocument/domain/receptionPresentation.js';

// Editor-only handles. The public renderer supplies bounds, not authoring logic.
export default function ReceptionFrameTools({ reception, selected, mobile, width, height, frame, onDividerStart, onDividerKey }) {
  return <>
    <div className="reception-selection-layer" aria-hidden="true">{!mobile && reception.regions.filter(r => r.id === selected).map(r =>
      <div className="reception-selection" key={r.id} style={{ ...receptionPixelRect(r, width, height, reception.gutter), borderRadius: reception.radius }} />)}</div>
    {!mobile && receptionDividers(reception, receptionMinimum(width, height, reception.gutter)).map((d, index) => <button key={d.id} className="reception-divider" type="button" disabled={d.min > d.max}
      aria-label={`Resize divider ${index + 1}`} role="slider" aria-orientation={d.axis === 'x' ? 'horizontal' : 'vertical'} aria-valuemin={d.min / 100} aria-valuemax={d.max / 100} aria-valuenow={d.position / 100}
      data-axis={d.axis} onPointerDown={event => onDividerStart(event, d, frame.current)} onKeyDown={event => onDividerKey(event, d)}
      style={d.axis === 'x' ? { left: d.position / RECEPTION_EXTENT * (width + reception.gutter) - reception.gutter / 2, top: d.from / RECEPTION_EXTENT * (height + reception.gutter), height: (d.to - d.from) / RECEPTION_EXTENT * (height + reception.gutter) - reception.gutter }
        : { top: d.position / RECEPTION_EXTENT * (height + reception.gutter) - reception.gutter / 2, left: d.from / RECEPTION_EXTENT * (width + reception.gutter), width: (d.to - d.from) / RECEPTION_EXTENT * (width + reception.gutter) - reception.gutter }} />)}
  </>;
}
