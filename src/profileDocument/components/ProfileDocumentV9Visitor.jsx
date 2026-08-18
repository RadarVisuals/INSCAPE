import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import LatticeFocusViewer from '../../lattice/rendering/LatticeFocusViewer.jsx';
import LatticeProfileRail from '../../lattice/rendering/LatticeProfileRail.jsx';
import LatticeProductionFocusArtwork from '../../lattice/rendering/LatticeProductionFocusArtwork.jsx';
import { preloadIdentityProfileImage } from '../../public/identity/preloadIdentityProfileImage.js';
import GridProductionRenderer from './GridProductionRenderer.jsx';
import { createProfileDocumentV9FocusViewModel } from './profileDocumentV9FocusViewModel.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import '../../lattice/rendering/latticeMenuSurface.css';
import './visitorGridWorld.css';

const LatticeProductionIdentityDossier = lazy(() => import('../../lattice/rendering/LatticeProductionIdentityDossier.jsx'));
const compactAddress = (address) => `${address.slice(0, 10)}…${address.slice(-6)}`;
const frozenRectangle = ({ height, left, top, width }) => Object.freeze({ height, left, top, width });

export default function ProfileDocumentV9Visitor({ document, onExit, onOpenDirectory, onReturn }) {
  const rootRef = useRef(null);
  const identityControlRef = useRef(null);
  const identityOpenRequestRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placementMedia, setPlacementMedia] = useState({});
  const [viewerSession, setViewerSession] = useState(null);
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
  const activeGrid = document.grids[activeIndex];
  const lastIndex = document.grids.length - 1;

  useEffect(() => {
    setActiveIndex(0); setPlacementMedia({}); setViewerSession(null); setIdentitySession(null);
    rootRef.current?.focus({ preventScroll: true });
  }, [document.documentId, document.revision]);
  useEffect(() => { identityOpenRequestRef.current += 1; setIdentityOpening(false); setIdentitySession(null); }, [document.profile.address]);

  const releaseVisitorInputOwnership = useCallback(() => {
    setViewerSession(null); setIdentityOpening(false); rootRef.current?.focus({ preventScroll: true });
  }, []);
  const selectGrid = useCallback((index) => {
    if (viewerSession || identitySession) return;
    setActiveIndex(Math.max(0, Math.min(lastIndex, index)));
  }, [identitySession, lastIndex, viewerSession]);
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
    if (gridId !== activeGrid.id || viewerSession || identitySession) return;
    const mediaState = placementMedia[`${gridId}:${placement.id}`];
    if (mediaState?.status !== 'ready' || !mediaState.dimensions) return;
    const originRectangle = frozenRectangle(element.getBoundingClientRect());
    const nativeImage = new Image(); nativeImage.decoding = 'async'; nativeImage.referrerPolicy = 'no-referrer'; nativeImage.src = mediaState.media.src;
    try { await nativeImage.decode(); } catch { /* Viewer preserves its honest media failure state. */ }
    if (element.isConnected) setViewerSession({ originRectangle, placementId: placement.id, returnFocus: element, gridId });
  }, [activeGrid.id, identitySession, placementMedia, viewerSession]);
  const viewerEntries = useMemo(() => activeGrid.placements.map((placement) => {
    const decoded = placementMedia[`${activeGrid.id}:${placement.id}`];
    const model = createProfileDocumentV9FocusViewModel(placement);
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
    const originRectangle = frozenRectangle(source.getBoundingClientRect());
    const viewport = Object.freeze({ width: window.innerWidth, height: window.innerHeight }); setIdentityOpening(true);
    const preloadedProfileImageUrl = await preloadIdentityProfileImage(identityRack.profile.avatarUrl);
    if (identityOpenRequestRef.current === requestId && source.isConnected) {
      setIdentitySession({ originRectangle, preloadedProfileImageUrl, viewport }); setIdentityOpening(false);
    }
  }, [identityOpening, identityRack, identitySession, viewerSession]);
  const closeIdentityRack = useCallback(() => {
    setIdentitySession(null); queueMicrotask(() => identityControlRef.current?.focus({ preventScroll: true }));
  }, []);
  const handleKeyDown = (event) => {
    if (event.target.closest?.('button,a,input,select,textarea') || viewerSession || identitySession) return;
    const destination = ['ArrowRight', 'PageDown'].includes(event.key) ? activeIndex + 1
      : ['ArrowLeft', 'PageUp'].includes(event.key) ? activeIndex - 1
        : event.key === 'Home' ? 0 : event.key === 'End' ? lastIndex : null;
    if (destination === null) return; event.preventDefault(); selectGrid(destination);
  };
  const gridVariables = { '--lattice-grid-cell-size': 'calc(min(100vw / 32, 100vh / 18))',
    '--lattice-grid-origin-x': '0px', '--lattice-grid-origin-y': '0px' };

  return <main aria-label="Published INSCAPE Grid visitor" className="visitor-grid-world"
    data-guide-mode={document.appearance.guideMode} data-menu-surface={document.appearance.menuSurfaceId}
    data-surface={document.appearance.surfaceId} onKeyDown={handleKeyDown} ref={rootRef} tabIndex="-1">
    <div className="visitor-grid-world__viewport" data-active-grid-id={activeGrid.id}>
      <GridProductionRenderer document={document} grid={activeGrid} imageLoading={activeIndex === 0 ? 'eager' : 'lazy'}
        onMediaState={handlePlacementMediaState} onPlacementActivate={openPlacementViewer}
        viewerPlacementId={viewerSession?.gridId === activeGrid.id ? viewerSession.placementId : null} />
    </div>
    <LatticeProfileRail blocked={Boolean(viewerSession)} collapsed compact entries={[]} identityControlRef={identityControlRef}
      identityDisabled={Boolean(identityOpening || identitySession || viewerSession)} identityExpanded={Boolean(identityOpening || identitySession)}
      identitySourceHidden={Boolean(identitySession)} officialIdentity={officialIdentity} onIdentityActivate={openIdentityRack} />
    <nav aria-label="Published Grid navigation" className="visitor-grid-world__navigation">
      <button aria-label="Previous Grid" disabled={activeIndex === 0 || Boolean(viewerSession || identitySession)}
        onClick={() => selectGrid(activeIndex - 1)} type="button">PREV</button>
      <span aria-live="polite">{activeIndex + 1} / {document.grids.length} · {activeGrid.title}</span>
      <button aria-label="Next Grid" disabled={activeIndex === lastIndex || Boolean(viewerSession || identitySession)}
        onClick={() => selectGrid(activeIndex + 1)} type="button">NEXT</button>
    </nav>
    {(onOpenDirectory || onReturn || onExit) && <div className="visitor-grid-world__actions">
      {onOpenDirectory && <button onClick={onOpenDirectory} type="button">DIRECTORY</button>}
      {onReturn && <button onClick={onReturn} type="button">RETURN</button>}
      {onExit && <button onClick={onExit} type="button">EXIT</button>}
    </div>}
    {viewerSession && viewerEntry && <LatticeFocusViewer dossier={viewerEntry.dossier} entry={viewerEntry}
      getReturnRectangle={() => findPlacementElement(viewerSession.placementId)?.getBoundingClientRect()}
      gridVariables={gridVariables} gridVisible inspectionVariant="rack" menuSurfaceId={document.appearance.menuSurfaceId}
      onClosed={closePlacementViewer} onNavigate={navigateViewer} originRectangle={viewerSession.originRectangle}
      position={viewerPosition} renderArtwork={(focusEntry, context) => <LatticeProductionFocusArtwork entry={focusEntry}
        focused={['open', 'opening', 'outgoing'].includes(context.phase)} phase={context.phase} />}
      returnFocus={viewerSession.returnFocus} surfaceColor="var(--lattice-menu-panel)" total={viewerEntries.length} />}
    {identitySession && identityRack && !viewerSession && <Suspense fallback={null}><LatticeProductionIdentityDossier
      getReturnRectangle={() => identityControlRef.current?.getBoundingClientRect() || identitySession.originRectangle}
      gridVariables={gridVariables} menuSurfaceId={document.appearance.menuSurfaceId} model={identityRack}
      onClosing={releaseVisitorInputOwnership} onClosed={closeIdentityRack} originRectangle={identitySession.originRectangle}
      preloadedProfileImageUrl={identitySession.preloadedProfileImageUrl} reducedMotion={reducedMotion}
      returnFocus={identityControlRef.current} sourceIdentity={officialIdentity} viewport={identitySession.viewport} /></Suspense>}
  </main>;
}
