import { useEffect, useId, useRef } from 'react';

const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];

// Native range input with the same preview/commit boundary as the colour wheel.
export default function ColourOpacity({ value, color, disabled, labelPrefix, update, beginGesture }) {
  const id = useId(), active = useRef(null), cancelled = useRef(false);
  const begin = () => {
    if (!disabled && !active.current) {
      cancelled.current = false;
      active.current = { transaction: beginGesture?.(), value, update };
    }
  };
  const finish = abandoned => {
    const gesture = active.current;
    if (!gesture) return;
    active.current = null;
    cancelled.current = abandoned;
    if (gesture.transaction) gesture.transaction.finish(abandoned);
    else if (abandoned) gesture.update({ opacity: gesture.value });
  };
  useEffect(() => {
    const cancel = () => finish(true);
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', visibility); cancel(); };
  }, []);
  useEffect(() => { if (disabled) finish(true); }, [disabled]);
  return <div className="ds-colour-opacity">
    <label htmlFor={id}>Opacity</label>
    <div className="ds-colour-opacity-row">
      <span className="ds-colour-opacity-preview" aria-hidden="true"><span style={{ backgroundColor: color, opacity: value / 100 }} /></span>
      <input id={id} aria-label={`${labelPrefix} opacity`} aria-valuetext={`${Math.round(value)}%`} disabled={disabled}
        type="range" min="0" max="100" step="1" value={value}
        onPointerDown={event => { if (event.button === 0) { begin(); event.currentTarget.setPointerCapture(event.pointerId); } }}
        onChange={event => { if (!cancelled.current) (active.current?.transaction?.update || update)({ opacity: Number(event.target.value) }); }}
        onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); finish(true); }
          else if (keys.includes(event.key)) begin();
        }} onKeyUp={event => { if (keys.includes(event.key)) finish(false); }} onBlur={() => finish(true)} />
      <output htmlFor={id}>{Math.round(value)}%</output>
    </div>
  </div>;
}
