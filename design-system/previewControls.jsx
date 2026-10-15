import React, { useState } from 'react';
export const keyClass = 'workflow-tactile-control';
export function IconKey({ label, icon: Icon, ...props }) {
  return (
    <button type="button" className={keyClass} aria-label={label} title={label} {...props}>
      <Icon aria-hidden="true" size={18} strokeWidth={1.6} />
    </button>
  );
}
export function NumberField({ label, value, onChange, min = 0, max = 4096, step = 1 }) {
  const [edit, setEdit] = useState({ source: value, text: String(value) });
  // Keep incomplete input local, but display external edits in the same render.
  // An effect would briefly paint the previous value after a toolbar transform.
  if (!Object.is(edit.source, value)) setEdit({ source: value, text: String(value) });
  const setDraft = (text) => setEdit({ source: value, text });
  return (
    <label>
      {label}
      <input
        type="number"
        aria-label={`Studio ${label}`}
        value={edit.text}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          setDraft(event.target.value);
          if (event.target.value !== '' && event.target.validity.valid)
            onChange(event.target.valueAsNumber);
        }}
        onBlur={() => setDraft(String(value))}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDraft(String(value));
        }}
      />
    </label>
  );
}
export function CheckField({ label, value, onChange }) {
  return (
    <label className="ds-studio-check">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
