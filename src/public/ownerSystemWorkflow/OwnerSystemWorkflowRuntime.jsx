import useWorkbenchPublicationPanel from './useWorkbenchPublicationPanel.js';
import useWorkbenchPresentation, { useWorkbenchLayoutSession } from './useWorkbenchPresentation.js';
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
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import OwnerWorkbenchSwitcher from './OwnerWorkbenchSwitcher.jsx';
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
import { SharedTextToolsProvider, SharedTextToolsWindow } from '../../text/SharedTextTools.jsx';
import WorkbenchAlignmentGrid from './WorkbenchAlignmentGrid.jsx';
import WorkbenchImageDropTarget from '../../imageModule/WorkbenchImageDropTarget.jsx';
import useDraftUndo from './useDraftUndo.js';
import { PRIMARY_DISPLAY_ID, displayModuleIds } from '../../systemWorkflow/domain/displayModules.js';
import OwnerSystemWorkflowSidebar from './OwnerSystemWorkflowSidebar.jsx';
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
const ProfileDocumentV9Preview = lazy(
  () => import('../../profileDocument/components/ProfileDocumentV9Preview.jsx')
);
const IdentityModule = lazy(() => import('../identity/IdentityModule.jsx'));

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

function WorkbenchSession({
  connectedProfile,
  getWalletPublicationContext,
  onConnect,
  onDisconnect,
  onEnterMyWorld,
  onOpenDiscover,
  onOpenReception,
  onEditReception,
  onOpenWorkbenchOverview,
  onPublicationConfirmed,
  profileAddress,
  publishedResolution,
  onVisitProfile,
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
  sidebarSession,
  editorPreferences,
  workbenchPreferenceStore,
}) {
  useStartupDestinationReady();
  const workbenchController = useWorkbenchController(profileAddress, { storage: reviewStorage, sharedStore });
  const layoutSession = useWorkbenchLayoutSession({
    profileAddress,
    draft: workbenchController.draft,
    storage: workbenchController.storage,
    workbenchId: sharedStore.getWorkbenchId(),
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
  const textPreference = editorPreferences.section('textOpen');
  const textToolsOpen =
    useSyncExternalStore(textPreference.subscribe, textPreference.getSnapshot) ?? initialTextTools.open;
  const setTextToolsOpen = textPreference.update;
  const preferenceError = useSyncExternalStore(editorPreferences.subscribe, editorPreferences.getError);
  const toolDocks = editorPreferences.tools;
  const artworkLayersOpen = useSyncExternalStore(toolDocks.subscribe, toolDocks.layersVisible);
  const changeTool = toolDocks.change;
  const selectionState = useWorkbenchSelection(workbenchController.draft, {
    initialTargetId: workbenchController.draft.texts?.some(text => text.id === sharedTools.targetId)
      ? sharedTools.targetId
      : (initialTextTools.targetId ??
        (sharedTools.targetId === undefined ? PRIMARY_DISPLAY_ID : sharedTools.targetId)),
    readContent: workbenchController.store.getSnapshot,
  });
  const activeModuleId = selectionState.targetId;
  const activateArtwork = selectionState.selectArtwork;
  const displayIds = displayModuleIds(workbenchController.draft);
  const selectedDisplayId = displayIds.includes(activeModuleId) ? activeModuleId : displayIds[0];
  const modules = useWorkbenchModuleRegistry({ displayIds, selectedDisplayId });
  const {
    records: instanceRecords,
    presentations: instancePresentations,
    selected: selectedInstance,
  } = modules.display;
  const {
    placement: allPlacementTargetsRef,
    shortcut: allShortcutTargetsRef,
    identity: identityTargetRef,
    module: moduleTargetsRef,
  } = modules.targets;
  const activeController = selectedInstance?.controller;
  const workbenchPreferences = useSyncExternalStore(
    workbenchPreferenceStore.subscribe,
    workbenchPreferenceStore.getSnapshot
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
  const { preview, close: closePreview, returnFocus: previewReturnFocus } = previewSession;
  const performHistory = useDraftUndo(
    workbenchController.store,
    Boolean(preview),
    setNotice,
    pendingText.length ? TEXT_RECOVERY_MESSAGE : null
  );
  const [identityOpen, setIdentityOpen] = useState(() => {
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
  const [libraryNavigationHost, setLibraryNavigationHost] = useState(null);
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
  });
  const panel = panels.activePanel;
  const libraryOpen = panels.isPanelOpen('library');
  const library = useOwnerWorkbenchLibrary({
    profileAddress,
    draft: workbenchController.draft,
    workbenchLayout,
    libraryOpen,
    selectedGrid: activeController?.selectedGrid,
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
  const leaveForDestination = open => {
    try {
      createNamedWorkbenchActions({
        store: sharedStore,
        projection: workbenchProjection,
        flushLayout: layoutPersistence.flush,
        busy: publicationPresence.present || previewSession.preparing || Boolean(preview),
      }).leave();
      open();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const openWorkbenchOverview = () => leaveForDestination(onOpenWorkbenchOverview);
  const activity = useOwnerSystemWorkflowActivity({
    active: panel === 'activity',
    fixture: reviewActivity,
    profileAddress,
  });
  // Grids acts as a destination picker alongside Library, so it must not
  // disable the Display's existing drop targets or authoring interactions.
  const panelBlocksAuthoring = id => id !== 'library' && !(id === 'grids' && libraryOpen);
  const panelOccupied = Boolean(
    publicationPresence.present ||
    (panel && panelBlocksAuthoring(panel)) ||
    Object.entries(panels.presence).some(([id, { present }]) => panelBlocksAuthoring(id) && present)
  );
  const noticeMessage = activeController?.error || workbenchController.error || notice?.message;
  const dismissNotice = activeController?.error
    ? activeController.clearError
    : workbenchController.error
      ? workbenchController.clearError
      : dismissHostNotice;
  useEffect(() => {
    if (!noticeMessage || noticeMessage === restoreWarning) return undefined;
    const timeout = globalThis.setTimeout(dismissNotice, 4_500);
    return () => globalThis.clearTimeout(timeout);
  }, [noticeMessage, dismissNotice, restoreWarning]);
  const changeGrid = (...args) => selectedInstance?.displayRef.current?.changeGrid(...args) ?? false;
  const profileModel = useMemo(
    () =>
      createProductionIdentityDossierViewModel({
        assetRecords: assetsById,
        contractFacts,
        identity: profileIdentity,
        identityPresentation: workbenchController.draft?.identityPresentation,
      }),
    [assetsById, contractFacts, workbenchController.draft?.identityPresentation, profileIdentity]
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
  const startPreview = trigger => {
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
          reviewAssets,
        }),
      () => livePreviewPresentation.current === previewPresentation,
      trigger
    );
  };
  const openDockPanel = (name, trigger) => {
    if (publicationOpen) closePublication({ returnFocus: false });
    if (name === 'discover' && onOpenDiscover) {
      panels.closePanel({ returnFocus: false });
      onOpenDiscover(trigger);
      return;
    }
    panels.togglePanel(name, trigger);
  };
  const toggleLibrary = trigger => {
    if (publicationOpen) closePublication({ returnFocus: false });
    panels.togglePanel('library', trigger?.isConnected ? trigger : workspaceRef.current);
  };
  const openPreview = trigger => {
    if (publicationOpen) closePublication({ returnFocus: false });
    startPreview(trigger);
  };
  const menuSurface = workbenchController.draft?.appearance.menuSurfaceId;
  const authoringLocked = selectedInstance?.locked || false;
  const instrumentsObscured = panelOccupied;
  const revealInstruments = () => {
    if (publicationOpen) closePublication({ returnFocus: false });
    if (instrumentsObscured) panels.closePanel({ returnFocus: false });
  };
  const { addCommands, runCommand, deleteDisplay } = workbenchCommands({
    store: workbenchController.store,
    draft: workbenchController.draft,
    profileAddress,
    workspaceRef,
    setNotice,
    activateArtwork,
    setTextToolsOpen,
    revealInstruments,
    changeTool,
    toggleLibrary,
    openIdentity,
    openDockPanel,
    openPreview,
    togglePublication,
    setWorkbenchPreferences,
    setWorkspaceMenu,
  });
  const toolbarHidden = Boolean(preview) || instrumentsObscured;
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
            editorPreferences={editorPreferences}
            menuSurface={menuSurface}
            activeModuleId={activeModuleId}
            onActivate={selectionState.focusModule}
            open={textToolsOpen}
            onOpenChange={setTextToolsOpen}
          >
            <WorkbenchViewProvider
              navigatorPosition={navigatorPosition}
              key={profileAddress}
              store={workbenchController.store}
              profileAddress={profileAddress}
              presentation={workbench}
              content={workbenchController.draft}
              selectionState={selectionState}
            >
              <WorkbenchPlacement
                hostRef={workspaceRef}
                enabled={workbenchPreferences.edgeSnap && !preview}
                gridEnabled={workbenchPreferences.shortcutSnap && !preview}
                gridSpacing={workbenchPreferences.gridSpacing}
                gap={workbenchPreferences.moduleGap}
              >
                <main
                  tabIndex={-1}
                  ref={workspaceRef}
                  aria-hidden={preview || undefined}
                  className="system-workflow"
                  data-creation-toolbar={!toolbarHidden || undefined}
                  data-canvas-context="canvas"
                  data-layout={layout.mode}
                  onPointerDownCapture={event => {
                    if (event.target === event.currentTarget && event.button === 0) {
                      for (const display of displayIds
                        .map(id => instanceRecords[id]?.controller)
                        .filter(Boolean)) {
                        if (display.selectedPlacementIds.length) display.replaceSelection([]);
                      }
                    }
                  }}
                  onContextMenu={event => {
                    if (event.target === event.currentTarget) {
                      event.preventDefault();
                      setWorkspaceMenu({ x: event.clientX, y: event.clientY });
                    }
                  }}
                  data-workspace-sidebar={workbenchPreferences.dockVisible || undefined}
                  style={{ '--workflow-dock-height': '0px' }}
                  onKeyDown={event => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
                    ) {
                      event.preventDefault();
                      setWorkspaceMenu({ x: 16, y: 16 });
                    }
                  }}
                  data-authoring-locked={authoringLocked || undefined}
                  data-board-instance-state={
                    instancePresentations[PRIMARY_DISPLAY_ID]?.open === false ? 'minimized' : 'window'
                  }
                  data-chrome-noise={workbenchPreferences.chromeNoise ? 'on' : 'off'}
                  data-lattice-menu-surface
                  data-menu-surface={menuSurface}
                  data-reduced-motion={layout.reducedMotion || undefined}
                  data-surface={workbenchPreferences.surfaceId}
                  data-previewing={preview ? true : undefined}
                  inert={preview ? '' : undefined}
                >
                  <OwnerWorkbenchSwitcher
                    onOverview={openWorkbenchOverview}
                    store={sharedStore}
                    navigationRef={workbenchNavigationRef}
                    focusOnMount={focusWorkbench}
                    hidden={Boolean(preview) || panelOccupied}
                    projection={workbenchProjection}
                    flushLayout={layoutPersistence.flush}
                    busy={publicationPresence.present || previewSession.preparing}
                  />
                  <WorkbenchViewControls
                    hostRef={workspaceRef}
                    showHandTool={false}
                    disabled={Boolean(preview)}
                    dockVisible={workbenchPreferences.dockVisible}
                    creationToolbarVisible={!toolbarHidden}
                    historyBlocked={pendingText.length ? TEXT_RECOVERY_MESSAGE : null}
                  />
                  <OwnerWorkbenchToolbar
                    onOpenSharedTool={tab => changeTool({ type: 'open', tab })}
                    hostRef={workspaceRef}
                    placementTargets={allPlacementTargetsRef}
                    artworkLayersOpen={artworkLayersOpen}
                    onToggleArtworkLayers={() =>
                      changeTool({ type: artworkLayersOpen ? 'close' : 'open', tab: 'Layers' })
                    }
                    commands={addCommands}
                    onCommand={runCommand}
                    onOpenLibrary={toggleLibrary}
                    libraryOpen={libraryOpen}
                    preferences={workbenchPreferences}
                    onPreferencesChange={change =>
                      setWorkbenchPreferences(current => ({ ...current, ...change }))
                    }
                    hidden={toolbarHidden}
                    onHistory={performHistory}
                    history={workbenchController.store.getHistory()}
                    historyBlocked={pendingText.length ? TEXT_RECOVERY_MESSAGE : null}
                    onNotice={setNotice}
                  />
                  <WorkbenchImageDropTarget
                    targetRef={workbenchImageTargetRef}
                    hostRef={workspaceRef}
                    suspended={Boolean(preview)}
                    onCreated={activateArtwork}
                    onError={setNotice}
                  />
                  <SharedDisplayToolWindows
                    fallbackFocus={workspaceRef}
                    menuSurface={menuSurface}
                    hidden={Boolean(preview) || instrumentsObscured}
                  />
                  <ContextToolbar
                    menuSurface={menuSurface}
                    hidden={Boolean(preview) || instrumentsObscured}
                  />
                  <SharedTextToolsWindow
                    hidden={Boolean(preview) || instrumentsObscured}
                    navigationRef={workbenchNavigationRef}
                  />
                  <WorkbenchToolDocks
                    controller={toolDocks}
                    hidden={Boolean(preview) || instrumentsObscured}
                    menuSurface={menuSurface}
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
                    workbenchController={workbenchController}
                    profileAddress={profileAddress}
                    modules={modules}
                    initialWorkbench={initialWorkbench}
                    restoredWorkspace={restoredWorkspace}
                    preferences={workbenchPreferences}
                    onPreferencesChange={setWorkbenchPreferences}
                    selectionState={selectionState}
                    library={library}
                    layout={layout}
                    workspaceRef={workspaceRef}
                    workbenchNavigationRef={workbenchNavigationRef}
                    keeperDockPositions={keeperDockPositions}
                    preview={preview}
                    panelOccupied={panelOccupied}
                    instrumentsObscured={instrumentsObscured}
                    revealInstruments={revealInstruments}
                    toggleLibrary={toggleLibrary}
                    panels={panels}
                    deleteDisplay={deleteDisplay}
                    onConnect={onConnect}
                  />
                  <OwnerSystemWorkflowPanelLayer
                    libraryPreferences={editorPreferences.section('library')}
                    navigationHost={libraryNavigationHost}
                    workbenchImageTargetRef={workbenchImageTargetRef}
                    moduleAssetTargetRef={moduleTargetsRef}
                    placementTargetRef={allPlacementTargetsRef}
                    shortcutTargetRef={allShortcutTargetsRef}
                    workspaceRef={workspaceRef}
                    activity={activity}
                    authoringLocked={false}
                    connectedProfile={connectedProfile}
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                    onEnterMyWorld={onEnterMyWorld}
                    controller={activeController}
                    profileAddress={profileAddress}
                    onMenuSurfaceChange={workbenchController.setMenuSurface}
                    libraryData={libraryData}
                    menuSurface={menuSurface}
                    onChangeGrid={changeGrid}
                    backupControls={
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
                    }
                    workbenchPreferences={workbenchPreferences}
                    onWorkbenchPreferencesChange={change =>
                      setWorkbenchPreferences(current => ({ ...current, ...change }))
                    }
                    onClose={() => panels.closePanel()}
                    onVisitProfile={onVisitProfile}
                    onOpenReception={onOpenReception}
                    onEditReception={() => leaveForDestination(onEditReception)}
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
                    resolveAssetDimensions={resolveAssetDimensions}
                    categoryCommands={library.categoryCommands}
                  />
                  {identityOpen && profileModel && (
                    <Suspense fallback={<p role="status">Opening Identity…</p>}>
                      <IdentityModule
                        key={profileAddress}
                        model={profileModel}
                        menuSurface={menuSurface}
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
                  {workbenchPreferences.dockVisible && (
                    <OwnerSystemWorkflowSidebar
                      onOverview={openWorkbenchOverview}
                      session={sidebarSession}
                      hostRef={workspaceRef}
                      hidden={Boolean(preview)}
                      onNavigationHost={setLibraryNavigationHost}
                      onWorkbench={() => {
                        closePublication({ returnFocus: false });
                        panels.closePanel({ returnFocus: false });
                        workspaceRef.current?.focus({ preventScroll: true });
                      }}
                      onLibrary={event => toggleLibrary(event.currentTarget)}
                      openPanels={panels.openPanels}
                      onOpen={openDockPanel}
                      onPreview={event => openPreview(event.currentTarget)}
                      onPublish={event => togglePublication(event.currentTarget)}
                      publicationOpen={publicationOpen}
                      unreadCount={activity.unreadCount}
                    />
                  )}
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
                          { id: 'identity', label: 'IDENTITY' },
                          { id: 'library', label: 'LIBRARY' },
                          { id: 'discover', label: 'DISCOVER' },
                          { id: 'preview', label: 'PREVIEW' },
                          { id: 'publish', label: 'PUBLISH' },
                          {
                            id: 'toggle-dock',
                            label: workbenchPreferences.dockVisible ? 'HIDE SIDEBAR' : 'SHOW SIDEBAR',
                          },
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
                        menuSurfaceId={menuSurface}
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
                        menuSurface={menuSurface}
                        onClose={closePublication}
                        onMotionComplete={publicationPresence.completeTransition}
                        onPublished={result => {
                          closePublication();
                          import('../../profileDocument/storage/ownerDraftReconciliation.js')
                            .then(({ recordOwnerPublicationBaseline }) => {
                              recordOwnerPublicationBaseline({
                                document: result?.document,
                                draft: workbenchController.draft,
                                profileAddress,
                                storage: reviewStorage ?? globalThis.localStorage,
                              });
                            })
                            .catch(() => {});
                          onPublicationConfirmed?.({ ...result, menuSurface });
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
        <Suspense fallback={null}>
          <ProfileDocumentV9Preview
            document={preview}
            onExit={closePreview}
            onReturn={closePreview}
            onConnect={onConnect}
            onOpenDirectory={() => {
              const trigger = previewReturnFocus.current;
              closePreview({ restoreFocus: false });
              requestAnimationFrame(() =>
                onOpenDiscover ? onOpenDiscover(trigger) : panels.openPanel('discover', trigger)
              );
            }}
          />
        </Suspense>
      )}
    </>
  );
}
