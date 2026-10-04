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
  // Library is the asset source while Grids chooses its destination. Only this
  // pair may coexist; every other dock surface keeps its exclusive behavior.
  const [openPanels, setOpenPanels] = useState([]);
  const activePanel = openPanels.at(-1) || null;
  const isPanelOpen = useCallback(panelId => openPanels.includes(panelId), [openPanels]);
  const triggers = useRef(new Map());
  const pendingFocus = useRef(null);
  const activity = useOwnerSystemWorkflowPanelPresence(activePanel === 'activity');
  const discover = useOwnerSystemWorkflowPanelPresence(activePanel === 'discover', { exitMs: 200 });
  const docs = useOwnerSystemWorkflowPanelPresence(activePanel === 'docs');
  const grids = useOwnerSystemWorkflowPanelPresence(activePanel === 'grids');
  const library = useOwnerSystemWorkflowPanelPresence(isPanelOpen('library'));
  const profile = useOwnerSystemWorkflowPanelPresence(activePanel === 'profile');
  const settings = useOwnerSystemWorkflowPanelPresence(activePanel === 'settings');
  const presence = useMemo(() => ({ activity, discover, docs, grids, library, profile, settings }), [activity, discover, docs, grids, library, profile, settings]);

  const closePanel = useCallback(({ panelId = null, returnFocus = true } = {}) => {
    clearOwnerSystemWorkflowDocumentSelection();
    setOpenPanels((current) => {
      const closing = panelId || current.at(-1);
      if (!current.includes(closing)) return current;
      pendingFocus.current = returnFocus ? { id: closing, node: triggers.current.get(closing) } : null;
      return panelId ? current.filter(id => id !== panelId) : [];
    });
  }, []);
  const openPanel = useCallback((panelId, trigger = null) => {
    if (blocked || !OWNER_SYSTEM_WORKFLOW_PANEL_IDS.includes(panelId)) return;
    if (trigger) triggers.current.set(panelId, trigger);
    pendingFocus.current = null;
    setOpenPanels(current => (panelId === 'grids' && current.includes('library')
      || panelId === 'library' && current.includes('grids')) ? ['library', 'grids'] : [panelId]);
  }, [blocked]);
  const togglePanel = useCallback((panelId, trigger = null) => {
    if (isPanelOpen(panelId)) closePanel({ panelId });
    else openPanel(panelId, trigger);
  }, [isPanelOpen, closePanel, openPanel]);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || presence[pending.id]?.present) return;
    const node = pending.node;
    pendingFocus.current = null;
    if (node?.isConnected) requestAnimationFrame(() => node.isConnected && node.focus({ preventScroll: true }));
  }, [presence]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || blocked || !activePanel || event.defaultPrevented || event.target?.closest?.('[role="listbox"]:not(.system-workflow__grid-list), select')) return;
      event.preventDefault();
      closePanel({ panelId: activePanel });
    };
    const onPointerDown = (event) => {
      if (blocked || !activePanel || activePanel === 'library' || event.defaultPrevented || event.target?.closest?.('[data-system-workflow-panel-trigger], [data-system-workflow-overlay]')) return;
      if (activePanel === 'grids' && isPanelOpen('library')) return;
      if (event.target?.closest?.('[data-system-workflow-panel]')) return;
      closePanel({ panelId: activePanel });
    };
    globalThis.addEventListener?.('keydown', onKeyDown);
    globalThis.addEventListener?.('pointerdown', onPointerDown, true);
    return () => { globalThis.removeEventListener?.('keydown', onKeyDown); globalThis.removeEventListener?.('pointerdown', onPointerDown, true); };
  }, [activePanel, blocked, closePanel, isPanelOpen]);

  const completePanelTransition = useCallback((panelId) => presence[panelId]?.completeTransition(), [presence]);
  return { activePanel, isPanelOpen, openPanels, closePanel, completePanelTransition, openPanel, presence, togglePanel };
}
