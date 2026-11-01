import { useLayoutEffect, useRef } from 'react';

// Only the two neighbouring pane shares change; the dock frame stays put.
export default function WorkbenchDockDivider({ group, before, after, label, onChange }) {
  const gesture = useRef(null), latest = useRef(null);
  const resize = (start, delta) => {
    const height = start.beforeHeight + start.afterHeight, minimum = Math.min(72, height / 2);
    const ratio = Math.max(minimum, Math.min(height - minimum, start.beforeHeight + delta)) / height;
    const total = start.shares[before.id] + start.shares[after.id];
    onChange({ type: 'shares', group, shares: { [before.id]: total * ratio, [after.id]: total * (1 - ratio) } });
  };
  const measure = element => ({ beforeHeight: element.previousElementSibling.getBoundingClientRect().height,
    afterHeight: element.nextElementSibling.getBoundingClientRect().height, shares: { [before.id]: before.share, [after.id]: after.share } });
  const finish = cancelled => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    if (cancelled) onChange({ type: 'shares', group, shares: current.shares });
    if (current.element.hasPointerCapture(current.id)) current.element.releasePointerCapture(current.id);
  };
  latest.current = finish;
  useLayoutEffect(() => {
    const cancel = () => latest.current(true);
    const visibility = () => { if (document.hidden) cancel(); };
    const escape = event => {
      if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(); }
    };
    window.addEventListener('blur', cancel); window.addEventListener('resize', cancel);
    document.addEventListener('keydown', escape, true); document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', cancel); window.removeEventListener('resize', cancel);
      document.removeEventListener('keydown', escape, true); document.removeEventListener('visibilitychange', visibility); cancel();
    };
  }, []);
  return <div className="workbench-dock-divider" role="separator" tabIndex={0} aria-label={label}
    aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={Math.round(100 * before.share / (before.share + after.share))}
    title="Drag to resize panels; use Up or Down when focused"
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary || gesture.current) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.blur();
      gesture.current = { ...measure(event.currentTarget), element: event.currentTarget, id: event.pointerId, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => { if (event.pointerId === gesture.current?.id) { event.stopPropagation(); resize(gesture.current, event.clientY - gesture.current.y); } }}
    onPointerUp={event => { if (event.pointerId === gesture.current?.id) finish(false); }}
    onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
    onKeyDown={event => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || gesture.current) return;
      event.preventDefault(); event.stopPropagation();
      const step = event.altKey ? 1 : event.shiftKey ? 24 : 8;
      resize(measure(event.currentTarget), event.key === 'Home' ? -innerHeight : event.key === 'End' ? innerHeight : event.key === 'ArrowUp' ? -step : step);
    }} />;
}
