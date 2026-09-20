import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SceneNavigationProvider, useReportScene } from '../../text/SceneNavigation.jsx';
import { WorkbenchViewProvider, WorkbenchViewControls } from '../../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import LatticeProfileRail from '../../lattice/rendering/LatticeProfileRail.jsx';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import GridProductionRenderer from './GridProductionRenderer.jsx';
import { createProfileDocumentV9FocusViewModel } from './profileDocumentV9FocusViewModel.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import '../../lattice/rendering/latticeMenuSurface.css';
import './visitorGridWorld.css';
import PresentationBoard from '../../public/ownerSystemWorkflow/PresentationBoard.jsx';
import useDisplayInspection from '../../public/ownerSystemWorkflow/useDisplayInspection.js';
import { gridRailSlot } from '../../public/ownerSystemWorkflow/gridRail.js';
import DisplayFocusViewer from '../../public/ownerSystemWorkflow/DisplayFocusViewer.jsx';
import RackMenu from '../../public/menus/RackMenu.jsx';
import { createPortal } from 'react-dom';
import DisplayInspectionCues from '../../public/ownerSystemWorkflow/DisplayInspectionCues.jsx';
import { SharedDisplayToolsProvider, SharedDisplayToolWindows, SharedDisplayToolContent, SharedDisplayToolsLauncher, displayToolCommands, useSharedDisplayTools } from '../../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
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
const MiniAppsWorkbench = lazy(() => import('../../miniApps/MiniAppsWorkbench.jsx'));
const TextWorkbench = lazy(() => import('../../text/TextWorkbench.jsx'));
const compactAddress = (address) => `${address.slice(0, 10)}…${address.slice(-6)}`;

export default function ProfileDocumentV9Visitor(props) {
  return <SharedDisplayToolsProvider key={`${props.document.profile.address}:${props.document.documentId}:${props.document.revision}`}><SceneNavigationProvider><WorkbenchViewProvider><ProfileDocumentV9Session {...props} /></WorkbenchViewProvider></SceneNavigationProvider></SharedDisplayToolsProvider>;
}

function ProfileDocumentV9Session({ document, onExit, onOpenDirectory, onReturn, onConnect, embedded = false, instanceId, active = true, onActivate }) {
  useStartupDestinationReady();
  const tools = useSharedDisplayTools();
  const targetId = instanceId || 'display:primary';
  const [metadataSelection, setMetadataSelection] = useState(null);
  const rootRef = useRef(null);
  const [activeDisplay, setActiveDisplay] = useState('display:primary');
  const additionalDocuments = useMemo(() => (document.displays || []).map(module => {
    const { displays: _displays, miniApps: _miniApps, texts: _texts, ...shared } = document;
    const { id, ...content } = module;
    const { id: _presentationId, ...display } = document.workbench?.displays?.find(item => item.id === id) || createDefaultWorkbenchPresentation().display;
    return { id, document: { ...shared, ...content, metadata: {}, workbench: { version: 1,
      display,
      identity: { ...createDefaultWorkbenchPresentation().identity, open: false } } } };
  }), [document]);
  const layout = useOwnerSystemWorkflowLayout();
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [displayMenu, setDisplayMenu] = useState(null);
  const identityControlRef = useRef(null);
  const profileDockControlRef = useRef(null);
  const gridDragRef = useRef(null);
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
  const hasDisplay = document.grids.length > 0;
  const lastIndex = document.grids.length - 1;
  const workspaceSurfaceColor = latticeSurfaceColor(document.appearance.surfaceId);
  const viewerEntries = useMemo(() => (activeGrid?.placements || []).filter(placement => placement.kind !== 'text').map((placement) => {
    const decoded = placementMedia[`${activeGrid.id}:${placement.id}`];
    const model = createProfileDocumentV9FocusViewModel(placement, {
      decodedDimensions: decoded?.dimensions, resolvedUrl: decoded?.media?.src,
      resolutionComplete: decoded?.status !== 'loading',
    });
    return model && decoded?.status === 'ready' && decoded.dimensions
      ? { ...model, focusDimensions: decoded.dimensions, media: { ...model.media, src: decoded.media.src } } : null;
  }).filter(Boolean), [activeGrid, placementMedia]);
  const findPlacementElement = useCallback((placementId) => [...(stageRef.current?.querySelectorAll('[data-placement-id]') || [])]
    .find((node) => node.dataset.placementId === placementId), []);
  const entriesById = useMemo(() => new Map(viewerEntries.map(entry => [entry.placement.id, entry])), [viewerEntries]);
  const viewer = useDisplayInspection({
    scope: `${document.profile.address}:${document.documentId}:${document.revision}:${instanceId || 'display:primary'}:${activeGrid?.id}`,
    items: (activeGrid?.placements || []).filter(placement => placement.kind !== 'text'),
    getEntry: id => entriesById.get(id),
    getElement: findPlacementElement,
    onOpen: id => setMetadataSelection({ gridId: activeGrid.id, id }),
    onNavigate: id => setMetadataSelection({ gridId: activeGrid.id, id }),
  });
  const viewerEntry = metadataSelection?.gridId === activeGrid?.id ? entriesById.get(metadataSelection.id) : null;
  const selectMetadata = id => { tools.activate(targetId); setMetadataSelection({ gridId: activeGrid.id, id }); };
  const playback = useGridPlayback({ playing,
    enabled: displayOpen && lastIndex > 0 && !viewer.placementId,
    scope: `${document.profile.address}:${document.documentId}:${document.revision}`,
    adjacentGrid: (id, direction) => document.grids[(document.grids.findIndex(grid => grid.id === id) + (direction === 'next' ? 1 : lastIndex)) % document.grids.length]?.id,
    gridId: activeGrid?.id, nextGridId: document.grids[(activeIndex + 1) % document.grids.length]?.id,
    canvasRef: stageRef, trackRef, viewScale: 1, reducedMotion,
    onPause: () => setPlaying(false),
    onAdvance: gridId => {
      const index = document.grids.findIndex(grid => grid.id === gridId);
      if (index < 0) return false;
      setActiveIndex(index); return true;
    },
  });

  useEffect(() => {
    setActiveIndex(0); setPlacementMedia({}); setProfileVisible(false); setIdentityOpen(Boolean(document.workbench?.identity.open));
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
  useEffect(() => {
    if (!playback.isDragging()) clearGridDrag();
  }, [displayOpen, visitorInputBlocked, activeGrid?.id, clearGridDrag]);
  const beginGridDrag = useCallback((event) => {
    if (visitorInputBlocked || event.button !== 0 || gridDragRef.current) return;
    event.preventDefault(); event.stopPropagation();
    playback.beginDrag(event.clientX);
    const origin = { x: event.clientX, y: event.clientY };
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
        playback.moveDrag(pointerEvent.clientX);
      }
    };
    const complete = (pointerEvent, cancelled = false) => {
      if (gridDragRef.current !== active || pointerEvent?.pointerId != null && pointerEvent.pointerId !== active.pointerId) return;
      if (active.moved) {
        suppressPlacementClickRef.current = true;
        globalThis.setTimeout?.(() => { suppressPlacementClickRef.current = false; }, 0);
      }
      clearGridDrag();
      if (active.mode !== 'swipe') { playback.endDrag(true); return; }
      playback.endDrag(cancelled);
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
      spacePressedRef.current = false; clearGridDrag();
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
    if (gridId === activeGrid.id) { selectMetadata(placement.id); if (!tools.state.metadata) viewer.open(placement.id, element); }
  };
  const openIdentityRack = () => {
    if (viewer.placementId || !identityRack) return;
    setIdentityOpen(true); setProfileVisible(false);
  };
  const handleKeyDown = (event) => {
    if (!hasDisplay || !active || !embedded && activeDisplay !== 'display:primary') return;
    if (event.target.closest?.('button,a,input,select,textarea,.identity-module') || viewer.placementId) return;
    const destination = ['ArrowRight', 'PageDown'].includes(event.key) ? activeIndex + 1
      : ['ArrowLeft', 'PageUp'].includes(event.key) ? activeIndex - 1
        : event.key === 'Home' ? 0 : event.key === 'End' ? lastIndex : null;
    if (destination === null) return; event.preventDefault(); playback.stop(); selectGrid(destination);
  };
  const gridSwipe = playback.swipe;
  const swipe = gridSwipe;
  const swipeGrid = Number.isInteger(swipe?.targetIndex) ? document.grids[swipe.targetIndex]
    : document.grids.find(grid => grid.id === swipe?.targetGridId);
  const sourceGridId = swipe?.sourceGridId || activeGrid?.id;
  useReportScene(targetId, sourceGridId, swipeGrid?.id, swipe, displayOpen, document.grids.map(grid => grid.id));
  // Keep a bounded neighborhood mounted, with stable scene keys. Arrival reuses
  // the incoming media instead of loading it again in a second canonical plane.
  // Two on either side also prepare the next handoff during drag and momentum.
  const neighbor = offset => document.grids[((activeIndex + offset) % document.grids.length + document.grids.length) % document.grids.length];
  const aheadId = neighbor(2)?.id, behindId = neighbor(-2)?.id;
  const preparedIds = new Set(JSON.parse(useDeferredValue(JSON.stringify(
    [sourceGridId, neighbor(-1)?.id, neighbor(1)?.id, aheadId, behindId, swipeGrid?.id],
  ))));
  // Visible/immediate neighbors stay synchronous. Far media mounts in an
  // interruptible render, and stale preparation never chooses a current slot.
  const preparedGridIds = new Set([activeGrid?.id, sourceGridId,
    neighbor(-1)?.id, neighbor(1)?.id, swipeGrid?.id,
    preparedIds.has(aheadId) ? aheadId : null,
    preparedIds.has(behindId) ? behindId : null]);
  const renderedGrids = document.grids.filter(grid => preparedGridIds.has(grid.id));

  const stage = activeGrid && <PublishedStage activeGridId={activeGrid.id} viewportRef={stageRef}
      onClickCapture={(event) => { if (suppressPlacementClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}
      onPointerDown={beginGridDrag}>
      <div ref={trackRef} className="visitor-grid-world__grid-track"
        data-rail-origin={swipe?.sourceSlot || 0} style={{ willChange: swipe || playing ? 'transform' : undefined }}>
      {renderedGrids.map(grid => {
        const selected = grid.id === activeGrid.id, source = grid.id === sourceGridId;
        return <div key={grid.id} aria-hidden={!selected || undefined} inert={selected ? undefined : ''} data-rendered-grid-id={grid.id}
          className={`visitor-grid-world__grid-plane ${source ? 'visitor-grid-world__grid-plane--current' : 'visitor-grid-world__grid-plane--adjacent'}`}
          data-rail-slot={gridRailSlot(grid.id, { sourceId: sourceGridId, targetId: swipeGrid?.id,
              sourceSlot: swipe?.sourceSlot, direction: swipe?.direction,
              previousId: neighbor(-1)?.id, nextId: neighbor(1)?.id, aheadId: neighbor(2)?.id, behindId: neighbor(-2)?.id })}
          style={{ willChange: swipe || playing ? 'transform' : undefined }}>
          <GridProductionRenderer document={document} grid={grid} imageLoading="eager"
            onMediaState={handlePlacementMediaState} onPlacementActivate={selected ? openPlacementViewer : undefined}
            projectionBottomInset={0} viewerPlacementId={selected ? viewer.sourcePlacementId : null} />
        </div>;
      })}
      </div>
    </PublishedStage>;

  return <main data-embedded-display={embedded || undefined} data-display-instance={instanceId || 'display:primary'} data-active-display={(embedded ? active : activeDisplay === 'display:primary') || undefined}
    onFocusCapture={event => { if (event.target.closest('[data-display-instance]') === rootRef.current && !event.target.closest('.visitor-grid-world__dock, [data-shared-display-tools]')) { tools.activate(targetId); if (embedded) onActivate?.(); else setActiveDisplay('display:primary'); } }}
    onPointerDownCapture={event => { if (event.target.closest('[data-display-instance]') === rootRef.current && !event.target.closest('.visitor-grid-world__dock, [data-shared-display-tools]')) { tools.activate(targetId); if (embedded) onActivate?.(); else setActiveDisplay('display:primary'); } }} aria-label="Published INSCAPE Grid visitor" className="visitor-grid-world system-workflow" data-workbench data-layout={layout.mode} data-lattice-menu-surface
    data-guide-mode={document.appearance.guideMode} data-menu-surface={document.appearance.menuSurfaceId}
    data-surface={document.appearance.surfaceId} data-space-navigation={spaceNavigation || undefined}
    data-grid-dragging={gridDragging || undefined} data-grid-swipe-settling={gridSwipe?.settling || undefined}
    onKeyDown={handleKeyDown} ref={rootRef} tabIndex="-1">
    {!embedded && <WorkbenchViewControls hostRef={rootRef} />}
    {hasDisplay && <PresentationBoard readOnly instanceId={instanceId} initialPresentation={displayPresentation} layoutMode={layout.mode}
      documentGeometry={document.geometry} profileAddress={document.profile.address}
      instanceState={displayOpen ? 'window' : 'minimized'} onMinimize={() => setDisplayOpen(false)} onRestore={() => setDisplayOpen(true)}
      menuSurface={document.appearance.menuSurfaceId} displaySurface={document.appearance.surfaceId} moduleAppearance={document.appearance} reducedMotion={reducedMotion}
      shortcutSnap={false}
      onContextMenu={event => {
        event.preventDefault(); event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setDisplayMenu({ x: event.clientX || rect.left, y: event.clientY || rect.top,
          trigger: event.currentTarget.querySelector('.system-workflow__identity-strip') });
      }}
      playing={playing}
      onTogglePlayback={() => setPlaying(current => !current)}
      inspectionAtmosphere={viewer.atmosphereActive} onInspectionCancel={viewer.close}
      renderCues={host => <DisplayInspectionCues key={`${document.profile.address}:${activeGrid.id}`}
        host={host} items={activeGrid.placements} viewer={viewer} contentVersion={viewerEntries} onSelect={selectMetadata} disabled={!tools.state.metadata || playing || Boolean(gridSwipe)} />}
      renderInspection={viewer.placementId && viewer.entry ? (container, controlsContainer, scene) => <DisplayFocusViewer
        scene={scene} container={container} controlsContainer={controlsContainer} viewer={viewer}
        menuSurface={document.appearance.menuSurfaceId} workspaceSurfaceColor={workspaceSurfaceColor} /> : null}
>
      {stage}
    </PresentationBoard>}
    {displayMenu && createPortal(<RackMenu anchor={displayMenu} label="Display commands"
      commands={[{ id: 'tools', label: 'TOOLS' },
        ...(lastIndex > 0 ? [{ id: 'play-grids', label: playing ? 'PAUSE GRIDS' : 'PLAY GRIDS', disabled: Boolean(viewer.placementId) }] : [])]}
      getSubmenuCommands={id => id === 'tools' ? displayToolCommands(true) : []}
      menuSurfaceId={document.appearance.menuSurfaceId} returnFocus={displayMenu.trigger}
      onClose={() => setDisplayMenu(null)} onCommand={id => {
        if (id === 'tool-metadata') tools.command('metadata', true, displayMenu.trigger, targetId);
        if (id === 'play-grids') setPlaying(current => !current);
        displayMenu.trigger?.focus();
        setDisplayMenu(null);
      }} systemWorkflowOverlay />, globalThis.document.body)}
    {!embedded && <SharedDisplayToolWindows readOnly menuSurface={document.appearance.menuSurfaceId} />}
    <SharedDisplayToolContent id="metadata" targetId={targetId} available={displayOpen && activeGrid != null}
      label={`${displayPresentation?.name || 'Display Module'} / ${activeGrid?.title || 'Grid'} / ${viewerEntry?.dossier.title || 'No artwork selected'}`}>
      <OwnerSystemWorkflowMetadataContent dossier={viewerEntry?.dossier || null} />
    </SharedDisplayToolContent>
    {!embedded && profileVisible && <LatticeProfileRail blocked={Boolean(viewer.placementId)} collapsed entries={[]} identityControlRef={identityControlRef} identityOnly
      identityDisabled={Boolean(viewer.placementId)} identityExpanded={identityOpen}
      officialIdentity={officialIdentity} onIdentityActivate={openIdentityRack} />}
    {!embedded && <footer className="visitor-grid-world__dock">
      <nav aria-label="Published profile navigation">
        <SharedDisplayToolsLauncher readOnly menuSurface={document.appearance.menuSurfaceId} />
        <button aria-expanded={document.workbench ? identityOpen : profileVisible} aria-label="Profile" data-visitor-profile-trigger
          disabled={Boolean(viewer.placementId)} onClick={document.workbench ? () => setIdentityOpen(current => !current) : toggleProfile}
          ref={profileDockControlRef} type="button">PROFILE</button>
        {hasDisplay && !displayOpen && <button aria-label="Open Display" onClick={() => setDisplayOpen(true)} type="button">DISPLAY</button>}
        {hasDisplay && displayOpen && <div aria-label="Published Grid navigation" className="visitor-grid-world__navigation" role="group">
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
    </footer>}
    {!embedded && identityOpen && identityRack && <div hidden={Boolean(viewer.placementId)}><Suspense fallback={<p role="status">Opening Identity…</p>}>
      <IdentityModule key={document.profile.address} model={identityRack} menuSurface={document.appearance.menuSurfaceId}
        initialWindow={identityWindow} onWindowChange={document.workbench ? changeIdentityWindow : undefined}
        onClose={() => setIdentityOpen(false)} returnFocus={profileDockControlRef.current} />
    </Suspense></div>}
    {!embedded && additionalDocuments.map(item => <ProfileDocumentV9Session key={item.id} document={item.document}
      embedded instanceId={item.id} active={activeDisplay === item.id} onActivate={() => setActiveDisplay(item.id)} />)}
    {!embedded && document.texts?.length > 0 && <Suspense fallback={<p role="status">Opening Text…</p>}>
      <TextWorkbench records={document.texts} presentations={document.workbench?.texts} profileAddress={document.profile.address} />
    </Suspense>}
    {!embedded && document.miniApps?.length > 0 && <Suspense fallback={<p role="status">Opening mini apps…</p>}>
      <MiniAppsWorkbench records={document.miniApps} presentations={document.workbench?.miniApps}
        profileAddress={document.profile.address} onConnect={onConnect} />
    </Suspense>}
  </main>;
}
