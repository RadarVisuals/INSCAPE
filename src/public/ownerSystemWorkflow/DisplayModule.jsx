import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { isSystemWorkflowWorldCoverGrid } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import OwnerSystemWorkflowCanvas from './OwnerSystemWorkflowCanvas.jsx';
import OwnerSystemWorkflowFocusViewer from './OwnerSystemWorkflowFocusViewer.jsx';
import { OwnerSystemWorkflowMetadataContent } from './OwnerSystemWorkflowMetadataModule.jsx';
import PresentationBoard from './PresentationBoard.jsx';
import DisplayInstruments from './DisplayInstruments.jsx';
import OwnerSystemWorkflowSelectionInspector from './OwnerSystemWorkflowSelectionInspector.jsx';
import { initialDisplayInstruments, transitionDisplayInstruments } from './displayInstrumentState.js';
import useOwnerSystemWorkflowCrop from './useOwnerSystemWorkflowCrop.js';
import useOwnerSystemWorkflowFocusViewer from './useOwnerSystemWorkflowFocusViewer.js';
import { createOwnerSystemWorkflowMetadataViewModel } from './ownerSystemWorkflowMetadataViewModel.js';

// Display owns composition interaction. The host supplies assets, its accepted
// controller and window configuration; it does not inspect selection or crop state.
export default forwardRef(function DisplayModule({ assetsById, controller, authoringLocked, active,
  panelOccupied, instrumentsObscured, onRevealInstruments, onInspect, onMetadataAvailabilityChange,
  onAuthoringLockToggle, registerAssetDimensions, resolveAssetDimensions, menuSurface,
  reducedMotion, workspaceSurfaceColor, windowProps }, ref) {
  const [instruments, dispatchInstruments] = useReducer(transitionDisplayInstruments, initialDisplayInstruments);
  const [playingGrids, setPlayingGrids] = useState(false);
  const [playbackTransition, setPlaybackTransition] = useState(false);
  const pauseGrids = useCallback(() => setPlayingGrids(false), []);
  const crop = useOwnerSystemWorkflowCrop({ assetsById, controller });
  const viewer = useOwnerSystemWorkflowFocusViewer({ assetsById, controller,
    onOpen: onInspect, resolveAssetDimensions });
  const metadataPlacement = controller.selectedPlacements.length === 1 ? controller.selectedPlacements[0] : null;
  const metadataEntry = useMemo(() => metadataPlacement
    ? createOwnerSystemWorkflowMetadataViewModel(metadataPlacement, assetsById.get(metadataPlacement.stableAssetId))
    : null, [assetsById, metadataPlacement]);
  const gridTransitionRef = useRef(null);
  const changeGrid = (gridId, directionHint = null, options = {}) => {
    if (!gridId || gridId === controller.selectedGridId || gridTransitionRef.current) return false;
    const grids = controller.draft?.grids || [];
    const currentIndex = grids.findIndex(({ id }) => id === controller.selectedGridId);
    const nextIndex = grids.findIndex(({ id }) => id === gridId);
    if (nextIndex < 0) return false;
    const direction = directionHint || (nextIndex > currentIndex ? 'next' : 'previous');
    const commit = () => flushSync(() => controller.changeGrid(gridId));
    const transitionDocument = globalThis.document;
    if (options.animate === false || reducedMotion || typeof transitionDocument?.startViewTransition !== 'function') {
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
  const instrumentCommand = (event) => {
    if (event.instrument !== 'layers' || ['close', 'toggle', 'detach'].includes(event.type)) crop.cancelCrop();
    dispatchInstruments(event);
  };
  const toggleInstrument = (instrument) => {
    onRevealInstruments();
    instrumentCommand({ type: instrumentsObscured ? 'open' : 'toggle', instrument });
  };
  const toggleAuthoringLock = () => {
    if (!authoringLocked) crop.cancelCrop();
    onAuthoringLockToggle();
  };
  const instrumentsVisible = !instrumentsObscured;
  const playbackDisabled = controller.draft.grids.filter((grid) => !isSystemWorkflowWorldCoverGrid(grid)).length < 2
    || isSystemWorkflowWorldCoverGrid(controller.selectedGrid) || panelOccupied || Boolean(viewer.placementId || crop.cropSession);
  useEffect(() => {
    if (!active || playbackDisabled) pauseGrids();
  }, [active, playbackDisabled, pauseGrids]);
  const metadataAvailable = instruments.metadata === 'closed';
  useEffect(() => { onMetadataAvailabilityChange(metadataAvailable); }, [metadataAvailable, onMetadataAvailabilityChange]);
  useImperativeHandle(ref, () => ({
    changeGrid,
    openMetadata: () => instrumentCommand({ type: 'open', instrument: 'metadata' }),
  }));
  const selectionLabel = metadataEntry?.dossier?.title || (controller.selectedPlacements.length > 1
    ? `${controller.selectedPlacements.length} selected` : controller.selectedPlacements.length === 1
      ? 'Selected artwork' : 'No artwork selected');
  return <PresentationBoard {...windowProps} assetsById={assetsById} authoringLocked={authoringLocked}
      displaySurface={controller.draft?.appearance.surfaceId}
      documentGeometry={controller.draft?.geometry}
      inspectionAtmosphere={viewer.atmosphereActive}
      layersOpen={instrumentsVisible && (instruments.active === 'layers' || instruments.layers === 'detached')}
      metadataOpen={instrumentsVisible && (instruments.active === 'metadata' || instruments.metadata === 'detached')}
      instrumentBayOpen={instrumentsVisible && Boolean(instruments.active)}
      playing={playingGrids} playbackDisabled={playbackDisabled}
      onTogglePlayback={() => { controller.replaceSelection([]); setPlayingGrids((current) => !current); }}
      menuSurface={menuSurface}
      onToggleLayers={() => toggleInstrument('layers')}
      onToggleMetadata={() => toggleInstrument('metadata')}
      onInspectionCancel={viewer.close}
      onAuthoringLockToggle={toggleAuthoringLock}
      renderInspection={viewer.placementId ? (container, controlsContainer) => <OwnerSystemWorkflowFocusViewer
        container={container} controlsContainer={controlsContainer} menuSurface={menuSurface}
        viewer={viewer} workspaceSurfaceColor={workspaceSurfaceColor} /> : null}
      renderInstruments={instrumentsVisible ? (projection, overlayTop) => <DisplayInstruments
        state={instruments} dispatch={instrumentCommand} projection={projection} overlayTop={overlayTop}
        scope={controller.selectedGrid?.title || 'Untitled Grid'} selectionLabel={selectionLabel}
        renderLayers={() => <OwnerSystemWorkflowSelectionInspector key={controller.selectedGridId}
          assetsById={assetsById} authoringLocked={authoringLocked || playingGrids || playbackTransition} controller={controller} crop={crop} onBeginCrop={crop.beginCrop} />}
        renderMetadata={() => <OwnerSystemWorkflowMetadataContent dossier={metadataEntry?.dossier || null} />} /> : null}>
    <OwnerSystemWorkflowCanvas assetsById={assetsById} authoringLocked={authoringLocked} controller={controller} crop={crop}
        playingGrids={playingGrids} onPauseGrids={pauseGrids} onPlaybackTransitionChange={setPlaybackTransition}
        onAssetDimensions={registerAssetDimensions} onChangeGrid={changeGrid}
        interactionDisabled={panelOccupied || Boolean(viewer.placementId)} onOpenViewer={(placement) => viewer.open(placement.id)}
        onPlacementRef={viewer.registerPlacement} reducedMotion={reducedMotion}
        resolveAssetDimensions={resolveAssetDimensions} viewerPlacementId={viewer.sourcePlacementId} />
    </PresentationBoard>;
});
