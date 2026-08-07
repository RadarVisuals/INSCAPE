import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  GRID_WALKER,
  GRID_WALKER_TUNING,
  clampPoint,
  createGridWalker,
  drawGridWalker,
  moveGridWalkerTarget,
  retuneGridWalker,
  updateGridWalker,
} from './gridWalkerMotion.js';
import './gridWalkerCanvas.css';

const PRODUCTION_TUNING = Object.freeze({ ...GRID_WALKER_TUNING, size: 0.55 });

function positiveStyle(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function finiteStyle(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readVisibleGrid(width, height, atmosphere) {
  if (atmosphere) {
    const style = getComputedStyle(atmosphere);
    const rectangle = atmosphere.getBoundingClientRect();
    const cellSize = positiveStyle(style.backgroundSize, width / 32);
    return {
      cellSize,
      originX: rectangle.left + finiteStyle(style.backgroundPositionX, 0),
      originY: rectangle.top + finiteStyle(style.backgroundPositionY, 0),
      ink: style.getPropertyValue('--lattice-overlay-ink').trim() || '#f3f1e9',
      surface: style.backgroundColor || '#050606',
    };
  }
  const cellSize = width / 32;
  return { cellSize, originX: 0, originY: (height - (cellSize * 18)) / 2, ink: '#f3f1e9', surface: '#050606' };
}

const GridWalkerCanvas = forwardRef(function GridWalkerCanvas({ actorVisible = true, reducedMotion = false, onReady }, ref) {
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);
  const actorVisibleRef = useRef(actorVisible);
  const reducedMotionRef = useRef(reducedMotion);
  actorVisibleRef.current = actorVisible;
  reducedMotionRef.current = reducedMotion;

  useImperativeHandle(ref, () => ({
    startResidentHandoff(bounds, options = {}) { return runtimeRef.current?.dock(bounds, options); },
    updateResidentHandoffBounds(bounds) { runtimeRef.current?.updateDockBounds(bounds); },
    exitResidentHandoff(bounds, options = {}) { return runtimeRef.current?.release(bounds, options); },
    cancelResidentHandoff() { runtimeRef.current?.cancelDock(); },
    setActorScreenPositionTarget(target) { runtimeRef.current?.setPositionTargets(target); },
    moveActorToScreenPosition(clientX, clientY, options = {}) { runtimeRef.current?.move(clientX, clientY, options); },
    moveActorHorizontallyToScreenPosition(clientX) { runtimeRef.current?.moveHorizontal(clientX); },
    acknowledgeUserGesture() {},
    getKeeperReactionAvailability() { return runtimeRef.current?.availability() || { ready: false }; },
    triggerKeeperReaction() { return runtimeRef.current?.react() || false; },
    setStageVisible() {},
    setAutonomy(enabled) { runtimeRef.current?.setAutonomy(enabled); },
    getAutonomy() { return runtimeRef.current?.getAutonomy() ?? true; },
    setTuning(next) { runtimeRef.current?.setTuning(next); },
    getTuning() { return runtimeRef.current?.getTuning() || { ...PRODUCTION_TUNING }; },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;
    let frame = 0;
    let width = Math.max(1, window.innerWidth);
    let height = Math.max(1, window.innerHeight);
    let lastFrame = performance.now();
    let nextAutonomousMove = lastFrame + 5200;
    let documentVisible = document.visibilityState !== 'hidden';
    let autonomy = true;
    let dock = null;
    let positionTargets = [];
    let reactionStarted = 0;
    let gridAtmosphere = null;
    let gridDirty = true;
    let gridCache = readVisibleGrid(width, height, null);
    const gridObservers = [];
    const tuning = { ...PRODUCTION_TUNING };
    let walker = createGridWalker({ x: width * 0.5, y: height * 0.52 }, tuning);

    const disconnectGridObservers = () => {
      while (gridObservers.length) gridObservers.pop().disconnect();
    };

    const observeGridNode = (node, attributeFilter) => {
      if (!node) return;
      const observer = new MutationObserver(() => { gridDirty = true; });
      observer.observe(node, { attributes: true, attributeFilter });
      gridObservers.push(observer);
    };

    const bindVisibleGrid = () => {
      const nextAtmosphere = document.querySelector('.owner-lattice-atmosphere, .visitor-lattice-world__atmosphere');
      if (nextAtmosphere === gridAtmosphere && nextAtmosphere?.isConnected !== false) return;
      disconnectGridObservers();
      gridAtmosphere = nextAtmosphere;
      gridDirty = true;
      if (!gridAtmosphere) return;
      observeGridNode(gridAtmosphere, ['class', 'style']);
      observeGridNode(gridAtmosphere.parentElement, ['class', 'style']);
      observeGridNode(
        gridAtmosphere.closest('.owner-lattice-spatial-surface, .visitor-lattice-world'),
        ['class', 'data-grid-style', 'data-surface', 'style'],
      );
    };

    const publishPosition = () => {
      for (const target of positionTargets) {
        if (!target?.style) continue;
        target.style.setProperty('--actor-screen-x', `${walker.center.x.toFixed(1)}px`);
        target.style.setProperty('--actor-screen-y', `${walker.center.y.toFixed(1)}px`);
        target.style.setProperty('--actor-void-radius', actorVisibleRef.current ? '52px' : '0px');
        target.style.setProperty('--actor-void-falloff', actorVisibleRef.current ? '18px' : '0px');
      }
    };

    const resize = () => {
      const rectangle = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, rectangle.width);
      const nextHeight = Math.max(1, rectangle.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(nextWidth * ratio);
      canvas.height = Math.round(nextHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      walker.center = clampPoint({
        x: walker.center.x * (nextWidth / width),
        y: walker.center.y * (nextHeight / height),
      }, nextWidth, nextHeight);
      walker.target = clampPoint(walker.target, nextWidth, nextHeight);
      width = nextWidth;
      height = nextHeight;
      gridDirty = true;
    };

    const dockPoint = (bounds) => bounds ? {
      x: bounds.left + (bounds.width * 0.5),
      y: bounds.top + (bounds.height * 0.5),
    } : null;

    const runtime = {
      move(clientX, clientY, options = {}) {
        if (dock) return false;
        moveGridWalkerTarget(walker, { x: clientX, y: clientY }, width, height);
        nextAutonomousMove = performance.now() + (options.continuous ? 2600 : 5200);
        return true;
      },
      moveHorizontal(clientX) { return this.move(clientX, walker.target.y); },
      setPositionTargets(target) { positionTargets = (Array.isArray(target) ? target : [target]).filter(Boolean); },
      setAutonomy(enabled) { autonomy = enabled !== false; nextAutonomousMove = performance.now() + 4200; },
      getAutonomy() { return autonomy; },
      setTuning(next) {
        for (const [key, value] of Object.entries(next || {})) {
          if (key in tuning && Number.isFinite(value)) tuning[key] = value;
        }
        retuneGridWalker(walker, tuning);
      },
      getTuning() { return { ...tuning }; },
      dock(bounds, options = {}) {
        const point = dockPoint(bounds);
        if (!point || dock) return false;
        dock = { phase: 'approaching', bounds, point, options, startedAt: performance.now(), vacuum: 0 };
        moveGridWalkerTarget(walker, point, width, height);
        return true;
      },
      updateDockBounds(bounds) {
        if (!dock || !bounds) return;
        dock.bounds = bounds;
        dock.point = dockPoint(bounds);
        if (dock.phase === 'approaching') moveGridWalkerTarget(walker, dock.point, width, height);
      },
      release(bounds, options = {}) {
        if (!dock || dock.phase !== 'docked') return false;
        dock.bounds = bounds || dock.bounds;
        dock.point = dockPoint(dock.bounds) || dock.point;
        dock.phase = 'releasing';
        dock.startedAt = performance.now();
        dock.options = options;
        walker.center = { ...dock.point };
        walker.target = { ...dock.point };
        walker.velocity = { x: 0, y: 0 };
        retuneGridWalker(walker, tuning);
        return true;
      },
      cancelDock() { dock = null; retuneGridWalker(walker, tuning); },
      availability() { return { ready: true, residentHandoff: Boolean(dock), actorMoving: walker.activity > 3 }; },
      react() { reactionStarted = performance.now(); return true; },
    };
    runtimeRef.current = runtime;

    const render = (now) => {
      if (!documentVisible) return;
      const delta = Math.min((now - lastFrame) / 1000, GRID_WALKER.maxDelta);
      lastFrame = now;
      bindVisibleGrid();
      if (gridDirty) {
        gridCache = readVisibleGrid(width, height, gridAtmosphere);
        gridDirty = false;
      }
      const grid = gridCache;
      tuning.gridSize = grid.cellSize;
      tuning.gridOriginX = grid.originX;
      tuning.gridOriginY = grid.originY;
      tuning.ink = grid.ink;
      tuning.surface = grid.surface;

      if (!dock && autonomy && now >= nextAutonomousMove) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.min(width, height) * (0.12 + Math.random() * 0.2);
        moveGridWalkerTarget(walker, {
          x: walker.center.x + (Math.cos(angle) * radius),
          y: walker.center.y + (Math.sin(angle) * radius),
        }, width, height);
        nextAutonomousMove = now + 5200 + (Math.random() * 4800);
      }

      if (dock?.phase === 'approaching') {
        moveGridWalkerTarget(walker, dock.point, width, height);
        updateGridWalker(walker, delta, now / 1000, reducedMotionRef.current, tuning);
        if (Math.hypot(walker.center.x - dock.point.x, walker.center.y - dock.point.y) < 7 && walker.activity < 48) {
          dock.phase = 'absorbing';
          dock.startedAt = now;
          dock.options.onEntering?.();
        }
      } else if (!dock) {
        updateGridWalker(walker, delta, now / 1000, reducedMotionRef.current, tuning);
      }

      if (dock?.phase === 'absorbing') {
        const raw = reducedMotionRef.current ? 1 : Math.min(1, (now - dock.startedAt) / 1080);
        dock.vacuum = 1 - Math.pow(1 - raw, 3);
        if (raw >= 1) {
          dock.phase = 'docked';
          dock.vacuum = 1;
          dock.options.onEntered?.();
        }
      } else if (dock?.phase === 'releasing') {
        const raw = reducedMotionRef.current ? 1 : Math.min(1, (now - dock.startedAt) / 1180);
        dock.vacuum = Math.pow(1 - raw, 3);
        if (raw >= 1) {
          const point = clampPoint({
            x: dock.point.x - Math.min(240, width * 0.3),
            y: dock.point.y - Math.min(170, height * 0.26),
          }, width, height);
          const complete = dock.options.onComplete;
          dock = null;
          moveGridWalkerTarget(walker, point, width, height);
          nextAutonomousMove = now + 5600;
          complete?.();
        }
      }

      context.clearRect(0, 0, width, height);
      const vacuum = dock?.vacuum || 0;
      if (actorVisibleRef.current && vacuum < 1) {
        if (dock?.point && vacuum > 0) {
          context.save();
          context.translate(dock.point.x, dock.point.y);
          context.rotate(vacuum * Math.PI * 1.35);
          const scale = Math.max(0.018, 1 - vacuum);
          context.scale(scale, scale);
          context.translate(-dock.point.x, -dock.point.y);
          context.globalAlpha = Math.max(0.05, 1 - (vacuum * 0.88));
          drawGridWalker(context, walker, now / 1000, tuning);
          context.restore();
        } else {
          drawGridWalker(context, walker, now / 1000, tuning);
        }
      }
      if (actorVisibleRef.current && now - reactionStarted < 900) {
        const progress = (now - reactionStarted) / 900;
        context.strokeStyle = `rgba(245,243,235,${0.42 * (1 - progress)})`;
        context.beginPath();
        context.arc(walker.center.x, walker.center.y, 14 + (progress * 34), 0, Math.PI * 2);
        context.stroke();
      }
      publishPosition();
      frame = window.requestAnimationFrame(render);
    };

    const visibility = () => {
      documentVisible = document.visibilityState !== 'hidden';
      if (documentVisible) { lastFrame = performance.now(); gridDirty = true; frame = window.requestAnimationFrame(render); }
      else window.cancelAnimationFrame(frame);
    };
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    frame = window.requestAnimationFrame(render);
    onReady?.();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      disconnectGridObservers();
      for (const target of positionTargets) {
        target?.style?.removeProperty('--actor-screen-x');
        target?.style?.removeProperty('--actor-screen-y');
        target?.style?.removeProperty('--actor-void-radius');
        target?.style?.removeProperty('--actor-void-falloff');
      }
      runtimeRef.current = null;
    };
  }, [onReady]);

  return <canvas ref={canvasRef} className="grid-walker-canvas" aria-hidden="true" />;
});

export default GridWalkerCanvas;
