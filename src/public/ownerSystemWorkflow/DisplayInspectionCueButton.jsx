import { forwardRef } from 'react';
import useDisplayCueGesture from './useDisplayCueGesture.js';

export default forwardRef(function DisplayInspectionCueButton({ host, bounds, position, offset, rectangle,
  editable, label, expanded, embedded = false, onActivate, onMove, onReset, children }, ref) {
  const gesture = useDisplayCueGesture({ host, bounds, offset, rectangle, editable, onMove, onReset, onActivate });
  return <button type="button" ref={ref} className="display-inspection-cue" data-movable={editable || undefined}
    data-embedded={embedded || undefined}
    style={embedded ? undefined : { left: position.x, top: position.y }} aria-label={label} aria-expanded={expanded}
    title={editable ? `${label} — drag to position; arrow keys to adjust; Home to reset` : label}
    {...gesture}><span aria-hidden="true">{children}</span></button>;
});
