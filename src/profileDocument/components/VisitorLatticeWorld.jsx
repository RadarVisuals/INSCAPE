import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import { LATTICE_PRODUCTION_COORDINATES, latticeProductionTableId } from '../../lattice/domain/latticeProductionDraft.js';
import { assertValidLatticeProductionPublication } from '../../lattice/domain/latticeProductionPublication.js';
import {
  DEFAULT_LATTICE_INTERACTION_CONFIG, addWheelDelta, createPointerGesture, entryLatticeCoordinate,
  finishPointerGesture, keyboardDirection, latticeDestination, resolveWheelDestination, updatePointerGesture,
} from '../../lattice/controller/latticeNavigation.js';
import {
  clampLatticeOwnerCameraY, createWidthFitLatticeOwnerViewport, updateLatticeOwnerCameraY,
} from '../../lattice/controller/latticeOwnerViewport.js';
import LatticeNavigationOverlay from '../../lattice/rendering/LatticeNavigationOverlay.jsx';
import LatticeFocusViewer from '../../lattice/rendering/LatticeFocusViewer.jsx';
import LatticeProfileRail from '../../lattice/rendering/LatticeProfileRail.jsx';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import LatticeProductionTableRenderer from '../../lattice/rendering/LatticeProductionTableRenderer.jsx';
import { createLatticeProductionFocusViewModel } from '../../lattice/rendering/latticeProductionFocusViewModel.js';
import { preloadIdentityProfileImage } from '../../public/identity/preloadIdentityProfileImage.js';
import KeeperDock from '../../public/KeeperDock.jsx';
import {
  createKeeperPointerFollowScheduler,
  keeperClickToMoveAllowed,
  keeperClickToMoveTargetAllowed,
  keeperPointerFollowAllowed,
  keeperPointerFollowSpeedMultiplier,
  keeperPointerTarget,
} from '../../public/keeperPointerFollow.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import '../../lattice/rendering/latticeMenuSurface.css';
import './visitorLatticeWorld.css';

const LatticeProductionIdentityDossier = lazy(() => import('../../lattice/rendering/LatticeProductionIdentityDossier.jsx'));
const sameCoordinate = (left, right) => left.x === right.x && left.y === right.y;
const frozenRectangle = ({ height, left, top, width }) => Object.freeze({ height, left, top, width });
const compactAddress = (address) => `${address.slice(0, 10)}…${address.slice(-6)}`;

export default function VisitorLatticeWorld({
  document,
  keeperVisible = true,
  onCancelKeeperDock,
  onDockKeeper,
  onExit,
  onMoveKeeper,
  onOpenDirectory,
  onReleaseKeeper,
  onReturn,
  onUpdateKeeperDock,
}) {
  const lattice = useMemo(() => assertValidLatticeProductionPublication(document.lattice), [document.lattice]);
  const rootRef = useRef(null);
  const activeRef = useRef(entryLatticeCoordinate());
  const gestureRef = useRef(null);
  const cameraGestureRef = useRef(null);
  const snapTimerRef = useRef(null);
  const wheelResetTimerRef = useRef(null);
  const wheelAccumulatorRef = useRef({ x: 0, y: 0 });
  const wheelBlockedUntilRef = useRef(0);
  const identityControlRef = useRef(null);
  const identityOpenRequestRef = useRef(0);
  const keeperPointerFollowRef = useRef(null);
  const keeperPointerTargetRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState(() => entryLatticeCoordinate());
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapping, setSnapping] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraOffsets, setCameraOffsets] = useState({});
  const [spacePressed, setSpacePressed] = useState(false);
  const [placementMedia, setPlacementMedia] = useState({});
  const [viewerSession, setViewerSession] = useState(null);
  const [identityOpening, setIdentityOpening] = useState(false);
  const [identitySession, setIdentitySession] = useState(null);
  const [keeperDockActive, setKeeperDockActive] = useState(false);
  const [keeperFollowCursor, setKeeperFollowCursor] = useState(true);
  const [keeperMovementSpeed, setKeeperMovementSpeed] = useState('normal');
  const profileIdentity = useProfileIdentity(document.profile.address);
  const profileContractFacts = useProfileContractFacts(document.profile.address, { enabled: Boolean(identityOpening || identitySession) });
  const identityRack = useMemo(() => createPublishedIdentityRackViewModel({
    contractFacts: profileContractFacts, document, identity: profileIdentity,
  }), [document, profileContractFacts, profileIdentity]);
  const officialIdentity = useMemo(() => ({
    avatarUrl: identityRack?.profile.avatarUrl || document.profile.cachedIdentity.avatarUrl || null,
    displayName: identityRack?.profile.displayName || document.profile.cachedIdentity.name || 'UNNAMED PROFILE',
    secondaryLabel: compactAddress(document.profile.address),
  }), [document.profile.address, document.profile.cachedIdentity.avatarUrl, document.profile.cachedIdentity.name, identityRack]);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const plane = createWidthFitLatticeOwnerViewport(dimensions);
  const activeTableId = latticeProductionTableId(active);
  const activeCameraY = clampLatticeOwnerCameraY(cameraOffsets[activeTableId] || 0, plane);
  const keeperDockHandoff = useMemo(() => ({
    cancel: onCancelKeeperDock,
    exit: onReleaseKeeper,
    start: onDockKeeper,
    updateBounds: onUpdateKeeperDock,
  }), [onCancelKeeperDock, onDockKeeper, onReleaseKeeper, onUpdateKeeperDock]);
  const keeperPointerFollowEnabled = keeperPointerFollowAllowed({
    cameraGestureActive: cameraActive,
    followCursor: keeperFollowCursor,
    gestureActive,
    identityActive: Boolean(identityOpening || identitySession),
    keeperDockActive,
    settling: snapping,
    viewerActive: Boolean(viewerSession),
  });
  const keeperClickToMoveEnabled = keeperClickToMoveAllowed({
    cameraGestureActive: cameraActive,
    followCursor: keeperFollowCursor,
    identityActive: Boolean(identityOpening || identitySession),
    keeperDockActive,
    settling: snapping,
    viewerActive: Boolean(viewerSession),
  });

  useEffect(() => {
    const scheduler = createKeeperPointerFollowScheduler((clientX, clientY) => {
      onMoveKeeper?.(clientX, clientY, {
        continuous: true,
        reducedMotion,
        speedMultiplier: keeperPointerFollowSpeedMultiplier(keeperMovementSpeed),
      });
    });
    keeperPointerFollowRef.current = scheduler;
    return () => {
      scheduler.cancel();
      if (keeperPointerFollowRef.current === scheduler) keeperPointerFollowRef.current = null;
    };
  }, [keeperMovementSpeed, onMoveKeeper, reducedMotion]);

  useEffect(() => {
    if (keeperPointerFollowEnabled) return;
    keeperPointerTargetRef.current = null;
    keeperPointerFollowRef.current?.cancel();
  }, [keeperPointerFollowEnabled]);

  useEffect(() => {
    if (!keeperPointerFollowEnabled || !keeperPointerTargetRef.current) return;
    keeperPointerFollowRef.current?.push(keeperPointerTargetRef.current);
  }, [dimensions.height, dimensions.width, keeperPointerFollowEnabled]);

  const handlePlacementMediaState = useCallback((state) => {
    const key = `${state.tableId}:${state.placementId}`;
    setPlacementMedia((current) => {
      const previous = current[key];
      if (previous?.status === state.status && previous?.media?.src === state.media?.src
        && previous?.dimensions?.width === state.dimensions?.width
        && previous?.dimensions?.height === state.dimensions?.height) return current;
      return { ...current, [key]: state };
    });
  }, []);

  const openPlacementViewer = useCallback(async ({ element, placement, tableId }) => {
    if (tableId !== activeTableId || viewerSession) return;
    const mediaState = placementMedia[`${tableId}:${placement.id}`];
    if (mediaState?.status !== 'ready' || !mediaState.dimensions) return;
    const originRectangle = element.getBoundingClientRect();
    const nativeImage = new Image();
    nativeImage.decoding = 'async';
    nativeImage.referrerPolicy = 'no-referrer';
    nativeImage.src = mediaState.media.src;
    try { await nativeImage.decode(); } catch { /* The viewer retains its honest media-failure state. */ }
    if (!element.isConnected) return;
    setViewerSession({ originRectangle, placementId: placement.id, returnFocus: element, tableId });
  }, [activeTableId, placementMedia, viewerSession]);

  const viewerTable = viewerSession ? lattice.tables.find(({ id }) => id === viewerSession.tableId) : null;
  const viewerEntries = useMemo(() => (viewerTable?.placements || []).map((placement) => {
    const decoded = placementMedia[`${viewerTable.id}:${placement.id}`];
    const model = createLatticeProductionFocusViewModel(placement, null, { trustPublishedMetadata: true });
    return model && decoded?.status === 'ready' && decoded.dimensions
      ? { ...model, focusDimensions: decoded.dimensions, media: { ...model.media, src: decoded.media.src } } : null;
  }).filter(Boolean), [placementMedia, viewerTable]);
  const viewerPosition = viewerEntries.findIndex(({ placement }) => placement.id === viewerSession?.placementId);
  const viewerEntry = viewerPosition >= 0 ? viewerEntries[viewerPosition] : null;
  const findPlacementElement = useCallback((placementId) => [...(rootRef.current
    ?.querySelectorAll('.visitor-lattice-world__table[data-active] [data-placement-id]') || [])]
    .find((node) => node.dataset.placementId === placementId), []);
  const navigateViewer = useCallback((direction) => {
    if (!viewerEntries.length || viewerPosition < 0) return;
    const destination = viewerEntries[(viewerPosition + direction + viewerEntries.length) % viewerEntries.length];
    const element = findPlacementElement(destination.placement.id);
    setViewerSession((current) => current && ({ ...current, placementId: destination.placement.id,
      returnFocus: element || current.returnFocus }));
  }, [findPlacementElement, viewerEntries, viewerPosition]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const update = () => setDimensions({ width: Math.max(1, node.clientWidth), height: Math.max(1, node.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.focus({ preventScroll: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    clearTimeout(snapTimerRef.current);
    clearTimeout(wheelResetTimerRef.current);
  }, []);

  useEffect(() => {
    identityOpenRequestRef.current += 1;
    setIdentityOpening(false);
    setIdentitySession(null);
  }, [document.profile.address]);

  const settle = useCallback((destination, offset = { x: 0, y: 0 }) => {
    setDragOffset(offset);
    requestAnimationFrame(() => {
      activeRef.current = destination;
      setActive(destination);
      setSnapping(true);
      setDragOffset({ x: 0, y: 0 });
      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => setSnapping(false), reducedMotion ? 0 : DEFAULT_LATTICE_INTERACTION_CONFIG.snapDuration);
    });
  }, [reducedMotion]);

  const finishGesture = useCallback((cancelled = false) => {
    const current = gestureRef.current;
    if (!current) return;
    gestureRef.current = null;
    setGestureActive(false);
    if (!current.gesture.activated) {
      setDragOffset({ x: 0, y: 0 });
      return;
    }
    settle(cancelled ? { ...activeRef.current } : finishPointerGesture(current.gesture, activeRef.current), current.gesture.offset);
  }, [settle]);

  const navigate = useCallback((destination) => {
    if (snapping || gestureRef.current || sameCoordinate(destination, activeRef.current)) return;
    settle(destination);
  }, [settle, snapping]);

  const setCameraY = useCallback((tableId, value) => {
    setCameraOffsets((current) => ({ ...current, [tableId]: value }));
  }, []);

  const finishCamera = useCallback((cancelled = false) => {
    const current = cameraGestureRef.current;
    if (!current) return false;
    cameraGestureRef.current = null;
    if (cancelled) setCameraY(current.tableId, current.startCameraY);
    setCameraActive(false);
    return true;
  }, [setCameraY]);

  const releaseVisitorInputOwnership = useCallback(() => {
    const node = rootRef.current;
    const pointerIds = [gestureRef.current?.pointerId, cameraGestureRef.current?.pointerId]
      .filter((pointerId) => Number.isInteger(pointerId));
    gestureRef.current = null;
    cameraGestureRef.current = null;
    pointerIds.forEach((pointerId) => {
      if (node?.hasPointerCapture?.(pointerId)) node.releasePointerCapture(pointerId);
    });
    wheelAccumulatorRef.current = { x: 0, y: 0 };
    setGestureActive(false);
    setCameraActive(false);
    setDragOffset({ x: 0, y: 0 });
    setSpacePressed(false);
    keeperPointerTargetRef.current = null;
    keeperPointerFollowRef.current?.cancel();
  }, []);

  const closePlacementViewer = useCallback(() => {
    releaseVisitorInputOwnership();
    setViewerSession(null);
  }, [releaseVisitorInputOwnership]);

  const openIdentityRack = useCallback(async () => {
    if (viewerSession || identitySession || snapping || gestureRef.current || cameraGestureRef.current) return;
    const source = identityControlRef.current;
    if (!source || !identityRack) return;
    const requestId = identityOpenRequestRef.current + 1;
    identityOpenRequestRef.current = requestId;
    const originRectangle = frozenRectangle(source.getBoundingClientRect());
    const viewport = Object.freeze({ width: window.innerWidth, height: window.innerHeight });
    setIdentityOpening(true);
    const preloadedProfileImageUrl = await preloadIdentityProfileImage(identityRack.profile.avatarUrl);
    if (identityOpenRequestRef.current !== requestId || !source.isConnected) return;
    setIdentitySession({ originRectangle, preloadedProfileImageUrl, viewport });
    setIdentityOpening(false);
  }, [identityRack, identitySession, snapping, viewerSession]);

  const closeIdentityRack = useCallback(() => {
    releaseVisitorInputOwnership();
    setIdentitySession(null);
  }, [releaseVisitorInputOwnership]);

  const handlePointerDownCapture = (event) => {
    if (!spacePressed || plane.maximumCameraY <= 0 || event.button !== 0
      || event.target.closest?.('[data-lattice-chrome],a,input,select,textarea,button')) return;
    event.preventDefault();
    cameraGestureRef.current = { pointerId: event.pointerId, tableId: activeTableId, originY: event.clientY, startCameraY: activeCameraY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCameraActive(true);
  };

  const handlePointerDown = (event) => {
    if (spacePressed || snapping || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || !keeperClickToMoveTargetAllowed(event.target)) return;
    rootRef.current?.focus({ preventScroll: true });
    gestureRef.current = { pointerId: event.pointerId, gesture: createPointerGesture({ x: event.clientX, y: event.clientY }) };
  };

  const handlePointerMove = (event) => {
    const camera = cameraGestureRef.current;
    if (camera?.pointerId === event.pointerId) {
      event.preventDefault();
      setCameraY(camera.tableId, updateLatticeOwnerCameraY({ originY: camera.originY, pointerY: event.clientY, startCameraY: camera.startCameraY }, plane));
      return;
    }
    const current = gestureRef.current;
    if (!current || current.pointerId !== event.pointerId || snapping) {
      if (!keeperClickToMoveTargetAllowed(event.target)) {
        keeperPointerTargetRef.current = null;
        keeperPointerFollowRef.current?.cancel();
        return;
      }
      const target = keeperPointerTarget(event, event.currentTarget.getBoundingClientRect());
      if (!target) return;
      keeperPointerTargetRef.current = target;
      if (keeperPointerFollowEnabled) keeperPointerFollowRef.current?.push(target);
      return;
    }
    const gesture = updatePointerGesture(current.gesture, { x: event.clientX, y: event.clientY }, activeRef.current);
    gestureRef.current = { ...current, gesture };
    if (gesture.activated && !current.gesture.activated) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setGestureActive(true);
    }
    setDragOffset(gesture.offset);
  };

  const handlePointerUp = (event) => {
    if (cameraGestureRef.current?.pointerId === event.pointerId) finishCamera(false);
    else if (gestureRef.current?.pointerId === event.pointerId) {
      const wasClick = !gestureRef.current.gesture.activated;
      finishGesture(false);
      if (wasClick && keeperClickToMoveEnabled && keeperClickToMoveTargetAllowed(event.target)) {
        const target = keeperPointerTarget(event, event.currentTarget.getBoundingClientRect());
        if (target) onMoveKeeper?.(target.clientX, target.clientY, {
          continuous: false,
          reducedMotion,
          speedMultiplier: keeperPointerFollowSpeedMultiplier(keeperMovementSpeed),
        });
      }
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (snapping || gestureRef.current || performance.now() < wheelBlockedUntilRef.current) return;
    wheelAccumulatorRef.current = addWheelDelta(wheelAccumulatorRef.current, { x: event.deltaX, y: event.deltaY });
    clearTimeout(wheelResetTimerRef.current);
    wheelResetTimerRef.current = setTimeout(() => { wheelAccumulatorRef.current = { x: 0, y: 0 }; }, DEFAULT_LATTICE_INTERACTION_CONFIG.wheelCooldown);
    const destination = resolveWheelDestination(wheelAccumulatorRef.current, activeRef.current);
    if (!destination || sameCoordinate(destination, activeRef.current)) return;
    wheelAccumulatorRef.current = { x: 0, y: 0 };
    wheelBlockedUntilRef.current = performance.now() + DEFAULT_LATTICE_INTERACTION_CONFIG.wheelCooldown;
    settle(destination);
  };

  const handleKeyDown = (event) => {
    if (event.code === 'Space' && !event.target.closest?.('button,a,input,select,textarea')) {
      event.preventDefault();
      if (!event.repeat) setSpacePressed(true);
      return;
    }
    if (event.target.closest?.('button,a,input,select,textarea') || snapping || gestureRef.current) return;
    const direction = keyboardDirection(event.key);
    const destination = direction && latticeDestination(activeRef.current, direction);
    if (!destination) return;
    event.preventDefault();
    settle(destination);
  };

  const stageTransform = `translate3d(${dragOffset.x - (active.x * plane.width)}px, ${dragOffset.y - (active.y * plane.height) + activeCameraY}px, 0)`;
  return <main aria-label="Published lattice visitor world" className="visitor-lattice-world"
    data-camera-active={cameraActive || undefined} data-gesture-active={gestureActive || undefined}
    data-menu-surface={lattice.appearance.menuSurfaceId} data-space-pan-ready={(spacePressed && plane.maximumCameraY > 0) || undefined}
    data-surface={lattice.appearance.surfaceId} onBlur={() => setSpacePressed(false)} onKeyDown={handleKeyDown}
    onKeyUp={(event) => { if (event.code === 'Space') setSpacePressed(false); }}
    onLostPointerCapture={() => { if (!finishCamera(true)) finishGesture(true); }}
    onPointerCancel={() => { if (!finishCamera(true)) finishGesture(true); }} onPointerDown={handlePointerDown}
    onPointerDownCapture={handlePointerDownCapture} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
    onWheel={handleWheel} ref={rootRef} tabIndex="-1">
    <div className="visitor-lattice-world__stage" data-snapping={snapping || undefined} style={{
      '--visitor-lattice-cell-size': `${plane.cellSize}px`,
      '--visitor-lattice-grid-origin-x': `${(3 * plane.width) + plane.left}px`,
      '--visitor-lattice-grid-origin-y': `${(3 * plane.height) + plane.top}px`,
      '--visitor-lattice-snap-duration': `${reducedMotion ? 0 : DEFAULT_LATTICE_INTERACTION_CONFIG.snapDuration}ms`,
      transform: stageTransform,
    }}>
      <div className="visitor-lattice-world__atmosphere" style={{ left: -3 * plane.width, top: -3 * plane.height, width: 7 * plane.width, height: 7 * plane.height }} />
      {LATTICE_PRODUCTION_COORDINATES.map((coordinate, index) => {
        const table = lattice.tables[index];
        return <div className="visitor-lattice-world__table" data-active={sameCoordinate(coordinate, active) || undefined}
          key={table.id} style={{ left: plane.left + (coordinate.x * plane.width), top: plane.top + (coordinate.y * plane.height), width: plane.width, height: plane.height }}>
          <LatticeProductionTableRenderer
            imageLoading={sameCoordinate(coordinate, active) ? 'eager' : 'lazy'}
            lattice={lattice}
            onMediaState={handlePlacementMediaState}
            onPlacementActivate={sameCoordinate(coordinate, active) ? openPlacementViewer : undefined}
            tableId={table.id}
            viewerPlacementId={viewerSession?.tableId === table.id ? viewerSession.placementId : null}
          />
        </div>;
      })}
    </div>
    <LatticeProfileRail
      blocked={Boolean(viewerSession)}
      collapsed
      compact
      entries={[]}
      identityControlRef={identityControlRef}
      identityDisabled={Boolean(identityOpening || identitySession || viewerSession || gestureActive || cameraActive || snapping)}
      identityExpanded={Boolean(identityOpening || identitySession)}
      identitySourceHidden={Boolean(identitySession)}
      officialIdentity={officialIdentity}
      onIdentityActivate={openIdentityRack}
    />
    <LatticeNavigationOverlay active={active} onNavigate={navigate} onReturnFocus={() => rootRef.current?.focus({ preventScroll: true })} />
    {keeperVisible && <KeeperDock
      actorId={document.presentation.keeperId}
      followCursor={keeperFollowCursor}
      movementSpeed={keeperMovementSpeed}
      onDockStateChange={setKeeperDockActive}
      onFollowCursorChange={setKeeperFollowCursor}
      onMovementSpeedChange={setKeeperMovementSpeed}
      reducedMotion={reducedMotion}
      residentHandoff={keeperDockHandoff}
      residentScale={0.5}
      spatialTheme={['carbon', 'graphite'].includes(lattice.appearance.surfaceId) ? 'dark' : 'light'}
    />}
    <div className="visitor-lattice-world__actions" data-lattice-chrome>
      {onOpenDirectory && <button type="button" onClick={onOpenDirectory}>DIRECTORY</button>}
      {onReturn && <button type="button" onClick={onReturn}>RETURN</button>}
      {onExit && <button type="button" onClick={onExit}>EXIT PREVIEW</button>}
    </div>
    {viewerSession && viewerEntry && <LatticeFocusViewer
      dossier={viewerEntry.dossier}
      entry={viewerEntry}
      getReturnRectangle={() => findPlacementElement(viewerSession.placementId)?.getBoundingClientRect()}
      gridVariables={{
        '--lattice-grid-cell-size': `${plane.cellSize}px`,
        '--lattice-grid-origin-x': `${plane.left}px`,
        '--lattice-grid-origin-y': `${plane.top + activeCameraY}px`,
      }}
      gridVisible
      inspectionVariant="rack"
      menuSurfaceId={lattice.appearance.menuSurfaceId}
      onClosed={closePlacementViewer}
      onNavigate={navigateViewer}
      originRectangle={viewerSession.originRectangle}
      position={viewerPosition}
      renderArtwork={(focusEntry, context) => <LatticeProductionFocusArtwork
        entry={focusEntry}
        focused={context.phase === 'open' || context.phase === 'opening' || context.phase === 'outgoing'}
        phase={context.phase}
      />}
      returnFocus={viewerSession.returnFocus}
      surfaceColor="var(--lattice-menu-panel)"
      total={viewerEntries.length}
    />}
    {identitySession && identityRack && !viewerSession && <Suspense fallback={null}>
      <LatticeProductionIdentityDossier
        getReturnRectangle={() => identityControlRef.current?.getBoundingClientRect() || identitySession.originRectangle}
        gridVariables={{
          '--lattice-grid-cell-size': `${plane.cellSize}px`,
          '--lattice-grid-origin-x': `${plane.left}px`,
          '--lattice-grid-origin-y': `${plane.top + activeCameraY}px`,
        }}
        menuSurfaceId={lattice.appearance.menuSurfaceId}
        model={identityRack}
        onClosing={releaseVisitorInputOwnership}
        onClosed={closeIdentityRack}
        originRectangle={identitySession.originRectangle}
        preloadedProfileImageUrl={identitySession.preloadedProfileImageUrl}
        reducedMotion={reducedMotion}
        returnFocus={identityControlRef.current}
        sourceIdentity={officialIdentity}
        viewport={identitySession.viewport}
      />
    </Suspense>}
  </main>;
}
