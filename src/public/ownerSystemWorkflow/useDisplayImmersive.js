import { useLayoutEffect, useRef } from 'react';

// Temporary top-layer ownership, scoped to this Display instance. It neither
// reparents artwork nor writes the saved window arrangement.
export default function useDisplayImmersive({ active, available, boardRef, exitRef, onExit, onResize, onInspectionCancel }) {
  const latest = useRef(null);
  latest.current = { onExit, onResize, onInspectionCancel };
  useLayoutEffect(() => {
    if (!active) return undefined;
    const board = boardRef.current;
    if (!available || !board) { latest.current.onExit(); return undefined; }
    const previousFocus = document.activeElement;
    board.showPopover?.();
    exitRef.current?.focus({ preventScroll: true });
    const resize = () => latest.current.onResize({ width: window.innerWidth, height: window.innerHeight });
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        latest.current.onInspectionCancel?.(); latest.current.onExit();
      } else if (event.key === 'Tab') {
        const controls = [...board.querySelectorAll('button:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')]
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        if (!controls.length) return;
        const index = controls.indexOf(document.activeElement);
        if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === controls.length - 1) {
          event.preventDefault();
          (event.shiftKey ? controls.at(-1) : controls[0]).focus({ preventScroll: true });
        }
      }
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keydown, true);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown, true);
      if (board.matches(':popover-open')) board.hidePopover();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [active, available, boardRef, exitRef]);
}
