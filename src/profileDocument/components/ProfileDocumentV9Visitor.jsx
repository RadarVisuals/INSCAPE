import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import LatticeFocusViewer from '../../lattice/rendering/LatticeFocusViewer.jsx';
import LatticeProfileRail from '../../lattice/rendering/LatticeProfileRail.jsx';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import { preloadIdentityProfileImage } from '../../public/identity/preloadIdentityProfileImage.js';
import GridProductionRenderer from './GridProductionRenderer.jsx';
import { createProfileDocumentV9FocusViewModel } from './profileDocumentV9FocusViewModel.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import { resolveVisitorGridDragDestination } from './visitorGridDragNavigation.js';
import '../../lattice/rendering/latticeMenuSurface.css';
import './visitorGridWorld.css';

const LatticeProductionIdentityDossier = lazy(() => import('../../lattice/rendering/LatticeProductionIdentityDossier.jsx'));
const VISITOR_GRID_NAVIGATION_SAFE_AREA = 42;
const compactAddress = (address) => `${address.slice(0, 10)}…${address.slice(-6)}`;
const frozenRectangle = ({ height, left, top, width }) => Object.freeze({ height, left, top, width });

export default function ProfileDocumentV9Visitor({ document, onExit, onOpenDirectory, onReturn }) {
  const rootRef = useRef(null);
  const identityControlRef = useRef(null);
  const profileDockControlRef = useRef(null);
  const gridDragRef = useRef(null);
  const gridSwipeTimerRef = useRef(null);
  const spacePressedRef = useRef(false);
  const suppressPlacementClickRef = useRef(false);
  const identityOpenRequestRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placementMedia, setPlacementMedia] = useState({});
  const [viewerSession, setViewerSession] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [identityOpening, setIdentityOpening] = useState(false);
  const [identitySession, setIdentitySession] = useState(null);
  const [gridDragging, setGridDragging] = useState(false);
  const [gridSwipe, setGridSwipe] = useState(null);
  const [spaceNavigation, setSpaceNavigation] = useState(false);
  const profileIdentity = useProfileIdentity(document.profile.address);
  const profileContractFacts = useProfileContractFacts(document.profile.address, { enabled: Boolean(identityOpening || identitySession) });
  const identityRack = useMemo(() => createPublishedIdentityRackViewModel({
    contractFacts: profileContractFacts, document, identity: profileIdentity,
  }), [document, profileContractFacts, profileIdentity]);
  const officialIdentity = useMemo(() => ({
    avatarUrl: identityRack?.profile.avatarUrl || document.profile.cachedIdentity.avatarUrl || null,
    displayName: identityRack?.profile.displayName || document.profile.cachedIdentity.name
      || document.identityPresentation.alias || 'UNNAMED PROFILE',
    secondaryLabel: compactAddress(document.profile.address),
  }), [document, identityRack]);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const identityDossierActive = Boolean(identitySession && !identitySession.compact);
  const activeGrid = document.grids[activeIndex];
  const lastIndex = document.grids.length - 1;
  const workspaceSurfaceColor = latticeSurfaceColor(document.appearance.surfaceId);

  useEffect(() => {
    setActiveIndex(0); setPlacementMedia({}); setViewerSession(null); setProfileVisible(false); setIdentitySession(null);
    globalThis.clearTimeout?.(gridSwipeTimerRef.current); gridSwipeTimerRef.current = null; setGridSwipe(null);
    rootRef.current?.focus({ preventScroll: true });
  }, [document.documentId, document.revision]);
  useEffect(() => { identityOpenRequestRef.current += 1; setIdentityOpening(false); setIdentitySession(null); }, [document.profile.address]);

  const releaseVisitorInputOwnership = useCallback(() => {
    setViewerSession(null); setIdentityOpening(false); rootRef.current?.focus({ preventScroll: true });
  }, []);
  const closeProfile = useCallback(({ returnFocus = false } = {}) => {
    identityOpenRequestRef.current += 1;
    setIdentityOpening(false);
    setIdentitySession(null);
    setProfileVisible(false);
    if (returnFocus) queueMicrotask(() => profileDockControlRef.current?.focus({ preventScroll: true }));
  }, []);
  const toggleProfile = useCallback(() => {
    if (viewerSession || identityOpening || identityDossierActive) return;
    if (profileVisible || identitySession) closeProfile();
    else setProfileVisible(true);
  }, [closeProfile, identityDossierActive, identityOpening, identitySession, profileVisible, viewerSession]);
  useEffect(() => {
    if ((!profileVisible && !identitySession?.compact) || identityDossierActive) return undefined;
    const handlePointerDown = (event) => {
      if (event.target?.closest?.('.lattice-profile-rail, #lattice-profile-dossier, [data-visitor-profile-trigger]')) return;
      closeProfile();
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); closeProfile({ returnFocus: true });
    };
    globalThis.addEventListener?.('pointerdown', handlePointerDown);
    globalThis.addEventListener?.('keydown', handleEscape);
    return () => {
      globalThis.removeEventListener?.('pointerdown', handlePointerDown);
      globalThis.removeEventListener?.('keydown', handleEscape);
    };
  }, [closeProfile, identityDossierActive, identitySession?.compact, profileVisible]);
  const selectGrid = useCallback((index) => {
    if (viewerSession || identityDossierActive) return;
    setActiveIndex(Math.max(0, Math.min(lastIndex, index)));
  }, [identityDossierActive, lastIndex, viewerSession]);
  const clearGridDrag = useCallback(() => {
    const active = gridDragRef.current;
    if (!active) return;
    globalThis.removeEventListener?.('pointermove', active.move, true);
    globalThis.removeEventListener?.('pointerup', active.finish, true);
    globalThis.removeEventListener?.('pointercancel', active.cancel, true);
    gridDragRef.current = null;
    setGridDragging(false);
  }, []);
  const visitorInputBlocked = Boolean(viewerSession || identityOpening || identityDossierActive);
  const beginGridDrag = useCallback((event) => {
    if (!spacePressedRef.current || visitorInputBlocked || event.button !== 0 || gridDragRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const origin = { x: event.clientX, y: event.clientY };
    const viewportWidth = event.currentTarget.clientWidth;
    const active = { end: origin, mode: 'pending', moved: false, pointerId: event.pointerId, targetIndex: null };
    const move = (pointerEvent) => {
      if (gridDragRef.current !== active || pointerEvent.pointerId !== active.pointerId) return;
      pointerEvent.preventDefault();
      active.end = { x: pointerEvent.clientX, y: pointerEvent.clientY };
      const deltaX = active.end.x - origin.x; const deltaY = active.end.y - origin.y;
      if (active.mode === 'pending' && Math.hypot(deltaX, deltaY) > 6) {
        const direction = deltaX < 0 ? 'next' : 'previous';
        const targetIndex = direction === 'next' ? activeIndex + 1 : activeIndex - 1;
        active.mode = Math.abs(deltaX) > Math.abs(deltaY) * 1.35 && targetIndex >= 0 && targetIndex <= lastIndex
          ? 'swipe' : 'navigation';
        active.direction = direction; active.targetIndex = active.mode === 'swipe' ? targetIndex : null;
        active.moved = true; setGridDragging(true);
      }
      if (active.mode === 'swipe') {
        const directionalDelta = active.direction === 'next' ? Math.min(0, deltaX) : Math.max(0, deltaX);
        const boundedDelta = Math.max(-viewportWidth, Math.min(viewportWidth, directionalDelta));
        setGridSwipe({ deltaX: boundedDelta, direction: active.direction, settling: false, targetIndex: active.targetIndex });
      }
    };
    const complete = (pointerEvent, cancelled = false) => {
      if (gridDragRef.current !== active || pointerEvent?.pointerId != null && pointerEvent.pointerId !== active.pointerId) return;
      const deltaX = active.end.x - origin.x; const deltaY = active.end.y - origin.y;
      if (active.moved) {
        suppressPlacementClickRef.current = true;
        globalThis.setTimeout?.(() => { suppressPlacementClickRef.current = false; }, 0);
      }
      clearGridDrag();
      if (active.mode !== 'swipe') return;
      const destination = cancelled ? null
        : resolveVisitorGridDragDestination({ activeIndex, deltaX, deltaY, lastIndex, viewportWidth });
      const committed = destination !== null;
      const completeSwipe = () => {
        if (!committed) {
          setGridSwipe(null); gridSwipeTimerRef.current = null; return;
        }
        selectGrid(destination);
        gridSwipeTimerRef.current = globalThis.setTimeout?.(() => {
          setGridSwipe(null); gridSwipeTimerRef.current = null;
        }, 34);
      };
      if (reducedMotion) completeSwipe();
      else {
        setGridSwipe({ deltaX: committed ? (active.direction === 'next' ? -viewportWidth : viewportWidth) : 0,
          direction: active.direction, settling: true, targetIndex: active.targetIndex });
        globalThis.clearTimeout?.(gridSwipeTimerRef.current);
        gridSwipeTimerRef.current = globalThis.setTimeout?.(completeSwipe, committed ? 280 : 220);
      }
    };
    active.move = move;
    active.finish = (pointerEvent) => complete(pointerEvent, false);
    active.cancel = (pointerEvent) => complete(pointerEvent, true);
    gridDragRef.current = active;
    globalThis.addEventListener?.('pointermove', active.move, true);
    globalThis.addEventListener?.('pointerup', active.finish, true);
    globalThis.addEventListener?.('pointercancel', active.cancel, true);
  }, [activeIndex, clearGridDrag, lastIndex, reducedMotion, selectGrid, visitorInputBlocked]);
  useEffect(() => {
    const editable = (event) => /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.target?.isContentEditable;
    const keydown = (event) => {
      if (event.code !== 'Space' || editable(event) || visitorInputBlocked) return;
      event.preventDefault(); spacePressedRef.current = true; setSpaceNavigation(true);
    };
    const release = (event) => {
      if (event?.code && event.code !== 'Space') return;
      spacePressedRef.current = false; setSpaceNavigation(false); gridDragRef.current?.cancel?.();
    };
    globalThis.addEventListener?.('keydown', keydown, true);
    globalThis.addEventListener?.('keyup', release, true);
    globalThis.addEventListener?.('blur', release);
    return () => {
      globalThis.removeEventListener?.('keydown', keydown, true);
      globalThis.removeEventListener?.('keyup', release, true);
      globalThis.removeEventListener?.('blur', release);
      spacePressedRef.current = false; clearGridDrag(); globalThis.clearTimeout?.(gridSwipeTimerRef.current);
    };
  }, [clearGridDrag, visitorInputBlocked]);
  const handlePlacementMediaState = useCallback((state) => {
    const key = `${state.gridId}:${state.placementId}`;
    setPlacementMedia((current) => {
      const previous = current[key];
      if (previous?.status === state.status && previous?.media?.src === state.media?.src
        && previous?.dimensions?.width === state.dimensions?.width && previous?.dimensions?.height === state.dimensions?.height) return current;
      return { ...current, [key]: state };
    });
  }, []);
  const openPlacementViewer = useCallback(async ({ element, placement, gridId }) => {
    if (gridId !== activeGrid.id || viewerSession || identityDossierActive) return;
    const mediaState = placementMedia[`${gridId}:${placement.id}`];
    if (mediaState?.status !== 'ready' || !mediaState.dimensions) return;
    const originRectangle = frozenRectangle(element.getBoundingClientRect());
    const nativeImage = new Image(); nativeImage.decoding = 'async'; nativeImage.referrerPolicy = 'no-referrer'; nativeImage.src = mediaState.media.src;
    try { await nativeImage.decode(); } catch { /* Viewer preserves its honest media failure state. */ }
    if (element.isConnected) setViewerSession({ originRectangle, placementId: placement.id, returnFocus: element, gridId, sourceHidden: true });
  }, [activeGrid.id, identityDossierActive, placementMedia, viewerSession]);
  const viewerEntries = useMemo(() => activeGrid.placements.map((placement) => {
    const decoded = placementMedia[`${activeGrid.id}:${placement.id}`];
    const model = createProfileDocumentV9FocusViewModel(placement, {
      decodedDimensions: decoded?.dimensions, resolvedUrl: decoded?.media?.src,
      resolutionComplete: decoded?.status !== 'loading',
    });
    return model && decoded?.status === 'ready' && decoded.dimensions
      ? { ...model, focusDimensions: decoded.dimensions, media: { ...model.media, src: decoded.media.src } } : null;
  }).filter(Boolean), [activeGrid, placementMedia]);
  const viewerPosition = viewerEntries.findIndex(({ placement }) => placement.id === viewerSession?.placementId);
  const viewerEntry = viewerPosition >= 0 ? viewerEntries[viewerPosition] : null;
  const findPlacementElement = useCallback((placementId) => [...(rootRef.current?.querySelectorAll('[data-placement-id]') || [])]
    .find((node) => node.dataset.placementId === placementId), []);
  const navigateViewer = useCallback((direction) => {
    if (!viewerEntries.length || viewerPosition < 0) return;
    const destination = viewerEntries[(viewerPosition + direction + viewerEntries.length) % viewerEntries.length];
    const element = findPlacementElement(destination.placement.id);
    setViewerSession((current) => current && ({ ...current, placementId: destination.placement.id, sourceHidden: true,
      returnFocus: element || current.returnFocus }));
  }, [findPlacementElement, viewerEntries, viewerPosition]);
  const closePlacementViewer = useCallback(() => {
    const returnFocus = viewerSession?.returnFocus; setViewerSession(null);
    queueMicrotask(() => returnFocus?.isConnected ? returnFocus.focus({ preventScroll: true })
      : rootRef.current?.focus({ preventScroll: true }));
  }, [viewerSession]);
  const openIdentityRack = useCallback(async () => {
    if (viewerSession || identitySession || identityOpening || !identityRack) return;
    const source = identityControlRef.current; if (!source) return;
    const requestId = identityOpenRequestRef.current + 1; identityOpenRequestRef.current = requestId;
    const sourceSurface = source.closest('.lattice-profile-rail') || source;
    const originRectangle = frozenRectangle(sourceSurface.getBoundingClientRect());
    const viewport = Object.freeze({ width: window.innerWidth, height: window.innerHeight }); setIdentityOpening(true);
    const preloadedProfileImageUrl = await preloadIdentityProfileImage(identityRack.profile.avatarUrl);
    if (identityOpenRequestRef.current === requestId && source.isConnected) {
      setIdentitySession({ originRectangle, preloadedProfileImageUrl, viewport }); setIdentityOpening(false);
    }
  }, [identityOpening, identityRack, identitySession, viewerSession]);
  const handleKeyDown = (event) => {
    if (event.target.closest?.('button,a,input,select,textarea') || viewerSession || identityDossierActive) return;
    const destination = ['ArrowRight', 'PageDown'].includes(event.key) ? activeIndex + 1
      : ['ArrowLeft', 'PageUp'].includes(event.key) ? activeIndex - 1
        : event.key === 'Home' ? 0 : event.key === 'End' ? lastIndex : null;
    if (destination === null) return; event.preventDefault(); selectGrid(destination);
  };
  const gridVariables = { '--lattice-grid-cell-size': 'calc(min(100vw / 32, 100vh / 18))',
    '--lattice-grid-origin-x': '0px', '--lattice-grid-origin-y': '0px' };
  const swipeGrid = Number.isInteger(gridSwipe?.targetIndex) ? document.grids[gridSwipe.targetIndex] : null;
  const swipeStyle = gridSwipe ? { '--visitor-grid-swipe-x': `${gridSwipe.deltaX}px`,
    '--visitor-grid-swipe-side': gridSwipe.direction === 'next' ? '100%' : '-100%' } : undefined;

  return <main aria-label="Published INSCAPE Grid visitor" className="visitor-grid-world" data-lattice-menu-surface
    data-guide-mode={document.appearance.guideMode} data-menu-surface={document.appearance.menuSurfaceId}
    data-surface={document.appearance.surfaceId} data-space-navigation={spaceNavigation || undefined}
    data-grid-dragging={gridDragging || undefined} data-grid-swipe-settling={gridSwipe?.settling || undefined}
    onKeyDown={handleKeyDown} ref={rootRef} style={swipeStyle} tabIndex="-1">
    <div className="visitor-grid-world__viewport" data-active-grid-id={activeGrid.id}
      onClickCapture={(event) => { if (suppressPlacementClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}
      onPointerDown={beginGridDrag}>
      <div className="visitor-grid-world__grid-plane visitor-grid-world__grid-plane--current">
        <GridProductionRenderer document={document} grid={activeGrid} imageLoading={activeIndex === 0 ? 'eager' : 'lazy'}
          onMediaState={handlePlacementMediaState} onPlacementActivate={openPlacementViewer}
          projectionBottomInset={VISITOR_GRID_NAVIGATION_SAFE_AREA}
          viewerPlacementId={viewerSession?.gridId === activeGrid.id && viewerSession.sourceHidden ? viewerSession.placementId : null} />
      </div>
      {gridSwipe && swipeGrid && <div aria-hidden="true" className="visitor-grid-world__grid-plane visitor-grid-world__grid-plane--adjacent">
        <GridProductionRenderer document={document} grid={swipeGrid} imageLoading="eager"
          onMediaState={handlePlacementMediaState} projectionBottomInset={VISITOR_GRID_NAVIGATION_SAFE_AREA} />
      </div>}
    </div>
    {(profileVisible || identityOpening) && !identitySession && <LatticeProfileRail blocked={Boolean(viewerSession)} collapsed entries={[]} identityControlRef={identityControlRef} identityOnly
      identityDisabled={Boolean(identityOpening || identityDossierActive || viewerSession)} identityExpanded={Boolean(identityOpening || identityDossierActive)}
      officialIdentity={officialIdentity} onIdentityActivate={openIdentityRack} />}
    <footer className="visitor-grid-world__dock">
      <nav aria-label="Published profile navigation">
        <button aria-expanded={Boolean(profileVisible || identitySession)} aria-label="Profile" data-visitor-profile-trigger
          disabled={Boolean(viewerSession || identityOpening || identityDossierActive)} onClick={toggleProfile}
          ref={profileDockControlRef} type="button">PROFILE</button>
        <div aria-label="Published Grid navigation" className="visitor-grid-world__navigation" role="group">
          <button aria-label="Previous Grid" disabled={activeIndex === 0 || Boolean(viewerSession || identityDossierActive)}
            onClick={() => selectGrid(activeIndex - 1)} type="button">&lt;</button>
          <span aria-live="polite">{activeGrid.title}</span>
          <button aria-label="Next Grid" disabled={activeIndex === lastIndex || Boolean(viewerSession || identityDossierActive)}
            onClick={() => selectGrid(activeIndex + 1)} type="button">&gt;</button>
        </div>
        {(onOpenDirectory || onReturn || onExit) && <div className="visitor-grid-world__actions">
          {onOpenDirectory && <button onClick={onOpenDirectory} type="button">DISCOVER</button>}
          {onReturn && <button onClick={onReturn} type="button">RETURN</button>}
          {onExit && <button onClick={onExit} type="button">EXIT</button>}
        </div>}
      </nav>
      <strong aria-label="INSCAPE" className="visitor-grid-world__brand"><span aria-hidden="true" /></strong>
    </footer>
    {viewerSession && viewerEntry && <LatticeFocusViewer dossier={viewerEntry.dossier} entry={viewerEntry}
      getReturnRectangle={() => findPlacementElement(viewerSession.placementId)?.getBoundingClientRect()}
      gridVariables={gridVariables} gridVisible={false} inspectionVariant="rack" menuSurfaceId={document.appearance.menuSurfaceId}
      onClosed={closePlacementViewer} onNavigate={navigateViewer} originRectangle={viewerSession.originRectangle}
      onReturnLanding={() => setViewerSession((current) => current && ({ ...current, sourceHidden: false }))}
      position={viewerPosition} renderArtwork={(focusEntry, context) => <LatticeProductionFocusArtwork entry={focusEntry}
        motion={context.motion} />}
      returnFocus={viewerSession.returnFocus} surfaceColor={workspaceSurfaceColor} total={viewerEntries.length} />}
    {identitySession && identityRack && !viewerSession && <Suspense fallback={null}><LatticeProductionIdentityDossier
      dismissOnBackdrop
      getReturnRectangle={() => identityControlRef.current?.closest('.lattice-profile-rail')?.getBoundingClientRect()
        || identityControlRef.current?.getBoundingClientRect() || identitySession.originRectangle}
      gridVariables={gridVariables} gridVisible={false} menuSurfaceId={document.appearance.menuSurfaceId} model={identityRack}
      onClosing={releaseVisitorInputOwnership}
      onClosed={() => setIdentitySession((current) => current && ({ ...current, compact: true }))}
      onDismiss={closeProfile}
      onOpening={() => setIdentitySession((current) => current && ({ ...current, compact: false }))}
      originRectangle={identitySession.originRectangle} inlineCloseControl persistent
      preloadedProfileImageUrl={identitySession.preloadedProfileImageUrl} reducedMotion={reducedMotion}
      returnFocus={identityControlRef.current} sourceIdentity={officialIdentity} viewport={identitySession.viewport}
      workspaceSurfaceColor={workspaceSurfaceColor} /></Suspense>}
  </main>;
}
