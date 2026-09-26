import { useWorkbenchPlacement } from './WorkbenchPlacement.jsx';
import { useWorkbenchView, workbenchModuleTransform, useWorkbenchViewRegistration } from './WorkbenchView.jsx';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { clampWorkbenchPosition, WORKBENCH_BOUNDS } from './workbenchSpace.js';
import { moduleEdgeStyle } from '../../systemWorkflow/domain/moduleSurfaceAppearance.js';
import './moduleSurface.css';
import { cloneElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { commitWorkbenchSelectionResize, prepareWindowResize } from '../../systemWorkflow/resizeWorkbenchSelection.js';
import {
  Lock, LockKeyhole, Minus, Pause,
} from 'lucide-react';
import './workbenchWindowChrome.css';
import PresentationBoardShortcut from './PresentationBoardShortcut.jsx';
import { DisplayStageSizeContext } from './DisplayStageSizeContext.js';
import { workbenchPaintStyle } from './workbenchPaintGeometry.js';
import { snapWorkbenchPosition, WORKBENCH_GRID_STEP } from './workbenchGrid.js';
import { loadPresentationBoardShortcut } from './presentationBoardShortcutStorage.js';
import { DISPLAY_DEFAULT_WINDOW_SIZES } from '../../profileDocument/domain/workbenchPresentation.js';
import { PRESENTATION_BOARD_INSTANCE_STATE } from './ownerSystemWorkflowModuleState.js';
import { presentationBoardResponsiveMetrics, projectPresentationBoardView,
  resizePresentationBoardFromCorner, resizePresentationBoardView, setContinuousPresentationBoardScale } from './presentationBoardGeometry.js';

const corners = ['nw', 'ne', 'sw', 'se'];
function BoardWindowControls({ disabled, onMinimize }) {
  return <span className="system-workflow__board-window-controls">
    <button aria-label="Minimize Display Module to shortcut" className="system-workflow__overlay-icon"
      disabled={disabled} onClick={onMinimize} type="button"><Minus /></button>
  </span>;
}
function BoardWorkspaceControls({ playing, onTogglePlayback }) {
  return playing ? <button aria-label="Pause Grids" className="system-workflow__overlay-icon"
    onClick={onTogglePlayback} title="Pause Grids" type="button"><Pause /></button> : null;
}
export default function PresentationBoardDefinitive({ assetsById = new Map(), children, documentGeometry,
  authoringLocked = false, displaySurface, moduleAppearance, inspectionAtmosphere = false,
  layoutMode = 'wide', onAuthoringLockToggle, onContextMenu,
  onDelete, moduleCommands, moduleSubmenu, onModuleCommand,
  onMinimize, onRestore,
  playing = false, onTogglePlayback,
  instanceState = PRESENTATION_BOARD_INSTANCE_STATE.WINDOW,
  menuSurface = null, profileAddress, instanceId, renderInspection, renderCues,
  shortcutTargetRef, shortcutSnap = true, windowSnap = false, initialPresentation, onWindowChange, onShortcutChange, readOnly = false }) {
  const localShortcutRef = useRef(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const geometryKey = JSON.stringify(documentGeometry);
  const shortcutRef = shortcutTargetRef || localShortcutRef;
  const storedName = useMemo(() => initialPresentation?.name || (readOnly ? null : loadPresentationBoardShortcut(profileAddress, undefined, instanceId)?.name), [profileAddress, instanceId]);
  const [moduleName, setModuleName] = useState(null);
  const displayName = moduleName?.profile === profileAddress ? moduleName.name
    : storedName && storedName !== 'PRESENTATION BOARD' ? storedName : 'DISPLAY MODULE';
  const [host, setHost] = useState(null);
  const [view, setView] = useState(null);
  const [boardPosition, setBoardPosition] = useState(initialPresentation?.window ? { left: initialPresentation.window.left, top: initialPresentation.window.top } : null);
  const [inspectionHost, setInspectionHost] = useState(null);
  const [inspectionControlsHost, setInspectionControlsHost] = useState(null);
  const [selectionOverlayHost, setSelectionOverlayHost] = useState(null);
  const workbenchView = useWorkbenchView();
  const { offset: cameraOffset } = useWorkbenchCamera();
  const viewId = instanceId || 'display:primary';
  const viewTransform = workbenchModuleTransform(workbenchView, viewId);
  const workbenchScale = viewTransform.scale;
  const [resizeError, setResizeError] = useState('');
  const applyGroupFrame = useCallback(frame => {
    setBoardPosition({ left: frame.left, top: frame.top });
    setView(current => current && setContinuousPresentationBoardScale(current, frame.width / current.fit.stage.width));
  }, []);
  const boardNodeRef = useRef(null);
  const placement = useWorkbenchPlacement(boardNodeRef, Boolean(view) && !readOnly && instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW, workbenchScale);
  const inspectionSceneRef = useRef(null);
  const boardDragRef = useRef(null);
  const boardResizeRef = useRef(null);
  const inspectionActive = Boolean(renderInspection);
  const responsiveMetrics = presentationBoardResponsiveMetrics(host?.clientWidth || 390);
  const geometryOptions = { inset: responsiveMetrics.inset,
    identityStripHeight: 0,
    sidecarWidth: 0 };

  useLayoutEffect(() => {
    if (!host) return undefined;
    const measure = () => setView((current) => {
      const viewport = { width: host.clientWidth, height: host.clientHeight };
      let next = current && JSON.stringify(current.documentGeometry) === geometryKey ? resizePresentationBoardView(current, viewport, geometryOptions)
        : projectPresentationBoardView(documentGeometry, viewport, 1, geometryOptions);
      if (next && (!current || JSON.stringify(current.documentGeometry) !== geometryKey)) {
        // Preserve the user's size relative to the same defaults used by Add.
        const targetSize = DISPLAY_DEFAULT_WINDOW_SIZES[documentGeometry?.rows > documentGeometry?.columns ? 'PORTRAIT' : 'LANDSCAPE'];
        const previousSize = DISPLAY_DEFAULT_WINDOW_SIZES[current?.documentGeometry?.rows > current?.documentGeometry?.columns ? 'PORTRAIT' : 'LANDSCAPE'];
        const width = current ? current.frame.stage.width / previousSize.width * targetSize.width
          : initialPresentation?.window?.width || targetSize.width;
        next = setContinuousPresentationBoardScale(next, Math.min(1, width / next.fit.stage.width));
      }
      return next;
    });
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(host);
    globalThis.addEventListener?.('resize', measure);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', measure); };
  }, [geometryKey, host, layoutMode]);

  const defaultTop = layoutMode === 'narrow' ? 48 : view?.frame.board.top || 0;
  useLayoutEffect(() => {
    if (view) setBoardPosition(current => current || { left: view.frame.board.left, top: defaultTop });
  }, [view, defaultTop]);
  const clampPosition = (position, frame = view?.frame.board) => clampWorkbenchPosition(position, frame);
  const renderedPosition = view ? boardPosition || { left: view.frame.board.left, top: defaultTop } : null;
  const windowFrame = view && renderedPosition ? { ...view.frame.board, ...renderedPosition } : null;
  const resizeTarget = useMemo(() => ({ enabled: Boolean(workbenchView.store && view) && !readOnly && !inspectionActive,
    continuousGeometry: true,
    store: workbenchView.store, profileAddress, layoutKey: viewId === 'display:primary' ? 'display' : 'displays',
    commit: commitWorkbenchSelectionResize, prepare: prepareWindowResize, applyFrame: applyGroupFrame, reportError: setResizeError,
    minimumWidth: Math.max(180, (view?.fit.stage.width || 0) * .25), minimumHeight: Math.max(100, (view?.fit.stage.height || 0) * .25),
    maximumWidth: view?.fit.stage.width || 1, maximumHeight: view?.fit.stage.height || 1,
  }), [workbenchView.store, view, readOnly, inspectionActive, profileAddress, viewId, applyGroupFrame]);
  useWorkbenchViewRegistration(viewId, boardNodeRef, Boolean(windowFrame) && instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW, windowFrame, resizeTarget);
  useEffect(() => {
    if (view && boardPosition) onWindowChange?.({ name: displayName, window: {
      left: boardPosition.left, top: boardPosition.top,
      width: view.frame.board.width, height: view.frame.board.height,
    } });
  }, [displayName, boardPosition?.left, boardPosition?.top, view?.frame.board.width, view?.frame.board.height, onWindowChange]);
  const density = globalThis.devicePixelRatio || 1;
  const contentScale = workbenchScale * density;
  const paintFrame = windowFrame ? workbenchPaintStyle(windowFrame, viewTransform, cameraOffset, density) : null;
  const stageWidth = paintFrame?.width || 0;
  const stageHeight = paintFrame?.height || 0;

  const placedPosition = (candidate, bypass) => clampPosition(placement.position(candidate, renderedPosition,
    snapWorkbenchPosition(candidate, windowSnap && !readOnly && !bypass), bypass));
  const edgeSnapper = (bypass, edges = true) => (axis, side, value) => placement.edgeMatch(axis, side, value, renderedPosition, bypass, edges);
  const resizeBounds = () => WORKBENCH_BOUNDS;
  const beginBoardDrag = (event) => {
    if (inspectionActive || event.button !== 0 || !renderedPosition || event.target.closest('button')) return;
    placement.begin(event);
    boardDragRef.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...renderedPosition };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardDrag = (event) => {
    const start = boardDragRef.current; if (!start || start.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < 3) return;
    setBoardPosition(placedPosition({ left: start.left + (event.clientX - start.clientX) / workbenchScale,
      top: start.top + (event.clientY - start.clientY) / workbenchScale }, event.altKey));
  };
  const stopBoardDrag = (event) => { if (boardDragRef.current?.id === event.pointerId) { boardDragRef.current = null; placement.finish(); } };
  const beginBoardResize = (corner, event) => {
    if (inspectionActive || event.button !== 0 || !view || !windowFrame) return;
    event.preventDefault(); event.stopPropagation();
    placement.begin(event);
    boardResizeRef.current = { corner, id: event.pointerId, clientX: event.clientX, clientY: event.clientY, frame: windowFrame, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardResize = (event) => {
    const start = boardResizeRef.current; if (!start || start.id !== event.pointerId) return;
    const resized = resizePresentationBoardFromCorner(start.view, start.frame, start.corner,
      { x: (event.clientX - start.clientX) / workbenchScale, y: (event.clientY - start.clientY) / workbenchScale }, 0, edgeSnapper(event.altKey), resizeBounds());
    if (!resized) return;
    setView(resized.view); setBoardPosition(resized.position);
  };
  const stopBoardResize = (event) => {
    if (boardResizeRef.current?.id !== event.pointerId) return;
    boardResizeRef.current = null; placement.finish();
  };
  const resizeBoardFromKeyboard = (corner, event) => {
    if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)
      || inspectionActive || !view || !windowFrame) return;
    event.preventDefault(); event.stopPropagation();
    placement.begin(event);
    const snapping = windowSnap && !readOnly && !event.altKey;
    const step = snapping || event.shiftKey ? WORKBENCH_GRID_STEP : 8;
    const resized = resizePresentationBoardFromCorner(view, windowFrame, corner, {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    // A small keyboard step must not be pulled straight back by the pointer's
    // edge magnet. Grid quantization still applies when explicitly enabled.
    }, 0, edgeSnapper(event.altKey, false), resizeBounds());
    if (!resized) return;
    setView(resized.view);
    setBoardPosition(clampPosition(resized.position, resized.view.frame.board));
  };
  useEffect(() => {
    const move = (event) => moveBoardResize(event); const stop = (event) => stopBoardResize(event);
    const cancel = () => { boardDragRef.current = null; boardResizeRef.current = null; };
    globalThis.addEventListener?.('pointermove', move, true); globalThis.addEventListener?.('pointerup', stop, true);
    globalThis.addEventListener?.('pointercancel', stop, true);
    globalThis.addEventListener?.('blur', cancel);
    return () => { globalThis.removeEventListener?.('pointermove', move, true); globalThis.removeEventListener?.('pointerup', stop, true);
      globalThis.removeEventListener?.('blur', cancel);
      globalThis.removeEventListener?.('pointercancel', stop, true); };
  });

  const minimizeToShortcut = () => {
    if (!windowFrame || inspectionActive) return;
    shortcutRef.current?.show();
    onMinimize?.();
  };
  return <div className="system-workflow__workbench" data-presentation-workbench ref={setHost}>
    <PresentationBoardShortcut onDelete={readOnly ? undefined : onDelete} assetsById={assetsById} host={host} instanceState={instanceState}
      readOnly={readOnly} instanceId={instanceId}
      moduleCommands={moduleCommands} moduleSubmenu={moduleSubmenu} onModuleCommand={onModuleCommand}
      initialShortcut={initialPresentation?.shortcut} onShortcutChange={onShortcutChange}
      name={displayName} onNameChange={(name) => setModuleName({ profile: profileAddress, name })}
      menuSurface={menuSurface} onRestore={onRestore} profileAddress={profileAddress}
      shortcutSnap={shortcutSnap} shortcutTargetRef={shortcutRef} />
    {view && instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW
      && <article aria-label="Display Module" className="system-workflow__presentation-board" data-window-chrome="bevel" data-menu-surface={menuSurface}
      onContextMenu={onContextMenu} data-module-edges={Boolean(moduleAppearance?.edges) || undefined} data-module-frame={moduleAppearance?.frame === false ? 'off' : moduleAppearance?.frame === true ? 'on' : undefined}
      data-authoring-locked={authoringLocked || undefined}
      data-workbench-scale={workbenchScale}
      data-workbench-view-id={viewId}
      data-workbench-pan data-board-scale={view.scale}
      data-inspecting={inspectionActive || undefined} data-inspection-atmosphere={inspectionAtmosphere || undefined}

      ref={boardNodeRef}
      style={{ ...moduleEdgeStyle(moduleAppearance?.edges, contentScale), '--workbench-pan-scale': workbenchScale, '--workflow-identity-strip-height': `${responsiveMetrics.identityStripHeight}px`,
        ...paintFrame }}>
      <button type="button" className="system-workflow__toolbar-reveal" aria-label={toolbarOpen ? 'Hide Display controls' : 'Show Display controls'} aria-expanded={toolbarOpen} onClick={() => setToolbarOpen(value => !value)}>···</button>
      <header className="system-workflow__identity-strip" data-workbench-selectable aria-keyshortcuts="Shift+Enter" data-toolbar-open={toolbarOpen || undefined} tabIndex={0} aria-label={`Move Display Module: ${displayName}`}
        onKeyDown={event => {
          if (event.target === event.currentTarget && (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) { onContextMenu?.(event); return; }
          if (event.target !== event.currentTarget || !event.key.startsWith('Arrow')) return;
          event.preventDefault(); event.stopPropagation();
          if (inspectionActive) return;
          placement.begin(event);
          const snapping = windowSnap && !readOnly && !event.altKey;
          const step = snapping || event.shiftKey ? WORKBENCH_GRID_STEP : 8;
          setBoardPosition(placedPosition({ left: renderedPosition.left + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
            top: renderedPosition.top + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) }, event.altKey));
        }} onPointerCancel={stopBoardDrag} onLostPointerCapture={stopBoardDrag} onPointerDown={beginBoardDrag}
        onPointerMove={moveBoardDrag} onPointerUp={stopBoardDrag}>
        <span className="system-workflow__board-title" title={displayName}>
          {inspectionActive && <span className="system-workflow__board-inspection-controls-host" ref={setInspectionControlsHost} />}
          <BoardWorkspaceControls playing={playing} onTogglePlayback={onTogglePlayback} />
          {!readOnly && <span className="system-workflow__composition-lock-controls">
            <button aria-label={authoringLocked ? 'Unlock Display Module composition' : 'Lock Display Module composition'}
              aria-pressed={authoringLocked} className="system-workflow__overlay-icon system-workflow__composition-lock"
              onClick={onAuthoringLockToggle} type="button">{authoringLocked ? <LockKeyhole /> : <Lock />}</button>
          </span>}
          <BoardWindowControls disabled={inspectionActive} onMinimize={minimizeToShortcut} />
        </span>
      </header>
      <div aria-hidden="true" className="system-workflow__stage-border" />
      <div className="system-workflow__stage-viewport" data-surface={displaySurface}
        onDragStartCapture={(event) => event.preventDefault()}
        ref={setSelectionOverlayHost} style={{ width: stageWidth, height: stageHeight }}>
        <div className="system-workflow__stage" data-presentation-stage data-surface={displaySurface}
          style={{ width: stageWidth, height: stageHeight }}>
          <div className="system-workflow__inspection-scene" ref={inspectionSceneRef}>
          <DisplayStageSizeContext.Provider value={{ width: stageWidth, height: stageHeight,
            screenScale: 1 / density, contentScale }}>
          {cloneElement(children, { boardScale: 1, workbenchScale, selectionOverlayHost })}
          </DisplayStageSizeContext.Provider>
          </div>
        </div>
      </div>
      {moduleAppearance?.edges?.grain > 0 && <span aria-hidden="true" className="module-surface-grain" />}
      {selectionOverlayHost && renderCues?.(selectionOverlayHost)}
      {corners.map((corner) => <button aria-label={`Resize Display Module from ${corner}`}
        className={`system-workflow__board-resize-handle is-${corner}`} key={corner}
        onPointerCancel={stopBoardResize} onLostPointerCapture={stopBoardResize} onPointerDown={(event) => beginBoardResize(corner, event)}
        onKeyDown={(event) => resizeBoardFromKeyboard(corner, event)} onPointerUp={stopBoardResize} type="button" />)}
      <div className="system-workflow__board-inspection-host" ref={setInspectionHost}>
        {resizeError && <p role="alert" className="system-workflow__notice">{resizeError}</p>}
        {inspectionActive && inspectionHost && inspectionControlsHost
          ? renderInspection(inspectionHost, inspectionControlsHost, inspectionSceneRef.current) : null}
      </div>
    </article>}
  </div>;
}
