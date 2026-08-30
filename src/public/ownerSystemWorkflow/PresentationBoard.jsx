import { cloneElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import {
  PRESENTATION_BOARD_MINIMUM_PERCENTAGE,
  normalizePresentationBoardPercentage,
  presentationBoardInspectionFrame,
  projectPresentationBoardView,
  resizePresentationBoardView,
  setPresentationBoardScale,
} from './presentationBoardGeometry.js';

const compactAddress = (address) => address?.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;

const sameFrame = (left, right) => left && right
  && ['height', 'left', 'top', 'width'].every((key) => Math.abs(left[key] - right[key]) < 0.01);

export { default } from './PresentationBoardDefinitive.jsx';

function LegacyPresentationBoard({ children, documentGeometry, identity, inspectionActive = false,
  layoutMode = 'wide', onContextMenu, onInspectionCancel, profileAddress, reducedMotion = false,
  renderInspection }) {
  const [host, setHost] = useState(null);
  const [view, setView] = useState(null);
  const [inputValue, setInputValue] = useState('100');
  const [boardPosition, setBoardPosition] = useState(null);
  const [inspectionHost, setInspectionHost] = useState(null);
  const [inspectionPhase, setInspectionPhase] = useState('idle');
  const boardNodeRef = useRef(null);
  const boardDragRef = useRef(null);
  const completedTransitionRef = useRef(null);
  const inspectionPhaseRef = useRef(inspectionPhase);
  const inspectionSnapshotRef = useRef(null);
  inspectionPhaseRef.current = inspectionPhase;
  useLayoutEffect(() => {
    if (!host) return undefined;
    const options = { inset: layoutMode === 'narrow' ? 8 : 24,
      identityStripHeight: layoutMode === 'narrow' ? 34 : 38 };
    const measure = () => setView((current) => current
      ? resizePresentationBoardView(current, { width: host.clientWidth, height: host.clientHeight }, options)
      : projectPresentationBoardView(documentGeometry, { width: host.clientWidth, height: host.clientHeight }, 1, options));
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(host);
    globalThis.addEventListener?.('resize', measure);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', measure); };
  }, [documentGeometry, host, layoutMode]);

  const officialName = identity?.status === 'RESOLVED' && identity.name ? identity.name : 'IDENTITY RESOLVING';
  const avatarUrl = identity?.status === 'RESOLVED' ? identity.avatarUrl : null;
  const address = identity?.normalizedAddress || identity?.address || profileAddress;
  const zoomPercentage = Math.round((view?.scale || 1) * 100);
  useEffect(() => setInputValue(String(zoomPercentage)), [zoomPercentage]);

  const setZoomPercentage = (percentage) => setView((current) => current
    && setPresentationBoardScale(current, percentage / 100));
  const commitInput = () => {
    if (!view) return;
    const percentage = normalizePresentationBoardPercentage(inputValue, view.maximumPercentage, zoomPercentage);
    setInputValue(String(percentage));
    setZoomPercentage(percentage);
  };
  const stepInput = (event) => {
    if (!view || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const percentage = normalizePresentationBoardPercentage(
      zoomPercentage + (event.key === 'ArrowUp' ? 1 : -1), view.maximumPercentage, zoomPercentage,
    );
    setInputValue(String(percentage));
    setZoomPercentage(percentage);
  };
  const defaultTop = layoutMode === 'narrow' ? 48 : view?.frame.board.top || 0;
  const clampPosition = (position) => ({
    left: Math.max(8, Math.min((host?.clientWidth || 0) - (view?.frame.board.width || 0) - 8, position.left)),
    top: Math.max(8, Math.min((host?.clientHeight || 0) - (view?.frame.board.height || 0) - 8, position.top)),
  });
  const renderedPosition = view ? clampPosition(boardPosition || { left: view.frame.board.left, top: defaultTop }) : null;
  const persistentFrame = view && renderedPosition ? { ...view.frame.board, ...renderedPosition } : null;
  const geometryOptions = { inset: layoutMode === 'narrow' ? 8 : 24,
    identityStripHeight: layoutMode === 'narrow' ? 34 : 38 };
  const inspectionView = presentationBoardInspectionFrame(view,
    { width: host?.clientWidth, height: host?.clientHeight }, geometryOptions);
  const inspectFrame = inspectionView?.board || null;
  const renderedFrame = inspectionPhase === 'focusing' || inspectionPhase === 'inspecting'
    ? inspectFrame
    : inspectionPhase === 'restoring' && inspectionSnapshotRef.current
      ? inspectionSnapshotRef.current.frame
      : persistentFrame;
  const displayScale = inspectionPhase === 'focusing' || inspectionPhase === 'inspecting'
    ? inspectionView.scale
    : view?.scale || 1;

  useLayoutEffect(() => {
    if (!view || !renderedPosition) return;
    if (inspectionActive && inspectionPhase === 'idle') {
      inspectionSnapshotRef.current = { frame: { ...view.frame.board, ...renderedPosition }, position: renderedPosition };
      if (reducedMotion || sameFrame(inspectionSnapshotRef.current.frame, inspectFrame)) setInspectionPhase('inspecting');
      else {
        completedTransitionRef.current = null;
        setInspectionPhase('focusing');
      }
      return;
    }
    if (!inspectionActive && (inspectionPhase === 'focusing' || inspectionPhase === 'inspecting')) {
      if (inspectionPhase === 'focusing') completedTransitionRef.current = 'focusing';
      const currentRectangle = boardNodeRef.current?.getBoundingClientRect();
      if (reducedMotion || sameFrame(inspectFrame, inspectionSnapshotRef.current?.frame)
        || inspectionPhase === 'focusing' && sameFrame(currentRectangle, inspectionSnapshotRef.current?.frame)) {
        setBoardPosition(inspectionSnapshotRef.current?.position || null);
        inspectionSnapshotRef.current = null;
        setInspectionPhase('idle');
      } else {
        completedTransitionRef.current = null;
        setInspectionPhase('restoring');
      }
    }
  }, [inspectionActive, inspectionPhase, reducedMotion, renderedPosition, view]);

  useEffect(() => {
    if (inspectionPhase !== 'focusing') return undefined;
    const cancel = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onInspectionCancel?.();
    };
    globalThis.addEventListener?.('keydown', cancel, true);
    return () => globalThis.removeEventListener?.('keydown', cancel, true);
  }, [inspectionPhase, onInspectionCancel]);

  useEffect(() => {
    if (inspectionPhase !== 'restoring') return undefined;
    let cancelled = false;
    const finish = () => {
      if (cancelled || inspectionPhaseRef.current !== 'restoring'
        || completedTransitionRef.current === 'restoring') return;
      completedTransitionRef.current = 'restoring';
      setBoardPosition(inspectionSnapshotRef.current?.position || null);
      inspectionSnapshotRef.current = null;
      setInspectionPhase('idle');
    };
    const frame = requestAnimationFrame(() => {
      const transitions = (boardNodeRef.current?.getAnimations?.() || [])
        .filter(({ transitionProperty }) => ['height', 'left', 'top', 'width'].includes(transitionProperty));
      if (!transitions.length) finish();
      else Promise.allSettled(transitions.map(({ finished }) => finished)).then(finish);
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [inspectionPhase]);

  const finishInspectionTransition = (event) => {
    if (event.target !== event.currentTarget || !['height', 'left', 'top', 'width'].includes(event.propertyName)) return;
    if (completedTransitionRef.current === inspectionPhase) return;
    completedTransitionRef.current = inspectionPhase;
    if (inspectionPhase === 'focusing') setInspectionPhase('inspecting');
    else if (inspectionPhase === 'restoring') {
      setBoardPosition(inspectionSnapshotRef.current?.position || null);
      inspectionSnapshotRef.current = null;
      setInspectionPhase('idle');
    }
  };
  const beginBoardDrag = (event) => {
    if (event.button !== 0 || !renderedPosition || inspectionPhase !== 'idle') return;
    boardDragRef.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...renderedPosition };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBoardDrag = (event) => {
    const start = boardDragRef.current;
    if (!start || start.id !== event.pointerId) return;
    setBoardPosition(clampPosition({ left: start.left + event.clientX - start.clientX, top: start.top + event.clientY - start.clientY }));
  };
  const stopBoardDrag = (event) => { if (boardDragRef.current?.id === event.pointerId) boardDragRef.current = null; };
  return <div className="system-workflow__workbench" data-presentation-workbench onContextMenu={onContextMenu} ref={setHost}>
    {view && <article aria-label="Presentation Board" className="system-workflow__presentation-board"
      data-inspection-phase={inspectionPhase}
      data-board-scale={view.scale}
      onTransitionEnd={finishInspectionTransition}
      ref={boardNodeRef}
        style={{ '--workflow-identity-strip-height': `${view.fit.identityStripHeight}px`, height: renderedFrame.height,
        left: renderedFrame.left, top: renderedFrame.top, width: renderedFrame.width }}>
      <header className="system-workflow__identity-strip" onPointerCancel={stopBoardDrag} onPointerDown={beginBoardDrag}
        onPointerMove={moveBoardDrag} onPointerUp={stopBoardDrag}>
        <span className="system-workflow__identity-primary">
          <i aria-hidden="true" className="system-workflow__identity-mark">{avatarUrl ? <img alt="" src={avatarUrl} /> : <UserRound />}</i>
          <strong>{officialName}</strong><code>{compactAddress(address)}</code>
        </span>
        <small>OWNER · PRESENTATION BOARD</small>
      </header>
      <div className="system-workflow__stage-viewport" style={{ height: view.fit.stage.height * displayScale }}>
        <div className="system-workflow__stage" data-presentation-stage
          style={{ height: view.fit.stage.height, transform: `scale(${displayScale})`, width: view.fit.stage.width }}>
          {cloneElement(children, {
            boardScale: displayScale,
            interactionDisabled: children.props.interactionDisabled || inspectionPhase !== 'idle',
          })}
        </div>
      </div>
      <div className="system-workflow__board-inspection-host" ref={setInspectionHost}>
        {inspectionPhase === 'inspecting' && inspectionHost ? renderInspection?.(inspectionHost) : null}
      </div>
    </article>}
    {view && <div aria-label="Board zoom" className="system-workflow__board-zoom-controls"
      data-inspecting={inspectionPhase !== 'idle' || undefined} role="group">
      {inspectionPhase !== 'idle' && <span className="system-workflow__board-inspection-status">INSPECT</span>}
      <label className="system-workflow__board-zoom-slider">
        <input aria-label="Board zoom" max={view.maximumPercentage} min={PRESENTATION_BOARD_MINIMUM_PERCENTAGE}
          disabled={inspectionPhase !== 'idle'}
          onChange={(event) => { const percentage = Number(event.target.value); setInputValue(String(percentage)); setZoomPercentage(percentage); }}
          step="1" type="range" value={zoomPercentage} />
      </label>
      <label className="system-workflow__board-zoom-value">
        <input aria-label="Board zoom percentage" inputMode="numeric" max={view.maximumPercentage}
          disabled={inspectionPhase !== 'idle'}
          min={PRESENTATION_BOARD_MINIMUM_PERCENTAGE} onBlur={commitInput} onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); setInputValue(String(zoomPercentage)); event.currentTarget.select(); }
            else if (event.key === 'Enter') { event.preventDefault(); commitInput(); event.currentTarget.select(); }
            else stepInput(event);
          }} step="1" type="number" value={inputValue} />
        <span aria-hidden="true">%</span>
      </label>
    </div>}
  </div>;
}
