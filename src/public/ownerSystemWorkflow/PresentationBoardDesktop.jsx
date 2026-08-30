import { cloneElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Minus, UserRound } from 'lucide-react';
import { presentationBoardInspectionFrame, projectPresentationBoardView, resizePresentationBoardFromCorner,
  resizePresentationBoardView } from './presentationBoardGeometry.js';

const compactAddress = (address) => address?.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;
const corners = ['nw', 'ne', 'sw', 'se'];
const sameFrame = (left, right) => left && right
  && ['height', 'left', 'top', 'width'].every((key) => Math.abs(left[key] - right[key]) < 0.01);

export default function PresentationBoardDesktop({ addShortcutRequest, children, documentGeometry, identity, layoutMode = 'wide',
  onContextMenu, onInspectionCancel, onShortcutCreated, profileAddress, reducedMotion = false, renderInspection }) {
  const [host, setHost] = useState(null);
  const [view, setView] = useState(null);
  const [boardPosition, setBoardPosition] = useState(null);
  const [inspectionHost, setInspectionHost] = useState(null);
  const [boardPhase, setBoardPhase] = useState('window');
  const [open, setOpen] = useState(true);
  const [shortcutPosition, setShortcutPosition] = useState({ left: 32, top: 72 });
  const boardNodeRef = useRef(null);
  const boardDragRef = useRef(null);
  const boardResizeRef = useRef(null);
  const handledAddRef = useRef(null);
  const completedTransitionRef = useRef(null);
  const boardPhaseRef = useRef(boardPhase);
  const windowSnapshotRef = useRef(null);
  const inspectionActive = Boolean(renderInspection);
  boardPhaseRef.current = boardPhase;
  const geometryOptions = { inset: layoutMode === 'narrow' ? 8 : 24,
    identityStripHeight: layoutMode === 'narrow' ? 34 : 38 };

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
  }, [documentGeometry, host, layoutMode]);

  useEffect(() => {
    if (!addShortcutRequest || !host || handledAddRef.current === addShortcutRequest.id) return;
    handledAddRef.current = addShortcutRequest.id;
    const bounds = host.getBoundingClientRect();
    setShortcutPosition({
      left: Math.max(8, Math.min(host.clientWidth - 88, addShortcutRequest.x - bounds.left)),
      top: Math.max(8, Math.min(host.clientHeight - 72, addShortcutRequest.y - bounds.top)),
    });
    setOpen(false);
    onShortcutCreated?.();
  }, [addShortcutRequest, host, onShortcutCreated]);

  const defaultTop = layoutMode === 'narrow' ? 48 : view?.frame.board.top || 0;
  const clampPosition = (position, frame = view?.frame.board) => ({
    left: Math.max(8, Math.min((host?.clientWidth || 0) - (frame?.width || 0) - 8, position.left)),
    top: Math.max(8, Math.min((host?.clientHeight || 0) - (frame?.height || 0) - 8, position.top)),
  });
  const renderedPosition = view ? clampPosition(boardPosition || { left: view.frame.board.left, top: defaultTop }) : null;
  const windowFrame = view && renderedPosition ? { ...view.frame.board, ...renderedPosition } : null;
  const maximumView = presentationBoardInspectionFrame(view,
    { width: host?.clientWidth, height: host?.clientHeight }, geometryOptions);
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
      setBoardPosition(windowSnapshotRef.current.position);
      windowSnapshotRef.current = null;
      setBoardPhase('window');
    } else { completedTransitionRef.current = null; setBoardPhase('restoring'); }
  };

  useLayoutEffect(() => {
    if (inspectionActive && boardPhase === 'window') maximize();
  }, [inspectionActive, boardPhase, view]);

  useEffect(() => {
    if (boardPhase !== 'restoring') return undefined;
    let cancelled = false;
    const finish = () => {
      if (cancelled || boardPhaseRef.current !== 'restoring' || completedTransitionRef.current === 'restoring') return;
      completedTransitionRef.current = 'restoring';
      setBoardPosition(windowSnapshotRef.current?.position || null);
      windowSnapshotRef.current = null;
      setBoardPhase('window');
    };
    const frame = requestAnimationFrame(() => {
      const transitions = (boardNodeRef.current?.getAnimations?.() || [])
        .filter(({ transitionProperty }) => ['height', 'left', 'top', 'width'].includes(transitionProperty));
      if (!transitions.length) finish();
      else Promise.allSettled(transitions.map(({ finished }) => finished)).then(finish);
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [boardPhase]);

  useEffect(() => {
    if (boardPhase !== 'maximized' || inspectionActive) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); restore();
    };
    globalThis.addEventListener?.('keydown', onKeyDown, true);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown, true);
  }, [boardPhase, inspectionActive]);

  const finishBoardTransition = (event) => {
    if (event.target !== event.currentTarget || !['height', 'left', 'top', 'width'].includes(event.propertyName)) return;
    if (completedTransitionRef.current === boardPhase) return;
    completedTransitionRef.current = boardPhase;
    if (boardPhase === 'maximizing') setBoardPhase('maximized');
    else if (boardPhase === 'restoring') {
      setBoardPosition(windowSnapshotRef.current?.position || null);
      windowSnapshotRef.current = null;
      setBoardPhase('window');
    }
  };
  const beginBoardDrag = (event) => {
    if (event.button !== 0 || !renderedPosition || boardPhase !== 'window' || event.target.closest('button')) return;
    boardDragRef.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...renderedPosition };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardDrag = (event) => {
    const start = boardDragRef.current;
    if (!start || start.id !== event.pointerId) return;
    setBoardPosition(clampPosition({ left: start.left + event.clientX - start.clientX,
      top: start.top + event.clientY - start.clientY }));
  };
  const stopBoardDrag = (event) => { if (boardDragRef.current?.id === event.pointerId) boardDragRef.current = null; };
  const beginBoardResize = (corner, event) => {
    if (event.button !== 0 || !view || !windowFrame || boardPhase !== 'window') return;
    event.preventDefault(); event.stopPropagation();
    boardResizeRef.current = { corner, id: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      frame: windowFrame, view };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardResize = (event) => {
    const start = boardResizeRef.current;
    if (!start || start.id !== event.pointerId) return;
    const resized = resizePresentationBoardFromCorner(start.view, start.frame, start.corner,
      { x: event.clientX - start.clientX, y: event.clientY - start.clientY });
    if (!resized) return;
    setView(resized.view);
    setBoardPosition(clampPosition(resized.position, resized.view.frame.board));
  };
  const stopBoardResize = (event) => { if (boardResizeRef.current?.id === event.pointerId) boardResizeRef.current = null; };
  useEffect(() => {
    const move = (event) => moveBoardResize(event);
    const stop = (event) => stopBoardResize(event);
    globalThis.addEventListener?.('pointermove', move, true);
    globalThis.addEventListener?.('pointerup', stop, true);
    globalThis.addEventListener?.('pointercancel', stop, true);
    return () => {
      globalThis.removeEventListener?.('pointermove', move, true);
      globalThis.removeEventListener?.('pointerup', stop, true);
      globalThis.removeEventListener?.('pointercancel', stop, true);
    };
  });
  const minimizeToShortcut = () => {
    if (!windowFrame || inspectionActive) return;
    const frame = boardPhase === 'maximized' ? maximumFrame : windowFrame;
    setShortcutPosition(clampPosition({ left: frame.left, top: frame.top }, { width: 80, height: 64 }));
    setOpen(false);
    onShortcutCreated?.();
  };

  const officialName = identity?.status === 'RESOLVED' && identity.name ? identity.name : 'IDENTITY RESOLVING';
  const avatarUrl = identity?.status === 'RESOLVED' ? identity.avatarUrl : null;
  const address = identity?.normalizedAddress || identity?.address || profileAddress;
  return <div className="system-workflow__workbench" data-presentation-workbench onContextMenu={onContextMenu} ref={setHost}>
    {!open && <button aria-label="Open Presentation Board" className="system-workflow__desktop-shortcut"
      onDoubleClick={() => setOpen(true)} onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); setOpen(true); }
      }} style={{ left: shortcutPosition.left, top: shortcutPosition.top }} type="button">
      <span aria-hidden="true">PB</span><strong>PRESENTATION BOARD</strong>
    </button>}
    {view && open && <article aria-label="Presentation Board" className="system-workflow__presentation-board"
      data-board-phase={boardPhase} data-board-scale={view.scale} data-maximized={maximized || undefined}
      onTransitionEnd={finishBoardTransition} ref={boardNodeRef}
      style={{ '--workflow-identity-strip-height': `${view.fit.identityStripHeight}px`, height: renderedFrame.height,
        left: renderedFrame.left, top: renderedFrame.top, width: renderedFrame.width }}>
      <header className="system-workflow__identity-strip" onPointerCancel={stopBoardDrag} onPointerDown={beginBoardDrag}
        onPointerMove={moveBoardDrag} onPointerUp={stopBoardDrag}>
        <span className="system-workflow__identity-primary">
          <i aria-hidden="true" className="system-workflow__identity-mark">{avatarUrl ? <img alt="" src={avatarUrl} /> : <UserRound />}</i>
          <strong>{officialName}</strong><code>{compactAddress(address)}</code>
        </span>
        <span className="system-workflow__board-title"><small>OWNER · PRESENTATION BOARD</small>
          <span className="system-workflow__board-window-controls">
            <button aria-label={maximized ? 'Restore Presentation Board' : 'Maximize Presentation Board'}
              disabled={inspectionActive} onClick={maximized ? restore : maximize} type="button">
              {maximized ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            </button>
            <button aria-label="Minimize Presentation Board to shortcut" disabled={inspectionActive}
              onClick={minimizeToShortcut} type="button"><Minus aria-hidden="true" /></button>
          </span>
        </span>
      </header>
      <div className="system-workflow__stage-viewport" style={{ height: view.fit.stage.height * displayScale }}>
        <div className="system-workflow__stage" data-presentation-stage
          style={{ height: view.fit.stage.height, transform: `scale(${displayScale})`, width: view.fit.stage.width }}>
          {cloneElement(children, { boardScale: displayScale,
            interactionDisabled: children.props.interactionDisabled || boardPhase === 'maximizing' || boardPhase === 'restoring' })}
        </div>
      </div>
      {boardPhase === 'window' && corners.map((corner) => <button aria-label={`Resize Presentation Board from ${corner}`}
        className={`system-workflow__board-resize-handle is-${corner}`} key={corner}
        onPointerCancel={stopBoardResize} onPointerDown={(event) => beginBoardResize(corner, event)}
        onPointerUp={stopBoardResize} type="button" />)}
      <div className="system-workflow__board-inspection-host" ref={setInspectionHost}>
        {boardPhase === 'maximized' && inspectionActive && inspectionHost ? renderInspection(inspectionHost) : null}
      </div>
    </article>}
  </div>;
}
