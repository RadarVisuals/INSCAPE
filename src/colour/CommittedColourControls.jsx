import { useEffect, useRef, useState } from 'react';
import ColourControls from './ColourControls.jsx';

// One completed gesture is one authored edit. Preview is temporary and belongs
// to the calling module; scope changes/unmount never commit its last pointer.
export default function CommittedColourControls({ color, opacity, disabled, onChange, onPreview, beginPreview, getVersion, opacityLabel = 'Opacity' }) {
  const [preview, setPreview] = useState(null), active = useRef(null);
  const version = getVersion();
  const cancel = () => active.current?.finish(true);
  useEffect(() => { cancel(); }, [version, disabled]);
  useEffect(() => () => cancel(), []);
  const begin = () => {
    cancel();
    const expected = getVersion(), transaction = beginPreview?.();
    let patch = null, finished = false;
    const gesture = {
      update(value) {
        if (finished || disabled || getVersion() !== expected) return;
        patch = { ...patch, ...value }; setPreview(patch);
        if (transaction) transaction.update(patch); else onPreview?.(patch);
      },
      finish(cancelled) {
        if (finished) return;
        finished = true; active.current = null;
        const abandoned = cancelled || disabled || getVersion() !== expected;
        setPreview(null);
        if (transaction) transaction.finish(abandoned);
        else { onPreview?.(null); if (!abandoned && patch) onChange(patch); }
      },
    };
    active.current = gesture;
    return gesture;
  };
  return <>
    <ColourControls item={{ color: preview?.color || color, locked: disabled }} labelPrefix="Color" showOpacity={false}
      beginGesture={begin} update={patch => { if (!disabled) onChange(patch); }} />
    {opacity !== undefined && <label>{opacityLabel} (%)<input key={opacity} aria-label={`Color ${opacityLabel.toLowerCase()}`} type="number" min="0" max="100" step="1"
      disabled={disabled} defaultValue={Math.round(opacity * 100)} onBlur={event => {
        if (event.currentTarget.value === event.currentTarget.defaultValue) return;
        if (event.currentTarget.value === '' || !event.currentTarget.validity.valid) { event.currentTarget.value = Math.round(opacity * 100); return; }
        const next = event.currentTarget.valueAsNumber / 100;
        if (next !== opacity && !disabled) onChange({ opacity: next });
      }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = Math.round(opacity * 100); event.currentTarget.blur(); } }} /></label>}
  </>;
}
