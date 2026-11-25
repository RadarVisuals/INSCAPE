import { useWorkspaceSaveLabel } from '../../workspace/WorkspaceBoundary.jsx';
import './ownerSystemWorkflow.css';
import './displayInstruments.css';
import '../../lattice/rendering/latticeMenuSurface.css';
import useWorkbenchPublicationPanel from './useWorkbenchPublicationPanel.js';
import useWorkbenchPresentation, { useWorkbenchLayoutSession } from './useWorkbenchPresentation.js';
import { publishedCompositionDestinations } from '../../profileDocument/domain/publishedCanvases.js';
import CanvasJourney from '../workbenchOverview/CanvasJourney.jsx';
import { useGalleryStudioEndpoint } from '../../navigation/galleryStudioMotion.js';
import { workbenchArea } from '../../systemWorkflow/domain/workbenchArea.js';
import { rememberGalleryView } from '../../navigation/galleryViewMemory.js';
import OwnerWorkbenchSession from './OwnerWorkbenchSession.jsx';
import useWorkbenchModuleRegistry from './useWorkbenchModuleRegistry.js';
import useOwnerWorkbenchLibrary from './useOwnerWorkbenchLibrary.js';
import prepareWorkbenchPreview from './prepareWorkbenchPreview.js';
import workbenchCommands from './workbenchCommands.js';
import OwnerWorkbenchModules from './OwnerWorkbenchModules.jsx';
import { WorkbenchPlacement } from './WorkbenchPlacement.jsx';
import { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchView } from './WorkbenchView.jsx';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import OwnerEditorMenuBar from './OwnerEditorMenuBar.jsx';
import OwnerWorkspaceMotion from './OwnerWorkspaceMotion.jsx';
import { workbenchOverviewModel } from '../workbenchOverview/workbenchOverviewModel.js';
import { createNamedWorkbenchActions } from './namedWorkbenchActions.js';
import WorkbenchToolDocks from './WorkbenchToolDocks.jsx';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { createPortal } from 'react-dom';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import { createProductionIdentityDossierViewModel } from '../identity/productionIdentityDossierViewModel.js';
import { loadIdentityShortcut, saveIdentityShortcut } from '../identity/useIdentityShortcut.js';
import {
  SharedDisplayToolsProvider,
  SharedDisplayToolWindows,
  displayToolCommands,
} from './SharedDisplayTools.jsx';
import { ContextToolbarProvider, ContextToolbar } from './ContextToolbar.jsx';
import { SharedTextToolsProvider } from '../../text/SharedTextTools.jsx';
import WorkbenchAlignmentGrid from './WorkbenchAlignmentGrid.jsx';
import WorkbenchImageDropTarget from '../../imageModule/WorkbenchImageDropTarget.jsx';
import useDraftUndo from './useDraftUndo.js';
import OwnerSystemWorkflowPanelLayer from './OwnerSystemWorkflowPanelLayer.jsx';
import useOwnerSystemWorkflowActivity from './useOwnerSystemWorkflowActivity.js';
import useWorkbenchController from './useWorkbenchController.js';
import useWorkbenchSelection from './useWorkbenchSelection.js';
import useWorkbenchPreview from './useWorkbenchPreview.js';
import useTextRecovery from '../../text/useTextRecovery.js';
import { textRecoveries, TEXT_RECOVERY_MESSAGE } from '../../text/textEditRecovery.js';
import useOwnerSystemWorkflowLayout from './useOwnerSystemWorkflowLayout.js';
import useOwnerSystemWorkflowPanels from './useOwnerSystemWorkflowPanels.js';
import WorkbenchBackupControls from '../../systemWorkflow/WorkbenchBackupControls.jsx';
import WorkbenchCommandMenu from './WorkbenchCommandMenu.jsx';
import OwnerWorkbenchToolbar from './OwnerWorkbenchToolbar.jsx';

const OwnerSystemWorkflowPublicationRack = lazy(() => import('./OwnerSystemWorkflowPublicationRack.jsx'));
const CompositionPreview = lazy(() => import('../workbenchOverview/CompositionPreview.jsx'));
const IdentityModule = lazy(() => import('../identity/IdentityModule.jsx'));
const OwnerWorkbenchOverview = lazy(() => import('../workbenchOverview/OwnerWorkbenchOverview.jsx'));

// Reuse the camera/toolbar owner's measured free viewport. Recovery stays
// reachable above wrapped controls without changing any authored geometry.
function WorkbenchRecoveryMessages({ children }) {
  const { toolViewportBottom } = useWorkbenchView();
  const style = Number.isFinite(toolViewportBottom)
    ? { '--workbench-recovery-bottom': `max(8px, calc(100dvh - ${toolViewportBottom}px + 8px))` }
    : undefined;
  return (
    <div className="system-workflow__recovery-stack" style={style}>
      {children}
    </div>
  );
}

function reviewIdentity(profileAddress, fixture) {
  if (!fixture) return null;
  return {
    address: profileAddress,
    normalizedAddress: profileAddress,
    name: fixture.name || 'RADAR VISUALS',
    avatarUrl: fixture.avatarUrl || null,
    description: fixture.description || null,
    tags: fixture.tags || [],
    links: fixture.links || [],
    profileImageCandidates: fixture.avatarUrl
      ? [{ kind: 'URL', url: fixture.avatarUrl, width: 96, source: 'DEVELOPMENT_FIXTURE' }]
      : [],
    backgroundImageCandidates: [],
    isUniversalProfile: true,
    metadataIntegrity: 'UNVERIFIED',
    status: 'RESOLVED',
    source: 'DEVELOPMENT_FIXTURE',
  };
}

export default function OwnerSystemWorkflowRuntime(props) {
  return <OwnerWorkbenchSession {...props} component={WorkbenchSession} />;
}

export function WorkbenchSession({
  connectedProfile,
  getWalletPublicationContext,
  onConnect,
  onDisconnect,
  onOpenProfile,
  onOpenWriting,
  onOpenGallery,
  onReturnToWorks,
  initialNew,
  initialPublicationReview,
  onPublicationReviewOpened,
  onNewOpened,
  ownerDestinations,
  returnLabel = 'Gallery',
  onOpenWorkbenchOverview,
  onPublicationConfirmed,
  profileAddress,
  publishedResolution,
  reviewStorage,
  reviewAssets,
  reviewCategories,
  reviewActivity,
  reviewProfile,
  restored,
  restoreWarning,
  onDraftRestored,
  sharedStore,
  focusWorkbench,
  keeperDockPositions,
  navigatorPosition,
  editorPreferences,
  workbenchPreferenceStore,
  compositionBackup,
  documentNavigation,
  overview,
}) {
  const composition = Boolean(sharedStore.getComposition);
  useStartupDestinationReady();
  const workbenchController = useWorkbenchController(profileAddress, { storage: reviewStorage, sharedStore });
  const layoutSession = useWorkbenchLayoutSession({
    profileAddress,
    draft: workbenchController.draft,
    storage: workbenchController.storage,
    workbenchId: sharedStore.getWorkbenchId(),
    cells: sharedStore.getCells?.(),
    restored,
  });
  const {
    restoredWorkspace,
    initialWorkbench,
    workbenchLayout,
    changeIdentityWindow,
    sharedTools,
    setSharedTools,
    initialTextTools,
  } = layoutSession;
  const pendingText = useTextRecovery(workbenchController.store, profileAddress);
  const browsing = overview?.active === true;
  const leavingEditor = overview?.journey?.direction === 'overview';
  const [commandSearchRequest, setCommandSearchRequest] = useState(null);
  const requestCommandSearch = trigger => setCommandSearchRequest({ trigger });
  const workspaceMotion = useRef(null);
  const textPreference = editorPreferences.section('textOpen');
  const textToolsOpen =
    useSyncExternalStore(textPreference.subscribe, textPreference.getSnapshot) ?? initialTextTools.open;
  const setTextToolsOpen = useCallback(
    open => {
      textPreference.update(open);
      if (open) editorPreferences.tools.change({ type: 'open', tab: 'Inspector', section: 'Text' });
    },
    [textPreference, editorPreferences]
  );
  const preferenceError = useSyncExternalStore(editorPreferences.subscribe, editorPreferences.getError);
  const creationBarPreference = editorPreferences.section('creationBar');
  const creationBarVisible =
    useSyncExternalStore(creationBarPreference.subscribe, creationBarPreference.getSnapshot) ?? true;
  const toolDocks = editorPreferences.tools;
  const layersVisible = useSyncExternalStore(toolDocks.subscribe, toolDocks.layersVisible);
  const inspectorVisible = useSyncExternalStore(toolDocks.subscribe, toolDocks.infoVisible);
  const libraryOpen = useSyncExternalStore(toolDocks.subscribe, toolDocks.libraryVisible);
  const changeTool = toolDocks.change;
  const selectionState = useWorkbenchSelection(workbenchController.draft, {
    initialTargetId: workbenchController.draft.texts?.some(text => text.id === sharedTools.targetId)
      ? sharedTools.targetId
      : (initialTextTools.targetId ?? sharedTools.targetId),
    readContent: workbenchController.store.getSnapshot,
  });
  const activeModuleId = selectionState.targetId;
  const activateArtwork = selectionState.selectArtwork;
  const modules = useWorkbenchModuleRegistry();
  const { identity: identityTargetRef, module: moduleTargetsRef } = modules.targets;
  const savedWorkbenchPreferences = useSyncExternalStore(
    workbenchPreferenceStore.subscribe,
    workbenchPreferenceStore.getSnapshot
  );
  const workbenchPreferences = useMemo(
    () =>
      composition
        ? { ...savedWorkbenchPreferences, gridMode: 'NONE', edgeSnap: false }
        : savedWorkbenchPreferences,
    [composition, savedWorkbenchPreferences]
  );
  const workbenchPreferenceError = useSyncExternalStore(
    workbenchPreferenceStore.subscribe,
    workbenchPreferenceStore.getError
  );
  const setWorkbenchPreferences = workbenchPreferenceStore.update;
  const [notice, setNoticeState] = useState(
    restored
      ? { message: restoreWarning || 'Workbench restored and saved locally. Nothing was published.' }
      : null
  );
  const setNotice = useCallback(message => setNoticeState(message ? { message } : null), []);
  const dismissHostNotice = useCallback(
    () => setNoticeState(current => (current === notice ? null : current)),
    [notice]
  );
  const previewSession = useWorkbenchPreview(workbenchController.store, setNotice);
  const { preview, close: closePreview } = previewSession;
  const performHistory = useDraftUndo(
    workbenchController.store,
    Boolean(preview) || browsing,
    setNotice,
    pendingText.length ? TEXT_RECOVERY_MESSAGE : null
  );
  const [identityOpen, setIdentityOpen] = useState(() => {
    if (composition) return false;
    const mode = loadIdentityShortcut(profileAddress)?.mode;
    return mode ? mode !== 'closed' : Boolean(initialWorkbench.current?.identity.open);
  });
  const identityReturnFocus = useRef(null);
  const identityPresentationRef = useRef(null);
  const openIdentity = trigger => {
    identityReturnFocus.current = trigger || workspaceRef.current;
    panels.closePanel({ returnFocus: false });
    if (!identityPresentationRef.current)
      saveIdentityShortcut(profileAddress, { ...loadIdentityShortcut(profileAddress), mode: 'window' });
    setIdentityOpen(true);
    identityPresentationRef.current?.restore();
  };
  const workspaceRef = useRef(null);
  const workbenchNavigationRef = useRef(null);
  const libraryTrigger = useRef(null);
  const workbenchImageTargetRef = useRef(null);
  const [workspaceMenu, setWorkspaceMenu] = useState(null);
  const layout = useOwnerSystemWorkflowLayout();
  const fixtureProfile = import.meta.env.DEV ? reviewProfile : null;
  const liveIdentity = useProfileIdentity(profileAddress, {
    sourceMode: fixtureProfile ? 'FIXTURE' : 'LIVE',
  });
  const contractFacts = useProfileContractFacts(profileAddress, { enabled: !fixtureProfile });
  const profileIdentity =
    (import.meta.env.DEV ? reviewIdentity(profileAddress, fixtureProfile) : null) || liveIdentity;
  const panels = useOwnerSystemWorkflowPanels({ blocked: Boolean(preview) });
  const {
    open: publicationOpen,
    presence: publicationPresence,
    close: closePublication,
    toggle: togglePublication,
  } = useWorkbenchPublicationPanel({
    closePanel: panels.closePanel,
    initialPublicationReview,
    onPublicationReviewOpened,
  });
  const panel = panels.activePanel;
  const artworkLayersOpen = layersVisible;
  const toggleArtworkLayers = () => changeTool({ type: artworkLayersOpen ? 'close' : 'open', tab: 'Layers' });
  const library = useOwnerWorkbenchLibrary({
    profileAddress,
    draft: workbenchController.draft,
    libraryOpen,
    reviewAssets,
    reviewCategories,
  });
  const { assetsById, resolvedAssets, canonicalRecords, resolveAssetDimensions, libraryData } = library;
  const { projection: workbenchProjection, persistence: layoutPersistence } = useWorkbenchPresentation({
    profileAddress,
    draft: workbenchController.draft,
    store: workbenchController.store,
    storage: workbenchController.storage,
    workbenchId: sharedStore.getWorkbenchId(),
    layoutSession,
    modules,
    activeModuleId,
    identityOpen,
  });
  const workbench = workbenchProjection.value;
  const saveBeforeDeparture = (browsing = false) => {
    if (composition) {
      sharedStore.checkTransition();
      if (textRecoveries(sharedStore, profileAddress).length) throw new Error(TEXT_RECOVERY_MESSAGE);
      if (!workbenchProjection.value)
        throw new Error(workbenchProjection.error || 'The layout is not ready.');
      if (!layoutPersistence.flush()) throw new Error('The layout could not be saved. Retry its save first.');
      if (!workbenchController.saveWorkbench(workbenchProjection.value))
        throw new Error('The document could not be saved. Retry its save first.');
      return;
    }
    createNamedWorkbenchActions({
      store: sharedStore,
      projection: workbenchProjection,
      flushLayout: layoutPersistence.flush,
      busy: publicationPresence.present || previewSession.preparing || Boolean(preview),
    })[browsing ? 'browse' : 'leave']();
  };
  const leaveForDestination = (open, browsing = false) => {
    try {
      saveBeforeDeparture(browsing);
      open?.();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const showWorkbenchOverview = () => {
    if (browsing) {
      panels.closePanel({ returnFocus: false });
      return;
    }
    saveBeforeDeparture(true);
    panels.closePanel({ returnFocus: false });
    const draft = { ...workbenchController.draft, workbench };
    const item = sharedStore.listWorkbenches().find(item => item.id === sharedStore.getWorkbenchId());
    const source =
      !composition && item
        ? workspaceMotion.current?.capture(workbenchOverviewModel(draft), item.name, item.id)
        : null;
    onOpenWorkbenchOverview(source);
  };
  const selectDocument = id => {
    if (id !== documentNavigation.activeId) {
      saveBeforeDeparture(true);
      documentNavigation.select(id);
    }
  };
  const compositionId = documentNavigation?.activeId;
  const resolution = publishedResolution;
  const verified =
    !resolution?.busy &&
    resolution?.status === 'RESOLVED' &&
    resolution.document?.profile.address === profileAddress;
  const placements = verified ? publishedCompositionDestinations(resolution.document, compositionId) : [];
  const inGallery = placements.includes('gallery');
  const incoming = useGalleryStudioEndpoint(
    'editor',
    browsing ? null : profileAddress,
    id => {
      if (!inGallery || (id && id !== compositionId)) return null;
      rememberGalleryView(profileAddress, { selectedId: compositionId });
      // Only geometry crosses back into the published view. Gallery supplies its verified artwork.
      const model = { area: workbenchArea(workbench) };
      const moving = workspaceMotion.current?.captureActive(model, '', compositionId);
      const frame = moving || workspaceMotion.current?.captureEditor(model, '', compositionId);
      return (
        frame && {
          id: compositionId,
          frame: frame.frame,
          paint: frame.paint,
          fitPublished: !moving,
          radius: frame.radius,
          background: frame.background,
        }
      );
    },
    workspaceRef,
    CanvasJourney
  );
  const routeJourney = incoming?.source.id === compositionId ? incoming : null;
  const journey = overview?.journey || routeJourney;
  const onProfile = placements.includes('profile');
  const knownEmpty =
    !resolution?.busy && resolution?.status === 'UNAVAILABLE' && resolution.address === profileAddress;
  let publicationState = resolution?.busy ? 'Checking publication' : 'Publication unverified';
  if (verified || knownEmpty) {
    if (inGallery) publicationState = onProfile ? 'In Gallery and on Profile' : 'In Gallery';
    else publicationState = onProfile ? 'On Profile' : 'Studio only';
  }
  const workspaceDestinations = {
    Curation: ownerDestinations?.Curation && (() => leaveForDestination(ownerDestinations.Curation)),
    Profile:
      onOpenProfile &&
      (() => {
        saveBeforeDeparture();
        onOpenProfile();
      }),
    Gallery: onOpenGallery ? () => leaveForDestination(onOpenGallery, true) : showWorkbenchOverview,
    Writing:
      onOpenWriting &&
      (() => {
        saveBeforeDeparture();
        onOpenWriting();
      }),
  };
  const activity = useOwnerSystemWorkflowActivity({
    active: panel === 'activity',
    fixture: reviewActivity,
    profileAddress,
  });
  const panelOccupied = Boolean(
    publicationPresence.present || panel || Object.values(panels.presence).some(({ present }) => present)
  );
  const noticeMessage = workbenchController.error || notice?.message;
  const dismissNotice = workbenchController.error ? workbenchController.clearError : dismissHostNotice;
  useEffect(() => {
    if (!noticeMessage || noticeMessage === restoreWarning) return undefined;
    const timeout = globalThis.setTimeout(dismissNotice, 4_500);
    return () => globalThis.clearTimeout(timeout);
  }, [noticeMessage, dismissNotice, restoreWarning]);
  const publishedProfile = ['RESOLVED', 'STALE'].includes(publishedResolution?.status)
    ? publishedResolution.document?.profile
    : null;
  const cachedIdentity =
    publishedProfile?.address === profileAddress ? publishedProfile.cachedIdentity : null;
  const profileModel = useMemo(
    () =>
      createProductionIdentityDossierViewModel({
        assetRecords: assetsById,
        contractFacts,
        identity: profileIdentity,
        cachedIdentity,
        identityPresentation: workbenchController.draft?.identityPresentation,
      }),
    [
      assetsById,
      contractFacts,
      workbenchController.draft?.identityPresentation,
      profileIdentity,
      cachedIdentity,
    ]
  );
  const publicationProfile = useMemo(
    () => ({
      name: profileIdentity?.status === 'RESOLVED' ? profileIdentity.name : null,
      avatarUrl: profileIdentity?.status === 'RESOLVED' ? profileIdentity.avatarUrl : null,
    }),
    [profileIdentity]
  );
  const previewPresentation = JSON.stringify({ workbench, profile: publicationProfile });
  const livePreviewPresentation = useRef(previewPresentation);
  livePreviewPresentation.current = previewPresentation;
  const openPreview = trigger => {
    if (publicationOpen) closePublication({ returnFocus: false });
    if (textRecoveries(workbenchController.store, profileAddress).length) {
      setNotice(TEXT_RECOVERY_MESSAGE);
      return;
    }
    panels.closePanel({ returnFocus: false });
    previewSession.open(
      current =>
        prepareWorkbenchPreview({
          current,
          draft: workbenchController.draft,
          store: workbenchController.store,
          profileAddress,
          workbench,
          projectionError: workbenchProjection.error,
          library,
          publicationProfile,
          activeWork: documentNavigation?.items.find(item => item.id === compositionId) || {
            id: sharedStore.getWorkbenchId(),
            name: 'Composition',
          },
          composition: sharedStore.getComposition?.(),
          publishedDocument: publishedProfile ? resolution.document : null,
        }),
      () => livePreviewPresentation.current === previewPresentation,
      trigger
    );
  };
  const openDockPanel = (name, trigger) => {
    if (publicationOpen) closePublication({ returnFocus: false });
    panels.togglePanel(name, trigger);
  };
  const openLibrary = trigger => {
    if (publicationOpen) closePublication({ returnFocus: false });
    panels.closePanel({ returnFocus: false });
    libraryTrigger.current = trigger?.isConnected ? trigger : workspaceRef.current;
    changeTool({ type: 'open', tab: 'Library', focus: true });
  };
  const instrumentsObscured = panelOccupied || (browsing && !leavingEditor);
  const revealInstruments = () => {
    if (publicationOpen) closePublication({ returnFocus: false });
    if (instrumentsObscured) panels.closePanel({ returnFocus: false });
  };
  const { addCommands, runCommand } = workbenchCommands({
    store: workbenchController.store,
    draft: workbenchController.draft,
    profileAddress,
    workspaceRef,
    setNotice,
    activateArtwork,
    setTextToolsOpen,
    revealInstruments,
    changeTool,
    openLibrary,
    openIdentity,
    openPreview,
    togglePublication,
    setWorkspaceMenu,
    composition: Boolean(composition),
  });
  const previewing = Boolean(preview);
  const canvasSuspended = previewing || browsing || leavingEditor;
  const committedLabel = useWorkspaceSaveLabel(profileAddress, 'Saved locally');
  const recordStatus = sharedStore.getRecordState().status;
  const commitFailure = useSyncExternalStore(sharedStore.subscribe, sharedStore.getLastCommitFailure);
  const saveState =
    pendingText.length ||
    commitFailure ||
    workbenchController.error ||
    layoutPersistence.error ||
    workbenchProjection.error ||
    !sharedStore.hasWriteAccess()
      ? 'Changes need attention'
      : layoutPersistence.pending
        ? 'Saving layout'
        : recordStatus === 'valid'
          ? committedLabel
          : 'No saved draft';
  const toolbarHidden = previewing || instrumentsObscured || !creationBarVisible;
  useLayoutEffect(() => {
    if (!overview?.saveBeforeRoute) return;
    const ref = overview.saveBeforeRoute;
    ref.current = () => {
      try {
        saveBeforeDeparture(true);
        return true;
      } catch (failure) {
        setNotice(failure.message);
        return false;
      }
    };
    return () => {
      ref.current = null;
    };
  });
  return (
    <>
      <ContextToolbarProvider target={activeModuleId}>
        <SharedDisplayToolsProvider
          metadataDock={toolDocks}
          value={sharedTools}
          onChange={setSharedTools}
          targetId={activeModuleId}
          onTargetChange={selectionState.selectArtwork}
        >
          <SharedTextToolsProvider
            activeModuleId={activeModuleId}
            onActivate={selectionState.focusModule}
            open={textToolsOpen && inspectorVisible}
            onOpenChange={setTextToolsOpen}
          >
            <WorkbenchViewProvider
              navigatorPosition={navigatorPosition}
              sideDockPreferences={editorPreferences.section('sideDock')}
              key={profileAddress}
              store={workbenchController.store}
              profileAddress={profileAddress}
              presentation={workbench}
              content={workbenchController.draft}
              selectionState={selectionState}
            >
              <WorkbenchPlacement
                hostRef={workspaceRef}
                enabled={workbenchPreferences.edgeSnap && !previewing && !browsing}
                editable={!previewing && !browsing}
                gridEnabled={workbenchPreferences.shortcutSnap && !previewing && !browsing}
                gridSpacing={workbenchPreferences.gridSpacing}
                gap={workbenchPreferences.moduleGap}
              >
                <main
                  tabIndex={-1}
                  ref={workspaceRef}
                  aria-hidden={previewing || undefined}
                  className="system-workflow"
                  data-editor-menu
                  data-overview={browsing || undefined}
                  data-workspace-journey={journey?.direction}
                  data-gallery-entry={routeJourney?.direction === 'editor' || undefined}
                  data-creation-toolbar={!toolbarHidden || undefined}
                  data-canvas-context={composition ? 'composition' : 'canvas'}
                  data-composition-editor={composition ? true : undefined}
                  data-layout={layout.mode}
                  onContextMenu={event => {
                    if (!browsing && event.target === event.currentTarget) {
                      event.preventDefault();
                      setWorkspaceMenu({ x: event.clientX, y: event.clientY });
                    }
                  }}
                  style={{ '--workflow-dock-height': '0px' }}
                  onKeyDown={event => {
                    if (
                      !browsing &&
                      event.target === event.currentTarget &&
                      (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
                    ) {
                      event.preventDefault();
                      setWorkspaceMenu({ x: 16, y: 16 });
                    }
                  }}
                  data-chrome-noise={workbenchPreferences.chromeNoise ? 'on' : 'off'}
                  data-lattice-menu-surface

                  data-reduced-motion={layout.reducedMotion || undefined}

                  data-previewing={previewing || undefined}
                  inert={previewing ? '' : undefined}
                >
                  <WorkbenchViewControls
                    bentoLibrary={library}
                    canvasColor={browsing || previewing ? null : workbenchPreferences.canvasColor}
                    gridSnap={workbenchPreferences.shortcutSnap}
                    gridSpacing={workbenchPreferences.gridSpacing}
                    bentoLibraryPreferences={editorPreferences.section('library')}
                    flushBentoLayout={layoutPersistence.flush}
                    renderMenuBar={navigation => (
                      <OwnerEditorMenuBar
                        hostRef={workspaceRef}
                        navigation={navigation}
                        editorPreferences={editorPreferences}
                        artworkLayersOpen={artworkLayersOpen}
                        onToggleLayers={toggleArtworkLayers}
                        creationBarVisible={creationBarVisible}
                        onCreationBarChange={creationBarPreference.update}
                        onSearchCommands={
                          !previewing && !browsing && !instrumentsObscured ? requestCommandSearch : undefined
                        }
                        preferences={workbenchPreferences}
                        onPreferencesChange={setWorkbenchPreferences}
                        history={workbenchController.store.getHistory()}
                        onHistory={performHistory}
                        historyBlocked={pendingText.length ? TEXT_RECOVERY_MESSAGE : null}
                        navigationRef={workbenchNavigationRef}
                        focusOnMount={focusWorkbench}
                        hidden={previewing || browsing}
                        preserveHeaderSpace={leavingEditor}
                        documentNavigation={
                          documentNavigation && { ...documentNavigation, select: selectDocument }
                        }
                        onReturnToWorks={
                          returnLabel === 'Profile' && workspaceDestinations.Profile
                            ? workspaceDestinations.Profile
                            : onReturnToWorks
                              ? () => leaveForDestination(onReturnToWorks, true)
                              : showWorkbenchOverview
                        }
                        onManageCompositions={showWorkbenchOverview}
                        initialNew={initialNew}
                        onNewOpened={onNewOpened}
                        returnLabel={returnLabel}
                        workspaceDestinations={workspaceDestinations}
                        onPublish={togglePublication}
                        publicationOpen={publicationOpen}
                        saveState={saveState}
                        publicationState={publicationState}
                        onPreview={openPreview}
                        onLibrary={openLibrary}
                        onOpenPanel={openDockPanel}
                        openPanels={libraryOpen ? [...panels.openPanels, 'library'] : panels.openPanels}
                        busy={publicationPresence.present || previewSession.preparing}
                      />
                    )}
                    hostRef={workspaceRef}
                    frameCanvas
                    showHandTool={false}
                    disabled={previewing || browsing}
                    exiting={leavingEditor}
                    creationToolbarVisible={!toolbarHidden}
                    historyBlocked={pendingText.length ? TEXT_RECOVERY_MESSAGE : null}
                  />
                  <OwnerWorkbenchToolbar
                    beginFirstCell={documentNavigation?.beginFirstCell}
                    shapePreference={editorPreferences.section('lastShape')}
                    searchRequest={commandSearchRequest}
                    searchEnabled={!previewing && !browsing && !instrumentsObscured}
                    onRevealCreationTools={() => {
                      if (!creationBarVisible) creationBarPreference.update(true);
                    }}
                    showIdentity={!composition}
                    onOpenSharedTool={section => changeTool({ type: 'open', tab: 'Inspector', section })}
                    hostRef={workspaceRef}
                    artworkLayersOpen={artworkLayersOpen}
                    onToggleArtworkLayers={toggleArtworkLayers}
                    commands={addCommands}
                    onCommand={runCommand}
                    onOpenLibrary={openLibrary}
                    libraryOpen={libraryOpen}
                    preferences={workbenchPreferences}
                    onPreferencesChange={change =>
                      setWorkbenchPreferences(current => ({ ...current, ...change }))
                    }
                    hidden={toolbarHidden || browsing}
                    exiting={leavingEditor && !toolbarHidden}
                    onHistory={performHistory}
                    history={workbenchController.store.getHistory()}
                    historyBlocked={pendingText.length ? TEXT_RECOVERY_MESSAGE : null}
                    onNotice={setNotice}
                  />
                  <WorkbenchImageDropTarget
                    targetRef={workbenchImageTargetRef}
                    hostRef={workspaceRef}
                    suspended={canvasSuspended}
                    onCreated={activateArtwork}
                    onError={setNotice}
                  />
                  <SharedDisplayToolWindows
                    fallbackFocus={workspaceRef}

                    hidden={Boolean(preview) || instrumentsObscured}
                  />
                  <ContextToolbar hidden={Boolean(preview) || instrumentsObscured} />
                  <WorkbenchToolDocks
                    controller={toolDocks}
                    libraryOnly={browsing && !leavingEditor}
                    returnFocusRefs={{ Library: libraryTrigger }}
                    libraryProps={{
                      preferenceStore: editorPreferences.section('library'),
                      workbenchImageTargetRef,
                      moduleAssetTargetRef: moduleTargetsRef,
                      workspaceRef,
                      placementScope: profileAddress,
                      authoringLocked: browsing,
                      categoryCommands: library.categoryCommands,
                      data: { ...libraryData, onOpenCuration: workspaceDestinations.Curation },
                      resolveAssetDimensions,
                    }}
                    colourPreference={editorPreferences.section('colourPickers')}
                    hidden={Boolean(preview) || panelOccupied}

                    navigationRef={workbenchNavigationRef}
                    hostRef={workspaceRef}
                    historyBlocked={pendingText.length ? TEXT_RECOVERY_MESSAGE : null}
                  />
                  <WorkbenchAlignmentGrid
                    spacing={workbenchPreferences.gridSpacing}
                    color={workbenchPreferences.gridColor}
                    mode={workbenchPreferences.gridMode}
                  />
                  <OwnerWorkbenchModules
                    reducedMotion={layout.reducedMotion}
                    workbenchController={workbenchController}
                    profileAddress={profileAddress}
                    modules={modules}
                    initialWorkbench={initialWorkbench}
                    restoredWorkspace={restoredWorkspace}
                    preferences={workbenchPreferences}
                    selectionState={selectionState}
                    library={library}
                    workspaceRef={workspaceRef}
                    workbenchNavigationRef={workbenchNavigationRef}
                    keeperDockPositions={keeperDockPositions}
                    suspended={canvasSuspended}
                    exiting={leavingEditor}
                  />
                  <OwnerSystemWorkflowPanelLayer
                    activity={activity}
                    onDisconnect={onDisconnect}
                    profileAddress={profileAddress}

                    backupControls={
                      composition ? (
                        compositionBackup
                      ) : (
                        <WorkbenchBackupControls
                          store={workbenchController.store}
                          storage={workbenchController.storage}
                          recoveryPending={pendingText.length > 0}
                          getDraft={() => {
                            if (!workbench)
                              throw Error(
                                workbenchProjection.error || 'The current layout is not ready. Try again.'
                              );
                            return { ...workbenchController.store.getDraft(), workbench };
                          }}
                          onRestored={warning => {
                            layoutPersistence.discard();
                            onDraftRestored(warning);
                          }}
                        />
                      )
                    }
                    workbenchPreferences={workbenchPreferences}
                    canvasGuides={!composition}
                    onWorkbenchPreferencesChange={change =>
                      setWorkbenchPreferences(current => ({ ...current, ...change }))
                    }
                    onClose={() => panels.closePanel()}
                    onOpenProfile={onOpenProfile && (() => leaveForDestination(onOpenProfile))}
                    onOpenIdentity={event => {
                      openIdentity(
                        event.currentTarget
                          .closest('.system-workflow')
                          ?.querySelector('[data-system-workflow-panel-trigger][aria-label="Profile"]')
                      );
                    }}
                    panels={panels}
                    profileIdentity={profileIdentity}
                    profileModel={profileModel}
                  />
                  {!browsing && identityOpen && profileModel && (
                    <Suspense fallback={<p role="status">Opening Identity…</p>}>
                      <IdentityModule
                        key={profileAddress}
                        model={profileModel}

                        presentationRef={identityPresentationRef}
                        onDisconnect={onDisconnect}
                        initialWindow={workbenchLayout.identity.window}
                        onWindowChange={changeIdentityWindow}
                        assetTargetRef={identityTargetRef}
                        avatar={workbenchController.draft.identityPresentation.avatar}
                        onSave={workbenchController.saveIdentity}
                        customAvatar={
                          workbenchController.draft.identityPresentation.avatar.mode === 'inscape'
                        }
                        portraitChoices={resolvedAssets.filter(
                          asset => asset.placeable !== false && (asset.originalImageUrl || asset.imageUrl)
                        )}
                        returnFocus={identityReturnFocus.current}
                        onClose={() => setIdentityOpen(false)}
                      />
                    </Suspense>
                  )}
                  {(browsing || overview?.journey?.direction === 'editor') && (
                    <Suspense
                      fallback={
                        <p className="owner-overview-loading" role="status">
                          Opening Gallery…
                        </p>
                      }
                    >
                      <OwnerWorkbenchOverview
                        store={overview.store}
                        preferences={workbenchPreferenceStore}
                        view={overview.view}
                        onViewChange={overview.onViewChange}
                        onEdit={(id, source) =>
                          overview.onEdit(
                            id,
                            (source &&
                              workspaceMotion.current?.captureActive(source.model, source.name, id)) ||
                              source
                          )
                        }
                        profileModel={profileModel}
                        account={connectedProfile}
                        ownerDestinations={ownerDestinations}
                        onConnect={onConnect}
                        onDisconnect={onDisconnect}
                        onOpenWriting={onOpenWriting}
                        onOpenGallery={onOpenGallery}
                        onOpenProfile={onOpenProfile && (() => onOpenProfile())}
                        workspace={{
                          memory: overview.memory,
                          exiting: !browsing,
                          entering: leavingEditor,
                          returning: overview.returning,
                          movingCanvasId: overview.journey?.source.id,
                        }}
                      />
                    </Suspense>
                  )}
                  <OwnerWorkspaceMotion
                    hostRef={workspaceRef}
                    motionRef={workspaceMotion}
                    journey={journey}
                    onComplete={overview?.onJourneyComplete}
                  />
                  {noticeMessage && (
                    <button
                      aria-label="Dismiss notification"
                      className="system-workflow__notice"
                      type="button"
                      onClick={dismissNotice}
                    >
                      {noticeMessage}
                    </button>
                  )}
                  {workspaceMenu &&
                    createPortal(
                      <WorkbenchCommandMenu
                        key={`${workspaceMenu.x}:${workspaceMenu.y}`}
                        anchor={workspaceMenu}
                        commands={[
                          { id: 'tools', label: 'TOOLS' },
                          { id: 'add', label: 'ADD' },
                          ...(workbenchController.draft.shapes?.length
                            ? [{ id: 'shapes', label: 'SHAPES' }]
                            : []),
                          ...(!composition ? [{ id: 'identity', label: 'IDENTITY' }] : []),
                          { id: 'library', label: 'LIBRARY' },
                          { id: 'preview', label: 'PREVIEW' },
                          { id: 'publish', label: 'PUBLISH' },
                        ]}
                        getSubmenuCommands={id =>
                          id === 'tools'
                            ? displayToolCommands()
                            : id === 'add'
                              ? addCommands
                              : id === 'shapes'
                                ? [...(workbenchController.draft.shapes || [])]
                                    .reverse()
                                    .map(shape => ({ id: shape.id, label: shape.name }))
                                : addCommands.find(command => command.id === id)?.children || []
                        }
                        label="Workbench commands"

                        returnFocus={workspaceRef.current}
                        onClose={() => setWorkspaceMenu(null)}
                        onCommand={runCommand}
                        systemWorkflowOverlay
                      />,
                      document.body
                    )}
                  {pendingText.length > 0 && (
                    <p className="system-workflow__recovery-notice" role="alert">
                      {TEXT_RECOVERY_MESSAGE}
                    </p>
                  )}
                  <WorkbenchRecoveryMessages>
                    {previewSession.preparing && (
                      <p className="system-workflow__layout-notice" role="status">
                        Preparing preview…{' '}
                        <button type="button" onClick={() => closePreview()}>
                          Cancel preview
                        </button>
                      </p>
                    )}
                    {(layoutPersistence.error || preferenceError || workbenchPreferenceError) && (
                      <div className="system-workflow__layout-notice" role="alert">
                        {[
                          [layoutPersistence.error, layoutPersistence.retry, 'Save current layout'],
                          [preferenceError, editorPreferences.retry, 'Save current editor preferences'],
                          [
                            workbenchPreferenceError,
                            workbenchPreferenceStore.retry,
                            'Save current Workbench preferences',
                          ],
                        ].map(
                          ([message, retry, label]) =>
                            message && (
                              <div key={label}>
                                {message}{' '}
                                <button type="button" onClick={retry}>
                                  {label}
                                </button>
                              </div>
                            )
                        )}
                      </div>
                    )}
                  </WorkbenchRecoveryMessages>
                  {publicationPresence.present && (
                    <Suspense fallback={null}>
                      <OwnerSystemWorkflowPublicationRack
                        store={sharedStore}
                        assetRecords={canonicalRecords}
                        getWalletPublicationContext={getWalletPublicationContext}

                        onClose={closePublication}
                        onMotionComplete={publicationPresence.completeTransition}
                        onPublished={(result, context) => {
                          closePublication();
                          onPublicationConfirmed?.(result, context);
                        }}
                        profile={publicationProfile}
                        profileAddress={profileAddress}
                        publishedResolution={publishedResolution}
                        phase={publicationPresence.phase}
                        systemWorkflowDraft={workbenchController.draft}
                        workbench={workbench}
                        onSaveWorkbench={() => workbenchController.saveWorkbench(workbench)}
                        preparationError={
                          pendingText.length ? TEXT_RECOVERY_MESSAGE : workbenchProjection.error
                        }
                      />
                    </Suspense>
                  )}
                </main>
              </WorkbenchPlacement>
            </WorkbenchViewProvider>
          </SharedTextToolsProvider>
        </SharedDisplayToolsProvider>
      </ContextToolbarProvider>
      {preview && (
        <Suspense fallback={<p role="status">Opening composition preview.</p>}>
          <CompositionPreview entry={preview.entry} snapshot={preview.snapshot} onClose={closePreview} />
        </Suspense>
      )}
    </>
  );
}
