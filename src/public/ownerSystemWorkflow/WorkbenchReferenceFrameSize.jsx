import { useEffect, useState } from 'react';
import { WORKBENCH_REFERENCE_FRAME_MAX } from './workbenchReferenceFrame.js';

function FrameDimension({ axis, value, disabled, onChange }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label title={'Frame ' + axis + ' in pixels (1–' + WORKBENCH_REFERENCE_FRAME_MAX + '). Enter or leave the field to apply; Escape cancels.'}>
    {axis === 'width' ? 'W' : 'H'}
    <input aria-label={'Reference frame ' + axis} type="number" inputMode="numeric"
      min={1} max={WORKBENCH_REFERENCE_FRAME_MAX} step={1} required disabled={disabled} value={draft}
      onChange={event => setDraft(event.target.value)}
      onBlur={event => {
        const next = event.currentTarget.valueAsNumber;
        if (event.currentTarget.validity.valid && Number.isInteger(next)) {
          setDraft(String(next));
          if (next !== value) onChange(next);
        } else setDraft(String(value));
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Escape') {
          event.currentTarget.value = String(value);
          setDraft(String(value));
        }
        event.currentTarget.blur();
      }} />
  </label>;
}

export default function WorkbenchReferenceFrameSize({ size, disabled, onChange }) {
  return <div className="workbench-reference-size" role="group" aria-label="Frame resolution in pixels">
    {['width', 'height'].map(axis => <FrameDimension key={axis} axis={axis} value={size[axis]} disabled={disabled}
      onChange={value => onChange({ width: size.width, height: size.height, [axis]: value })} />)}
    <small>px</small>
  </div>;
}
