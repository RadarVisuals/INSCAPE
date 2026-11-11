import { useCallback, useEffect, useRef, useState } from 'react';
import { useOwnerSystemWorkflowPanelPresence } from './useOwnerSystemWorkflowPanels.js';
import useDeferredFocusReturn from '../useDeferredFocusReturn.js';

// Owns only the publication surface. Preparation, signing and persistence stay
// with the existing publication rack and its scoped publication controller.
export default function useWorkbenchPublicationPanel({ closePanel }) {
  const [open, setOpen] = useState(false);
  const presence = useOwnerSystemWorkflowPanelPresence(open);
  const focusReturn = useRef(null);
  const { restoreFocus, cancelFocusReturn } = useDeferredFocusReturn();
  const close = useCallback(
    ({ returnFocus = true } = {}) => {
      cancelFocusReturn();
      focusReturn.current =
        returnFocus && focusReturn.current
          ? { node: focusReturn.current.node, previous: document.activeElement }
          : null;
      setOpen(false);
    },
    [cancelFocusReturn]
  );

  useEffect(() => {
    if (open || presence.present) return;
    const pending = focusReturn.current;
    focusReturn.current = null;
    if (pending) restoreFocus(pending.node, pending.previous);
  }, [open, presence.present, restoreFocus]);

  const toggle = trigger => {
    if (open) {
      close();
      return;
    }
    cancelFocusReturn();
    focusReturn.current = { node: trigger };
    closePanel({ returnFocus: false });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const dismissFromCanvas = event => {
      if (event.target?.closest?.('[data-system-workflow-artboard]')) close({ returnFocus: false });
    };
    globalThis.addEventListener?.('pointerdown', dismissFromCanvas, true);
    return () => globalThis.removeEventListener?.('pointerdown', dismissFromCanvas, true);
  }, [close, open]);

  return { open, presence, close, toggle };
}
