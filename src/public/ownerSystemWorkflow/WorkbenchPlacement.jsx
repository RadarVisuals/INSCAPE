import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { gridEdgeMatch, moduleEdgeMatch, modulePositionMatch } from './workbenchEdgeSnap.js';
import WorkbenchSnapGuides from './WorkbenchSnapGuides.jsx';
import { WORKBENCH_GRID_STEP } from './workbenchGrid.js';
const Placement = createContext(null);
const rectangle = nodes => {
  const boxes = nodes.filter(node => node?.isConnected).map(node => node.getBoundingClientRect());
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map(b => b.left)), top = Math.min(...boxes.map(b => b.top));
  return { left, top, width: Math.max(...boxes.map(b => b.right)) - left, height: Math.max(...boxes.map(b => b.bottom)) - top };
};
const edgeValue = (rect, side) => side === 'right' ? rect.left + rect.width : side === 'bottom' ? rect.top + rect.height : rect[side];
const targets = (host, excluded) => [...(host?.entries.values() || [])].map(ref => ref.current)
  .filter(node => node?.isConnected && !excluded.includes(node)).map(node => ({ id: node, ...rectangle([node]) }));
function positionMatch(host, rect, nodes, scale, bypass, edges = true) {
  if (bypass) { host?.clearMatches(); return rect; }
  if (!host) return rect;
  const previous = host.active?.matches || {};
  const result = host.options.current.enabled && edges
    ? modulePositionMatch(rect, targets(host, nodes), host.options.current.gap * scale, previous) : { position: {}, matches: {} };
  const origin = host.options.current.hostRef?.current?.getBoundingClientRect();
  if (host.options.current.gridEnabled) for (const [axis, side] of [['x', 'left'], ['y', 'top']]) {
    if (result.matches[axis]) continue;
    const match = gridEdgeMatch(axis, side, rect[side], origin?.[side] || 0, WORKBENCH_GRID_STEP, previous[axis]);
    result.position[side] = match.value; result.matches[axis] = match;
  }
  host.report(nodes, { x: result.matches.x || null, y: result.matches.y || null });
  return { ...rect, ...result.position };
}
// Group and zoomed-window movement is already in screen coordinates. Reuse
// the same registered targets and preference owner as ordinary window snapping.
export function useWorkbenchMovementSnap() {
  const host = useContext(Placement);
  const snap = (rect, excluded, scale, bypass) => positionMatch(host, rect, excluded, scale, bypass);
  snap.begin = (event, nodes) => host?.begin(event, nodes);
  snap.finish = () => host?.clear();
  return snap;
}
export function WorkbenchPlacement({ children, enabled, gap, gridEnabled = false, hostRef }) {
  const entries = useRef(new Map()), options = useRef({ enabled, gap, gridEnabled, hostRef });
  options.current = { enabled, gap, gridEnabled, hostRef };
  const host = useMemo(() => {
    const listeners = new Set();
    const state = { entries: entries.current, options, active: null, frame: null, guides: [],
      subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
      snapshot: () => state.guides,
      publish: guides => { state.guides = guides; listeners.forEach(fn => fn()); },
      clearMatches: () => {
        if (state.frame !== null) cancelAnimationFrame(state.frame);
        state.frame = null;
        if (state.active) state.active.matches = {};
        if (state.guides.length) state.publish([]);
      },
      clear: () => { state.clearMatches(); state.active = null; },
      begin: (event, nodes) => { state.clear(); state.active = { nodes, pointerId: event.pointerId, matches: {} }; },
      confirm: node => {
        if (!state.active?.nodes.includes(node)) return;
        state.validate(true);
      },
      validate: (committed = false) => {
        const active = state.active, rect = active && rectangle(active.nodes);
        if (!rect || active.nodes.some(node => !node?.isConnected)) { state.clear(); return; }
        const applied = Object.values(active.matches).filter(match => match
          && (!match.target || match.target.id?.isConnected)
          && Math.abs(edgeValue(rect, match.side) - match.value) <= 1);
        // A pointer event may precede React's geometry commit. Do not release
        // its candidate on an early animation frame; confirm after layout.
        if (committed) active.matches = Object.fromEntries(applied.map(match => [match.axis, match]));
        state.publish(applied.map(match => ({ ...match, rect })));
      },
      report: (nodes, matches) => {
        if (!state.active || nodes.length !== state.active.nodes.length || nodes.some(node => !state.active.nodes.includes(node))) return;
        state.active.matches = { ...state.active.matches, ...matches };
        if (state.frame !== null) cancelAnimationFrame(state.frame);
        state.frame = requestAnimationFrame(() => {
          state.frame = null;
          // Bounds and fixed-ratio resizing can reject a candidate. Only show
          // matches the final rendered window actually reached.
          state.validate();
        });
      },
    };
    return state;
  }, []);
  useLayoutEffect(() => { host.clear(); }, [host, enabled, gap, gridEnabled]);
  useLayoutEffect(() => {
    const finish = event => {
      if (event.type === 'blur' && event.target !== globalThis) return;
      if (event.type === 'keyup') { if (host.active?.pointerId === undefined) host.clear(); return; }
      if (event.type === 'blur' || event.type === 'resize' || event.pointerId === host.active?.pointerId) host.clear();
    };
    const key = event => { if (event.key === 'Alt') host.clearMatches(); if (event.key === 'Escape') host.clear(); };
    for (const name of ['pointerup', 'pointercancel', 'blur', 'resize', 'keyup']) globalThis.addEventListener(name, finish, true);
    globalThis.addEventListener('keydown', key, true);
    return () => {
      for (const name of ['pointerup', 'pointercancel', 'blur', 'resize', 'keyup']) globalThis.removeEventListener(name, finish, true);
      globalThis.removeEventListener('keydown', key, true); host.clear();
    };
  }, [host]);
  return <Placement.Provider value={host}>{children}<WorkbenchSnapGuides host={host} hostRef={hostRef} /></Placement.Provider>;
}
// Only open content modules register. Instruments and other Workbenches are excluded.
export function useWorkbenchPlacement(node, enabled = true, scale = 1, register = true) {
  const host = useContext(Placement);
  useLayoutEffect(() => { if (enabled) host?.confirm(node.current); });
  useLayoutEffect(() => {
    if (!host || !enabled) return;
    if (register) host.entries.set(node, node);
    const element = node.current;
    return () => { host.entries.delete(node); if (host.active?.nodes.includes(element)
      || Object.values(host.active?.matches || {}).some(match => match?.target?.id === element)) host.clear(); };
  }, [host, node, enabled, register]);
  const edgeMatch = (axis, side, value, current, bypass, edges = true) => {
    const bounds = node.current?.getBoundingClientRect();
    if (!host || !enabled || !bounds) return null;
    if (bypass) { host.clearMatches(); return null; }
    const delta = axis === 'x' ? bounds.left - current.left * scale : bounds.top - current.top * scale;
    const previous = host.active?.matches[axis];
    const origin = host.options.current.hostRef?.current?.getBoundingClientRect();
    const match = (host.options.current.enabled && register && edges
      ? moduleEdgeMatch(bounds, targets(host, [node.current]), axis, side, value * scale + delta, host.options.current.gap * scale, previous) : null)
      || (host.options.current.gridEnabled ? gridEdgeMatch(axis, side, value * scale + delta, (axis === 'x' ? origin?.left : origin?.top) || 0, WORKBENCH_GRID_STEP, previous) : null);
    host.report([node.current], { [axis]: match });
    return match ? { ...match, value: (match.value - delta) / scale } : null;
  };
  return {
    begin: event => { if (enabled) host?.begin(event, [node.current]); },
    finish: () => { if (host?.active?.nodes.includes(node.current)) host.clear(); },
    position(candidate, current, fallback, bypass) {
      const bounds = node.current?.getBoundingClientRect();
      if (!host || !enabled || !bounds) return fallback;
      if (bypass) { host.clearMatches(); return fallback; }
      const dx = bounds.left - current.left * scale, dy = bounds.top - current.top * scale;
      const match = positionMatch(host, { left: candidate.left * scale + dx, top: candidate.top * scale + dy, width: bounds.width, height: bounds.height }, [node.current], scale, bypass, register);
      return { left: match.left === undefined ? fallback.left : (match.left - dx) / scale, top: match.top === undefined ? fallback.top : (match.top - dy) / scale };
    },
    edgeMatch,
    edge: (...args) => edgeMatch(...args)?.value ?? null,
  };
}
