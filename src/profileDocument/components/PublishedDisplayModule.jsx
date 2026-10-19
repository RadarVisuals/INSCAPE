import { forwardRef, useCallback, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReportScene } from '../../text/SceneNavigation.jsx';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import GridProductionRenderer from './GridProductionRenderer.jsx';
import { createProfileDocumentV9FocusViewModel } from './profileDocumentV9FocusViewModel.js';
import useDisplayInspection from '../../public/ownerSystemWorkflow/useDisplayInspection.js';
import { gridRailScenes } from '../../public/ownerSystemWorkflow/gridRail.js';
import { ArtworkPreparationProvider } from '../../artwork/ArtworkPreparation.jsx';
import DisplayFocusViewer from '../../public/ownerSystemWorkflow/DisplayFocusViewer.jsx';
import RackMenu from '../../public/menus/RackMenu.jsx';
import DisplayInspectionCues from '../../public/ownerSystemWorkflow/DisplayInspectionCues.jsx';
import { SharedDisplayToolContent, displayToolCommands, useSharedDisplayTools } from '../../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import { OwnerSystemWorkflowMetadataContent } from '../../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';
import { createDefaultWorkbenchPresentation } from '../domain/workbenchPresentation.js';
import useGridPlayback from '../../public/ownerSystemWorkflow/useGridPlayback.js';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import './publishedDisplay.css';

function PublishedStage({ children, activeGridId, onClickCapture, onPointerDown, viewportRef }) {
  return <div className="visitor-grid-world__viewport" data-active-grid-id={activeGridId}
    ref={viewportRef} onClickCapture={onClickCapture} onPointerDown={onPointerDown}>{children}</div>;
}


// One public Display session. The host supplies its frame and optional canvas
// focus action; scene state, media, gestures and playback stay here.
const PublishedDisplayModule = forwardRef(function PublishedDisplayModule({ document, Frame, frameProps,
  instanceId = 'display:primary', entryTarget, active = true, onActivate, onFocusModule,
  open: displayOpen = true, visible = true, onOpenChange, onInspectionChange, navigationHost, reducedMotion = false }, ref) {
  const tools = useSharedDisplayTools();
  const targetId = instanceId;
  const [inView, setInView] = useState(true);
  const [metadataSelection, setMetadataSelection] = useState(null);
  const rootRef = useRef(null), stageRef = useRef(null), activeSceneRef = useRef(null), trackRef = useRef(null);
  useEffect(() => {
    if (!displayOpen || !stageRef.current || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(stageRef.current); return () => observer.disconnect();
  }, [displayOpen]);
  const gridDragRef = useRef(null), suppressPlacementClickRef = useRef(false);
  const [playing, setPlaying] = useState(false), [liftInspection, setLiftInspection] = useState(false), [liftMoving, setLiftMoving] = useState(false);
  const [displayMenu, setDisplayMenu] = useState(null), [gridDragging, setGridDragging] = useState(false);
  const entryGridIndex = entryTarget?.moduleId === targetId ? Math.max(0, document.grids.findIndex(grid => grid.id === entryTarget.gridId)) : 0;
  const [activeIndex, setActiveIndex] = useState(entryGridIndex);
  const [placementMedia, setPlacementMedia] = useState({});
  const displayPresentation = useMemo(() => {
    const display = document.workbench?.display || createDefaultWorkbenchPresentation().display;
    const icon = display.shortcut.icon;
    return { ...display, shortcut: { ...display.shortcut, open: display.open,
      iconAssetId: icon?.stableAssetId || null, iconMedia: icon?.media?.type === 'image'
        ? { url: resolvePublishedAssetUrl(icon.media.url), width: icon.media.width, height: icon.media.height } : null } };
  }, [document]);
  const activeGrid = document.grids[activeIndex];
  const hasDisplay = document.grids.length > 0, lastIndex = document.grids.length - 1;
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
  const findPlacementElement = useCallback((placementId) => [...(activeSceneRef.current?.querySelectorAll('[data-placement-id]') || [])]
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
  const viewerEntry = metadataSelection && metadataSelection.gridId === activeGrid?.id ? entriesById.get(metadataSelection.id) : null;
  const selectMetadata = id => { tools.activate(targetId); setMetadataSelection({ gridId: activeGrid.id, id }); };
  const playback = useGridPlayback({ playing,
    enabled: displayOpen && visible && inView && lastIndex > 0,
    suspended: liftMoving || Boolean(viewer.placementId),
    scope: `${document.profile.address}:${document.documentId}:${document.revision}:${targetId}`,
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


  useEffect(() => { onInspectionChange?.(Boolean(viewer.placementId)); }, [onInspectionChange, viewer.placementId]);
  useEffect(() => {
    // Unrelated reception-card navigation must not reset this Display or its
    // linked Text. Only a destination addressed to this instance selects a Grid.
    if (entryTarget?.moduleId !== targetId) return;
    setActiveIndex(entryGridIndex); setPlacementMedia({});
  },
    [document.documentId, document.revision, entryTarget?.moduleId, entryTarget?.gridId]);
  const selectGrid = useCallback((index) => {
    if (viewer.placementId || liftMoving) return;
    setActiveIndex(((index % (lastIndex + 1)) + lastIndex + 1) % (lastIndex + 1));
  }, [lastIndex, viewer.placementId, liftMoving]);
  const clearGridDrag = useCallback(() => {
    const active = gridDragRef.current;
    if (!active) return;
    globalThis.removeEventListener?.('pointermove', active.move, true);
    globalThis.removeEventListener?.('pointerup', active.finish, true);
    globalThis.removeEventListener?.('pointercancel', active.cancel, true);
    gridDragRef.current = null;
    setGridDragging(false);
  }, []);
  const visitorInputBlocked = liftMoving || Boolean(viewer.placementId);
  useEffect(() => {
    if (!playback.isDragging()) clearGridDrag();
  }, [displayOpen, visitorInputBlocked, activeGrid?.id, clearGridDrag]);
  const beginGridDrag = useCallback((event) => {
    if (visitorInputBlocked || event.button !== 0 || gridDragRef.current) return;
    event.preventDefault(); event.stopPropagation();
    rootRef.current?.focus({ preventScroll: true });
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
    const release = () => gridDragRef.current?.cancel?.();
    globalThis.addEventListener?.('blur', release);
    return () => {
      globalThis.removeEventListener?.('blur', release);
      clearGridDrag();
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
  const inspectArtwork = source => {
    const id = source?.closest?.('[data-placement-id]')?.dataset.placementId || viewerEntry?.placement.id;
    if (!displayOpen || !hasDisplay || playing || liftMoving || gridDragging || gridSwipe?.moving || gridSwipe?.offset || viewer.placementId || !entriesById.has(id)) return false;
    return viewer.open(id);
  };
  useImperativeHandle(ref, () => ({ inspect: inspectArtwork }));
  const openPlacementViewer = ({ element, placement, gridId }) => {
    if (gridId !== activeGrid.id) return;
    selectMetadata(placement.id);
    if (liftInspection) viewer.open(placement.id, element);
    else if (!tools.state.metadata) {
      onFocusModule?.(targetId);
    }
  };
  const handleKeyDown = (event) => {
    if (liftMoving || !hasDisplay || !active) return;
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
  const sourceSlot = swipe?.sourceSlot || 0;
  const railScenes = gridRailScenes(document.grids, sourceGridId, sourceSlot);
  const preparedSlots = new Set(JSON.parse(useDeferredValue(JSON.stringify(railScenes.map(scene => scene.slot)))));
  const renderedGrids = railScenes.filter(scene => Math.abs(scene.slot - sourceSlot) < 2 || preparedSlots.has(scene.slot));

  const stage = activeGrid && <PublishedStage activeGridId={activeGrid.id} viewportRef={stageRef}
      onClickCapture={(event) => { if (suppressPlacementClickRef.current) { event.preventDefault(); event.stopPropagation(); } }}
      onPointerDown={beginGridDrag}>
      <ArtworkPreparationProvider viewportRef={stageRef} enabled={displayOpen}>
      <div ref={trackRef} className="visitor-grid-world__grid-track"
        data-rail-origin={swipe?.sourceSlot || 0} style={{ willChange: document.grids.length > 1 ? 'transform' : undefined }}>
      {renderedGrids.map(({ grid, slot }) => {
        const selected = grid.id === activeGrid.id && slot === sourceSlot, source = grid.id === sourceGridId && slot === sourceSlot;
        return <div key={`${grid.id}:${slot}`} ref={selected ? activeSceneRef : undefined} aria-hidden={!selected || undefined} inert={selected ? undefined : ''} data-rendered-grid-id={grid.id}
          className={`visitor-grid-world__grid-plane ${source ? 'visitor-grid-world__grid-plane--current' : 'visitor-grid-world__grid-plane--adjacent'}`}
          data-rail-slot={slot}>
          <GridProductionRenderer document={document} grid={grid} imageLoading="eager"
            onMediaState={handlePlacementMediaState} onPlacementActivate={selected ? openPlacementViewer : undefined}
            projectionBottomInset={0} viewerPlacementId={selected ? viewer.sourcePlacementId : null} />
        </div>;
      })}
      </div>
      </ArtworkPreparationProvider>
    </PublishedStage>;


  const navigation = hasDisplay && displayOpen ? <div aria-label="Published Grid navigation" className="visitor-grid-world__navigation" role="group">
    <button aria-label="Previous Grid" disabled={lastIndex === 0 || Boolean(viewer.placementId)}
      onClick={() => { playback.stop(); selectGrid(activeIndex - 1); }} type="button">&lt;</button>
    <span aria-live="polite">{activeGrid.title}</span>
    <button aria-label="Next Grid" disabled={lastIndex === 0 || Boolean(viewer.placementId)}
      onClick={() => { playback.stop(); selectGrid(activeIndex + 1); }} type="button">&gt;</button>
  </div> : null;
  const activate = () => { tools.activate(targetId); onActivate?.(); };
  return <section ref={rootRef} className="published-display" tabIndex={-1}
    aria-label={'Display — ' + (displayPresentation.name || 'Display Module')} data-display-instance={instanceId}
    data-active-display={active || undefined} data-grid-dragging={gridDragging || undefined}
    data-grid-swipe-settling={gridSwipe?.settling || undefined}
    onFocusCapture={activate} onPointerDownCapture={activate} onKeyDown={handleKeyDown}>
    {hasDisplay && <Frame {...frameProps} navigation={navigation} readOnly instanceId={instanceId} initialPresentation={displayPresentation} layoutMode={frameProps?.layoutMode || 'wide'}
      onLiftInspectionChange={setLiftInspection} onLiftTransitionChange={setLiftMoving}
      onLiftReturn={viewer.close}
      onInspect={() => inspectArtwork()} inspectDisabled={!viewerEntry || playing || liftMoving || gridDragging || Boolean(gridSwipe?.moving || gridSwipe?.offset || viewer.placementId)}
      documentGeometry={document.geometry} profileAddress={document.profile.address}
      instanceState={displayOpen ? 'window' : 'minimized'} onMinimize={() => onOpenChange?.(false)} onRestore={() => onOpenChange?.(true)}
      menuSurface={document.appearance.menuSurfaceId} displaySurface={document.appearance.surfaceId} moduleAppearance={document.appearance} reducedMotion={reducedMotion}
      shortcutSnap={false}
      onContextMenu={event => {
        event.preventDefault(); event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setDisplayMenu({ x: event.clientX || rect.left, y: event.clientY || rect.top,
          trigger: event.currentTarget.querySelector('.system-workflow__identity-strip') || rootRef.current });
      }}
      playing={playing} playbackAvailable={lastIndex > 0}
      onTogglePlayback={() => setPlaying(current => !current)}
      inspectionAtmosphere={viewer.atmosphereActive}
      renderCues={host => <DisplayInspectionCues key={`${document.profile.address}:${activeGrid.id}`}
        host={host} items={activeGrid.placements} viewer={viewer} contentVersion={viewerEntries} onSelect={selectMetadata} disabled={!tools.state.metadata || playing || Boolean(gridSwipe?.moving || gridSwipe?.offset)} />}
      renderInspection={viewer.placementId && viewer.entry ? (container, controlsContainer, scene) => <DisplayFocusViewer
        scene={scene} container={container} controlsContainer={controlsContainer} viewer={viewer}
        menuSurface={document.appearance.menuSurfaceId} workspaceSurfaceColor={workspaceSurfaceColor} /> : null}
>
      {stage}
    </Frame>}
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
    <SharedDisplayToolContent id="metadata" targetId={targetId} available={displayOpen && activeGrid != null && Boolean(viewerEntry?.dossier)}
      label={`${displayPresentation?.name || 'Display Module'} / ${activeGrid?.title || 'Grid'} / ${viewerEntry?.dossier.title || 'No artwork selected'}`}>
      <OwnerSystemWorkflowMetadataContent dossier={viewerEntry?.dossier || null} />
    </SharedDisplayToolContent>

    {navigationHost && createPortal(navigation, navigationHost)}
  </section>;
});
export default PublishedDisplayModule;
