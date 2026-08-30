import { cloneElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, UserRound, X } from 'lucide-react';
import LatticePixelGrid from '../../lattice/rendering/LatticePixelGrid.jsx';
import RackMenu from '../menus/RackMenu.jsx';
import ProgressiveArtworkImage from './ProgressiveArtworkImage.jsx';
import { PRESENTATION_BOARD_METADATA_SIDECAR, presentationBoardInspectionFrame, projectPresentationBoardView,
  resizePresentationBoardFromCorner, resizePresentationBoardView } from './presentationBoardGeometry.js';

const compactAddress = (address) => address?.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;
const corners = ['nw', 'ne', 'sw', 'se'];
const WORKBENCH_CELL = 24;
const SHORTCUT_SIZE = { width: 82, height: 70 };
const sameFrame = (left, right) => left && right
  && ['height', 'left', 'top', 'width'].every((key) => Math.abs(left[key] - right[key]) < 0.01);
const snap = (value) => Math.round(value / WORKBENCH_CELL) * WORKBENCH_CELL;
const shortcutStorageKey = (profileAddress) => `inscape:workbench:presentation-board:${profileAddress || 'anonymous'}`;

function loadShortcut(profileAddress) {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(shortcutStorageKey(profileAddress)) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

export default function PresentationBoardDefinitive({ addShortcutRequest, assetsById = new Map(), children, documentGeometry,
  identity, inspectionAtmosphere = false, layoutMode = 'wide', metadataDocked = false, metadataProjection = 'closed', onContextMenu,
  onInspectionCancel, onMetadataClose, onMetadataProjectionChange, onMetadataUndock, onShortcutCreated,
  profileAddress, reducedMotion = false, renderInspection, renderMetadata }) {
  const storedShortcut = useMemo(() => loadShortcut(profileAddress), [profileAddress]);
  const [host, setHost] = useState(null);
  const [view, setView] = useState(null);
  const [boardPosition, setBoardPosition] = useState(null);
  const [inspectionHost, setInspectionHost] = useState(null);
  const [inspectionControlsHost, setInspectionControlsHost] = useState(null);
  const [selectionOverlayHost, setSelectionOverlayHost] = useState(null);
  const [boardPhase, setBoardPhase] = useState('window');
  const [open, setOpen] = useState(storedShortcut?.open !== false);
  const [shortcutPosition, setShortcutPosition] = useState(storedShortcut?.position || { left: 24, top: 72 });
  const [shortcutName, setShortcutName] = useState(storedShortcut?.name || 'PRESENTATION BOARD');
  const [shortcutIconId, setShortcutIconId] = useState(storedShortcut?.iconAssetId || null);
  const [shortcutMenu, setShortcutMenu] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(shortcutName);
  const boardNodeRef = useRef(null);
  const boardDragRef = useRef(null);
  const boardResizeRef = useRef(null);
  const shortcutDragRef = useRef(null);
  const handledAddRef = useRef(null);
  const completedTransitionRef = useRef(null);
  const boardPhaseRef = useRef(boardPhase);
  const windowSnapshotRef = useRef(null);
  const inspectionActive = Boolean(renderInspection);
  const sidecarOpen = metadataDocked && metadataProjection === 'side';
  const metadataWidth = layoutMode === 'narrow' ? Math.min(180, (host?.clientWidth || 390) * 0.42)
    : PRESENTATION_BOARD_METADATA_SIDECAR.trackWidth;
  boardPhaseRef.current = boardPhase;
  const geometryOptions = { inset: layoutMode === 'narrow' ? 8 : 24,
    identityStripHeight: layoutMode === 'narrow' ? 34 : 38,
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
    try { globalThis.localStorage?.setItem(shortcutStorageKey(profileAddress), JSON.stringify({
      iconAssetId: shortcutIconId, name: shortcutName, open, position: shortcutPosition,
    })); } catch { /* Workbench layout persistence is optional. */ }
  }, [open, profileAddress, shortcutIconId, shortcutName, shortcutPosition]);

  const clampShortcut = (position) => ({
    left: Math.max(0, Math.min((host?.clientWidth || SHORTCUT_SIZE.width) - SHORTCUT_SIZE.width, snap(position.left))),
    top: Math.max(0, Math.min((host?.clientHeight || SHORTCUT_SIZE.height) - SHORTCUT_SIZE.height, snap(position.top))),
  });
  useEffect(() => {
    if (!addShortcutRequest || !host || handledAddRef.current === addShortcutRequest.id) return;
    handledAddRef.current = addShortcutRequest.id;
    const bounds = host.getBoundingClientRect();
    setShortcutPosition(clampShortcut({ left: addShortcutRequest.x - bounds.left, top: addShortcutRequest.y - bounds.top }));
    setOpen(false);
    onShortcutCreated?.();
  }, [addShortcutRequest, host, onShortcutCreated]);

  const defaultTop = layoutMode === 'narrow' ? 48 : view?.frame.board.top || 0;
  const clampPosition = (position, frame = view?.frame.board, extraWidth = 0) => ({
    left: Math.max(8, Math.min((host?.clientWidth || 0) - (frame?.width || 0) - extraWidth - 8, position.left)),
    top: Math.max(8, Math.min((host?.clientHeight || 0) - (frame?.height || 0) - 8, position.top)),
  });
  const renderedPosition = view ? clampPosition(boardPosition || { left: view.frame.board.left, top: defaultTop },
    view.frame.board, sidecarOpen ? metadataWidth : 0) : null;
  const windowFrame = view && renderedPosition ? { ...view.frame.board, ...renderedPosition } : null;
  const maximumView = presentationBoardInspectionFrame(view, { width: host?.clientWidth, height: host?.clientHeight },
    geometryOptions);
  const maximumFrame = maximumView?.board || null;
  const maximized = boardPhase === 'maximizing' || boardPhase === 'maximized';
  const renderedFrame = maximized ? maximumFrame
    : boardPhase === 'restoring' && windowSnapshotRef.current ? windowSnapshotRef.current.frame : windowFrame;
  const displayScale = maximized ? maximumView?.scale || 1 : view?.scale || 1;

  const maximize = () => {
    if (!view || !renderedPosition || boardPhase !== 'window') return;
    windowSnapshotRef.current = { frame: { ...view.frame.board, ...renderedPosition }, position: renderedPosition };
    if (reducedMotion || sameFrame(windowSnapshotRef.current.frame, maximumFrame)) setBoardPhase('maximized');
    else { completedTransitionRef.current = null; setBoardPhase('maximizing'); }
  };
  const restore = () => {
    if (!windowSnapshotRef.current || !['maximized', 'maximizing'].includes(boardPhase)) return;
    if (inspectionActive) { onInspectionCancel?.(); return; }
    if (reducedMotion || sameFrame(maximumFrame, windowSnapshotRef.current.frame)) {
      setBoardPosition(windowSnapshotRef.current.position); windowSnapshotRef.current = null; setBoardPhase('window');
    } else { completedTransitionRef.current = null; setBoardPhase('restoring'); }
  };

  useEffect(() => {
    if (boardPhase !== 'restoring') return undefined;
    let cancelled = false;
    const finish = () => {
      if (cancelled || boardPhaseRef.current !== 'restoring' || completedTransitionRef.current === 'restoring') return;
      completedTransitionRef.current = 'restoring'; setBoardPosition(windowSnapshotRef.current?.position || null);
      windowSnapshotRef.current = null; setBoardPhase('window');
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
    if (boardPhase === 'maximizing') setBoardPhase('maximized');
    else if (boardPhase === 'restoring') {
      setBoardPosition(windowSnapshotRef.current?.position || null); windowSnapshotRef.current = null; setBoardPhase('window');
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
      top: start.top + event.clientY - start.clientY }, undefined, sidecarOpen ? metadataWidth : 0));
  };
  const stopBoardDrag = (event) => { if (boardDragRef.current?.id === event.pointerId) boardDragRef.current = null; };
  const beginBoardResize = (corner, event) => {
    if (event.button !== 0 || !view || !windowFrame || boardPhase !== 'window') return;
    event.preventDefault(); event.stopPropagation();
    boardResizeRef.current = { corner, id: event.pointerId, clientX: event.clientX, clientY: event.clientY, frame: windowFrame, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardResize = (event) => {
    const start = boardResizeRef.current; if (!start || start.id !== event.pointerId) return;
    const resized = resizePresentationBoardFromCorner(start.view, start.frame, start.corner,
      { x: event.clientX - start.clientX, y: event.clientY - start.clientY });
    if (!resized) return;
    setView(resized.view); setBoardPosition(clampPosition(resized.position, resized.view.frame.board,
      sidecarOpen ? metadataWidth : 0));
  };
  const stopBoardResize = (event) => { if (boardResizeRef.current?.id === event.pointerId) boardResizeRef.current = null; };
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
    const frame = boardPhase === 'maximized' ? maximumFrame : windowFrame;
    setShortcutPosition(clampShortcut({ left: frame.left, top: frame.top })); setOpen(false); onShortcutCreated?.();
  };
  const commitRename = () => {
    const value = renameValue.trim(); if (value) setShortcutName(value.slice(0, 48)); else setRenameValue(shortcutName);
    setRenaming(false);
  };

  const officialName = identity?.status === 'RESOLVED' && identity.name ? identity.name : 'IDENTITY RESOLVING';
  const avatarUrl = identity?.status === 'RESOLVED' ? identity.avatarUrl : null;
  const address = identity?.normalizedAddress || identity?.address || profileAddress;
  const shortcutAsset = shortcutIconId ? assetsById.get(shortcutIconId) : null;
  const workbenchField = host ? { cellSize: WORKBENCH_CELL, left: 0, top: 0 } : null;
  return <div className="system-workflow__workbench" data-presentation-workbench onContextMenu={onContextMenu} ref={setHost}>
    {host && <LatticePixelGrid color="var(--study-grid)" field={workbenchField} guideInterval={1}
      guideSize={1} height={host.clientHeight} mode="LINES" width={host.clientWidth} />}
    {!open && <button aria-label={`Open ${shortcutName}`} className="system-workflow__desktop-shortcut"
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setShortcutMenu({ x: event.clientX, y: event.clientY }); }}
      onDoubleClick={() => setOpen(true)} onDragOver={(event) => { if ([...event.dataTransfer.types].includes('application/x-inscape-asset')) event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('application/x-inscape-asset'); if (assetsById.has(id)) setShortcutIconId(id); }}
      onKeyDown={(event) => { if (event.key === 'Enter' && !renaming) { event.preventDefault(); setOpen(true); } }}
      onPointerCancel={stopShortcutDrag} onPointerDown={beginShortcutDrag} onPointerMove={moveShortcutDrag}
      onPointerUp={stopShortcutDrag} style={{ left: shortcutPosition.left, top: shortcutPosition.top }} type="button">
      <span aria-hidden="true" className="system-workflow__desktop-shortcut-icon">
        {shortcutAsset ? <ProgressiveArtworkImage asset={shortcutAsset} /> : 'PB'}
      </span>
      {renaming ? <input aria-label="Presentation Board shortcut name" autoFocus maxLength="48"
        onBlur={commitRename} onChange={(event) => setRenameValue(event.target.value)}
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
          if (event.key === 'Escape') { event.preventDefault(); setRenameValue(shortcutName); setRenaming(false); }
        }} value={renameValue} /> : <strong>{shortcutName}</strong>}
    </button>}
    {view && open && <article aria-label="Presentation Board" className="system-workflow__presentation-board"
      data-board-phase={boardPhase} data-board-scale={view.scale} data-maximized={maximized || undefined}
      data-inspecting={inspectionActive || undefined} data-inspection-atmosphere={inspectionAtmosphere || undefined}
      data-metadata-sidecar={sidecarOpen || undefined}
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
          {metadataDocked && <span className="system-workflow__metadata-dock-controls">
            <strong>METADATA</strong>
            <button aria-label="Open Metadata below Board bar" aria-pressed={metadataProjection === 'down'}
              className="system-workflow__round-control"
              onClick={() => onMetadataProjectionChange?.(metadataProjection === 'down' ? 'closed' : 'down')} type="button"><ChevronDown /></button>
            <button aria-label="Open Metadata beside Presentation Board" aria-pressed={metadataProjection === 'side'}
              className="system-workflow__round-control"
              onClick={() => onMetadataProjectionChange?.(metadataProjection === 'side' ? 'closed' : 'side')} type="button"><ChevronRight /></button>
            <button aria-label="Undock Metadata" className="system-workflow__round-control" onClick={onMetadataUndock}
              type="button"><i aria-hidden="true" className="system-workflow__state-glyph is-docked" /></button>
            <button aria-label="Close Metadata" className="system-workflow__round-control is-close" onClick={onMetadataClose}
              type="button"><X /></button>
          </span>}
          <span className="system-workflow__board-window-controls">
            <button aria-label={maximized ? 'Restore Presentation Board' : 'Maximize Presentation Board'}
              className="system-workflow__round-control" disabled={inspectionActive} onClick={maximized ? restore : maximize} type="button">
              <i aria-hidden="true" className={`system-workflow__state-glyph${maximized ? '' : ' is-contained'}`} />
            </button>
            <button aria-label="Close Presentation Board to shortcut" className="system-workflow__round-control is-close"
              disabled={inspectionActive} onClick={minimizeToShortcut} type="button"><X /></button>
          </span>
        </span>
      </header>
      <div className="system-workflow__stage-viewport" ref={setSelectionOverlayHost} style={{ height: view.fit.stage.height * displayScale }}>
        <div className="system-workflow__stage" data-presentation-stage
          style={{ height: view.fit.stage.height, transform: `scale(${displayScale})`, width: view.fit.stage.width }}>
          {cloneElement(children, { boardScale: displayScale,
            interactionDisabled: children.props.interactionDisabled || boardPhase === 'maximizing' || boardPhase === 'restoring',
            selectionOverlayHost })}
        </div>
      </div>
      {metadataDocked && metadataProjection === 'down'
        && <div className="system-workflow__metadata-down-host">
          <aside aria-label="Metadata below Presentation Board bar" className="system-workflow__metadata-projection is-down">
            <div className="system-workflow__metadata-down-scroll">{renderMetadata?.()}</div>
          </aside>
        </div>}
      {sidecarOpen && <aside aria-label="Metadata beside Presentation Board" className="system-workflow__metadata-projection is-side">
        <div className="system-workflow__metadata-side-scroll">{renderMetadata?.()}</div>
      </aside>}
      {boardPhase === 'window' && corners.map((corner) => <button aria-label={`Resize Presentation Board from ${corner}`}
        className={`system-workflow__board-resize-handle is-${corner}`} key={corner}
        onPointerCancel={stopBoardResize} onPointerDown={(event) => beginBoardResize(corner, event)}
        onPointerUp={stopBoardResize} type="button" />)}
      <div className="system-workflow__board-inspection-host" ref={setInspectionHost}>
        {inspectionActive && inspectionHost && inspectionControlsHost
          ? renderInspection(inspectionHost, inspectionControlsHost) : null}
      </div>
    </article>}
    {shortcutMenu && createPortal(<RackMenu anchor={shortcutMenu} commands={[
      { id: 'rename', label: 'RENAME' }, { disabled: !shortcutIconId, id: 'reset-icon', label: 'RESET ICON' },
    ]} label="Presentation Board shortcut commands" onClose={() => setShortcutMenu(null)} onCommand={(id) => {
      if (id === 'rename') { setRenameValue(shortcutName); setRenaming(true); }
      if (id === 'reset-icon') setShortcutIconId(null);
      setShortcutMenu(null);
    }} systemWorkflowOverlay />, document.body)}
  </div>;
}
