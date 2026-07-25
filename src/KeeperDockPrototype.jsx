import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import ArtCanvas from './components/Canvas/ArtCanvas.jsx';
import './keeperDockPrototype.css';

const KEEPER_ID = 'abyssal_eye';
const PRESENTATION = Object.freeze({ keeperId: KEEPER_ID });

function RangeControl({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return <label className="keeper-dock-study__range">
    <span>{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <output>{value}{suffix}</output>
  </label>;
}

export default function KeeperDockPrototype() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const phaseRef = useRef('free');
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState('free');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [socketOpacity, setSocketOpacity] = useState(26);
  const [keeperScale, setKeeperScale] = useState(0.72);
  const [duration, setDuration] = useState(0.62);
  const [dockSize, setDockSize] = useState(112);
  const resident = phase === 'approaching' || phase === 'locking' || phase === 'docked';

  const setDockPhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const residentHandoff = useMemo(() => ({
    start(bounds, options) {
      return canvasRef.current?.startResidentHandoff(bounds, options);
    },
    updateBounds(bounds) {
      return canvasRef.current?.updateResidentHandoffBounds(bounds);
    },
    exit(bounds, options) {
      return canvasRef.current?.exitResidentHandoff(bounds, options);
    },
    cancel() {
      canvasRef.current?.cancelResidentHandoff();
    }
  }), []);

  const dockKeeper = useCallback(() => {
    if (!ready || phaseRef.current !== 'free') return;
    const bounds = socketRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setDockPhase('approaching');
    residentHandoff.start(bounds, {
      targetMode: 'center',
      keepVisible: true,
      residentScale: keeperScale,
      residentFacing: -1,
      duration,
      onEntering: () => setDockPhase('locking'),
      onEntered: () => setDockPhase('docked')
    });
  }, [duration, keeperScale, ready, residentHandoff, setDockPhase]);

  const releaseKeeper = useCallback((onReleased) => {
    if (!resident || phaseRef.current === 'releasing') return;
    const bounds = socketRef.current?.getBoundingClientRect();
    setDockPhase('releasing');
    residentHandoff.exit(bounds, {
      duration,
      onComplete: () => {
        setDockPhase('free');
        onReleased?.();
      }
    });
  }, [duration, resident, residentHandoff, setDockPhase]);

  const toggleResident = useCallback(() => {
    if (phaseRef.current === 'free') {
      dockKeeper();
      return;
    }
    if (resident) releaseKeeper();
  }, [dockKeeper, releaseKeeper, resident]);

  useEffect(() => () => residentHandoff.cancel(), [residentHandoff]);

  useEffect(() => {
    const updateBounds = () => {
      if (phaseRef.current === 'approaching' || phaseRef.current === 'locking') {
        residentHandoff.updateBounds(socketRef.current?.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [residentHandoff]);

  return <main
    className="keeper-dock-study"
    style={{
      '--keeper-socket-opacity': socketOpacity / 100,
      '--keeper-dock-size': `${dockSize}px`
    }}
    data-phase={phase}
  >
    <div className="keeper-dock-study__ghost" data-phase={phase} aria-hidden="true" />

    <div className="keeper-dock-study__world" aria-hidden="true">
      <ArtCanvas
        ref={canvasRef}
        actorVisible
        stageVisible={false}
        foregroundOnly
        presentationOverride={PRESENTATION}
        onReady={() => setReady(true)}
      />
    </div>

    <header className="keeper-dock-study__heading">
      <small>INSCAPE / KEEPER SYSTEM STUDY</small>
      <h1>RESIDENT SOCKET</h1>
      <p>Click the grid to move the Keeper. Recall it into the silhouette when the dock is ready.</p>
    </header>

    {resident && <div className="keeper-dock-study__containment-shield" aria-hidden="true" />}

    <aside className="keeper-dock-study__dock" data-resident={resident || undefined}>
      <button
        ref={socketRef}
        className="keeper-dock-study__socket"
        type="button"
        onClick={toggleResident}
        disabled={!ready || phase === 'releasing'}
        aria-label={resident ? 'Release Keeper' : 'Recall Keeper to dock'}
      >
      </button>
      <button
        className="keeper-dock-study__satellite keeper-dock-study__satellite--options"
        type="button"
        aria-label="Toggle Keeper Dock options"
        aria-expanded={optionsOpen}
        onClick={() => setOptionsOpen((value) => !value)}
      ><MoreHorizontal aria-hidden="true" /></button>
    </aside>

    {optionsOpen && <section className="keeper-dock-study__controls" aria-label="Keeper Dock prototype controls">
      <header><strong>SOCKET PARAMETERS</strong><span>{ready ? 'ENGINE READY' : 'INITIALIZING'}</span></header>
      <RangeControl label="DOCK SIZE" value={dockSize} min={72} max={180} suffix="px" onChange={setDockSize} />
      <RangeControl label="GHOST" value={socketOpacity} min={2} max={40} suffix="%" onChange={setSocketOpacity} />
      <RangeControl label="KEEPER SCALE" value={keeperScale} min={0.4} max={1} step={0.02} onChange={setKeeperScale} />
      <RangeControl label="TRAVEL" value={duration} min={0.2} max={1.2} step={0.02} suffix="s" onChange={setDuration} />
      <p>Click the central socket to recall or release. A docked Keeper ignores movement commands from the canvas.</p>
    </section>}

    <footer className="keeper-dock-study__status">
      <span>ABYSSAL EYE</span>
      <span>{phase.toUpperCase()}</span>
      <span>{resident ? 'CONTAINED' : 'FREE'}</span>
    </footer>
  </main>;
}
