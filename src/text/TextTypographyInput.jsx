import { useEffect, useRef, useState } from 'react';
import { X } from '../public/InscapeIcons.jsx';

// Valid values apply immediately. Keep incomplete input local while typing;
// Escape restores the formatting captured before this field was edited.
export default function TextTypographyInput({ label, accessibleLabel = label, value, mixed = false, hasOverride = value != null,
  limits, disabled, onChange, onReturn, onStart, resetLabel, placeholder = 'Inherited' }) {
  const [input, setInput] = useState(value == null ? '' : String(value));
  const editing = useRef(null);
  useEffect(() => { if (!editing.current) setInput(value == null ? '' : String(value)); }, [value, mixed]);
  const valid = number => Number.isFinite(number) && number >= limits.min && number <= limits.max;
  const finish = event => {
    if (!editing.current || disabled) return;
    const empty = input.trim() === '' && !event.currentTarget.validity.badInput;
    editing.current = null;
    if (empty) { setInput(''); if (value != null || mixed) onChange(null); }
    else setInput(value == null ? '' : String(value));
  };
  return <div className="text-selection-number">
    <label>{label}<input type="number" aria-label={accessibleLabel} {...limits} disabled={disabled}
      placeholder={mixed ? 'Mixed' : placeholder} value={input}
      onChange={event => {
        if (!editing.current) editing.current = { value, restore: onStart?.() };
        const raw = event.target.value, next = Number(raw);
        setInput(raw);
        if (raw.trim() !== '' && valid(next) && (next !== value || mixed)) {
          editing.current.applied = true;
          onChange(next);
        }
      }} onBlur={finish}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); finish(event); onReturn?.(); }
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation();
          const previous = editing.current; editing.current = null;
          if (previous?.applied) {
            if (previous.restore) previous.restore(); else if (value !== previous.value) onChange(previous.value ?? null);
          }
          const restored = previous ? previous.value : value;
          setInput(restored == null ? '' : String(restored));
        }
      }} /></label>
    <button type="button" aria-label={resetLabel} title={resetLabel} disabled={disabled || !hasOverride}
      onMouseDown={event => event.preventDefault()} onClick={() => { editing.current = null; setInput(''); onChange(null); onReturn?.(); }}><X /></button>
  </div>;
}
