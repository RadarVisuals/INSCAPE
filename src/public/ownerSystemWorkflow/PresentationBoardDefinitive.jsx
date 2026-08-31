import { cloneElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Lock, UserRound, X } from 'lucide-react';
import LatticePixelGrid from '../../lattice/rendering/LatticePixelGrid.jsx';
import RackMenu from '../menus/RackMenu.jsx';
import ProgressiveArtworkImage from './ProgressiveArtworkImage.jsx';
import { PRESENTATION_BOARD_INSTANCE_STATE } from './ownerSystemWorkflowModuleState.js';
import {
  DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION,
  loadPresentationBoardShortcut,
  normalizePresentationBoardShortcutIconPresentation,
  presentationBoardShortcutStorageKey,
} from './presentationBoardShortcutStorage.js';
import { presentationBoardInspectionFrame, presentationBoardResponsiveMetrics, projectPresentationBoardView,
  resizePresentationBoardFromCorner, resizePresentationBoardView } from './presentationBoardGeometry.js';

const compactAddress = (address) => address?.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;
const corners = ['nw', 'ne', 'sw', 'se'];
const WORKBENCH_CELL = 24;
const MINIMUM_SHORTCUT_SIZE = { width: 82, height: 64 };
const SHORTCUT_ICON_EDITOR_SIZE = { width: 252, height: 308 };
const SHORTCUT_ICON_PREVIEW_SIZE = 84;
const sameFrame = (left, right) => left && right
  && ['height', 'left', 'top', 'width'].every((key) => Math.abs(left[key] - right[key]) < 0.01);
const snap = (value, enabled) => enabled ? Math.round(value / WORKBENCH_CELL) * WORKBENCH_CELL : value;
const shortcutIconStyle = ({ offsetX, offsetY, scale }) => ({
  transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
});
const shortcutIconPreviewStyle = ({ offsetX, offsetY, scale, size }) => {
  const previewRatio = SHORTCUT_ICON_PREVIEW_SIZE / size;
  return { transform: `translate(${offsetX * previewRatio}px, ${offsetY * previewRatio}px) scale(${scale})` };
};
const shortcutBounds = ({ labelSize, size }) => ({
  height: Math.max(MINIMUM_SHORTCUT_SIZE.height, Math.ceil(size + labelSize * 1.25 + 19)),
  width: Math.max(MINIMUM_SHORTCUT_SIZE.width, size + 10),
});
const shortcutPresentationStyle = (presentation) => ({
  '--workflow-shortcut-height': `${shortcutBounds(presentation).height}px`,
  '--workflow-shortcut-icon-size': `${presentation.size}px`,
  '--workflow-shortcut-label-size': `${presentation.labelSize}px`,
  '--workflow-shortcut-width': `${shortcutBounds(presentation).width}px`,
});
export default function PresentationBoardDefinitive({ assetsById = new Map(), children, documentGeometry,
  authoringLocked = false, displaySurface, identity, inspectionAtmosphere = false,
  layoutMode = 'wide', metadataDocked = false, metadataProjection = 'closed', onAuthoringLockToggle, onContextMenu,
  onInspectionCancel,
  onMetadataClose, onMetadataInnerToggle, onMetadataSidecarToggle, onMetadataUndock, onMinimize, onRestore,
  instanceState = PRESENTATION_BOARD_INSTANCE_STATE.WINDOW,
  menuSurface = null, profileAddress, reducedMotion = false, renderInspection, renderMetadata,
  shortcutSnap = true, workbenchGridColor = null, workbenchGridMode = 'LINES' }) {
  const storedShortcut = useMemo(() => loadPresentationBoardShortcut(profileAddress), [profileAddress]);
  const [host, setHost] = useState(null);
  const [view, setView] = useState(null);
  const [boardPosition, setBoardPosition] = useState(null);
  const [inspectionHost, setInspectionHost] = useState(null);
  const [inspectionControlsHost, setInspectionControlsHost] = useState(null);
  const [selectionOverlayHost, setSelectionOverlayHost] = useState(null);
  const [boardPhase, setBoardPhase] = useState('window');
  const [scaleRendering, setScaleRendering] = useState('settled');
  const [shortcutPosition, setShortcutPosition] = useState(storedShortcut?.position || { left: 24, top: 72 });
  const [shortcutName, setShortcutName] = useState(storedShortcut?.name && storedShortcut.name !== 'PRESENTATION BOARD'
    ? storedShortcut.name : 'DISPLAY MODULE');
  const [shortcutIconId, setShortcutIconId] = useState(storedShortcut?.iconAssetId || null);
  const [shortcutVisible, setShortcutVisible] = useState(Boolean(storedShortcut?.visible || storedShortcut?.open === false));
  const [shortcutIconPresentation, setShortcutIconPresentation] = useState(() =>
    normalizePresentationBoardShortcutIconPresentation(storedShortcut?.iconPresentation));
  const [shortcutIconEditing, setShortcutIconEditing] = useState(false);
  const [shortcutMenu, setShortcutMenu] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(shortcutName);
  const boardNodeRef = useRef(null);
  const boardDragRef = useRef(null);
  const boardResizeRef = useRef(null);
  const liveStageRef = useRef(null);
  const shortcutDragRef = useRef(null);
  const completedTransitionRef = useRef(null);
  const boardPhaseRef = useRef(boardPhase);
  const windowSnapshotRef = useRef(null);
  const inspectionActive = Boolean(renderInspection);
  const metadataSidecarOpen = metadataDocked && metadataProjection === 'side';
  const sidecarOpen = metadataSidecarOpen;
  const responsiveMetrics = presentationBoardResponsiveMetrics(host?.clientWidth || 390);
  const metadataWidth = responsiveMetrics.metadataWidth;
  boardPhaseRef.current = boardPhase;
  const geometryOptions = { inset: responsiveMetrics.inset,
    identityStripHeight: responsiveMetrics.identityStripHeight,
    sidecarWidth: sidecarOpen ? metadataWidth : 0 };

  useLayoutEffect(() => {
    if (!host) return undefined;
    const measure = () => setView((current) => current
      ? resizePresentationBoardView(current, { width: host.clientWidth, height: host.clientHeight }, geometryOptions)
      : projectPresentationBoardView(documentGeometry, { width: host.clientWidth, height: host.clientHeight }, 0.3, geometryOptions));
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(host);
    globalThis.addEventListener?.('resize', measure);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', measure); };
  }, [documentGeometry, host, layoutMode, metadataWidth, sidecarOpen]);

  useEffect(() => {
    try { globalThis.localStorage?.setItem(presentationBoardShortcutStorageKey(profileAddress), JSON.stringify({
      iconAssetId: shortcutIconId, iconPresentation: shortcutIconPresentation, name: shortcutName,
      open: instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW, position: shortcutPosition, visible: shortcutVisible,
    })); } catch { /* Workbench layout persistence is optional. */ }
  }, [instanceState, profileAddress, shortcutIconId, shortcutIconPresentation, shortcutName, shortcutPosition, shortcutVisible]);

  useEffect(() => {
    if (!shortcutVisible || !shortcutIconId) setShortcutIconEditing(false);
  }, [shortcutIconId, shortcutVisible]);

  const currentShortcutBounds = shortcutBounds(shortcutIconPresentation);
  const clampShortcut = (position) => ({
    left: Math.max(0, Math.min((host?.clientWidth || currentShortcutBounds.width) - currentShortcutBounds.width, snap(position.left, shortcutSnap))),
    top: Math.max(0, Math.min((host?.clientHeight || currentShortcutBounds.height) - currentShortcutBounds.height, snap(position.top, shortcutSnap))),
  });
  useEffect(() => {
    if (!host || !shortcutVisible) return;
    setShortcutPosition((current) => {
      const next = clampShortcut(current);
      return next.left === current.left && next.top === current.top ? current : next;
    });
  }, [host, shortcutIconPresentation.labelSize, shortcutIconPresentation.size, shortcutSnap, shortcutVisible]);
  const defaultTop = layoutMode === 'narrow' ? 48 : view?.frame.board.top || 0;
  const clampPosition = (position, frame = view?.frame.board) => ({
    left: Math.max(8,
      Math.min((host?.clientWidth || 0) - (frame?.width || 0) - (sidecarOpen ? metadataWidth : 0) - 8, position.left)),
    top: Math.max(8, Math.min((host?.clientHeight || 0) - (frame?.height || 0) - 8, position.top)),
  });
  const renderedPosition = view ? clampPosition(boardPosition || { left: view.frame.board.left, top: defaultTop },
    view.frame.board) : null;
  const windowFrame = view && renderedPosition ? { ...view.frame.board, ...renderedPosition } : null;
  const maximumView = presentationBoardInspectionFrame(view, { width: host?.clientWidth, height: host?.clientHeight },
    geometryOptions);
  const maximumFrame = maximumView?.board || null;
  const maximized = boardPhase === 'maximizing' || boardPhase === 'maximized';
  const renderedFrame = maximized ? maximumFrame
    : boardPhase === 'restoring' && windowSnapshotRef.current ? windowSnapshotRef.current.frame : windowFrame;
  const displayScale = maximized ? maximumView?.scale || 1 : view?.scale || 1;
  const liveScaleRendering = scaleRendering === 'live' || boardPhase === 'maximizing' || boardPhase === 'restoring';
  const settledStageWidth = view ? Math.ceil(view.fit.stage.width * displayScale) : 0;
  const settledStageHeight = view ? Math.ceil(view.fit.stage.height * displayScale) : 0;
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
    if (boardPhase !== 'maximized' || inspectionActive) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); restore(); } };
    globalThis.addEventListener?.('keydown', onKeyDown, true);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown, true);
  }, [boardPhase, inspectionActive]);

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
    if (event.button !== 0 || !renderedPosition || boardPhase !== 'window' || event.target.closest('button')) return;
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
    prepareLiveScaleRendering();
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

  const beginShortcutDrag = (event) => {
    if (event.button !== 0 || renaming) return;
    shortcutDragRef.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...shortcutPosition };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveShortcutDrag = (event) => {
    const start = shortcutDragRef.current; if (!start || start.id !== event.pointerId) return;
    setShortcutPosition(clampShortcut({ left: start.left + event.clientX - start.clientX,
      top: start.top + event.clientY - start.clientY }));
  };
  const stopShortcutDrag = (event) => { if (shortcutDragRef.current?.id === event.pointerId) shortcutDragRef.current = null; };
  const minimizeToShortcut = () => {
    if (!windowFrame || inspectionActive) return;
    setShortcutVisible(true);
    onMinimize?.();
  };
  const commitRename = () => {
    const value = renameValue.trim(); if (value) setShortcutName(value.slice(0, 48)); else setRenameValue(shortcutName);
    setRenaming(false);
  };

  const officialName = identity?.status === 'RESOLVED' && identity.name ? identity.name : 'IDENTITY RESOLVING';
  const avatarUrl = identity?.status === 'RESOLVED' ? identity.avatarUrl : null;
  const address = identity?.normalizedAddress || identity?.address || profileAddress;
  const shortcutAsset = shortcutIconId ? assetsById.get(shortcutIconId) : null;
  const hostRectangle = host?.getBoundingClientRect();
  const iconEditorPosition = hostRectangle ? {
    left: Math.max(8, Math.min(globalThis.innerWidth - SHORTCUT_ICON_EDITOR_SIZE.width - 8,
      hostRectangle.left + shortcutPosition.left + currentShortcutBounds.width + 8)),
    top: Math.max(8, Math.min(globalThis.innerHeight - SHORTCUT_ICON_EDITOR_SIZE.height - 8,
      hostRectangle.top + shortcutPosition.top)),
  } : { left: 8, top: 8 };
  const workbenchField = host ? { cellSize: WORKBENCH_CELL, left: 0, top: 0 } : null;
  return <div className="system-workflow__workbench" data-presentation-workbench onContextMenu={onContextMenu} ref={setHost}>
    {host && <LatticePixelGrid color={workbenchGridColor || 'var(--study-grid)'} field={workbenchField} guideInterval={1}
      guideSize={1} height={host.clientHeight} mode={workbenchGridMode} width={host.clientWidth} />}
    {shortcutVisible
      && <button aria-label={instanceState === PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED
        ? `Open ${shortcutName}` : `${shortcutName} shortcut`} className="system-workflow__desktop-shortcut"
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setShortcutMenu({ x: event.clientX, y: event.clientY }); }}
      onDoubleClick={() => { if (instanceState === PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED) onRestore?.(); }} onDragOver={(event) => { if ([...event.dataTransfer.types].includes('application/x-inscape-asset')) event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('application/x-inscape-asset'); if (assetsById.has(id)) {
        setShortcutIconId(id);
        setShortcutIconPresentation(DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION);
      } }}
      onKeyDown={(event) => { if (event.key === 'Enter' && !renaming && instanceState === PRESENTATION_BOARD_INSTANCE_STATE.MINIMIZED) { event.preventDefault(); onRestore?.(); } }}
      onPointerCancel={stopShortcutDrag} onPointerDown={beginShortcutDrag} onPointerMove={moveShortcutDrag}
      onPointerUp={stopShortcutDrag} style={{ left: shortcutPosition.left, top: shortcutPosition.top,
        ...shortcutPresentationStyle(shortcutIconPresentation) }} type="button">
      <span aria-hidden="true" className="system-workflow__desktop-shortcut-icon" data-custom={shortcutAsset ? true : undefined}>
        {shortcutAsset ? <ProgressiveArtworkImage asset={shortcutAsset} style={shortcutIconStyle(shortcutIconPresentation)} /> : 'DM'}
      </span>
      {renaming ? <input aria-label="Display Module shortcut name" autoFocus maxLength="48"
        onBlur={commitRename} onChange={(event) => setRenameValue(event.target.value)}
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
          if (event.key === 'Escape') { event.preventDefault(); setRenameValue(shortcutName); setRenaming(false); }
        }} value={renameValue} /> : <strong>{shortcutName}</strong>}
    </button>}
    {shortcutIconEditing && shortcutAsset && <section aria-label="Edit Display Module shortcut icon"
      className="system-workflow__shortcut-icon-editor" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); setShortcutIconEditing(false); }
      }} role="dialog" style={iconEditorPosition}>
      <div className="system-workflow__shortcut-icon-preview" aria-hidden="true">
        <ProgressiveArtworkImage asset={shortcutAsset} style={shortcutIconPreviewStyle(shortcutIconPresentation)} />
      </div>
      <div className="system-workflow__shortcut-icon-controls">
        <label><span>SIZE</span><input aria-label="Shortcut icon size" autoFocus max="150" min="40" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, size: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.size} /><output>{shortcutIconPresentation.size}px</output></label>
        <label><span>ZOOM</span><input aria-label="Shortcut icon zoom" max="3" min="0.75" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, scale: Number(event.target.value) }))} step="0.05" type="range" value={shortcutIconPresentation.scale} /><output>{Math.round(shortcutIconPresentation.scale * 100)}%</output></label>
        <label><span>X</span><input aria-label="Shortcut icon horizontal position" max="150" min="-150" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, offsetX: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.offsetX} /><output>{shortcutIconPresentation.offsetX > 0 ? '+' : ''}{shortcutIconPresentation.offsetX}</output></label>
        <label><span>Y</span><input aria-label="Shortcut icon vertical position" max="150" min="-150" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, offsetY: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.offsetY} /><output>{shortcutIconPresentation.offsetY > 0 ? '+' : ''}{shortcutIconPresentation.offsetY}</output></label>
        <label><span>FONT</span><input aria-label="Shortcut label size" max="20" min="7" onChange={(event) => setShortcutIconPresentation((current) => ({ ...current, labelSize: Number(event.target.value) }))} step="1" type="range" value={shortcutIconPresentation.labelSize} /><output>{shortcutIconPresentation.labelSize}px</output></label>
      </div>
      <footer><button onClick={() => setShortcutIconPresentation(DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION)} type="button">Reset</button><button onClick={() => setShortcutIconEditing(false)} type="button">Done</button><button aria-label="Close icon editor" className="system-workflow__shortcut-icon-editor-close" onClick={() => setShortcutIconEditing(false)} title="Close" type="button"><X /></button></footer>
    </section>}
    {view && instanceState === PRESENTATION_BOARD_INSTANCE_STATE.WINDOW
      && <article aria-label="Display Module" className="system-workflow__presentation-board"
      data-authoring-locked={authoringLocked || undefined}
      data-board-phase={boardPhase} data-board-scale={view.scale} data-maximized={maximized || undefined}
      data-scale-rendering={liveScaleRendering ? 'live' : 'settled'}
      data-inspecting={inspectionActive || undefined} data-inspection-atmosphere={inspectionAtmosphere || undefined}
      data-metadata-sidecar={metadataSidecarOpen || undefined}
      onTransitionEnd={finishBoardTransition} ref={boardNodeRef}
      style={{ '--workflow-identity-strip-height': `${view.fit.identityStripHeight}px`,
        '--workflow-metadata-width': `${metadataWidth}px`, height: renderedFrame.height,
        left: renderedFrame.left, top: renderedFrame.top, width: renderedFrame.width }}>
      <header className="system-workflow__identity-strip" onPointerCancel={stopBoardDrag} onPointerDown={beginBoardDrag}
        onPointerMove={moveBoardDrag} onPointerUp={stopBoardDrag}>
        <span className="system-workflow__identity-primary">
          <i aria-hidden="true" className="system-workflow__identity-mark">{avatarUrl ? <img alt="" src={avatarUrl} /> : <UserRound />}</i>
          <strong>{officialName}</strong><code>{compactAddress(address)}</code>
        </span>
        <span className="system-workflow__board-title">
          {inspectionActive && <span className="system-workflow__board-inspection-controls-host" ref={setInspectionControlsHost} />}
          <span className="system-workflow__composition-lock-controls">
            <strong>LOCK</strong>
            <button aria-label={authoringLocked ? 'Unlock Display Module composition' : 'Lock Display Module composition'}
              aria-pressed={authoringLocked} className="system-workflow__round-control system-workflow__composition-lock"
              onClick={onAuthoringLockToggle} type="button"><Lock /></button>
          </span>
          {metadataDocked && <span className="system-workflow__metadata-dock-controls">
            <strong>METADATA</strong>
            <button aria-label={metadataProjection === 'down' ? 'Close Metadata below Display Module bar' : 'Open Metadata below Display Module bar'}
              aria-pressed={metadataProjection === 'down'}
              className="system-workflow__round-control system-workflow__metadata-direction is-down"
              onClick={onMetadataInnerToggle} type="button"><ChevronDown /></button>
            <button aria-label={metadataProjection === 'side' ? 'Close Metadata beside Display Module' : 'Open Metadata beside Display Module'}
              aria-pressed={metadataProjection === 'side'}
              className="system-workflow__round-control system-workflow__metadata-direction is-side"
              onClick={onMetadataSidecarToggle} type="button"><ChevronRight /></button>
            <button aria-label="Undock Metadata" className="system-workflow__round-control" onClick={onMetadataUndock}
              type="button"><i aria-hidden="true" className="system-workflow__state-glyph is-docked" /></button>
            <button aria-label="Close Metadata" className="system-workflow__round-control is-close" onClick={onMetadataClose}
              type="button"><X /></button>
          </span>}
          <span className="system-workflow__board-window-controls">
            <button aria-label={maximized ? 'Restore Display Module' : 'Maximize Display Module'}
              className="system-workflow__round-control" disabled={inspectionActive} onClick={maximized ? restore : maximize} type="button">
              <i aria-hidden="true" className={`system-workflow__state-glyph${maximized ? '' : ' is-contained'}`} />
            </button>
            <button aria-label="Close Display Module to shortcut" className="system-workflow__round-control is-close"
              disabled={inspectionActive} onClick={minimizeToShortcut} type="button"><X /></button>
          </span>
        </span>
      </header>
      <div className="system-workflow__stage-viewport" ref={setSelectionOverlayHost} style={{ height: view.fit.stage.height * displayScale }}>
        <div className="system-workflow__stage" data-presentation-stage data-surface={displaySurface}
          style={{ height: liveScaleRendering ? liveStage?.height || view.fit.stage.height : settledStageHeight,
            transform: liveScaleRendering ? `scale(${liveTransformScale})` : undefined,
            width: liveScaleRendering ? liveStage?.width || view.fit.stage.width : settledStageWidth }}>
          {cloneElement(children, { boardScale: liveScaleRendering ? liveTransformScale : 1,
            interactionDisabled: children.props.interactionDisabled || boardPhase === 'maximizing' || boardPhase === 'restoring',
            renderingMode: liveScaleRendering ? 'live' : 'settled', selectionOverlayHost })}
        </div>
      </div>
      {metadataDocked && metadataProjection === 'down'
        && <div className="system-workflow__metadata-down-host">
          <aside aria-label="Metadata below Display Module bar" className="system-workflow__metadata-projection is-down">
            <div className="system-workflow__metadata-down-scroll">{renderMetadata?.()}</div>
          </aside>
        </div>}
      {metadataSidecarOpen && <aside aria-label="Metadata beside Display Module" className="system-workflow__metadata-projection is-side">
        <div className="system-workflow__metadata-side-scroll">{renderMetadata?.()}</div>
      </aside>}
      {boardPhase === 'window' && corners.map((corner) => <button aria-label={`Resize Display Module from ${corner}`}
        className={`system-workflow__board-resize-handle is-${corner}`} key={corner}
        onPointerCancel={stopBoardResize} onPointerDown={(event) => beginBoardResize(corner, event)}
        onKeyDown={(event) => resizeBoardFromKeyboard(corner, event)} onPointerUp={stopBoardResize} type="button" />)}
      <div className="system-workflow__board-inspection-host" ref={setInspectionHost}>
        {inspectionActive && inspectionHost && inspectionControlsHost
          ? renderInspection(inspectionHost, inspectionControlsHost) : null}
      </div>
    </article>}
    {shortcutMenu && createPortal(<RackMenu anchor={shortcutMenu} commands={[
      { id: 'rename', label: 'RENAME' }, { disabled: !shortcutIconId, id: 'edit-icon', label: 'EDIT ICON' },
      { disabled: !shortcutIconId, id: 'reset-icon', label: 'RESET ICON' },
    ]} label="Display Module shortcut commands" menuSurfaceId={menuSurface} onClose={() => setShortcutMenu(null)} onCommand={(id) => {
      if (id === 'rename') { setRenameValue(shortcutName); setRenaming(true); }
      if (id === 'edit-icon') setShortcutIconEditing(true);
      if (id === 'reset-icon') { setShortcutIconId(null); setShortcutIconPresentation(DEFAULT_PRESENTATION_BOARD_SHORTCUT_ICON_PRESENTATION); }
      setShortcutMenu(null);
    }} systemWorkflowOverlay />, document.body)}
  </div>;
}
