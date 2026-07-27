import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANONICAL_LATTICE_ARTBOARD,
  FRAME_IDS,
  LATTICE_COORDINATES,
  TABLE_LABEL_ANCHORS,
  TABLE_VISIBILITY,
  TRANSPARENCY_MODES,
  latticeTableId,
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
import LatticeTableRenderer from './lattice/rendering/LatticeTableRenderer.jsx';
import LatticeGridPlane from './lattice/rendering/LatticeGridPlane.jsx';
import {
  LATTICE_GEOMETRY_PRESETS,
  LATTICE_SURFACES,
  PROTOTYPE_START_GEOMETRY,
} from './lattice/rendering/latticeGeometry.js';
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

const FIXTURE_ASSET_IDS = Object.freeze({
  landscape: '42:0x1111111111111111111111111111111111111111:0x01',
  portrait: '42:0x2222222222222222222222222222222222222222:0x02',
  transparent: '42:0x3333333333333333333333333333333333333333:0x03',
});

const FIXTURE_MEDIA = Object.freeze({
  [FIXTURE_ASSET_IDS.landscape]: Object.freeze({
    src: '/assets/stage/backdrops/backdrop_moonpurple.webp',
    width: 4636,
    height: 2000,
    accessibleLabel: 'Landscape rendering fixture',
  }),
  [FIXTURE_ASSET_IDS.portrait]: Object.freeze({
    src: '/assets/ratio/3.webp',
    width: 2000,
    height: 2829,
    accessibleLabel: 'Portrait rendering fixture',
  }),
  [FIXTURE_ASSET_IDS.transparent]: Object.freeze({
    src: '/assets/actors/abyssal_eye/full.webp',
    width: 2000,
    height: 2000,
    accessibleLabel: 'Transparent rendering fixture',
  }),
});

function createFixturePlacements(transparencyMode, layersSwapped) {
  const common = {
    crop: null,
    frameId: FRAME_IDS.NONE,
    visitorVisible: true,
  };
  return [
    {
      ...common,
      id: 'phase-2-landscape',
      stableAssetId: FIXTURE_ASSET_IDS.landscape,
      x: 0.46, y: 0.13, width: 0.4, height: 0.4 * (16 / 9) * (2000 / 4636),
      layer: 0,
      navigationOrder: 2,
      transparencyMode: TRANSPARENCY_MODES.AUTO,
    },
    {
      ...common,
      id: 'phase-2-portrait',
      stableAssetId: FIXTURE_ASSET_IDS.portrait,
      x: 0.14, y: 0.16, width: 0.22, height: 0.22 * (16 / 9) * (2829 / 2000),
      layer: layersSwapped ? 2 : 1,
      navigationOrder: 0,
      transparencyMode: TRANSPARENCY_MODES.PRESERVE_ALPHA,
    },
    {
      ...common,
      id: 'phase-2-transparent',
      stableAssetId: FIXTURE_ASSET_IDS.transparent,
      x: 0.35, y: 0.42, width: 0.27, height: 0.27 * (16 / 9),
      layer: layersSwapped ? 1 : 2,
      navigationOrder: 1,
      transparencyMode,
    },
  ];
}

const createDefaultRenderPreview = () => ({
  geometry: { ...PROTOTYPE_START_GEOMETRY },
  surfaceId: LATTICE_SURFACES[0].id,
  title: '',
  subtitle: '',
  labelVisible: true,
  labelAnchor: 'top-left',
  labelOffset: { column: 0, row: 0 },
  transparencyMode: TRANSPARENCY_MODES.AUTO,
  layersSwapped: false,
});

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
  const [renderPreview, setRenderPreview] = useState(createDefaultRenderPreview);
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
        <LatticeGridPlane
          artboard={CANONICAL_LATTICE_ARTBOARD}
          className={`lattice-engine-stage${snapping ? ' is-snapping' : ''}`}
          geometry={renderPreview.geometry}
          stageOrigin={{ x: dimensions.width, y: dimensions.height }}
          style={{
            width: dimensions.width * 3,
            height: dimensions.height * 3,
            transform: `translate3d(${stageX}px, ${stageY}px, 0)`,
            '--lattice-snap-duration': `${snapDuration}ms`,
            '--lattice-cell-width': `${dimensions.width}px`,
            '--lattice-cell-height': `${dimensions.height}px`,
          }}
          surfaceId={renderPreview.surfaceId}
          viewport={dimensions}
        >
          {LATTICE_COORDINATES.map((coordinate) => {
            const isActive = coordinate.x === active.x && coordinate.y === active.y;
            const isAuthoredTable = coordinate.x === 0 && coordinate.y === 0;
            const table = {
              id: latticeTableId(coordinate),
              coordinate,
              title: isAuthoredTable ? renderPreview.title : '',
              subtitle: isAuthoredTable ? renderPreview.subtitle : '',
              labelVisible: isAuthoredTable ? renderPreview.labelVisible : true,
              labelAnchor: isAuthoredTable ? renderPreview.labelAnchor : 'top-left',
              labelOffset: isAuthoredTable ? renderPreview.labelOffset : { column: 0, row: 0 },
              visibility: TABLE_VISIBILITY.PUBLIC,
              placements: isAuthoredTable
                ? createFixturePlacements(
                    renderPreview.transparencyMode,
                    renderPreview.layersSwapped,
                  )
                : [],
            };
            return (
              <LatticeTableRenderer
                active={isActive}
                artboard={CANONICAL_LATTICE_ARTBOARD}
                assetsByStableId={FIXTURE_MEDIA}
                geometry={renderPreview.geometry}
                hidden={!isActive}
                key={`${coordinate.x}:${coordinate.y}`}
                positionStyle={{
                  left: (coordinate.x + 1) * dimensions.width,
                  top: (coordinate.y + 1) * dimensions.height,
                  width: dimensions.width,
                  height: dimensions.height,
                }}
                table={table}
                viewport={dimensions}
              />
            );
          })}
        </LatticeGridPlane>
      </section>

      <aside className="lattice-engine-readout" data-lattice-chrome>
        <p>LATTICE RENDERER / FREE-ARTBOARD FOUNDATION</p>
        <p>ACTIVE {active.x}:{active.y} / {latticeTableFallbackTitle(active)}</p>
        <p>GRID {renderPreview.geometry.columns} × {renderPreview.geometry.rows} / {renderPreview.surfaceId.toUpperCase()}</p>
        <p>{snapping ? 'SETTLING' : gestureActive ? 'DIRECT MANIPULATION' : 'READY'}</p>
      </aside>

      <details className="lattice-engine-controls" data-lattice-chrome>
        <summary>ENGINE / DEV</summary>
        <div className="lattice-engine-control-list">
          <fieldset>
            <legend>RENDER</legend>
            <label><span>Geometry</span><select value={LATTICE_GEOMETRY_PRESETS.find(({ geometry }) => geometry.columns === renderPreview.geometry.columns && geometry.rows === renderPreview.geometry.rows)?.id || 'custom'} onChange={(event) => {
              const preset = LATTICE_GEOMETRY_PRESETS.find(({ id }) => id === event.target.value);
              if (preset) setRenderPreview((current) => ({ ...current, geometry: { ...preset.geometry } }));
            }}>
              {LATTICE_GEOMETRY_PRESETS.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
              <option value="custom" disabled>CUSTOM</option>
            </select></label>
            <label><span>Surface</span><select value={renderPreview.surfaceId} onChange={(event) => setRenderPreview((current) => ({ ...current, surfaceId: event.target.value }))}>
              {LATTICE_SURFACES.map((surface) => <option value={surface.id} key={surface.id}>{surface.label}</option>)}
            </select></label>
            <label><span>Transparency</span><select value={renderPreview.transparencyMode} onChange={(event) => setRenderPreview((current) => ({ ...current, transparencyMode: event.target.value }))}>
              {Object.values(TRANSPARENCY_MODES).map((mode) => <option value={mode} key={mode}>{mode}</option>)}
            </select></label>
            <label className="is-check"><span>Swap layers</span><input type="checkbox" checked={renderPreview.layersSwapped} onChange={(event) => setRenderPreview((current) => ({ ...current, layersSwapped: event.target.checked }))} /></label>
            <label className="is-wide"><span>Title</span><input type="text" maxLength="80" placeholder="EMPTY / FALLBACK" value={renderPreview.title} onChange={(event) => setRenderPreview((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="is-wide"><span>Subtitle</span><input type="text" maxLength="120" placeholder="OPTIONAL" value={renderPreview.subtitle} onChange={(event) => setRenderPreview((current) => ({ ...current, subtitle: event.target.value }))} /></label>
            <label><span>Anchor</span><select value={renderPreview.labelAnchor} onChange={(event) => setRenderPreview((current) => ({ ...current, labelAnchor: event.target.value }))}>
              {TABLE_LABEL_ANCHORS.map((anchor) => <option value={anchor} key={anchor}>{anchor.toUpperCase()}</option>)}
            </select></label>
            <label><span>Offset X</span><input type="number" min="-2" max="2" step="1" value={renderPreview.labelOffset.column} onChange={(event) => {
              const column = Math.min(2, Math.max(-2, Number(event.target.value)));
              if (Number.isSafeInteger(column)) setRenderPreview((current) => ({ ...current, labelOffset: { ...current.labelOffset, column } }));
            }} /></label>
            <label><span>Offset Y</span><input type="number" min="-2" max="2" step="1" value={renderPreview.labelOffset.row} onChange={(event) => {
              const row = Math.min(2, Math.max(-2, Number(event.target.value)));
              if (Number.isSafeInteger(row)) setRenderPreview((current) => ({ ...current, labelOffset: { ...current.labelOffset, row } }));
            }} /></label>
            <label className="is-check"><span>Label visible</span><input type="checkbox" checked={renderPreview.labelVisible} onChange={(event) => setRenderPreview((current) => ({ ...current, labelVisible: event.target.checked }))} /></label>
            <button type="button" onClick={() => setRenderPreview(createDefaultRenderPreview())}>RESET RENDER</button>
          </fieldset>
          <fieldset>
            <legend>FEEL</legend>
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
            <button type="button" onClick={() => setConfig({ ...DEFAULT_LATTICE_INTERACTION_CONFIG })}>RESET FEEL</button>
          </fieldset>
        </div>
      </details>
    </main>
  );
}
