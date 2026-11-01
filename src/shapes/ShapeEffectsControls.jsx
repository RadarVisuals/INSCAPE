import { useEffect, useRef, useState } from 'react';
const rangeKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];

// Effects remain Shape-owned. A slider gesture previews locally, then commits
// once against its original record; dismissal or a changed draft cancels it.
export default function ShapeEffectsControls({ record, disabled, store, onPreview, onChange }) {
  const [preview, setPreview] = useState(null), active = useRef(null), dismissed = useRef(false);
  const version = store.getGeneration();
  const finish = cancelled => {
    const gesture = active.current;
    if (!gesture) { if (!cancelled) dismissed.current = false; return; }
    dismissed.current = cancelled;
    active.current = null; setPreview(null); onPreview(null);
    if (!cancelled && !disabled && store.getGeneration() === gesture.version && gesture.patch
      && Object.entries(gesture.patch).some(([key, value]) => value !== (record[key] || 0))) onChange(gesture.patch);
  };
  const cancel = () => finish(true);
  useEffect(() => { active.current?.cancel(); }, [version, disabled]);
  useEffect(() => {
    const blur = () => active.current?.cancel();
    window.addEventListener('blur', blur);
    return () => { blur(); window.removeEventListener('blur', blur); };
  }, []);
  const begin = () => {
    dismissed.current = false;
    if (!disabled && !active.current) active.current = { version: store.getGeneration(), patch: null, cancel };
  };
  const fields = [
    ...(!record.kind ? [['grain', 'Grain', 100, 1, 100, '%']] : []),
    ['blur', 'Blur', 12, .5, 1, 'px'],
  ];
  return <div className="shape-fx-tools">{fields.map(([key, label, max, step, factor, unit]) => {
    const value = Math.round((preview?.[key] ?? record[key] ?? 0) * factor * 100) / 100;
    return <label key={key} className="shape-fx-range">{label}<output>{value}{unit}</output>
      <input aria-label={`FX ${label}`} type="range" min="0" max={max} step={step} value={value} disabled={disabled}
        onPointerDown={event => { if (event.button !== 0) return; begin(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={() => finish(false)} onPointerCancel={cancel} onLostPointerCapture={cancel}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
          else if (rangeKeys.includes(event.key) && !event.repeat) begin();
        }}
        onKeyUp={event => { if (rangeKeys.includes(event.key)) finish(false); }} onBlur={cancel}
        onChange={event => {
          if (disabled || dismissed.current) return;
          const patch = { [key]: Number(event.target.value) / factor };
          if (!active.current) { onChange(patch); return; }
          if (store.getGeneration() !== active.current.version) { cancel(); return; }
          active.current.patch = patch; setPreview(patch); onPreview(patch);
        }} />
    </label>;
  })}</div>;
}
