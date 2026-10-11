import { useEffect, useRef, useState } from 'react';

// One Workbench request owns preparation, acceptance and focus recovery. The
// document is a temporary preview; the draft store remains authoritative.
export default function useWorkbenchPreview(store, onError) {
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const request = useRef(0), mounted = useRef(false), returnFocus = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current++; returnFocus.current = null; };
  }, [store]);
  const close = ({ restoreFocus = true } = {}) => {
    request.current++;
    setPreparing(false);
    setPreview(null);
    const node = returnFocus.current;
    returnFocus.current = null;
    if (restoreFocus) requestAnimationFrame(() => node?.isConnected && node.focus({ preventScroll: true }));
  };
  const open = async (prepare, presentationCurrent, trigger) => {
    const operation = ++request.current;
    const generation = store.getGeneration(), profile = store.getProfileAddress();
    const ownsRequest = () => mounted.current && operation === request.current;
    const current = () => ownsRequest() && store.getGeneration() === generation
      && store.getProfileAddress() === profile && presentationCurrent();
    returnFocus.current = trigger;
    setPreparing(true);
    try {
      const document = await prepare(current);
      if (!ownsRequest()) return;
      if (!current()) throw new Error('Your work changed while Preview was loading. Open Preview again.');
      if (document) setPreview(document);
    } catch (error) {
      if (ownsRequest()) {
        returnFocus.current = null;
        onError(error?.message || 'Preview unavailable');
      }
    } finally {
      if (ownsRequest()) setPreparing(false);
    }
  };
  return { preview, preparing, open, close, returnFocus };
}
