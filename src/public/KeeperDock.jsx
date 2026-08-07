import { MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GRID_WALKER_RANGES, GRID_WALKER_TUNING } from '../components/Canvas/gridWalkerMotion.js';
import './menus/rackMenu.css';
import './keeperDock.css';

const RESIDENT_PHASES = new Set(['approaching', 'entering', 'docked']);

function WalkerRange({ label, name, value, onChange }) {
  const range = GRID_WALKER_RANGES[name];
  return <label className="keeper-dock__range">
    <span>{label}</span>
    <input min={range.min} max={range.max} onChange={(event) => onChange(name, Number(event.target.value))}
      step={range.step} type="range" value={value} />
    <output>{value}</output>
  </label>;
}

export default function KeeperDock({
  actorId,
  followCursor = true,
  movementSpeed = 'normal',
  residentHandoff,
  reducedMotion = false,
  residentScale = 0.72,
  spatialTheme = 'dark',
  gridStyle = 'lines',
  onDockStateChange,
  onFollowCursorChange,
  onGridStyleChange,
  onMovementSpeedChange,
}) {
  const dockRef = useRef(null);
  const socketRef = useRef(null);
  const phaseRef = useRef('empty');
  const startedRef = useRef(false);
  const [phase, setPhase] = useState('empty');
  const [menuOpen, setMenuOpen] = useState(false);
  const [autonomy, setAutonomy] = useState(() => residentHandoff?.getAutonomy?.() !== false);
  const [walkerTuning, setWalkerTuning] = useState(() => ({ ...GRID_WALKER_TUNING, size: 0.55 }));
  const resident = RESIDENT_PHASES.has(phase);
  const pointerControlsAvailable = typeof onFollowCursorChange === 'function' || typeof onMovementSpeedChange === 'function';
  const actorLabel = 'grid walker';

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

  const changeWalkerTuning = (name, value) => {
    setWalkerTuning((current) => ({ ...current, [name]: value }));
    residentHandoff?.setTuning?.({ [name]: value });
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event) => {
      if (!dockRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', closeOutside, true);
    window.addEventListener('keydown', closeEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOutside, true);
      window.removeEventListener('keydown', closeEscape);
    };
  }, [menuOpen]);

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
    <aside
      ref={dockRef}
      className="keeper-dock"
      data-phase={phase}
      data-resident={resident || undefined}
      aria-label="Keeper Dock"
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen((open) => !open);
      }}
    >
      <button
        ref={socketRef}
        className="keeper-dock__socket"
        type="button"
        onClick={toggleResident}
        disabled={phase === 'releasing'}
        aria-label={resident ? `Release ${actorLabel} from dock` : `Recall ${actorLabel} to dock`}
      ><span className="keeper-dock__shell" aria-hidden="true" /><span className="keeper-dock__orb" aria-hidden="true" /><span className="keeper-dock__core" aria-hidden="true" /></button>
      <button
        className="keeper-dock__options"
        type="button"
        aria-label="Toggle Keeper options"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      ><MoreHorizontal aria-hidden="true" /></button>
      {menuOpen && <div className="keeper-dock__menu rack-menu-surface" role="menu" aria-label="Resident controls">
        <strong className="rack-menu-faceplate">RESIDENT CONTROLS</strong>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={autonomy}
          className="rack-menu-faceplate"
          data-rack-active={autonomy || undefined}
          onClick={() => {
            const next = !autonomy;
            setAutonomy(next);
            residentHandoff?.setAutonomy?.(next);
          }}
        >Autonomy <span aria-hidden="true">{autonomy ? 'ON' : 'OFF'}</span></button>
        {typeof onGridStyleChange === 'function' && <>
          <small className="rack-menu-faceplate">GRID MARKS</small>
          <div className="keeper-dock__grid-style rack-menu-segments" role="group" aria-label="Grid marks">
            {['lines', 'dots'].map((style) => <button
              aria-pressed={gridStyle === style}
              className="rack-menu-segment"
              data-rack-active={gridStyle === style || undefined}
              key={style}
              onClick={() => onGridStyleChange(style)}
              type="button"
            >{style}</button>)}
          </div>
        </>}
        <small className="rack-menu-faceplate">BODY / LEGS</small>
        <div className="keeper-dock__tuning">
          <WalkerRange label="SIZE" name="size" value={walkerTuning.size} onChange={changeWalkerTuning} />
          <WalkerRange label="LEGS" name="legCount" value={walkerTuning.legCount} onChange={changeWalkerTuning} />
          <WalkerRange label="LENGTH" name="legRadius" value={walkerTuning.legRadius} onChange={changeWalkerTuning} />
          <WalkerRange label="STRETCH" name="maxStretch" value={walkerTuning.maxStretch} onChange={changeWalkerTuning} />
          <WalkerRange label="HINGE" name="hingeRadius" value={walkerTuning.hingeRadius} onChange={changeWalkerTuning} />
          <WalkerRange label="TRAVEL" name="bodySpeed" value={walkerTuning.bodySpeed} onChange={changeWalkerTuning} />
        </div>
        {pointerControlsAvailable ? <>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={followCursor}
            className="rack-menu-faceplate"
            data-rack-active={followCursor || undefined}
            onClick={() => onFollowCursorChange?.(!followCursor)}
          >Follow cursor <span aria-hidden="true">{followCursor ? '✓' : ''}</span></button>
          <small className="rack-menu-faceplate">MOVEMENT SPEED</small>
          <div className="keeper-dock__speed rack-menu-segments" role="group" aria-label="Keeper movement speed">
            {['slow', 'normal', 'fast'].map((speed) => <button
              aria-pressed={movementSpeed === speed}
              className="rack-menu-segment"
              data-rack-active={movementSpeed === speed || undefined}
              key={speed}
              onClick={() => onMovementSpeedChange?.(speed)}
              type="button"
            >{speed}</button>)}
          </div>
        </> : <button className="rack-menu-faceplate" type="button" disabled>Swap Keeper <span>Later</span></button>}
      </div>}
    </aside>
  </>;
}
