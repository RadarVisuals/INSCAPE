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
  const identityOpenRequestRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placementMedia, setPlacementMedia] = useState({});
  const [viewerSession, setViewerSession] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [identityOpening, setIdentityOpening] = useState(false);
  const [identitySession, setIdentitySession] = useState(null);
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
    if (element.isConnected) setViewerSession({ originRectangle, placementId: placement.id, returnFocus: element, gridId });
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
    setViewerSession((current) => current && ({ ...current, placementId: destination.placement.id,
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

  return <main aria-label="Published INSCAPE Grid visitor" className="visitor-grid-world" data-lattice-menu-surface
    data-guide-mode={document.appearance.guideMode} data-menu-surface={document.appearance.menuSurfaceId}
    data-surface={document.appearance.surfaceId} onKeyDown={handleKeyDown} ref={rootRef} tabIndex="-1">
    <div className="visitor-grid-world__viewport" data-active-grid-id={activeGrid.id}>
      <GridProductionRenderer document={document} grid={activeGrid} imageLoading={activeIndex === 0 ? 'eager' : 'lazy'}
        onMediaState={handlePlacementMediaState} onPlacementActivate={openPlacementViewer}
        projectionBottomInset={VISITOR_GRID_NAVIGATION_SAFE_AREA}
        viewerPlacementId={viewerSession?.gridId === activeGrid.id ? viewerSession.placementId : null} />
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
