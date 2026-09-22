import ModuleSurfaceControls from './ModuleSurfaceControls.jsx';
import { WorkbenchWindow } from './DisplayInstrumentWindow.jsx';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import RackMenu from '../menus/RackMenu.jsx';
import { PRIMARY_DISPLAY_ID } from '../../systemWorkflow/domain/displayModules.js';
import { isSystemWorkflowWorldCoverGrid } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import OwnerSystemWorkflowCanvas from './OwnerSystemWorkflowCanvas.jsx';
import DisplayFocusViewer from './DisplayFocusViewer.jsx';
import DisplayInspectionCues from './DisplayInspectionCues.jsx';
import { OwnerSystemWorkflowMetadataContent } from './OwnerSystemWorkflowMetadataModule.jsx';
import PresentationBoard from './PresentationBoard.jsx';
import { useSharedDisplayTools, SharedDisplayToolContent, displayToolCommands } from './SharedDisplayTools.jsx';
import OwnerSystemWorkflowSelectionInspector from './OwnerSystemWorkflowSelectionInspector.jsx';
import { useContextToolTarget } from './ContextToolbar.jsx';
import useOwnerSystemWorkflowCrop from './useOwnerSystemWorkflowCrop.js';
import useOwnerSystemWorkflowFocusViewer from './useOwnerSystemWorkflowFocusViewer.js';
import { createOwnerSystemWorkflowMetadataViewModel } from './ownerSystemWorkflowMetadataViewModel.js';
import { displayTextLabel } from '../../systemWorkflow/domain/displayText.js';

// Display owns composition interaction. The host supplies assets, its accepted
// controller and window configuration; it does not inspect selection or crop state.
export default forwardRef(function DisplayModule({ assetsById, controller, authoringLocked, suspended = false, displayName,
  panelOccupied, onRevealInstruments, onInspect, onToggleLibrary,
  onAuthoringLockToggle, registerAssetDimensions, resolveAssetDimensions, menuSurface,
  reducedMotion, workspaceSurfaceColor, windowProps, placementTargetRef, shortcutTargetRef, workspaceRef }, ref) {
  const tools = useSharedDisplayTools();
  const targetId = controller.moduleId;
  const toolTarget = useContextToolTarget();
  const toolAvailable = windowProps.instanceState === 'window';
  const inactive = suspended || !toolAvailable;
  const toolScope = `${displayName || windowProps.initialPresentation?.name || 'Display Module'} / ${controller.selectedGrid?.title || 'Untitled Grid'}`;
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearanceTrigger = useRef(null);
  const [moduleMenu, setModuleMenu] = useState(null);
  const [playingGrids, setPlayingGrids] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const editText = id => setEditingText(id ? { gridId: controller.selectedGridId, id } : null);
  const formatCommands = [
    { id: 'landscape', label: 'HORIZONTAL 16:9', checkable: true, selected: controller.draft.geometry.columns > controller.draft.geometry.rows, disabled: authoringLocked },
    { id: 'portrait', label: 'VERTICAL 9:16', checkable: true, selected: controller.draft.geometry.rows > controller.draft.geometry.columns, disabled: authoringLocked },
  ];
  const moduleCommand = id => {
    if (id === 'tool-layers' || id === 'tool-metadata') {
      onRevealInstruments();
      tools.command(id.slice(5), true, moduleMenu?.trigger || shortcutTargetRef.current?.node, targetId);
    }
    if (id === 'play-grids' && !playbackDisabled) { controller.replaceSelection([]); setPlayingGrids(current => !current); }
    if (id === 'appearance' && !authoringLocked) { appearanceTrigger.current = moduleMenu?.trigger || document.activeElement; setAppearanceOpen(true); }
    if (id === 'toggle-library') onToggleLibrary?.();
    if ((id === 'landscape' || id === 'portrait') && !authoringLocked) controller.setDisplayFormat(id.toUpperCase());
    if (id === 'include-display') controller.setDisplayVisibility('PRIVATE', 'PUBLIC');
    if (id === 'exclude-display') controller.setDisplayVisibility('PUBLIC', 'PRIVATE');
    if (id === 'close-module') {
      viewer.close();
      shortcutTargetRef.current?.show();
      windowProps.onMinimize?.();
      requestAnimationFrame(() => shortcutTargetRef.current?.node?.focus());
    }
    if (id === 'delete-module') moduleMenu?.onDelete?.();
    moduleMenu?.trigger?.focus();
    setModuleMenu(null);
  };
  const openModuleMenu = event => {
    if (event.target.closest('.system-workflow__instrument-bay, .system-workflow__instrument-window')) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    setModuleMenu({ x: event.clientX || bounds.left, y: event.clientY || bounds.top,
      trigger: event.currentTarget.querySelector('.system-workflow__identity-strip') || event.currentTarget,
      onDelete: windowProps.onDelete });
  };
  const [playbackState, setPlaybackState] = useState({ offset: false, moving: false });
  const pauseGrids = useCallback(() => setPlayingGrids(false), []);
  const crop = useOwnerSystemWorkflowCrop({ assetsById, controller });
  const viewer = useOwnerSystemWorkflowFocusViewer({ assetsById, controller,
    onOpen: onInspect, resolveAssetDimensions });
  const metadataPlacement = controller.selectedPlacements.length === 1 && controller.selectedPlacements[0].kind !== 'text' ? controller.selectedPlacements[0] : null;
  const metadataEntry = useMemo(() => metadataPlacement
    ? createOwnerSystemWorkflowMetadataViewModel(metadataPlacement, assetsById.get(metadataPlacement?.stableAssetId))
    : null, [assetsById, metadataPlacement]);
  const gridTransitionRef = useRef(null);
  const changeGrid = (gridId, directionHint = null, options = {}) => {
    if (!gridId || options.animate !== false && gridId === controller.selectedGridId || gridTransitionRef.current) return false;
    const grids = controller.draft?.grids || [];
    const currentIndex = grids.findIndex(({ id }) => id === controller.selectedGridId);
    const nextIndex = grids.findIndex(({ id }) => id === gridId);
    if (nextIndex < 0) return false;
    const direction = directionHint || (nextIndex > currentIndex ? 'next' : 'previous');
    // The moving camera owns scheduling and may cross again before this view
    // commits. Do not force an extra synchronous render from inside that action.
    if (options.animate === false) { controller.changeGrid(gridId); return true; }
    const commit = () => flushSync(() => controller.changeGrid(gridId));
    const transitionDocument = globalThis.document;
    if (reducedMotion || typeof transitionDocument?.startViewTransition !== 'function') {
      commit();
      return true;
    }
    const root = transitionDocument.documentElement;
    root.dataset.systemWorkflowGridDirection = direction;
    const transition = transitionDocument.startViewTransition(commit);
    gridTransitionRef.current = transition;
    const cleanup = () => {
      if (gridTransitionRef.current === transition) gridTransitionRef.current = null;
      delete root.dataset.systemWorkflowGridDirection;
    };
    transition.finished.then(cleanup, cleanup);
    return true;
  };
  const toggleAuthoringLock = () => {
    if (!authoringLocked) crop.cancelCrop();
    onAuthoringLockToggle();
  };
  const playbackDisabled = controller.draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid)).length < 2
    || inactive || isSystemWorkflowWorldCoverGrid(controller.selectedGrid) || panelOccupied || Boolean(viewer.placementId || crop.cropSession);
  const moduleCommands = [{ id: 'tools', label: 'TOOLS' },
    ...(controller.draft.grids.filter(grid => !isSystemWorkflowWorldCoverGrid(grid)).length > 1 ? [{ id: 'play-grids', label: playingGrids ? 'PAUSE GRIDS' : 'PLAY GRIDS', disabled: playbackDisabled }] : []),{ id: 'appearance', label: 'APPEARANCE', disabled: authoringLocked }, { id: 'format', label: 'FORMAT', disabled: authoringLocked },
    ...(onToggleLibrary ? [{ id: 'toggle-library', label: 'LIBRARY' }] : []),
    ...(controller.moduleId !== PRIMARY_DISPLAY_ID ? [controller.store.getSnapshot().displays?.find(item => item.id === controller.moduleId)?.visibility === 'PUBLIC'
      ? { id: 'exclude-display', label: 'MAKE DISPLAY PRIVATE' }
      : { id: 'include-display', label: 'INCLUDE DISPLAY IN PUBLICATION' }] : [])];
  const moduleSubmenu = id => id === 'tools' ? displayToolCommands() : id === 'format' ? formatCommands : [];
  useEffect(() => {
    if (playbackDisabled) pauseGrids();
  }, [playbackDisabled, pauseGrids]);
  useEffect(() => {
    if (!inactive) return;
    crop.cancelCrop();
    viewer.close();
    setModuleMenu(null);
    setAppearanceOpen(false);
  }, [inactive]);
  useEffect(() => {
    if (toolTarget !== targetId) crop.cancelCrop();
  }, [toolTarget, targetId]);
  useImperativeHandle(ref, () => ({
    changeGrid,
  }));
  const selectionLabel = metadataEntry?.dossier?.title || (controller.selectedPlacements.length === 1 && controller.selectedPlacements[0].kind === 'text'
    ? displayTextLabel(controller.selectedPlacements[0].text) : null) || (controller.selectedPlacements.length > 1
    ? `${controller.selectedPlacements.length} selected` : controller.selectedPlacements.length === 1
      ? 'Selected artwork' : 'No artwork selected');
  return <><PresentationBoard {...windowProps} onContextMenu={openModuleMenu}
      moduleCommands={moduleCommands} moduleSubmenu={moduleSubmenu} onModuleCommand={moduleCommand}
      shortcutTargetRef={shortcutTargetRef} assetsById={assetsById} authoringLocked={authoringLocked}
      displaySurface={controller.draft?.appearance.surfaceId} moduleAppearance={controller.draft.appearance}
      documentGeometry={isSystemWorkflowWorldCoverGrid(controller.selectedGrid) ? { columns: 32, rows: 18 } : controller.draft?.geometry}
      inspectionAtmosphere={viewer.atmosphereActive}
      playing={playingGrids}
      onTogglePlayback={() => { controller.replaceSelection([]); setPlayingGrids((current) => !current); }}
      menuSurface={menuSurface}
      onInspectionCancel={viewer.close}
      renderCues={host => <DisplayInspectionCues key={`${controller.draft.profileAddress}:${controller.selectedGridId}`}
        host={host} items={controller.selectedGrid?.placements || []} viewer={viewer} contentVersion={assetsById} onSelect={id => { tools.activate(targetId); controller.replaceSelection([id]); }}
        editable={!authoringLocked} disabled={!tools.state.metadata || panelOccupied || playbackState.moving || playbackState.offset || Boolean(crop.cropSession)}
        />}
      onAuthoringLockToggle={toggleAuthoringLock}
      renderInspection={viewer.placementId ? (container, controlsContainer, scene) => <DisplayFocusViewer
        scene={scene} container={container} controlsContainer={controlsContainer} menuSurface={menuSurface}
        viewer={viewer} workspaceSurfaceColor={workspaceSurfaceColor} /> : null}
>
    <OwnerSystemWorkflowCanvas placementTargetRef={placementTargetRef} assetsById={assetsById} authoringLocked={authoringLocked} controller={controller} crop={crop}
        editingTextId={editingText?.gridId === controller.selectedGridId ? editingText.id : null} onEditText={editText}
        playingGrids={playingGrids} onPauseGrids={pauseGrids} onPlaybackStateChange={setPlaybackState}
        onAssetDimensions={registerAssetDimensions} onChangeGrid={changeGrid}
        suspended={inactive} interactionDisabled={inactive || panelOccupied || Boolean(viewer.placementId)} onOpenViewer={(placement) => tools.state.metadata ? controller.replaceSelection([placement.id]) : viewer.open(placement.id)}
        onPlacementRef={viewer.registerPlacement} reducedMotion={reducedMotion}
        resolveAssetDimensions={resolveAssetDimensions} viewerPlacementId={viewer.sourcePlacementId} inspectionActive={Boolean(viewer.placementId)} />
    </PresentationBoard>
      <OwnerSystemWorkflowSelectionInspector key={controller.selectedGridId} assetsById={assetsById}
        toolLabel={toolScope} available={toolAvailable && !suspended && !viewer.placementId}
        authoringLocked={authoringLocked || playingGrids || playbackState.moving} controller={controller} crop={crop}
        onBeginCrop={crop.beginCrop} onEditText={editText}
        onArtworkInfo={event => { onRevealInstruments(); tools.command('metadata', true, event.currentTarget, targetId); }} />
    <SharedDisplayToolContent id="metadata" targetId={targetId} label={`${toolScope} / ${selectionLabel}`} available={toolAvailable}>
      <OwnerSystemWorkflowMetadataContent dossier={metadataEntry?.dossier || null} />
    </SharedDisplayToolContent>

    {appearanceOpen && !authoringLocked && workspaceRef.current && createPortal(<WorkbenchWindow surfaceStyle={{ zIndex: 70 }} label="Display appearance" title={windowProps.initialPresentation?.name || 'Display Module'} width={320} initialHeight={470} chrome="bevel" menuSurface={menuSurface}
      controls={<button type="button" className="system-workflow__round-control" aria-label="Close Display appearance" onClick={() => { setAppearanceOpen(false); appearanceTrigger.current?.focus(); }}>×</button>}>
      <ModuleSurfaceControls display value={controller.draft.appearance.edges} frame={controller.draft.appearance.frame !== false}
        onChange={edges => controller.setAppearance({ edges })} onFrameChange={frame => controller.setAppearance({ frame })} />
    </WorkbenchWindow>, workspaceRef.current)}
    {moduleMenu && createPortal(<RackMenu anchor={moduleMenu} commands={[...moduleCommands,
      { id: 'close-module', label: 'CLOSE MODULE' },
      ...(moduleMenu.onDelete ? [{ id: 'delete-module', label: 'DELETE MODULE' }] : []),
    ]} getSubmenuCommands={moduleSubmenu}
      label="Display Module commands" menuSurfaceId={menuSurface} returnFocus={moduleMenu.trigger}
      onClose={() => setModuleMenu(null)} onCommand={moduleCommand} systemWorkflowOverlay />, document.body)}</>;
});
