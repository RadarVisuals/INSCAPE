import { useId, useState } from 'react';
import './cellNumber.css';

export default function CellNumber({ label, prefix = label, suffix, value, onChange, min = 0, max = 512, step = 'any', disabled, title }) {
  const shown = Math.round(value * 1000) / 1000, errorId = useId();
  const source = `${value}:${min}:${max}:${step}`, [issue, setIssue] = useState(null);
  if (issue && issue.source !== source) setIssue(null);
  const error = issue?.source === source ? issue.message : '';
  return <label title={title} className="reception-cell-number" data-invalid={Boolean(error) || undefined}>
    {prefix && <span>{prefix}</span>}<input type="number" step={step} min={min} max={max} aria-label={label}
    aria-invalid={Boolean(error) || undefined} aria-describedby={error ? errorId : undefined}
    disabled={disabled} key={value} defaultValue={shown} onChange={() => setIssue(null)} onBlur={event => {
      const input = event.currentTarget, next = input.valueAsNumber;
      // An untouched rounded display must not replace the saved precision.
      if (input.value && next === shown) { input.value = shown; setIssue(null); return; }
      if (!input.value || !input.validity.valid) {
        const kind = input.validity.stepMismatch && step === 1 ? 'a whole number' : 'a number';
        setIssue({ source, message: `Enter ${kind} from ${min} to ${max}.` });
        return;
      }
      setIssue(null);
      // Reset even when a save fails or normalisation leaves the value unchanged.
      input.value = shown;
      onChange(next);
    }} onKeyDown={event => {
      if (['Enter', 'Escape'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Escape') { event.currentTarget.value = shown; setIssue(null); }
        event.currentTarget.blur();
      }
    }} />{suffix && <span>{suffix}</span>}
    {error && <small id={errorId} className="reception-cell-number-error" role="alert">{error}</small>}
  </label>;
}
