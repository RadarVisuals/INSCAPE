import { useEffect, useRef, useState } from 'react';
import {
  GRID_WALKER,
  GRID_WALKER_RANGES,
  GRID_WALKER_TUNING,
  clampPoint,
  createGridWalker,
  drawGridWalker,
  moveGridWalkerTarget,
  retuneGridWalker,
  updateGridWalker,
} from '../../components/Canvas/gridWalkerMotion.js';
import './gridWalkerPrototype.css';

const MESSAGES = Object.freeze([
  { label: 'COORDINATES', text: 'I will meet you there.' },
  { label: 'GRID', text: 'A new point has my attention.' },
  { label: 'PATH', text: 'There is a route through this.' },
  { label: 'RESIDENT', text: 'Still here. Still looking.' },
]);

function TuningControl({ label, name, value, suffix = '', onChange }) {
  const range = GRID_WALKER_RANGES[name];
  return <label className="grid-walker-prototype__range">
    <span>{label}</span>
    <input type="range" min={range.min} max={range.max} step={range.step} value={value} onChange={(event) => onChange(name, Number(event.target.value))} />
    <output>{value}{suffix}</output>
  </label>;
}

export default function GridWalkerPrototype() {
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const dockRef = useRef(null);
  const dockCommandRef = useRef({ id: 0, type: null });
  const dockPhaseRef = useRef('free');
  const bubbleTimerRef = useRef(null);
  const messageIndexRef = useRef(0);
  const [message, setMessage] = useState({ label: 'RESIDENT ONLINE', text: 'The grid is listening.' });
  const [autonomy, setAutonomy] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [dockPhase, setDockPhase] = useState('free');
  const [tuning, setTuning] = useState(() => ({ ...GRID_WALKER_TUNING }));
  const tuningRef = useRef(tuning);
  const tuningVersionRef = useRef(0);
  const autonomyRef = useRef(autonomy);
  autonomyRef.current = autonomy;

  const speak = (next, duration = 3600) => {
    window.clearTimeout(bubbleTimerRef.current);
    setMessage(next);
    bubbleTimerRef.current = window.setTimeout(() => setMessage(null), duration);
  };

  const speakNext = () => {
    const next = MESSAGES[messageIndexRef.current % MESSAGES.length];
    messageIndexRef.current += 1;
    speak(next);
  };

  const changeTuning = (name, value) => {
    setTuning((current) => ({ ...current, [name]: value }));
  };

  const toggleDock = () => {
    const phase = dockPhaseRef.current;
    if (phase !== 'free' && phase !== 'docked') return;
    dockCommandRef.current = {
      id: dockCommandRef.current.id + 1,
      type: phase === 'docked' ? 'release' : 'dock',
    };
  };

  useEffect(() => {
    tuningRef.current = tuning;
    tuningVersionRef.current += 1;
  }, [tuning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !root || !context) return undefined;

    let frame = 0;
    let width = 0;
    let height = 0;
    let lastFrame = performance.now();
    let nextIdleMoveAt = lastFrame + 4300;
    let walker = null;
    let appliedTuningVersion = tuningVersionRef.current;
    let lastDockCommand = 0;
    let dockPhaseStarted = 0;
    let dockPoint = null;
    let releasePoint = null;
    let reducedMotion = false;
    let documentVisible = document.visibilityState !== 'hidden';
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(nextWidth * ratio);
      canvas.height = Math.round(nextHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!walker) {
        walker = createGridWalker({ x: nextWidth * 0.5, y: nextHeight * 0.52 }, tuningRef.current);
      } else {
        walker.center.x *= nextWidth / width;
        walker.center.y *= nextHeight / height;
        moveGridWalkerTarget(walker, walker.center, nextWidth, nextHeight);
      }
      width = nextWidth;
      height = nextHeight;
      const dockBounds = dockRef.current?.getBoundingClientRect();
      if (dockBounds) {
        dockPoint = {
          x: dockBounds.left + (dockBounds.width * 0.5),
          y: dockBounds.top + (dockBounds.height * 0.5),
        };
      }
    };

    const pointFromEvent = (event) => {
      const bounds = canvas.getBoundingClientRect();
      return clampPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, width, height);
    };

    const handlePointerDown = (event) => {
      if (!walker || dockPhaseRef.current !== 'free') return;
      moveGridWalkerTarget(walker, pointFromEvent(event), width, height);
      nextIdleMoveAt = performance.now() + 5200;
      speakNext();
    };

    const handleVisibility = () => {
      documentVisible = document.visibilityState !== 'hidden';
      if (documentVisible) {
        lastFrame = performance.now();
        frame = window.requestAnimationFrame(render);
      } else {
        window.cancelAnimationFrame(frame);
      }
    };

    const handleMotion = () => { reducedMotion = motionQuery.matches; };

    const render = (now) => {
      if (!documentVisible || !walker) return;
      const delta = Math.min((now - lastFrame) / 1000, GRID_WALKER.maxDelta);
      lastFrame = now;

      if (appliedTuningVersion !== tuningVersionRef.current) {
        appliedTuningVersion = tuningVersionRef.current;
        retuneGridWalker(walker, tuningRef.current);
      }

      const dockCommand = dockCommandRef.current;
      if (dockCommand.id !== lastDockCommand && dockPoint) {
        lastDockCommand = dockCommand.id;
        if (dockCommand.type === 'dock' && dockPhaseRef.current === 'free') {
          dockPhaseRef.current = 'approaching';
          setDockPhase('approaching');
          moveGridWalkerTarget(walker, dockPoint, width, height);
          speak({ label: 'RETURNING', text: 'Folding into the lattice.' }, 2600);
        } else if (dockCommand.type === 'release' && dockPhaseRef.current === 'docked') {
          dockPhaseStarted = now;
          dockPhaseRef.current = 'releasing';
          setDockPhase('releasing');
          walker.center = { ...dockPoint };
          walker.target = { ...dockPoint };
          walker.velocity = { x: 0, y: 0 };
          retuneGridWalker(walker, tuningRef.current);
          releasePoint = clampPoint({
            x: dockPoint.x - Math.min(240, width * 0.3),
            y: dockPoint.y - Math.min(170, height * 0.26),
          }, width, height);
        }
      }

      if (dockPhaseRef.current === 'free' && autonomyRef.current && now >= nextIdleMoveAt) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.min(width, height) * (0.16 + Math.random() * 0.2);
        moveGridWalkerTarget(walker, {
          x: walker.center.x + Math.cos(angle) * radius,
          y: walker.center.y + Math.sin(angle) * radius,
        }, width, height);
        nextIdleMoveAt = now + 4800 + (Math.random() * 4200);
      }

      if (dockPhaseRef.current === 'approaching' && dockPoint) {
        moveGridWalkerTarget(walker, dockPoint, width, height);
      }

      if (!['docked', 'releasing'].includes(dockPhaseRef.current)) {
        updateGridWalker(walker, delta, now / 1000, reducedMotion, tuningRef.current);
      }

      if (dockPhaseRef.current === 'approaching' && dockPoint) {
        const remaining = Math.hypot(walker.center.x - dockPoint.x, walker.center.y - dockPoint.y);
        if (remaining < 7 && walker.activity < 48) {
          dockPhaseStarted = now;
          dockPhaseRef.current = 'absorbing';
          setDockPhase('absorbing');
        }
      }

      let vacuumAmount = 0;
      if (dockPhaseRef.current === 'absorbing') {
        const raw = reducedMotion ? 1 : Math.min(1, (now - dockPhaseStarted) / 1080);
        vacuumAmount = 1 - Math.pow(1 - raw, 3);
        if (raw >= 1) {
          vacuumAmount = 1;
          dockPhaseRef.current = 'docked';
          setDockPhase('docked');
          setMessage(null);
        }
      } else if (dockPhaseRef.current === 'docked') {
        vacuumAmount = 1;
      } else if (dockPhaseRef.current === 'releasing') {
        const raw = reducedMotion ? 1 : Math.min(1, (now - dockPhaseStarted) / 1180);
        vacuumAmount = Math.pow(1 - raw, 3);
        if (raw >= 1) {
          vacuumAmount = 0;
          dockPhaseRef.current = 'free';
          setDockPhase('free');
          moveGridWalkerTarget(walker, releasePoint || walker.center, width, height);
          nextIdleMoveAt = now + 5600;
          speak({ label: 'RESIDENT', text: 'Back on the grid.' });
        }
      }

      context.clearRect(0, 0, width, height);
      if (vacuumAmount < 1 && dockPoint && vacuumAmount > 0) {
        context.save();
        context.translate(dockPoint.x, dockPoint.y);
        context.rotate(vacuumAmount * Math.PI * 1.35);
        const vacuumScale = Math.max(0.018, 1 - vacuumAmount);
        context.scale(vacuumScale, vacuumScale);
        context.translate(-dockPoint.x, -dockPoint.y);
        context.globalAlpha = Math.max(0.05, 1 - (vacuumAmount * 0.88));
        drawGridWalker(context, walker, now / 1000, tuningRef.current);
        context.restore();
      } else if (vacuumAmount < 1) {
        drawGridWalker(context, walker, now / 1000, tuningRef.current);
      }
      root.style.setProperty('--walker-x', `${walker.center.x}px`);
      root.style.setProperty('--walker-y', `${walker.center.y}px`);
      root.toggleAttribute('data-walker-right', walker.center.x > width * 0.68);
      root.toggleAttribute('data-walker-low', walker.center.y > height * 0.72);
      frame = window.requestAnimationFrame(render);
    };

    handleMotion();
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);
    motionQuery.addEventListener?.('change', handleMotion);
    canvas.addEventListener('pointerdown', handlePointerDown);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(bubbleTimerRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
      motionQuery.removeEventListener?.('change', handleMotion);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return <main ref={rootRef} className="grid-walker-prototype" style={{ '--walker-grid-size': `${tuning.gridSize}px` }}>
    <canvas ref={canvasRef} className="grid-walker-prototype__canvas" aria-label="Interactive INSCAPE grid walker" />
    <header className="grid-walker-prototype__heading">
      <small>INSCAPE / RESIDENT STUDY 01</small>
      <strong>GRID WALKER</strong>
      <span>CLICK ANY GRID REGION</span>
    </header>
    <nav className="grid-walker-prototype__controls" aria-label="Grid walker controls">
      <button type="button" aria-pressed={autonomy} onClick={() => setAutonomy((current) => !current)}>AUTONOMY {autonomy ? 'ON' : 'OFF'}</button>
      <button type="button" onClick={speakNext}>TEST SIGNAL</button>
    </nav>
    <aside className="grid-walker-prototype__dock-wrap" data-phase={dockPhase}>
      <button
        ref={dockRef}
        className="grid-walker-prototype__dock"
        type="button"
        data-phase={dockPhase}
        disabled={!['free', 'docked'].includes(dockPhase)}
        aria-label={dockPhase === 'docked' ? 'Release grid walker' : 'Return grid walker to dock'}
        onClick={toggleDock}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setControlsOpen((current) => !current);
        }}
      >
        <span className="grid-walker-prototype__dock-grid" aria-hidden="true" />
        <span className="grid-walker-prototype__dock-orb" aria-hidden="true" />
        <span className="grid-walker-prototype__dock-core" aria-hidden="true" />
      </button>
      <footer aria-hidden="true"><strong>RESIDENT DOCK</strong><span>{dockPhase.toUpperCase()}</span></footer>
    </aside>
    {controlsOpen && <aside className="grid-walker-prototype__tuning" aria-label="Grid walker tuning parameters">
      <header><strong>WALKER PARAMETERS</strong><span>LIVE</span></header>
      <TuningControl name="size" label="SIZE" value={tuning.size} suffix="×" onChange={changeTuning} />
      <TuningControl name="gridSize" label="GRID" value={tuning.gridSize} suffix="px" onChange={changeTuning} />
      <TuningControl name="legCount" label="LEGS" value={tuning.legCount} onChange={changeTuning} />
      <TuningControl name="legRadius" label="LEG LENGTH" value={tuning.legRadius} suffix="px" onChange={changeTuning} />
      <TuningControl name="maxStretch" label="STRETCH" value={tuning.maxStretch} suffix="px" onChange={changeTuning} />
      <TuningControl name="hingeRadius" label="HINGE" value={tuning.hingeRadius} suffix="px" onChange={changeTuning} />
      <TuningControl name="bodySpeed" label="TRAVEL" value={tuning.bodySpeed} suffix="px/s" onChange={changeTuning} />
      <TuningControl name="stepDuration" label="STEP TIME" value={tuning.stepDuration} suffix="s" onChange={changeTuning} />
      <TuningControl name="stepLift" label="STEP LIFT" value={tuning.stepLift} suffix="px" onChange={changeTuning} />
      <TuningControl name="jointBend" label="JOINT BEND" value={tuning.jointBend} suffix="px" onChange={changeTuning} />
    </aside>}
    {message && <aside className="grid-walker-prototype__speech" role="status" aria-atomic="true">
      <span>{message.label}</span>
      <p>{message.text}</p>
      <button type="button" aria-label="Dismiss resident message" onClick={() => setMessage(null)}>×</button>
    </aside>}
  </main>;
}
