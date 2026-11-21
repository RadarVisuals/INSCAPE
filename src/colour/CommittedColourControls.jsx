import { useEffect, useRef, useState } from 'react';
import ColourControls from './ColourControls.jsx';
import ColourOpacity from './ColourOpacity.jsx';

// One completed gesture is one authored edit. Preview is temporary and belongs
// to the calling module; scope changes/unmount never commit its last pointer.
function useColourEdit({ color, opacity, disabled, onChange, onPreview, beginPreview, getVersion, scopeKey }) {
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
  return { color: preview?.color ?? color, percent: (preview?.opacity ?? opacity) * 100, begin,
    update: patch => { if (!disabled) onChange(normalise(patch)); } };
}

export default function CommittedColourControls(props) {
  const { color, percent, begin, update } = useColourEdit(props);
  return <ColourControls item={{ color, opacity: percent, locked: props.disabled }}
    labelPrefix="Color" showOpacity={props.opacity !== undefined} scopeKey={props.scopeKey} getVersion={props.getVersion} variant={props.variant}
    beginGesture={begin} beginOpacityGesture={begin} update={update} />;
}

export function CommittedOpacityControl({ label, caption = 'Opacity', ...props }) {
  const { color, percent, begin, update } = useColourEdit(props);
  return <ColourOpacity value={percent} color={color} disabled={props.disabled} label={label}
    caption={caption} exact update={update} beginGesture={begin} />;
}
