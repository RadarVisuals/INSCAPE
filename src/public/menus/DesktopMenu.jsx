import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clampMenuPosition } from './contextMenuModel.js';

export default function DesktopMenu({ anchor, commands, label, onCommand, onClose, returnFocus }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(anchor);
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPosition(clampMenuPosition(anchor, rect, { width: window.innerWidth, height: window.innerHeight }));
    ref.current?.querySelector('button')?.focus();
  }, [anchor]);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); returnFocus?.focus?.(); } };
    const outside = (event) => { if (!ref.current?.contains(event.target)) onClose(); };
    window.addEventListener('keydown', close); window.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', outside, true); };
  }, [onClose, returnFocus]);
  const onKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); const buttons = [...ref.current.querySelectorAll('button:not(:disabled)')];
    const offset = event.key === 'ArrowDown' ? 1 : -1; const index = buttons.indexOf(document.activeElement);
    buttons[(index + offset + buttons.length) % buttons.length]?.focus();
  };
  return <div ref={ref} className="desktop-menu" role="menu" aria-label={label} style={{ left: position.x, top: position.y }} onKeyDown={onKeyDown}>
    {commands.map((command) => <button key={command.id} type="button" role="menuitem" disabled={command.disabled} onClick={() => onCommand(command.id)}><i aria-hidden="true" />{command.label}</button>)}
  </div>;
}
