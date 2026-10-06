import { useWorkbenchView } from './WorkbenchView.jsx';
import ModuleSurfaceControls from './ModuleSurfaceControls.jsx';
import DisplayCanvasControls from './DisplayCanvasControls.jsx';
import { useSharedTextTools } from '../../text/SharedTextTools.jsx';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import RackMenu from '../menus/RackMenu.jsx';
import { PRIMARY_DISPLAY_ID, displayPreset } from '../../systemWorkflow/domain/displayModules.js';
import DisplaySizeDialog from './DisplaySizeDialog.jsx';
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
export default forwardRef(function DisplayModule({ assetsById, controller, authoringLocked: editingLocked, suspended = false, displayName,
  panelOccupied, onRevealInstruments, onInspect, onToggleLibrary,
  onAuthoringLockToggle, registerAssetDimensions, resolveAssetDimensions, menuSurface,
  reducedMotion, workspaceSurfaceColor, windowProps, placementTargetRef, shortcutTargetRef, workspaceRef }, ref) {
  const authoringLocked = editingLocked || Boolean(useWorkbenchView().presentationTransforms?.[controller.moduleId || PRIMARY_DISPLAY_ID]);
  const tools = useSharedDisplayTools();
  const textTools = useSharedTextTools();
  const targetId = controller.moduleId;
  const toolTarget = useContextToolTarget();
  const toolAvailable = windowProps.instanceState === 'window';
  const inactive = suspended || !toolAvailable;
  const toolScope = `${displayName || windowProps.initialPresentation?.name || 'Display Module'} / ${controller.selectedGrid?.title || 'Untitled Grid'}`;
  const [moduleMenu, setModuleMenu] = useState(null);
  const [sizeDialog, setSizeDialog] = useState(null);
  const [playingGrids, setPlayingGrids] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const [liftInspection, setLiftInspection] = useState(false);
  const [liftMoving, setLiftMoving] = useState(false);
  const editText = id => {
    setEditingText(id ? { gridId: controller.selectedGridId, id } : null);
    if (id) { controller.replaceSelection([id]); tools.activate(targetId); }
    textTools?.setOpen(Boolean(id));
  };
  const selectedTextId = controller.selectedPlacements.length === 1 && controller.selectedPlacements[0].kind === 'text' ? controller.selectedPlacements[0].id : null;
  useEffect(() => {
    if (!textTools?.open || textTools.activeModuleId !== targetId || inactive || authoringLocked) return;
    setEditingText(current => selectedTextId ? current?.id === selectedTextId && current.gridId === controller.selectedGridId
      ? current : { gridId: controller.selectedGridId, id: selectedTextId } : null);
  }, [textTools?.open, textTools?.activeModuleId, targetId, inactive, authoringLocked, selectedTextId, controller.selectedGridId]);
  const formatCommands = [
    { id: 'landscape', label: 'HORIZONTAL 16:9', checkable: true, selected: displayPreset(controller.draft.geometry) === 'LANDSCAPE', disabled: authoringLocked },
    { id: 'portrait', label: 'VERTICAL 9:16', checkable: true, selected: displayPreset(controller.draft.geometry) === 'PORTRAIT', disabled: authoringLocked },
    { id: 'custom-size', label: 'CUSTOM SIZE…', checkable: true, selected: displayPreset(controller.draft.geometry) === 'CUSTOM', disabled: authoringLocked },
  ];
  const moduleCommand = id => {
    if (id === 'tool-layers' || id === 'tool-metadata') {
      onRevealInstruments();
      tools.command(id.slice(5), true, moduleMenu?.trigger || shortcutTargetRef.current?.node, targetId);
    }
    if (id === 'play-grids' && !playbackDisabled) { controller.replaceSelection([]); setPlayingGrids(current => !current); }
    if (id === 'appearance' && !authoringLocked) tools.command('appearance', true, moduleMenu?.trigger || document.activeElement, targetId);
    if (id === 'toggle-library') onToggleLibrary?.();
    if ((id === 'landscape' || id === 'portrait') && !authoringLocked) controller.setDisplayFormat(id.toUpperCase());
    if (id === 'custom-size' && !authoringLocked) {
      controller.clearError();
      setSizeDialog({ geometry: controller.draft.geometry, appearance: controller.draft.appearance, trigger: moduleMenu?.trigger || shortcutTargetRef.current?.node });
    }
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
    setSizeDialog(null);
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
      reducedMotion={reducedMotion} onLiftInspectionChange={setLiftInspection} onLiftTransitionChange={setLiftMoving}
      onLiftReturn={viewer.close}
      liftDisabled={inactive || panelOccupied || Boolean(crop.cropSession || editingText || sizeDialog)}
      moduleCommands={moduleCommands} moduleSubmenu={moduleSubmenu} onModuleCommand={moduleCommand}
      shortcutTargetRef={shortcutTargetRef} assetsById={assetsById} authoringLocked={authoringLocked}
      displaySurface={controller.draft?.appearance.surfaceId} moduleAppearance={controller.draft.appearance}
      documentGeometry={isSystemWorkflowWorldCoverGrid(controller.selectedGrid) ? { columns: 32, rows: 18 } : controller.draft?.geometry}
      inspectionAtmosphere={viewer.atmosphereActive}
      playing={playingGrids}
      onTogglePlayback={() => { controller.replaceSelection([]); setPlayingGrids((current) => !current); }}
      menuSurface={menuSurface}
      renderCues={host => <DisplayInspectionCues key={`${controller.draft.profileAddress}:${controller.selectedGridId}`}
        host={host} items={controller.selectedGrid?.placements || []} viewer={viewer} contentVersion={assetsById} onSelect={id => { tools.activate(targetId); controller.replaceSelection([id]); }}
        editable={!authoringLocked} disabled={!tools.state.metadata || panelOccupied || playbackState.moving || playbackState.offset || Boolean(crop.cropSession)}
        />}
      onAuthoringLockToggle={toggleAuthoringLock}
      renderInspection={viewer.placementId ? (container, controlsContainer, scene) => <DisplayFocusViewer
        scene={scene} container={container} controlsContainer={controlsContainer} menuSurface={menuSurface}
        viewer={viewer} workspaceSurfaceColor={workspaceSurfaceColor} /> : null}
>
    <OwnerSystemWorkflowCanvas placementTargetRef={placementTargetRef} assetsById={assetsById} authoringLocked={authoringLocked || liftInspection} controller={controller} crop={crop}
        editingTextId={editingText?.gridId === controller.selectedGridId ? editingText.id : null} onEditText={liftInspection ? undefined : editText}
        playingGrids={playingGrids} onPauseGrids={pauseGrids} onPlaybackStateChange={setPlaybackState}
        onAssetDimensions={registerAssetDimensions} onChangeGrid={changeGrid}
        suspended={inactive} interactionDisabled={inactive || panelOccupied || liftMoving || Boolean(viewer.placementId)} onOpenViewer={(placement) => tools.state.metadata && !liftInspection ? controller.replaceSelection([placement.id]) : viewer.open(placement.id)}
        onPlacementRef={viewer.registerPlacement} reducedMotion={reducedMotion}
        resolveAssetDimensions={resolveAssetDimensions} viewerPlacementId={viewer.sourcePlacementId} inspectionActive={liftMoving || Boolean(viewer.placementId)} />
    </PresentationBoard>
      <OwnerSystemWorkflowSelectionInspector key={controller.selectedGridId} assetsById={assetsById}
        toolLabel={toolScope} available={toolAvailable && !suspended && !liftInspection && !viewer.placementId}
        authoringLocked={authoringLocked || playingGrids || playbackState.moving} controller={controller} crop={crop}
        onBeginCrop={crop.beginCrop} onEditText={editText}
        onArtworkInfo={event => { onRevealInstruments(); tools.command('metadata', true, event.currentTarget, targetId); }} />
    <SharedDisplayToolContent id="metadata" targetId={targetId} label={`${toolScope} / ${selectionLabel}`} available={toolAvailable}>
      <OwnerSystemWorkflowMetadataContent dossier={metadataEntry?.dossier || null} />
    </SharedDisplayToolContent>

    <SharedDisplayToolContent id="appearance" targetId={targetId} label={displayName || windowProps.initialPresentation?.name || 'Display Module'} available={toolAvailable && !inactive && !authoringLocked && !liftInspection}>
      <DisplayCanvasControls appearance={controller.draft.appearance} onChange={controller.setAppearance} error={controller.error} />
      <ModuleSurfaceControls display value={controller.draft.appearance.edges} frame={controller.draft.appearance.frame !== false}
        onChange={edges => controller.setAppearance({ edges })} onFrameChange={frame => controller.setAppearance({ frame })} />
    </SharedDisplayToolContent>
    {sizeDialog && !suspended && !authoringLocked && <DisplaySizeDialog geometry={sizeDialog.geometry} appearance={sizeDialog.appearance} menuSurface={menuSurface}
      returnFocus={sizeDialog.trigger} error={controller.error} onClose={() => setSizeDialog(null)}
      onConfirm={(size, appearance) => controller.setDisplayFormat(size, sizeDialog.geometry, appearance, sizeDialog.appearance)} />}
    {moduleMenu && createPortal(<RackMenu anchor={moduleMenu} commands={[...moduleCommands,
      { id: 'close-module', label: 'CLOSE MODULE' },
      ...(moduleMenu.onDelete ? [{ id: 'delete-module', label: 'DELETE MODULE' }] : []),
    ]} getSubmenuCommands={moduleSubmenu}
      label="Display Module commands" menuSurfaceId={menuSurface} returnFocus={moduleMenu.trigger}
      onClose={() => setModuleMenu(null)} onCommand={moduleCommand} systemWorkflowOverlay />, document.body)}</>;
});
