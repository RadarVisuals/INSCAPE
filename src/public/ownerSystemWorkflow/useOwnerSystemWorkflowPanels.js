import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';

export const OWNER_SYSTEM_WORKFLOW_PANEL_IDS = Object.freeze(['activity', 'discover', 'docs', 'grids', 'library', 'profile', 'settings']);

const reducedMotionPreferred = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function useOwnerSystemWorkflowPanelPresence(open, { exitMs = 140, entranceFrames = 2 } = {}) {
  const [state, setState] = useState(() => ({ present: open, phase: open ? 'open' : 'closed' }));
  const completeTransition = useCallback(() => setState((current) => current.phase === 'closing'
    ? { present: false, phase: 'closed' } : current.phase === 'opening' ? { present: true, phase: 'open' } : current), []);
  useEffect(() => {
    let frame = 0;
    let timer = 0;
    if (open) {
      const reducedMotion = reducedMotionPreferred();
      setState({ present: true, phase: 'entering' });
      const advance = (remaining) => {
        frame = requestAnimationFrame(() => {
          if (remaining > 1 && !reducedMotion) advance(remaining - 1);
          else if (reducedMotion) setState({ present: true, phase: 'open' });
          else {
            setState({ present: true, phase: 'opening' });
            timer = setTimeout(completeTransition, exitMs + 120);
          }
        });
      };
      advance(reducedMotion ? 1 : entranceFrames);
    } else {
      setState((current) => current.present ? { present: true, phase: 'closing' } : current);
      if (reducedMotionPreferred()) completeTransition();
      else timer = setTimeout(completeTransition, exitMs + 120);
    }
    return () => { if (frame) cancelAnimationFrame(frame); if (timer) clearTimeout(timer); };
  }, [completeTransition, entranceFrames, exitMs, open]);
  return useMemo(() => ({ ...state, completeTransition }), [completeTransition, state]);
}

export default function useOwnerSystemWorkflowPanels({ blocked = false } = {}) {
  const [activePanel, setActivePanel] = useState(null);
  const triggers = useRef(new Map());
  const pendingFocus = useRef(null);
  const activity = useOwnerSystemWorkflowPanelPresence(activePanel === 'activity');
  const discover = useOwnerSystemWorkflowPanelPresence(activePanel === 'discover', { exitMs: 200 });
  const docs = useOwnerSystemWorkflowPanelPresence(activePanel === 'docs');
  const grids = useOwnerSystemWorkflowPanelPresence(activePanel === 'grids');
  const library = useOwnerSystemWorkflowPanelPresence(activePanel === 'library');
  const profile = useOwnerSystemWorkflowPanelPresence(activePanel === 'profile');
  const settings = useOwnerSystemWorkflowPanelPresence(activePanel === 'settings');
  const presence = useMemo(() => ({ activity, discover, docs, grids, library, profile, settings }), [activity, discover, docs, grids, library, profile, settings]);

  const closePanel = useCallback(({ returnFocus = true } = {}) => {
    clearOwnerSystemWorkflowDocumentSelection();
    setActivePanel((current) => {
      if (returnFocus && current) pendingFocus.current = triggers.current.get(current) || null;
      return null;
    });
  }, []);
  const openPanel = useCallback((panelId, trigger = null) => {
    if (blocked || !OWNER_SYSTEM_WORKFLOW_PANEL_IDS.includes(panelId)) return;
    if (trigger) triggers.current.set(panelId, trigger);
    pendingFocus.current = null;
    setActivePanel(panelId);
  }, [blocked]);
  const togglePanel = useCallback((panelId, trigger = null) => {
    if (activePanel === panelId) closePanel();
    else openPanel(panelId, trigger);
  }, [activePanel, closePanel, openPanel]);

  useEffect(() => {
    if (Object.values(presence).some(({ present }) => present)) return;
    const node = pendingFocus.current;
    pendingFocus.current = null;
    if (node?.isConnected) requestAnimationFrame(() => node.isConnected && node.focus({ preventScroll: true }));
  }, [presence]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || blocked || !activePanel || event.defaultPrevented || event.target?.closest?.('[role="listbox"], select')) return;
      event.preventDefault();
      closePanel();
    };
    const onPointerDown = (event) => {
      if (blocked || !activePanel || event.defaultPrevented || event.target?.closest?.('[data-system-workflow-panel], [data-system-workflow-panel-trigger], [data-system-workflow-overlay]')) return;
      closePanel();
    };
    globalThis.addEventListener?.('keydown', onKeyDown);
    globalThis.addEventListener?.('pointerdown', onPointerDown);
    return () => { globalThis.removeEventListener?.('keydown', onKeyDown); globalThis.removeEventListener?.('pointerdown', onPointerDown); };
  }, [activePanel, blocked, closePanel]);

  const completePanelTransition = useCallback((panelId) => presence[panelId]?.completeTransition(), [presence]);
  return { activePanel, closePanel, completePanelTransition, openPanel, presence, togglePanel };
}
