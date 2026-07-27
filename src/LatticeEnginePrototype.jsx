import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LATTICE_COORDINATES,
  latticeTableFallbackTitle,
} from './lattice/domain/latticeProfile.js';
import {
  DEFAULT_LATTICE_INTERACTION_CONFIG,
  addWheelDelta,
  createPointerGesture,
  entryLatticeCoordinate,
  finishPointerGesture,
  keyboardDirection,
  latticeDestination,
  resolveWheelDestination,
  updatePointerGesture,
} from './lattice/controller/latticeNavigation.js';
import './latticeEnginePrototype.css';

const CONTROL_FIELDS = [
  ['deadZone', 'Dead zone', 0, 40, 1],
  ['commitThreshold', 'Commit threshold', 20, 240, 1],
  ['diagonalTolerance', 'Diagonal tolerance', 0, 1, 0.01],
  ['edgeResistance', 'Edge resistance', 0, 0.5, 0.01],
  ['wheelAccumulationThreshold', 'Wheel threshold', 20, 240, 1],
  ['wheelCooldown', 'Wheel cooldown', 0, 1500, 10],
  ['snapDuration', 'Snap duration', 0, 1000, 10],
];

const interactiveChrome = (target) => target.closest('[data-lattice-chrome]');

export default function LatticeEnginePrototype() {
  const viewportRef = useRef(null);
  const gestureRef = useRef(null);
  const activeRef = useRef(entryLatticeCoordinate());
  const configRef = useRef({ ...DEFAULT_LATTICE_INTERACTION_CONFIG });
  const snapTimerRef = useRef(null);
  const wheelResetTimerRef = useRef(null);
  const wheelAccumulatorRef = useRef({ x: 0, y: 0 });
  const wheelBlockedUntilRef = useRef(0);
  const settlingRef = useRef(false);

  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState(activeRef.current);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapping, setSnapping] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [config, setConfig] = useState(configRef.current);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const resize = () => setDimensions({
      width: Math.max(1, viewport.clientWidth),
      height: Math.max(1, viewport.clientHeight),
    });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(snapTimerRef.current);
    window.clearTimeout(wheelResetTimerRef.current);
  }, []);

  const settle = useCallback((destination, offset = dragOffset) => {
    if (settlingRef.current) return;
    settlingRef.current = true;
    const duration = reducedMotion ? 0 : configRef.current.snapDuration;
    setDragOffset(offset);
    requestAnimationFrame(() => {
      activeRef.current = destination;
      setSnapping(true);
      setActive(destination);
      setDragOffset({ x: 0, y: 0 });
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = window.setTimeout(() => {
        settlingRef.current = false;
        setSnapping(false);
      }, duration);
    });
  }, [dragOffset, reducedMotion]);

  const finishGesture = useCallback((cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || settlingRef.current) return;
    gestureRef.current = null;
    setGestureActive(false);
    if (!gesture.activated) return;
    const destination = cancelled
      ? { ...activeRef.current }
      : finishPointerGesture(gesture, activeRef.current, configRef.current);
    settle(destination, gesture.offset);
  }, [settle]);

  const handlePointerDown = (event) => {
    if (settlingRef.current || event.button !== 0 || interactiveChrome(event.target)) return;
    gestureRef.current = createPointerGesture({ x: event.clientX, y: event.clientY });
    viewportRef.current?.focus({ preventScroll: true });
  };

  const handlePointerMove = (event) => {
    if (!gestureRef.current || settlingRef.current) return;
    const previousActivated = gestureRef.current.activated;
    const next = updatePointerGesture(
      gestureRef.current,
      { x: event.clientX, y: event.clientY },
      activeRef.current,
      configRef.current,
    );
    gestureRef.current = next;
    if (next.activated && !previousActivated) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setGestureActive(true);
    }
    setDragOffset(next.offset);
  };

  const handlePointerUp = (event) => {
    if (!gestureRef.current) return;
    finishGesture(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (settlingRef.current || gestureRef.current || performance.now() < wheelBlockedUntilRef.current) return;
    wheelAccumulatorRef.current = addWheelDelta(wheelAccumulatorRef.current, {
      x: event.deltaX,
      y: event.deltaY,
    });
    window.clearTimeout(wheelResetTimerRef.current);
    wheelResetTimerRef.current = window.setTimeout(() => {
      wheelAccumulatorRef.current = { x: 0, y: 0 };
    }, configRef.current.wheelCooldown);
    const destination = resolveWheelDestination(
      wheelAccumulatorRef.current,
      activeRef.current,
      configRef.current,
    );
    if (!destination) return;
    wheelAccumulatorRef.current = { x: 0, y: 0 };
    wheelBlockedUntilRef.current = performance.now() + configRef.current.wheelCooldown;
    settle(destination, { x: 0, y: 0 });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && gestureRef.current && !settlingRef.current) {
      event.preventDefault();
      finishGesture(true);
      return;
    }
    if (settlingRef.current || gestureRef.current) return;
    const direction = keyboardDirection(event.key);
    const destination = event.key === 'Home'
      ? entryLatticeCoordinate()
      : direction && latticeDestination(activeRef.current, direction);
    if (!destination) return;
    event.preventDefault();
    settle(destination, { x: 0, y: 0 });
  };

  const stageX = -((active.x + 1) * dimensions.width) + dragOffset.x;
  const stageY = -((active.y + 1) * dimensions.height) + dragOffset.y;
  const snapDuration = reducedMotion ? 0 : config.snapDuration;

  return (
    <main className="lattice-engine-shell">
      <section
        ref={viewportRef}
        className={`lattice-engine-viewport${gestureActive ? ' is-dragging' : ''}`}
        tabIndex={0}
        aria-label="Lattice navigation engine prototype"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => finishGesture(true)}
        onLostPointerCapture={() => finishGesture(true)}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      >
        <div
          className={`lattice-engine-stage${snapping ? ' is-snapping' : ''}`}
          style={{
            width: dimensions.width * 3,
            height: dimensions.height * 3,
            transform: `translate3d(${stageX}px, ${stageY}px, 0)`,
            '--lattice-snap-duration': `${snapDuration}ms`,
            '--lattice-cell-width': `${dimensions.width}px`,
            '--lattice-cell-height': `${dimensions.height}px`,
          }}
        >
          {LATTICE_COORDINATES.map((coordinate) => (
            <article
              className={`lattice-engine-table${coordinate.x === active.x && coordinate.y === active.y ? ' is-active' : ''}`}
              key={`${coordinate.x}:${coordinate.y}`}
              style={{
                left: (coordinate.x + 1) * dimensions.width,
                top: (coordinate.y + 1) * dimensions.height,
                width: dimensions.width,
                height: dimensions.height,
              }}
            >
              <span className="lattice-engine-table-label">
                {latticeTableFallbackTitle(coordinate)}
              </span>
            </article>
          ))}
        </div>
      </section>

      <aside className="lattice-engine-readout" data-lattice-chrome>
        <p>LATTICE ENGINE / SLICE 1B</p>
        <p>ACTIVE {active.x}:{active.y} · {latticeTableFallbackTitle(active)}</p>
        <p>{snapping ? 'SETTLING' : gestureActive ? 'DIRECT MANIPULATION' : 'READY'}</p>
      </aside>

      <details className="lattice-engine-controls" data-lattice-chrome>
        <summary>FEEL / DEV</summary>
        <div className="lattice-engine-control-list">
          {CONTROL_FIELDS.map(([key, label, min, max, step]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={config[key]}
                onChange={(event) => {
                  const nextValue = Math.min(max, Math.max(min, Number(event.target.value)));
                  setConfig((current) => ({ ...current, [key]: Number.isFinite(nextValue) ? nextValue : current[key] }));
                }}
              />
            </label>
          ))}
          <button type="button" onClick={() => setConfig({ ...DEFAULT_LATTICE_INTERACTION_CONFIG })}>
            RESET VALUES
          </button>
        </div>
      </details>
    </main>
  );
}
