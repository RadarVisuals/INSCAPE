import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import LatticeProfileRail from '../../lattice/rendering/LatticeProfileRail.jsx';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import GridProductionRenderer from './GridProductionRenderer.jsx';
import { createProfileDocumentV9FocusViewModel } from './profileDocumentV9FocusViewModel.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import { resolveVisitorGridDragDestination } from './visitorGridDragNavigation.js';
import '../../lattice/rendering/latticeMenuSurface.css';
import './visitorGridWorld.css';
import PresentationBoard from '../../public/ownerSystemWorkflow/PresentationBoard.jsx';
import useDisplayInspection from '../../public/ownerSystemWorkflow/useDisplayInspection.js';
import DisplayFocusViewer from '../../public/ownerSystemWorkflow/DisplayFocusViewer.jsx';
import DisplayInstruments from '../../public/ownerSystemWorkflow/DisplayInstruments.jsx';
import { transitionDisplayInstruments } from '../../public/ownerSystemWorkflow/displayInstrumentState.js';
import { OwnerSystemWorkflowMetadataContent } from '../../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';
import { createDefaultWorkbenchPresentation } from '../domain/workbenchPresentation.js';
import useOwnerSystemWorkflowLayout from '../../public/ownerSystemWorkflow/useOwnerSystemWorkflowLayout.js';
import useGridPlayback from '../../public/ownerSystemWorkflow/useGridPlayback.js';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import '../../public/ownerSystemWorkflow/ownerSystemWorkflow.css';

function PublishedStage({ children, activeGridId, onClickCapture, onPointerDown, viewportRef }) {
  return <div className="visitor-grid-world__viewport" data-active-grid-id={activeGridId}
    ref={viewportRef} onClickCapture={onClickCapture} onPointerDown={onPointerDown}>{children}</div>;
}

const IdentityModule = lazy(() => import('../../public/identity/IdentityModule.jsx'));
const compactAddress = (address) => `${address.slice(0, 10)}…${address.slice(-6)}`;

export default function ProfileDocumentV9Visitor(props) {
  return <ProfileDocumentV9Session key={`${props.document.profile.address}:${props.document.documentId}:${props.document.revision}`} {...props} />;
}

function ProfileDocumentV9Session({ document, onExit, onOpenDirectory, onReturn }) {
  useStartupDestinationReady();
  const rootRef = useRef(null);
  const layout = useOwnerSystemWorkflowLayout();
  const stageRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const instrumentTriggers = useRef({});
  const [instruments, dispatchInstruments] = useReducer(transitionDisplayInstruments,
    { active: null, layers: 'closed', metadata: 'attached' });
  const identityControlRef = useRef(null);
  const profileDockControlRef = useRef(null);
  const gridDragRef = useRef(null);
  const gridSwipeTimerRef = useRef(null);
  const spacePressedRef = useRef(false);
  const suppressPlacementClickRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placementMedia, setPlacementMedia] = useState({});
  const [profileVisible, setProfileVisible] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(Boolean(document.workbench?.identity.open));
  const [displayOpen, setDisplayOpen] = useState(document.workbench?.display.open !== false);
  const [identityWindow, setIdentityWindow] = useState(document.workbench?.identity.window);
  const changeIdentityWindow = useCallback(({ left, top, width }) => setIdentityWindow(current =>
    current?.left === left && current?.top === top && current?.width === width ? current : { left, top, width }), []);
  const displayPresentation = useMemo(() => {
    const display = document.workbench?.display || createDefaultWorkbenchPresentation().display;
    const icon = display.shortcut.icon;
    return { ...display, shortcut: { ...display.shortcut, open: display.open,
      iconAssetId: icon?.stableAssetId || null, iconMedia: icon?.media?.type === 'image'
        ? { url: resolvePublishedAssetUrl(icon.media.url), width: icon.media.width, height: icon.media.height } : null } };
  }, [document]);
  const [gridDragging, setGridDragging] = useState(false);
  const [gridSwipe, setGridSwipe] = useState(null);
  const [spaceNavigation, setSpaceNavigation] = useState(false);
  const profileIdentity = useProfileIdentity(document.profile.address);
  const profileContractFacts = useProfileContractFacts(document.profile.address, { enabled: identityOpen });
  const identityRack = useMemo(() => createPublishedIdentityRackViewModel({
    contractFacts: profileContractFacts, document, identity: profileIdentity,
  }), [document, profileContractFacts, profileIdentity]);
  const officialIdentity = useMemo(() => ({
    avatarUrl: identityRack?.profile.avatarUrl || document.profile.cachedIdentity.avatarUrl || null,
    displayName: identityRack?.profile.displayName || document.profile.cachedIdentity.name
      || document.identityPresentation.alias || 'UNNAMED PROFILE',
    secondaryLabel: compactAddress(document.profile.address),
  }), [document, identityRack]);
  const reducedMotion = layout.reducedMotion;
  const activeGrid = document.grids[activeIndex];
  const lastIndex = document.grids.length - 1;
  const workspaceSurfaceColor = latticeSurfaceColor(document.appearance.surfaceId);
  const viewerEntries = useMemo(() => activeGrid.placements.map((placement) => {
    const decoded = placementMedia[`${activeGrid.id}:${placement.id}`];
    const model = createProfileDocumentV9FocusViewModel(placement, {
      decodedDimensions: decoded?.dimensions, resolvedUrl: decoded?.media?.src,
      resolutionComplete: decoded?.status !== 'loading',
    });
    return model && decoded?.status === 'ready' && decoded.dimensions
      ? { ...model, focusDimensions: decoded.dimensions, media: { ...model.media, src: decoded.media.src } } : null;
  }).filter(Boolean), [activeGrid, placementMedia]);
  const findPlacementElement = useCallback((placementId) => [...(rootRef.current?.querySelectorAll('[data-placement-id]') || [])]
    .find((node) => node.dataset.placementId === placementId), []);
  const entriesById = useMemo(() => new Map(viewerEntries.map(entry => [entry.placement.id, entry])), [viewerEntries]);
  const viewer = useDisplayInspection({
    scope: activeGrid.id,
    items: activeGrid.placements,
    getEntry: id => entriesById.get(id),
    getElement: findPlacementElement,
    onOpen: () => dispatchInstruments({ type: 'open', instrument: 'metadata' }),
  });
  const viewerEntry = viewer.entry;
  const playback = useGridPlayback({ playing,
    enabled: displayOpen && lastIndex > 0 && !viewer.placementId && !gridSwipe,
    gridId: activeGrid.id, nextGridId: document.grids[(activeIndex + 1) % document.grids.length]?.id,
    canvasRef: stageRef, viewScale: 1, reducedMotion,
    onPause: () => setPlaying(false),
    onAdvance: gridId => {
      const index = document.grids.findIndex(grid => grid.id === gridId);
      if (index < 0) return false;
      setActiveIndex(index); return true;
    },
  });

  useEffect(() => {
    setActiveIndex(0); setPlacementMedia({}); setProfileVisible(false); setIdentityOpen(Boolean(document.workbench?.identity.open));
    globalThis.clearTimeout?.(gridSwipeTimerRef.current); gridSwipeTimerRef.current = null; setGridSwipe(null);
    rootRef.current?.focus({ preventScroll: true });
  }, [document.documentId, document.revision]);
  const closeProfile = useCallback(({ returnFocus = false } = {}) => {
    setProfileVisible(false);
    if (returnFocus) queueMicrotask(() => profileDockControlRef.current?.focus({ preventScroll: true }));
  }, []);
  const toggleProfile = useCallback(() => {
    if (viewer.placementId) return;
    if (profileVisible) closeProfile();
    else setProfileVisible(true);
  }, [closeProfile, profileVisible, viewer.placementId]);
  useEffect(() => {
    if (!profileVisible) return undefined;
    const handlePointerDown = (event) => {
      if (event.target?.closest?.('.lattice-profile-rail, .identity-module, [data-visitor-profile-trigger]')) return;
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
  }, [closeProfile, profileVisible]);
  const selectGrid = useCallback((index) => {
    if (viewer.placementId) return;
    setActiveIndex(((index % (lastIndex + 1)) + lastIndex + 1) % (lastIndex + 1));
  }, [lastIndex, viewer.placementId]);
  const clearGridDrag = useCallback(() => {
    const active = gridDragRef.current;
    if (!active) return;
    globalThis.removeEventListener?.('pointermove', active.move, true);
    globalThis.removeEventListener?.('pointerup', active.finish, true);
    globalThis.removeEventListener?.('pointercancel', active.cancel, true);
    gridDragRef.current = null;
    setGridDragging(false);
  }, []);
  const visitorInputBlocked = Boolean(viewer.placementId);
  const beginGridDrag = useCallback((event) => {
    if (visitorInputBlocked || event.button !== 0 || gridDragRef.current || gridSwipeTimerRef.current !== null) return;
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
        const targetIndex = (activeIndex + (direction === 'next' ? 1 : lastIndex)) % (lastIndex + 1);
        active.mode = Math.abs(deltaX) > Math.abs(deltaY) * 1.35 && lastIndex > 0
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
        setGridSwipe({ deltaX: committed ? (active.direction === 'next' ? -1 : 1) * (viewportWidth - 1) : 0,
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
      if (event.code !== 'Space' || editable(event) || visitorInputBlocked || event.target?.closest?.('[data-workbench-module]')) return;
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
  const openPlacementViewer = ({ element, placement, gridId }) => {
    if (gridId === activeGrid.id) viewer.open(placement.id, element);
  };
  const openIdentityRack = () => {
    if (viewer.placementId || !identityRack) return;
    setIdentityOpen(true); setProfileVisible(false);
  };
  const handleKeyDown = (event) => {
    if (event.target.closest?.('button,a,input,select,textarea,.identity-module') || viewer.placementId) return;
    const destination = ['ArrowRight', 'PageDown'].includes(event.key) ? activeIndex + 1
      : ['ArrowLeft', 'PageUp'].includes(event.key) ? activeIndex - 1
        : event.key === 'Home' ? 0 : event.key === 'End' ? lastIndex : null;
    if (destination === null) return; event.preventDefault(); playback.stop(); selectGrid(destination);
  };
  const swipe = gridSwipe || playback.swipe;
  const swipeGrid = Number.isInteger(swipe?.targetIndex) ? document.grids[swipe.targetIndex]
    : document.grids.find(grid => grid.id === swipe?.targetGridId);
  const swipeStyle = swipe ? { '--visitor-grid-swipe-x': `${swipe.deltaX}px`,
    '--visitor-grid-swipe-side': swipe.direction === 'next' ? 'calc(100% - 1px)' : 'calc(-100% + 1px)' } : undefined;

  const stage = <PublishedStage activeGridId={activeGrid.id} viewportRef={stageRef}
      onClickCapture={(event) => { if (suppressPlacementClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}
      onPointerDown={event => { playback.stop(); beginGridDrag(event); }}>
      <div className="visitor-grid-world__grid-track">
      <div className="visitor-grid-world__grid-plane visitor-grid-world__grid-plane--current">
        <GridProductionRenderer document={document} grid={activeGrid} imageLoading={activeIndex === 0 ? 'eager' : 'lazy'}
          onMediaState={handlePlacementMediaState} onPlacementActivate={openPlacementViewer}
          projectionBottomInset={0}
          viewerPlacementId={viewer.sourcePlacementId} />
      </div>
      {swipe && swipeGrid && <div aria-hidden="true" className="visitor-grid-world__grid-plane visitor-grid-world__grid-plane--adjacent">
        <GridProductionRenderer document={document} grid={swipeGrid} imageLoading="eager"
          onMediaState={handlePlacementMediaState} projectionBottomInset={0} />
      </div>}
      </div>
    </PublishedStage>;

  return <main aria-label="Published INSCAPE Grid visitor" className="visitor-grid-world system-workflow" data-workbench data-layout={layout.mode} data-lattice-menu-surface
    data-guide-mode={document.appearance.guideMode} data-menu-surface={document.appearance.menuSurfaceId}
    data-surface={document.appearance.surfaceId} data-space-navigation={spaceNavigation || undefined}
    data-grid-dragging={gridDragging || undefined} data-grid-swipe-settling={gridSwipe?.settling || undefined}
    onKeyDown={handleKeyDown} ref={rootRef} style={swipeStyle} tabIndex="-1">
    <PresentationBoard readOnly initialPresentation={displayPresentation} layoutMode={layout.mode}
      documentGeometry={document.geometry} profileAddress={document.profile.address}
      instanceState={displayOpen ? 'window' : 'minimized'} onMinimize={() => setDisplayOpen(false)} onRestore={() => setDisplayOpen(true)}
      menuSurface={document.appearance.menuSurfaceId} displaySurface={document.appearance.surfaceId} reducedMotion={reducedMotion}
      workbenchGridMode="NONE" shortcutSnap={false}
      playing={playing} playbackDisabled={lastIndex === 0 || Boolean(viewer.placementId)}
      onTogglePlayback={() => setPlaying(current => !current)}
      instrumentTriggers={instrumentTriggers}
      metadataOpen={instruments.active === 'metadata' || instruments.metadata === 'detached'}
      instrumentBayOpen={Boolean(instruments.active)}
      onToggleMetadata={() => dispatchInstruments({ type: 'toggle', instrument: 'metadata' })}
      inspectionAtmosphere={viewer.atmosphereActive} onInspectionCancel={viewer.close}
      renderInspection={viewer.placementId && viewer.entry ? (container, controlsContainer, scene) => <DisplayFocusViewer
        scene={scene} container={container} controlsContainer={controlsContainer} viewer={viewer}
        menuSurface={document.appearance.menuSurfaceId} workspaceSurfaceColor={workspaceSurfaceColor} /> : null}
      renderInstruments={(projection, overlayTop) => <DisplayInstruments workspaceRef={rootRef}
        instrumentTriggers={instrumentTriggers} state={instruments} dispatch={dispatchInstruments}
        projection={projection} overlayTop={overlayTop} scope={activeGrid.title}
        selectionLabel={viewerEntry?.dossier.title || 'No artwork selected'}
        renderMetadata={() => <OwnerSystemWorkflowMetadataContent dossier={viewerEntry?.dossier || null} />} />}>
      {stage}
    </PresentationBoard>
    {profileVisible && <LatticeProfileRail blocked={Boolean(viewer.placementId)} collapsed entries={[]} identityControlRef={identityControlRef} identityOnly
      identityDisabled={Boolean(viewer.placementId)} identityExpanded={identityOpen}
      officialIdentity={officialIdentity} onIdentityActivate={openIdentityRack} />}
    <footer className="visitor-grid-world__dock">
      <nav aria-label="Published profile navigation">
        <button aria-expanded={document.workbench ? identityOpen : profileVisible} aria-label="Profile" data-visitor-profile-trigger
          disabled={Boolean(viewer.placementId)} onClick={document.workbench ? () => setIdentityOpen(current => !current) : toggleProfile}
          ref={profileDockControlRef} type="button">PROFILE</button>
        {!displayOpen && <button aria-label="Open Display" onClick={() => setDisplayOpen(true)} type="button">DISPLAY</button>}
        {displayOpen && <div aria-label="Published Grid navigation" className="visitor-grid-world__navigation" role="group">
          <button aria-label="Previous Grid" disabled={lastIndex === 0 || Boolean(viewer.placementId)}
            onClick={() => { playback.stop(); selectGrid(activeIndex - 1); }} type="button">&lt;</button>
          <span aria-live="polite">{activeGrid.title}</span>
          <button aria-label="Next Grid" disabled={lastIndex === 0 || Boolean(viewer.placementId)}
            onClick={() => { playback.stop(); selectGrid(activeIndex + 1); }} type="button">&gt;</button>
        </div>}
        {(onOpenDirectory || onReturn || onExit) && <div className="visitor-grid-world__actions">
          {onOpenDirectory && <button onClick={onOpenDirectory} type="button">DISCOVER</button>}
          {onReturn && <button onClick={onReturn} type="button">RETURN</button>}
          {onExit && <button onClick={onExit} type="button">EXIT</button>}
        </div>}
      </nav>
      <strong aria-label="INSCAPE" className="visitor-grid-world__brand"><span aria-hidden="true" /></strong>
    </footer>
    {identityOpen && identityRack && <div hidden={Boolean(viewer.placementId)}><Suspense fallback={<p role="status">Opening Identity…</p>}>
      <IdentityModule key={document.profile.address} model={identityRack} menuSurface={document.appearance.menuSurfaceId}
        initialWindow={identityWindow} onWindowChange={document.workbench ? changeIdentityWindow : undefined}
        onClose={() => setIdentityOpen(false)} returnFocus={profileDockControlRef.current} />
    </Suspense></div>}
  </main>;
}
