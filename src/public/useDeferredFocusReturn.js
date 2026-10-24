import { useCallback, useEffect, useRef } from 'react';

// A closing surface may return focus after React removes its controls, but it
// must not overrule a newer focus choice or focus a hidden/disposed destination.
export default function useDeferredFocusReturn() {
  const frame = useRef(0);
  const cancelFocusReturn = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);
  useEffect(() => cancelFocusReturn, [cancelFocusReturn]);
  const restoreFocus = useCallback((target, previous = document.activeElement) => {
    cancelFocusReturn();
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const active = document.activeElement;
      if (active !== previous && active !== document.body && active !== document.documentElement) return;
      // Inline editors replace their trigger; resolve that button after React
      // has rendered it again, without changing a newer user focus choice.
      const node = typeof target === 'function' ? target() : target;
      if (!node?.isConnected || node.disabled || !node.getClientRects().length
        || node.closest('[hidden], [inert], [aria-hidden="true"]')
        || getComputedStyle(node).visibility === 'hidden') return;
      node.focus({ preventScroll: true });
    });
  }, [cancelFocusReturn]);
  return { restoreFocus, cancelFocusReturn };
}
