import { useEffect, useState } from 'react';
import { X } from '../public/InscapeIcons.jsx';

// The field buffers incomplete numeric input only. Blur/Enter commits once;
// selection or target changes replace the buffer, and Escape cancels it.
export default function TextTypographyInput({ label, accessibleLabel = label, value, mixed = false, hasOverride = value != null,
  limits, disabled, onChange, onReturn, resetLabel, placeholder = 'Inherited' }) {
  const [input, setInput] = useState(value == null ? '' : String(value));
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setInput(value == null ? '' : String(value)); setDirty(false); }, [value, mixed]);
  const commit = () => {
    if (!dirty || disabled) return;
    const next = input.trim() === '' ? null : Number(input);
    if (next === null || Number.isFinite(next) && next >= limits.min && next <= limits.max) onChange(next);
    else setInput(value == null ? '' : String(value));
    setDirty(false);
  };
  return <div className="text-selection-number">
    <label>{label}<input type="number" aria-label={accessibleLabel} {...limits} disabled={disabled}
      placeholder={mixed ? 'Mixed' : placeholder} value={input}
      onChange={event => { setInput(event.target.value); setDirty(true); }} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); commit(); onReturn?.(); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setInput(value == null ? '' : String(value)); setDirty(false); }
      }} /></label>
    <button type="button" aria-label={resetLabel} title={resetLabel} disabled={disabled || !hasOverride}
      onMouseDown={event => event.preventDefault()} onClick={() => { setDirty(false); setInput(''); onChange(null); onReturn?.(); }}><X /></button>
  </div>;
}
