import { useEffect, useRef, useState } from 'react';
import ColourControls from './ColourControls.jsx';

// One completed gesture is one authored edit. Preview is temporary and belongs
// to the calling module; scope changes/unmount never commit its last pointer.
export default function CommittedColourControls({ color, opacity, disabled, onChange, onPreview, beginPreview, getVersion, scopeKey }) {
  const [preview, setPreview] = useState(null), active = useRef(null);
  const version = getVersion();
  const cancel = () => active.current?.finish(true);
  useEffect(() => { cancel(); }, [version, disabled, scopeKey]);
  useEffect(() => () => cancel(), []);
  const normalise = patch => 'opacity' in patch ? { ...patch, opacity: patch.opacity / 100 } : patch;
  const begin = () => {
    cancel();
    const expected = getVersion(), transaction = beginPreview?.();
    let patch = null, finished = false;
    const gesture = {
      update(value) {
        if (finished || disabled || getVersion() !== expected) return;
        patch = { ...patch, ...normalise(value) }; setPreview(patch);
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
  return <ColourControls item={{ color: preview?.color || color, opacity: (preview?.opacity ?? opacity) * 100, locked: disabled }}
    labelPrefix="Color" showOpacity={opacity !== undefined} scopeKey={scopeKey} getVersion={getVersion}
    beginGesture={begin} beginOpacityGesture={begin} update={patch => { if (!disabled) onChange(normalise(patch)); }} />;
}
