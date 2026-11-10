import { useEffect, useRef, useState } from 'react';
const rangeKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];

// Effects remain Shape-owned. A slider or numeric edit previews locally, then commits
// once against its original record; dismissal or a changed draft cancels it.
export default function ShapeEffectsControls({ record, disabled, store, onPreview, onChange }) {
  const [preview, setPreview] = useState(null), active = useRef(null), dismissed = useRef(false);
  const [numberDraft, setNumberDraft] = useState(null);
  const version = store.getGeneration();
  const finish = cancelled => {
    const gesture = active.current;
    if (!gesture) { if (!cancelled) dismissed.current = false; return; }
    dismissed.current = cancelled;
    active.current = null; setPreview(null); setNumberDraft(null); onPreview(null);
    if (!cancelled && !disabled && store.getGeneration() === gesture.version && gesture.patch
      && gesture.record === record
      && Object.entries(gesture.patch).some(([key, value]) => value !== (record[key] || 0))) onChange(gesture.patch);
  };
  const cancel = () => finish(true);
  useEffect(() => { active.current?.cancel(); }, [version, disabled, record, store]);
  useEffect(() => {
    const blur = () => active.current?.cancel();
    window.addEventListener('blur', blur);
    return () => { blur(); window.removeEventListener('blur', blur); };
  }, []);
  const begin = () => {
    dismissed.current = false;
    if (!disabled && !active.current) active.current = { version: store.getGeneration(), record, patch: null, cancel };
  };
  const updatePreview = patch => {
    if (!active.current) return;
    if (store.getGeneration() !== active.current.version || record !== active.current.record) { cancel(); return; }
    active.current.patch = patch; setPreview(patch); onPreview(patch);
  };
  const fields = [
    ...(!record.kind ? [['grain', 'Grain', 100, 1, 100, '%']] : []),
    ['blur', 'Blur', 12, .5, 1, 'px'],
  ];
  return <div className="shape-fx-tools">{fields.map(([key, label, max, step, factor, unit]) => {
    const value = Number(((preview?.[key] ?? record[key] ?? 0) * factor).toPrecision(15));
    return <div key={key} className="workbench-inspector-row shape-fx-range"><span>{label}</span>
      <input aria-label={`FX ${label}`} type="range" min="0" max={max} step={step} value={value} disabled={disabled}
        onPointerDown={event => {
          if (event.button !== 0) return;
          // Finish the previous field's blur before this range owns a gesture.
          event.currentTarget.focus({ preventScroll: true });
          begin(); event.currentTarget.setPointerCapture(event.pointerId);
        }}
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
          updatePreview(patch);
        }} />
      <label><span aria-hidden="true">{unit}</span><input aria-label={`${label} (${unit})`} type="number" min="0" max={max} step="any"
        value={numberDraft?.key === key ? numberDraft.value : value} disabled={disabled}
        onFocus={begin} onChange={event => {
          if (disabled) return;
          begin();
          const input = event.currentTarget;
          setNumberDraft({ key, value: input.value });
          updatePreview(input.value !== '' && input.validity.valid ? { [key]: Number(input.value) / factor } : null);
        }} onBlur={() => finish(false)} onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
          else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
        }} /></label>
    </div>;
  })}</div>;
}
