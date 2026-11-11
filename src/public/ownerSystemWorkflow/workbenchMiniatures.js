import { useLayoutEffect, useRef } from 'react';
import { useWorkbenchView } from './WorkbenchViewContext.js';

// Live module-owned reading projections, scoped to this mounted Workbench.
// No saved copies, editor instances or independent media state live here.
export function createWorkbenchMiniatures() {
  const sources = new Map(), listeners = new Set();
  let revision = 0;
  return { sources, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot: () => revision, changed() { revision++; listeners.forEach(listener => listener()); } };
}
export function useWorkbenchMiniature(id, source) {
  const { miniatures } = useWorkbenchView();
  const current = useRef(source); current.current = source;
  useLayoutEffect(() => {
    if (!miniatures) return;
    miniatures.sources.set(id, current); miniatures.changed();
    return () => { if (miniatures.sources.get(id) === current) { miniatures.sources.delete(id); miniatures.changed(); } };
  }, [miniatures, id]);
  useLayoutEffect(() => { miniatures?.changed(); }, [miniatures, source]);
}
