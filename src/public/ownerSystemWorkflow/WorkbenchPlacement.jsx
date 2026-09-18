import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { nearestModuleEdge, snapModulePosition } from './workbenchEdgeSnap.js';
const Placement = createContext(null);
export function WorkbenchPlacement({ children, enabled, gap }) {
  const entries = useRef(new Map()), options = useRef({ enabled, gap });
  options.current = { enabled, gap };
  const host = useMemo(() => ({ entries: entries.current, options }), []);
  return <Placement.Provider value={host}>{children}</Placement.Provider>;
}
// Only open content modules register. Instruments and other Workbenches are excluded.
export function useWorkbenchPlacement(node, enabled = true) {
  const host = useContext(Placement);
  useLayoutEffect(() => {
    if (!host || !enabled) return;
    host.entries.set(node, node);
    return () => { host.entries.delete(node); };
  }, [host, node, enabled]);
  const targets = () => [...(host?.entries.values() || [])].filter(ref => ref !== node && ref.current?.isConnected)
    .map(ref => ref.current.getBoundingClientRect()).filter(r => r.width && r.height);
  return {
    position(candidate, current, fallback, bypass) {
      const bounds = node.current?.getBoundingClientRect();
      if (!host?.options.current.enabled || !enabled || bypass || !bounds) return fallback;
      const dx = bounds.left - current.left, dy = bounds.top - current.top;
      const match = snapModulePosition({ left: candidate.left + dx, top: candidate.top + dy, width: bounds.width, height: bounds.height }, targets(), host.options.current.gap);
      return { left: match.left === undefined ? fallback.left : match.left - dx, top: match.top === undefined ? fallback.top : match.top - dy };
    },
    edge(axis, side, value, current, bypass) {
      const bounds = node.current?.getBoundingClientRect();
      if (!host?.options.current.enabled || !enabled || bypass || !bounds) return null;
      const delta = axis === 'x' ? bounds.left - current.left : bounds.top - current.top;
      const result = nearestModuleEdge(bounds, targets(), axis, side, value + delta, host.options.current.gap);
      return result === null ? null : result - delta;
    },
  };
}
