import { useLayoutEffect, useRef } from 'react';
import './artworkActionControls.css';

// Presentation only: each module supplies its own actions and temporary edit.
export default function ArtworkActionControls({ actions, inspection }) {
  const root = useRef(null), focused = useRef(null);
  useLayoutEffect(() => {
    if (focused.current && !focused.current.isConnected && document.activeElement === document.body) {
      root.current?.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true });
    }
  });
  const navigate = event => {
    if (!event.target.closest('button') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    event.preventDefault(); event.stopPropagation();
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true });
  };
  return <div ref={root} className="artwork-action-controls" onFocusCapture={event => { focused.current = event.target; }}>
    {inspection && <div className="artwork-action-controls__group" role="group" aria-label="Inspection and placement" onKeyDown={navigate}>{inspection}</div>}
    {actions && <div className="artwork-action-controls__group" role="group" aria-label="Selection tools" onKeyDown={navigate}>{actions}</div>}
  </div>;
}
