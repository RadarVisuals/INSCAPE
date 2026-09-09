import { useEffect, useState } from 'react';

export const OWNER_SHELL_SYSTEM_PANEL_IDS = Object.freeze([
  'activity',
  'activity-history',
  'discover',
  'library',
  'profile',
  'settings',
  'tables',
]);

const PANEL_EXIT_MS = 140;
const DISCOVER_EXIT_MS = 200;

function usePanelPresence(open, exitMs = PANEL_EXIT_MS, entranceFrames = 1) {
  const [present, setPresent] = useState(open);
  const [phase, setPhase] = useState(open ? 'open' : 'closed');

  useEffect(() => {
    let frame;
    let settleFrame;
    let timer;
    if (open) {
      setPresent(true);
      setPhase('entering');
      frame = requestAnimationFrame(() => {
        if (entranceFrames > 1) settleFrame = requestAnimationFrame(() => setPhase('open'));
        else setPhase('open');
      });
    } else if (present) {
      setPhase('closing');
      const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      timer = setTimeout(() => setPresent(false), reducedMotion ? 0 : exitMs);
    } else {
      setPhase('closed');
    }
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      clearTimeout(timer);
    };
  }, [entranceFrames, exitMs, open, present]);

  return { phase, present };
}

export default function useOwnerShellSystemPanels({ blocked = false, cancelBeforeClose }) {
  const [activePanel, setActivePanel] = useState(null);
  const isOpen = (panelId) => activePanel === panelId;
  const activity = usePanelPresence(isOpen('activity'));
  const activityHistory = usePanelPresence(isOpen('activity-history'));
  const discover = usePanelPresence(isOpen('discover'), DISCOVER_EXIT_MS, 2);
  const library = usePanelPresence(isOpen('library'));
  const profile = usePanelPresence(isOpen('profile'));
  const settings = usePanelPresence(isOpen('settings'));
  const tables = usePanelPresence(isOpen('tables'));
  const close = () => setActivePanel(null);
  const open = (panelId) => {
    if (!OWNER_SHELL_SYSTEM_PANEL_IDS.includes(panelId)) return;
    setActivePanel(panelId);
  };
  const toggle = (panelId) => {
    if (!OWNER_SHELL_SYSTEM_PANEL_IDS.includes(panelId)) return;
    setActivePanel((current) => current === panelId ? null : panelId);
  };

  useEffect(() => {
    if (!activePanel || blocked) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || document.querySelector('.owner-shell-system__select-popover')) return;
      if (cancelBeforeClose?.()) {
        event.stopPropagation();
        return;
      }
      close();
    };
    globalThis.addEventListener('keydown', closeOnEscape, true);
    return () => globalThis.removeEventListener('keydown', closeOnEscape, true);
  }, [activePanel, blocked, cancelBeforeClose]);

  return {
    activePanel,
    activityExpanded: isOpen('activity') || isOpen('activity-history'),
    close,
    isOpen,
    open,
    presence: { activity, activityHistory, discover, library, profile, settings, tables },
    toggle,
  };
}
