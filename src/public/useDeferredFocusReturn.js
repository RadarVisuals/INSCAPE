import { useCallback, useLayoutEffect, useReducer, useRef } from 'react';

// A closing surface may return focus after React removes its controls, but it
// must not overrule a newer focus choice or focus a hidden/disposed destination.
export default function useDeferredFocusReturn() {
  const frame = useRef(0);
  const pending = useRef(null);
  const [revision, requestCommit] = useReducer(value => value + 1, 0);
  const cancelFocusReturn = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    pending.current = null;
  }, []);
  useLayoutEffect(() => cancelFocusReturn, [cancelFocusReturn]);
  const restoreFocus = useCallback((target, previous = document.activeElement) => {
    cancelFocusReturn();
    pending.current = { target, previous };
    requestCommit();
  }, [cancelFocusReturn]);
  useLayoutEffect(() => {
    if (!pending.current) return;
    // A bare animation frame can run before a concurrent close has committed,
    // while the destination is still inert or its replacement is not mounted.
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const request = pending.current;
      pending.current = null;
      if (!request) return;
      const { target, previous } = request;
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
  }, [revision]);
  return { restoreFocus, cancelFocusReturn };
}
