import { MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';

const RESIDENT_PHASES = new Set(['approaching', 'entering', 'docked']);

export default function KeeperDock({
  actorId,
  residentHandoff,
  reducedMotion = false,
  residentScale = 0.72,
  spatialTheme = 'dark',
  onDockStateChange,
}) {
  const socketRef = useRef(null);
  const phaseRef = useRef('empty');
  const startedRef = useRef(false);
  const [phase, setPhase] = useState('empty');
  const [menuOpen, setMenuOpen] = useState(false);
  const [underlayRoot, setUnderlayRoot] = useState(null);
  const resident = RESIDENT_PHASES.has(phase);
  const actorLabel = actorId.replaceAll('_', ' ');
  const maskUrl = `/assets/actors/${actorId}/mask.webp`;

  const changePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const dock = useCallback(() => {
    if (phaseRef.current !== 'empty') return;
    const bounds = socketRef.current?.getBoundingClientRect();
    if (!bounds) return;
    startedRef.current = true;
    setMenuOpen(false);
    changePhase('approaching');
    onDockStateChange?.(true);
    residentHandoff?.start?.(bounds, {
      reducedMotion,
      targetMode: 'center',
      keepVisible: true,
      residentScale,
      residentFacing: -1,
      duration: 0.62,
      onEntering: () => changePhase('entering'),
      onEntered: () => changePhase('docked')
    });
  }, [changePhase, onDockStateChange, reducedMotion, residentHandoff, residentScale]);

  const release = useCallback(() => {
    if (!startedRef.current || phaseRef.current === 'releasing') return;
    const bounds = socketRef.current?.getBoundingClientRect();
    setMenuOpen(false);
    changePhase('releasing');
    residentHandoff?.exit?.(bounds, {
      reducedMotion,
      duration: 0.62,
      onComplete: () => {
        startedRef.current = false;
        changePhase('empty');
        onDockStateChange?.(false);
      }
    });
  }, [changePhase, onDockStateChange, reducedMotion, residentHandoff]);

  const toggleResident = useCallback(() => {
    if (phaseRef.current === 'empty') dock();
    else if (RESIDENT_PHASES.has(phaseRef.current)) release();
  }, [dock, release]);

  useEffect(() => {
    setUnderlayRoot(document.getElementById('keeper-dock-underlay'));
  }, []);

  useEffect(() => {
    const resize = () => {
      if (phaseRef.current === 'approaching' || phaseRef.current === 'entering') {
        residentHandoff?.updateBounds?.(socketRef.current?.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (startedRef.current) {
        residentHandoff?.cancel?.();
        onDockStateChange?.(false);
      }
    };
  }, [onDockStateChange, residentHandoff]);

  return <>
    {underlayRoot && createPortal(<div
      className="keeper-dock__ghost"
      data-phase={phase}
      data-spatial-theme={spatialTheme}
      style={{ '--keeper-dock-mask': `url("${maskUrl}")` }}
      aria-hidden="true"
    />, underlayRoot)}
    <aside
      className="keeper-dock"
      data-phase={phase}
      data-resident={resident || undefined}
      style={{ '--keeper-dock-mask': `url("${maskUrl}")` }}
      aria-label="Keeper Dock"
    >
      <button
        ref={socketRef}
        className="keeper-dock__socket"
        type="button"
        onClick={toggleResident}
        disabled={phase === 'releasing'}
        aria-label={resident ? `Release ${actorLabel} from dock` : `Recall ${actorLabel} to dock`}
      />
      <button
        className="keeper-dock__options"
        type="button"
        aria-label="Toggle Keeper options"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      ><MoreHorizontal aria-hidden="true" /></button>
      {menuOpen && <div className="keeper-dock__menu" role="dialog" aria-label="Keeper options">
        <strong>{actorLabel}</strong>
        <button type="button" disabled>Swap Keeper <span>Later</span></button>
      </div>}
    </aside>
  </>;
}
