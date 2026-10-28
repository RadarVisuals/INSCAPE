import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import ToolPanel from '../ui/ToolPanel.jsx';
import '../public/ownerSystemWorkflow/workbenchToolPanel.css';

// Reception content controls use the same window interaction as Workbench.
export function ReceptionButton({ icon: Icon, children, label, ...props }) {
  return <button type="button" className="workflow-tactile-control" data-icon-only={Boolean(Icon && !children) || undefined} aria-label={label} title={label} {...props}>
    {Icon && <Icon aria-hidden="true" size={16} />}{children && <span>{children}</span>}
  </button>;
}

export function ReceptionPanel({ title, panelId, preferences, boundsRef, initialTop = 16, side, onClose, onFocusReturn, fallbackFocus, active, onActivate, children, className = '' }) {
  const panel = useRef(null), fallback = useRef(null), activation = useRef(null);
  fallback.current = fallbackFocus; activation.current = onActivate;
  // Text formatting uses nested React portals. Native capture follows the
  // actual tool window, regardless of the editor that owns those controls.
  useEffect(() => {
    const node = panel.current, activate = () => activation.current?.();
    node.addEventListener('pointerdown', activate, true); node.addEventListener('focusin', activate, true);
    return () => { node.removeEventListener('pointerdown', activate, true); node.removeEventListener('focusin', activate, true); };
  }, []);
  useLayoutEffect(() => {
    const previous = document.activeElement, node = panel.current;
    return () => { if (node?.contains(document.activeElement)) onFocusReturn?.(() => previous?.isConnected ? previous : fallback.current?.(), document.activeElement); };
  }, [onFocusReturn]);
  const section = preferences.section('receptionFrames');
  const frames = useSyncExternalStore(section.subscribe, section.getSnapshot);
  const host = boundsRef.current;
  const initial = { left: side === 'left' ? 16 : Math.max(8, (host?.clientWidth || 380) - 356), top: initialTop,
    width: 340, height: Math.min(480, (host?.clientHeight || 520) - initialTop - 16) };
  const frame = frames[panelId] || initial;
  const change = update => section.update(current => ({ ...current, [panelId]: typeof update === 'function' ? update(current[panelId] || initial) : update }));
  return <ToolPanel chrome="flat" panelRef={panel} title={title} label={title} onClose={onClose} boundsRef={boundsRef}
    active={active}
    frame={frame} onFrameChange={change} minimumWidth={260} minimumHeight={160}
    className={`workbench-tool-controls reception-tool-panel ${className}`}>
    {children}
  </ToolPanel>;
}

// No pixel fields. A pointer drag previews locally, then commits once. Escape,
// cancellation, a changed draft or unmount must never save an abandoned value.
export function ReceptionRange({ label, value, min = 0, max, step = 1, unit, version, onCommit, onPreview }) {
  const [shown, setShown] = useState(value), pending = useRef(null), callbacks = useRef(null);
  callbacks.current = { onCommit, onPreview, version, value };
  const cancel = () => { pending.current = null; setShown(callbacks.current.value); callbacks.current.onPreview?.(null); };
  useEffect(() => { pending.current = null; setShown(value); }, [value, version]);
  useEffect(() => () => { if (pending.current) callbacks.current.onPreview?.(null); }, []);
  const commit = () => {
    const change = pending.current; pending.current = null;
    callbacks.current.onPreview?.(null);
    if (change && change.version === callbacks.current.version && change.value !== callbacks.current.value) callbacks.current.onCommit(change.value);
  };
  return <label className="reception-range"><span>{label}{unit && ` · ${shown} ${unit}`}</span><input type="range" aria-label={label} min={min} max={max} step={step} value={shown}
    onChange={event => { const next = Number(event.target.value); pending.current = { value: next, version }; setShown(next); onPreview?.(next); }}
    onPointerUp={commit} onPointerCancel={cancel} onBlur={commit} onKeyUp={event => { if (event.key !== 'Escape') commit(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } }} /></label>;
}

export function ReceptionChoices({ label, value, choices, onChange }) {
  return <fieldset className="reception-choices"><legend>{label}</legend><div>
    {choices.map(([id, text]) => <ReceptionButton key={id} aria-pressed={value === id} onClick={() => onChange(id)}>{text}</ReceptionButton>)}
  </div></fieldset>;
}
