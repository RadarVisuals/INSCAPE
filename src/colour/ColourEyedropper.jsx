import { useEffect, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import { normaliseHex } from './colourModel.js';

// Sampling is an explicit browser gesture. Its result belongs to the captured
// target and generation, never whichever object happens to be selected later.
export default function ColourEyedropper({ color, disabled, scopeKey, getVersion, onChange }) {
  const [picking, setPicking] = useState(false), [error, setError] = useState('');
  const active = useRef(null), latest = useRef(null), native = useRef(null), fallback = useRef(null), returnFocus = useRef(null);
  latest.current = { disabled, scopeKey, getVersion, onChange };
  const version = getVersion(), supported = typeof globalThis.EyeDropper === 'function';
  const current = attempt => !latest.current.disabled && latest.current.scopeKey === attempt.scope
    && latest.current.getVersion() === attempt.version;
  useEffect(() => {
    if (picking) return;
    const trigger = returnFocus.current;
    returnFocus.current = null;
    if (trigger?.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
  }, [picking]);
  useEffect(() => {
    setError('');
    return () => { if (!active.current?.finished) active.current?.controller.abort(); fallback.current = null; };
  }, [version, scopeKey, disabled]);
  // Native color inputs emit many input previews but only change when their
  // chooser commits. Listen to change directly so one choice is one edit.
  useEffect(() => {
    const input = native.current;
    if (!input) return;
    const commit = () => {
      const attempt = fallback.current, chosen = normaliseHex(input.value);
      fallback.current = null;
      if (attempt && current(attempt) && chosen) attempt.change({ color: chosen });
      if (input.isConnected) input.focus({ preventScroll: true });
    };
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  }, [color, scopeKey, supported]);
  const capture = () => ({ scope: scopeKey, version: getVersion(), change: onChange });
  const pick = async event => {
    if (disabled || active.current) return;
    const trigger = event.currentTarget, attempt = { ...capture(), controller: new AbortController() };
    active.current = attempt; setPicking(true); setError('');
    try {
      const result = await new globalThis.EyeDropper().open({ signal: attempt.controller.signal });
      if (attempt.controller.signal.aborted || !current(attempt)) return;
      const chosen = normaliseHex(result?.sRGBHex);
      if (!chosen) throw new Error('Invalid sampled color');
      attempt.finished = true;
      attempt.change({ color: chosen });
    } catch (failure) {
      if (failure?.name !== 'AbortError' && !attempt.controller.signal.aborted && current(attempt))
        setError('Color sampling failed. Try again or choose a color below.');
    } finally {
      if (!attempt.controller.signal.aborted) returnFocus.current = trigger;
      if (active.current === attempt) { active.current = null; setPicking(false); }
    }
  };
  return <>
    {supported ? <button type="button" className="workflow-tactile-control ds-colour-eyedropper" data-icon-only="true" aria-label="Pick color from screen" title="Pick color from screen"
      disabled={disabled || picking} aria-busy={picking || undefined} onClick={pick}><Pipette size={16} aria-hidden="true" /></button>
      : <label className="workflow-tactile-control ds-colour-native" data-icon-only="true" data-disabled={disabled || undefined} title="Choose color"><Pipette size={16} aria-hidden="true" /><input ref={native} key={`${scopeKey}:${color}`} type="color" aria-label="Choose color"
        disabled={disabled} defaultValue={color} onClick={() => { fallback.current = capture(); }} /></label>}
    {error && <p className="ds-colour-sampling-error" role="alert">{error}</p>}
  </>;
}
