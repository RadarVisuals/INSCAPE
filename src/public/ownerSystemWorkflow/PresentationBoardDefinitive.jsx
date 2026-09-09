import { cloneElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Info, Layers3, Lock, LockKeyhole, Maximize2, Minimize2, Minus, Play, Pause,
} from 'lucide-react';
import useDisplayImmersive from './useDisplayImmersive.js';
import PresentationBoardShortcut from './PresentationBoardShortcut.jsx';
import { DisplayStageSizeContext } from './DisplayStageSizeContext.js';
import { loadPresentationBoardShortcut } from './presentationBoardShortcutStorage.js';
import LatticePixelGrid from '../../lattice/rendering/LatticePixelGrid.jsx';
import { displayInstrumentLayout } from './displayInstrumentState.js';
import { PRESENTATION_BOARD_INSTANCE_STATE } from './ownerSystemWorkflowModuleState.js';
import { presentationBoardInspectionFrame, presentationBoardResponsiveMetrics, projectPresentationBoardView,
  resizePresentationBoardFromCorner, resizePresentationBoardView, setContinuousPresentationBoardScale } from './presentationBoardGeometry.js';

const corners = ['nw', 'ne', 'sw', 'se'];
const WORKBENCH_CELL = 24;
const sameFrame = (left, right) => left && right
  && ['height', 'left', 'top', 'width'].every((key) => Math.abs(left[key] - right[key]) < 0.01);
function BoardWindowControls({ disabled, maximized, onMaximize, onMinimize, onRestore }) {
  return <span className="system-workflow__board-window-controls">
    <button aria-label="Minimize Display Module to shortcut" className="system-workflow__round-control"
      disabled={disabled} onClick={onMinimize} type="button"><Minus /></button>
    <button aria-label={maximized ? 'Restore Display Module' : 'Maximize Display Module'}
      className="system-workflow__round-control" disabled={disabled}
      onClick={maximized ? onRestore : onMaximize} type="button">
      {maximized ? <Minimize2 /> : <Maximize2 />}
    </button>
  </span>;
}
function BoardWorkspaceControls({ instrumentTriggers, layersOpen, metadataOpen, onToggleLayers, onToggleMetadata, playing, playbackDisabled, onTogglePlayback, readOnly }) {
  return <span className="system-workflow__board-workspace-controls">
    {onTogglePlayback && <button aria-label={playing ? 'Pause Grids' : 'Play Grids'} aria-pressed={playing}
      className="system-workflow__round-control" disabled={playbackDisabled} onClick={onTogglePlayback}
      title={playing ? 'Pause Grids' : 'Play Grids'} type="button">{playing ? <Pause /> : <Play />}</button>}
    {!readOnly && <button aria-label="Layers" aria-pressed={layersOpen} data-instrument-trigger="layers" ref={(node) => { if (instrumentTriggers) instrumentTriggers.current.layers = node; }}
      className="system-workflow__round-control system-workflow__layers-trigger"
      onClick={onToggleLayers} title="Layers and placement tools" type="button"><Layers3 /></button>}
    <button aria-label="Metadata" aria-pressed={metadataOpen} data-instrument-trigger="metadata" ref={(node) => { if (instrumentTriggers) instrumentTriggers.current.metadata = node; }}
      className="system-workflow__round-control" onClick={onToggleMetadata} title="Metadata" type="button"><Info /></button>
  </span>;
}
export default function PresentationBoardDefinitive({ assetsById = new Map(), children, documentGeometry,
  authoringLocked = false, displaySurface, inspectionAtmosphere = false,
  layersOpen = false, metadataOpen = false, instrumentBayOpen = false, layoutMode = 'wide', onAuthoringLockToggle, onContextMenu,
  onInspectionCancel,
  onMinimize, onRestore, onToggleLayers, onToggleMetadata,
  playing = false, playbackDisabled = true, onTogglePlayback,
  instanceState = PRESENTATION_BOARD_INSTANCE_STATE.WINDOW,
  menuSurface = null, profileAddress, reducedMotion = false, renderInspection, renderInstruments,
  shortcutTargetRef, instrumentTriggers, shortcutSnap = true, workbenchGridColor = null, workbenchGridMode = 'LINES', initialPresentation, onWindowChange, onShortcutChange, readOnly = false }) {
  const localShortcutRef = useRef(null);
  const geometryKey = JSON.stringify(documentGeometry);
  const shortcutRef = shortcutTargetRef || localShortcutRef;
  const storedName = useMemo(() => initialPresentation?.name || (readOnly ? null : loadPresentationBoardShortcut(profileAddress)?.name), [profileAddress]);
  const [moduleName, setModuleName] = useState(null);
  const displayName = moduleName?.profile === profileAddress ? moduleName.name
    : storedName && storedName !== 'PRESENTATION BOARD' ? storedName : 'DISPLAY MODULE';
  const [host, setHost] = useState(null);
  const [view, setView] = useState(null);
  const [boardPosition, setBoardPosition] = useState(initialPresentation?.window ? { left: initialPresentation.window.left, top: initialPresentation.window.top } : null);
  const [inspectionHost, setInspectionHost] = useState(null);
  const [inspectionControlsHost, setInspectionControlsHost] = useState(null);
  const [selectionOverlayHost, setSelectionOverlayHost] = useState(null);
  const [boardPhase, setBoardPhase] = useState('window');
  const [immersive, setImmersive] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const wheelRef = useRef({ time: 0, blockedUntil: 0 });
  const wheelResizeRef = useRef(null);
  const exitImmersiveRef = useRef(null);
  const [scaleRendering, setScaleRendering] = useState('settled');
  const boardNodeRef = useRef(null);
  const inspectionSceneRef = useRef(null);
  const boardDragRef = useRef(null);
  const boardResizeRef = useRef(null);
  const liveStageRef = useRef(null);
  const completedTransitionRef = useRef(null);
  const boardPhaseRef = useRef(boardPhase);
  const windowSnapshotRef = useRef(null);
  const inspectionActive = Boolean(renderInspection);
  const instrumentLayout = displayInstrumentLayout(host?.clientWidth || 390, host?.clientHeight || 700);
  const metadataSidecarOpen = instrumentBayOpen && instrumentLayout.attached;
  const responsiveMetrics = presentationBoardResponsiveMetrics(host?.clientWidth || 390);
  const metadataWidth = instrumentLayout.width;
  boardPhaseRef.current = boardPhase;
  const geometryOptions = { inset: responsiveMetrics.inset,
    identityStripHeight: responsiveMetrics.identityStripHeight,
    sidecarWidth: metadataSidecarOpen ? metadataWidth : 0 };

  useLayoutEffect(() => {
    if (!host) return undefined;
    const measure = () => setView((current) => {
      const viewport = { width: host.clientWidth, height: host.clientHeight };
      let next = current ? resizePresentationBoardView(current, viewport, geometryOptions)
        : projectPresentationBoardView(documentGeometry, viewport, 0.9, geometryOptions);
      if (!current && initialPresentation?.window && next) {
        next = projectPresentationBoardView(documentGeometry, viewport, Math.min(1, initialPresentation.window.width / next.fit.stage.width), geometryOptions);
      }
      // A scale constrained by an attached bay must not become a tiny Stage
      // after moving to the narrow overlay projection.
      return next && !metadataSidecarOpen && next.frame.stage.width < Math.min(320, next.fit.stage.width)
        ? projectPresentationBoardView(documentGeometry, viewport, Math.min(1, 320 / next.fit.stage.width), geometryOptions)
        : next;
    });
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(host);
    globalThis.addEventListener?.('resize', measure);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', measure); };
  }, [geometryKey, host, layoutMode, metadataSidecarOpen, metadataWidth]);

  const defaultTop = layoutMode === 'narrow' ? 48 : view?.frame.board.top || 0;
  const clampPosition = (position, frame = view?.frame.board) => ({
    left: Math.max(8,
      Math.min((host?.clientWidth || 0) - (frame?.width || 0) - (metadataSidecarOpen ? metadataWidth : 0) - 8, position.left)),
    top: Math.max(8, Math.min((host?.clientHeight || 0) - (frame?.height || 0) - 8, position.top)),
  });
  const renderedPosition = view ? clampPosition(boardPosition || { left: view.frame.board.left, top: defaultTop },
    view.frame.board) : null;
  const windowFrame = view && renderedPosition ? { ...view.frame.board, ...renderedPosition } : null;
  const maximumView = presentationBoardInspectionFrame(view, { width: host?.clientWidth, height: host?.clientHeight },
    geometryOptions);
  const maximumFrame = maximumView?.board || null;
  const maximized = boardPhase === 'maximizing' || boardPhase === 'maximized';
  const renderedFrame = immersive ? { left: 0, top: 0, width: screenSize.width, height: screenSize.height } : maximized ? maximumFrame
    : boardPhase === 'restoring' && windowSnapshotRef.current ? windowSnapshotRef.current.frame : windowFrame;
  const displayScale = immersive && view ? Math.min(screenSize.width / view.fit.stage.width, screenSize.height / view.fit.stage.height)
    : maximized ? maximumView?.scale || 1 : view?.scale || 1;
  useEffect(() => {
    if (renderedFrame && !immersive) onWindowChange?.({ name: displayName, window: {
      left: renderedFrame.left, top: renderedFrame.top, width: renderedFrame.width, height: renderedFrame.height,
    } });
  }, [displayName, renderedFrame?.left, renderedFrame?.top, renderedFrame?.width, renderedFrame?.height, onWindowChange, immersive]);
  const liveScaleRendering = !immersive && (scaleRendering === 'live' || boardPhase === 'maximizing' || boardPhase === 'restoring');
  const settledStageWidth = view ? view.fit.stage.width * displayScale : 0;
  const settledStageHeight = view ? view.fit.stage.height * displayScale : 0;
  const currentStageWidth = view ? view.fit.stage.width * displayScale : 0;
  const currentStageHeight = view ? view.fit.stage.height * displayScale : 0;
  const liveStage = liveStageRef.current;
  const liveTransformScale = liveStage?.displayWidth
    ? currentStageWidth / liveStage.displayWidth : displayScale;
  const prepareLiveScaleRendering = () => {
    liveStageRef.current = {
      displayHeight: currentStageHeight, displayWidth: currentStageWidth,
      height: settledStageHeight, width: settledStageWidth,
    };
    setScaleRendering('live');
  };

  const stopWheelResize = () => {
    if (!wheelResizeRef.current) return;
    clearTimeout(wheelResizeRef.current.timer);
    wheelResizeRef.current = null;
    setScaleRendering('settled');
  };
  useLayoutEffect(() => {
    stopWheelResize();
    setScaleRendering('settled');
    return () => {
      if (wheelResizeRef.current) clearTimeout(wheelResizeRef.current.timer);
      wheelResizeRef.current = null;
    };
  }, [host, geometryKey, view?.fit.stage.width, view?.fit.stage.height, metadataSidecarOpen, metadataWidth, immersive, boardPhase, instanceState]);

  const leaveImmersive = () => {
    wheelRef.current.blockedUntil = performance.now() + 450;
    setImmersive(false);
  };
  useDisplayImmersive({ active: immersive, available: instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW,
    boardRef: boardNodeRef, exitRef: exitImmersiveRef, onExit: leaveImmersive,
    onResize: setScreenSize, onInspectionCancel });

  useEffect(() => {
    const stage = selectionOverlayHost;
    if (!stage) return undefined;
    const wheel = event => {
      if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault(); event.stopPropagation();
      const now = performance.now();
      const paused = now - wheelRef.current.time > 240;
      wheelRef.current.time = now;
      if (now < wheelRef.current.blockedUntil || boardDragRef.current || boardResizeRef.current) return;
      if (immersive) { if (event.deltaY > 0) leaveImmersive(); return; }
      if (!view || !windowFrame || !['window', 'maximized'].includes(boardPhase)) return;
      if (maximized || view.scale >= view.maximumPercentage / 100 - .001) {
        if (event.deltaY < 0) {
          if (paused) {
            setScreenSize({ width: window.innerWidth, height: window.innerHeight });
            setImmersive(true);
            wheelRef.current.blockedUntil = now + 450;
          }
          return;
        }
        if (maximized) { restore(); wheelRef.current.blockedUntil = now + 450; return; }
      }
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
      let resize = wheelResizeRef.current;
      const current = resize?.view || view;
      const next = setContinuousPresentationBoardScale(current,
        current.scale + Math.max(-.06, Math.min(.06, -pixels * .001)));
      if (next.scale === current.scale) return;
      if (!resize) {
        resize = { centerX: windowFrame.left + windowFrame.width / 2,
          centerY: windowFrame.top + windowFrame.height / 2, timer: null };
        wheelResizeRef.current = resize;
      }
      resize.view = next;
      setView(next);
      setBoardPosition(clampPosition({ left: resize.centerX - next.frame.board.width / 2,
        top: resize.centerY - next.frame.board.height / 2 }, next.frame.board));
      clearTimeout(resize.timer);
      // Retain the gesture's centre across wheel events. Stage dimensions and
      // artwork projection update together, without a bitmap-scaling handoff.
      resize.timer = setTimeout(() => {
        if (wheelResizeRef.current !== resize) return;
        wheelResizeRef.current = null;
        setScaleRendering('settled');
      }, 160);
    };
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => stage.removeEventListener('wheel', wheel);
  });

  const maximize = () => {
    if (!view || !renderedPosition || boardPhase !== 'window') return;
    windowSnapshotRef.current = { frame: { ...view.frame.board, ...renderedPosition }, position: renderedPosition };
    if (reducedMotion || sameFrame(windowSnapshotRef.current.frame, maximumFrame)) setBoardPhase('maximized');
    else {
      completedTransitionRef.current = null;
      prepareLiveScaleRendering();
      requestAnimationFrame(() => setBoardPhase('maximizing'));
    }
  };
  const restore = () => {
    if (!windowSnapshotRef.current || !['maximized', 'maximizing'].includes(boardPhase)) return;
    if (inspectionActive) { onInspectionCancel?.(); return; }
    if (reducedMotion || sameFrame(maximumFrame, windowSnapshotRef.current.frame)) {
      setBoardPosition(windowSnapshotRef.current.position); windowSnapshotRef.current = null; setBoardPhase('window');
    } else {
      completedTransitionRef.current = null;
      prepareLiveScaleRendering();
      requestAnimationFrame(() => setBoardPhase('restoring'));
    }
  };

  useEffect(() => {
    if (boardPhase !== 'restoring') return undefined;
    let cancelled = false;
    const finish = () => {
      if (cancelled || boardPhaseRef.current !== 'restoring' || completedTransitionRef.current === 'restoring') return;
      completedTransitionRef.current = 'restoring'; setBoardPosition(windowSnapshotRef.current?.position || null);
      windowSnapshotRef.current = null; setBoardPhase('window'); setScaleRendering('settled');
    };
    const frame = requestAnimationFrame(() => {
      const transitions = (boardNodeRef.current?.getAnimations?.() || [])
        .filter(({ transitionProperty }) => ['height', 'left', 'top', 'width'].includes(transitionProperty));
      if (!transitions.length) finish(); else Promise.allSettled(transitions.map(({ finished }) => finished)).then(finish);
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [boardPhase]);
  useEffect(() => {
    if (boardPhase !== 'maximized' || inspectionActive || immersive) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); restore(); } };
    globalThis.addEventListener?.('keydown', onKeyDown, true);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown, true);
  }, [boardPhase, inspectionActive, immersive]);

  const finishBoardTransition = (event) => {
    if (event.target !== event.currentTarget || !['height', 'left', 'top', 'width'].includes(event.propertyName)) return;
    if (completedTransitionRef.current === boardPhase) return;
    completedTransitionRef.current = boardPhase;
    if (boardPhase === 'maximizing') { setBoardPhase('maximized'); setScaleRendering('settled'); }
    else if (boardPhase === 'restoring') {
      setBoardPosition(windowSnapshotRef.current?.position || null); windowSnapshotRef.current = null;
      setBoardPhase('window'); setScaleRendering('settled');
    }
  };
  const beginBoardDrag = (event) => {
    if (immersive || event.button !== 0 || !renderedPosition || boardPhase !== 'window' || event.target.closest('button')) return;
    stopWheelResize();
    boardDragRef.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...renderedPosition };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardDrag = (event) => {
    const start = boardDragRef.current; if (!start || start.id !== event.pointerId) return;
    setBoardPosition(clampPosition({ left: start.left + event.clientX - start.clientX,
      top: start.top + event.clientY - start.clientY }));
  };
  const stopBoardDrag = (event) => { if (boardDragRef.current?.id === event.pointerId) boardDragRef.current = null; };
  const beginBoardResize = (corner, event) => {
    if (event.button !== 0 || !view || !windowFrame || boardPhase !== 'window') return;
    event.preventDefault(); event.stopPropagation();
    stopWheelResize();
    boardResizeRef.current = { corner, id: event.pointerId, clientX: event.clientX, clientY: event.clientY, frame: windowFrame, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardResize = (event) => {
    const start = boardResizeRef.current; if (!start || start.id !== event.pointerId) return;
    const resized = resizePresentationBoardFromCorner(start.view, start.frame, start.corner,
      { x: event.clientX - start.clientX, y: event.clientY - start.clientY });
    if (!resized) return;
    setView(resized.view); setBoardPosition(clampPosition(resized.position, resized.view.frame.board));
  };
  const stopBoardResize = (event) => {
    if (boardResizeRef.current?.id !== event.pointerId) return;
    boardResizeRef.current = null; setScaleRendering('settled');
  };
  const resizeBoardFromKeyboard = (corner, event) => {
    if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)
      || !view || !windowFrame || boardPhase !== 'window') return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 24 : 8;
    const resized = resizePresentationBoardFromCorner(view, windowFrame, corner, {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    });
    if (!resized) return;
    setView(resized.view);
    setBoardPosition(clampPosition(resized.position, resized.view.frame.board));
  };
  useEffect(() => {
    const move = (event) => moveBoardResize(event); const stop = (event) => stopBoardResize(event);
    globalThis.addEventListener?.('pointermove', move, true); globalThis.addEventListener?.('pointerup', stop, true);
    globalThis.addEventListener?.('pointercancel', stop, true);
    return () => { globalThis.removeEventListener?.('pointermove', move, true); globalThis.removeEventListener?.('pointerup', stop, true);
      globalThis.removeEventListener?.('pointercancel', stop, true); };
  });

  const minimizeToShortcut = () => {
    if (!windowFrame || inspectionActive) return;
    shortcutRef.current?.show();
    onMinimize?.();
  };
  const workbenchField = host ? { cellSize: WORKBENCH_CELL, left: 0, top: 0 } : null;
  return <div className="system-workflow__workbench" data-presentation-workbench onContextMenu={onContextMenu} ref={setHost}>
    {host && <LatticePixelGrid color={workbenchGridColor || 'var(--study-grid)'} field={workbenchField} guideInterval={1}
      guideSize={1} height={host.clientHeight} mode={workbenchGridMode} width={host.clientWidth} />}
    <PresentationBoardShortcut assetsById={assetsById} host={host} instanceState={instanceState}
      readOnly={readOnly}
      initialShortcut={initialPresentation?.shortcut} onShortcutChange={onShortcutChange}
      name={displayName} onNameChange={(name) => setModuleName({ profile: profileAddress, name })}
      menuSurface={menuSurface} onRestore={onRestore} profileAddress={profileAddress}
      shortcutSnap={shortcutSnap} shortcutTargetRef={shortcutRef} />
    {view && instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW
      && <article aria-label="Display Module" className="system-workflow__presentation-board"
      popover={immersive ? 'manual' : undefined} data-immersive={immersive || undefined}
      data-authoring-locked={authoringLocked || undefined}
      data-board-phase={boardPhase} data-board-scale={view.scale} data-maximized={maximized || undefined}
      data-scale-rendering={liveScaleRendering ? 'live' : 'settled'}
      data-inspecting={inspectionActive || undefined} data-inspection-atmosphere={inspectionAtmosphere || undefined}
      data-metadata-sidecar={metadataSidecarOpen || undefined} data-instrument-bay={instrumentBayOpen || undefined}
      onTransitionEnd={finishBoardTransition} ref={boardNodeRef}
      style={{ '--workflow-identity-strip-height': `${view.fit.identityStripHeight}px`,
        '--workflow-metadata-width': `${metadataWidth}px`, height: renderedFrame.height,
        left: renderedFrame.left, top: renderedFrame.top, width: renderedFrame.width }}>
      <header className="system-workflow__identity-strip" onPointerCancel={stopBoardDrag} onPointerDown={beginBoardDrag}
        onPointerMove={moveBoardDrag} onPointerUp={stopBoardDrag}>
        <span className="system-workflow__identity-primary">
          <strong title={displayName}>{displayName}</strong>
        </span>
        <span className="system-workflow__board-title">
          {inspectionActive && <span className="system-workflow__board-inspection-controls-host" ref={setInspectionControlsHost} />}
          <BoardWorkspaceControls readOnly={readOnly} instrumentTriggers={instrumentTriggers} layersOpen={layersOpen} metadataOpen={metadataOpen}
            playing={playing} playbackDisabled={playbackDisabled} onTogglePlayback={onTogglePlayback}
            onToggleLayers={onToggleLayers} onToggleMetadata={onToggleMetadata} />
          {!readOnly && <span className="system-workflow__composition-lock-controls">
            <button aria-label={authoringLocked ? 'Unlock Display Module composition' : 'Lock Display Module composition'}
              aria-pressed={authoringLocked} className="system-workflow__round-control system-workflow__composition-lock"
              onClick={onAuthoringLockToggle} type="button">{authoringLocked ? <LockKeyhole /> : <Lock />}</button>
          </span>}
          <BoardWindowControls disabled={inspectionActive} maximized={maximized}
            onMaximize={maximize} onMinimize={minimizeToShortcut} onRestore={restore} />
        </span>
      </header>
      <div aria-hidden="true" className="system-workflow__stage-border" />
      <div className="system-workflow__stage-viewport" data-surface={displaySurface}
        onDragStartCapture={(event) => event.preventDefault()}
        ref={setSelectionOverlayHost} style={{ height: view.fit.stage.height * displayScale,
          width: immersive ? view.fit.stage.width * displayScale : undefined }}>
        <div className="system-workflow__stage" data-presentation-stage data-surface={displaySurface}
          style={{ height: liveScaleRendering ? liveStage?.height || view.fit.stage.height : settledStageHeight,
            transform: liveScaleRendering ? `scale(${liveTransformScale})` : undefined,
            width: liveScaleRendering ? liveStage?.width || view.fit.stage.width : settledStageWidth }}>
          <div className="system-workflow__inspection-scene" ref={inspectionSceneRef}>
          <DisplayStageSizeContext.Provider value={{
            width: liveScaleRendering ? liveStage?.width || view.fit.stage.width : settledStageWidth,
            height: liveScaleRendering ? liveStage?.height || view.fit.stage.height : settledStageHeight }}>
          {cloneElement(children, { boardScale: liveScaleRendering ? liveTransformScale : 1,
            interactionDisabled: children.props.interactionDisabled || boardPhase === 'maximizing' || boardPhase === 'restoring',
            renderingMode: liveScaleRendering ? 'live' : 'settled', selectionOverlayHost })}
          </DisplayStageSizeContext.Provider>
          </div>
        </div>
      </div>
      {renderInstruments?.(metadataSidecarOpen ? 'attached' : 'overlay',
        Math.min((host?.clientHeight || 700) - 210, renderedFrame.top + renderedFrame.height + 12))}
      {immersive && <button className="system-workflow__immersive-exit" ref={exitImmersiveRef}
        aria-label="Exit immersive view" onClick={leaveImmersive} type="button"><Minimize2 size={16} /> Exit</button>}
      {!immersive && boardPhase === 'window' && corners.map((corner) => <button aria-label={`Resize Display Module from ${corner}`}
        className={`system-workflow__board-resize-handle is-${corner}`} key={corner}
        onPointerCancel={stopBoardResize} onPointerDown={(event) => beginBoardResize(corner, event)}
        onKeyDown={(event) => resizeBoardFromKeyboard(corner, event)} onPointerUp={stopBoardResize} type="button" />)}
      <div className="system-workflow__board-inspection-host" ref={setInspectionHost}>
        {inspectionActive && inspectionHost && inspectionControlsHost
          ? renderInspection(inspectionHost, inspectionControlsHost, inspectionSceneRef.current) : null}
      </div>
    </article>}
  </div>;
}
