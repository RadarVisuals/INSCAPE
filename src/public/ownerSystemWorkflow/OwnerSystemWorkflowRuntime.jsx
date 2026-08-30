import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import { createProductionIdentityDossierViewModel } from '../identity/productionIdentityDossierViewModel.js';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import OwnerSystemWorkflowCanvas from './OwnerSystemWorkflowCanvas.jsx';
import OwnerSystemWorkflowFocusViewer from './OwnerSystemWorkflowFocusViewer.jsx';
import OwnerSystemWorkflowGlobalBar from './OwnerSystemWorkflowGlobalBar.jsx';
import OwnerSystemWorkflowMetadataModule, { OwnerSystemWorkflowMetadataContent } from './OwnerSystemWorkflowMetadataModule.jsx';
import OwnerSystemWorkflowPanelLayer from './OwnerSystemWorkflowPanelLayer.jsx';
import PresentationBoard from './PresentationBoard.jsx';
import useOwnerSystemWorkflowActivity from './useOwnerSystemWorkflowActivity.js';
import useOwnerSystemWorkflowController from './useOwnerSystemWorkflowController.js';
import useOwnerSystemWorkflowCrop from './useOwnerSystemWorkflowCrop.js';
import useOwnerSystemWorkflowFocusViewer from './useOwnerSystemWorkflowFocusViewer.js';
import useOwnerSystemWorkflowLayout from './useOwnerSystemWorkflowLayout.js';
import useOwnerSystemWorkflowPanels, { useOwnerSystemWorkflowPanelPresence } from './useOwnerSystemWorkflowPanels.js';
import useOwnerSystemWorkflowDevelopmentAuthorities from './useOwnerSystemWorkflowDevelopmentAuthorities.js';
import { createOwnerSystemWorkflowMetadataViewModel } from './ownerSystemWorkflowMetadataViewModel.js';
import {
  OWNER_METADATA_EVENT,
  OWNER_METADATA_MODE,
  PRESENTATION_BOARD_INSTANCE_EVENT,
  ownerMetadataModeView,
  ownerWorkbenchModuleAvailability,
  presentationBoardInstanceStateFromShortcut,
  transitionOwnerMetadataMode,
  transitionPresentationBoardInstance,
} from './ownerSystemWorkflowModuleState.js';
import { loadPresentationBoardShortcut } from './presentationBoardShortcutStorage.js';
import RackMenu from '../menus/RackMenu.jsx';
import {
  decodeOwnerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from './ownerSystemWorkflowAssetDimensions.js';

const OwnerSystemWorkflowPublicationRack = lazy(() => import('./OwnerSystemWorkflowPublicationRack.jsx'));
const ProfileDocumentV9Preview = lazy(() => import('../../profileDocument/components/ProfileDocumentV9Preview.jsx'));

function assetMap(assets, records) {
  const map = new Map();
  for (const asset of [...assets, ...records]) {
    const id = asset?.stableAssetId || asset?.id;
    if (id) map.set(id, { ...(map.get(id) || {}), ...asset });
  }
  return map;
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
    profileImageCandidates: fixture.avatarUrl ? [{ kind: 'URL', url: fixture.avatarUrl, width: 96, source: 'DEVELOPMENT_FIXTURE' }] : [],
    backgroundImageCandidates: [],
    isUniversalProfile: true,
    metadataIntegrity: 'UNVERIFIED',
    status: 'RESOLVED',
    source: 'DEVELOPMENT_FIXTURE',
  };
}

const LAYERS_OPEN_KEY = 'inscape:system-workflow:layers-open';
const initialLayersOpen = () => {
  try { return globalThis.sessionStorage?.getItem(LAYERS_OPEN_KEY) !== 'false'; }
  catch { return true; }
};

export default function OwnerSystemWorkflowRuntime({ connectedProfile, getWalletPublicationContext, onConnect, onDisconnect, onEnterMyWorld, onPreviewDocumentChange,
  onPublicationConfirmed, profileAddress, publishedResolution, onVisitProfile, reviewStorage, reviewAssets,
  reviewCategories, reviewActivity, reviewDiscovery, reviewProfile }) {
  const controller = useOwnerSystemWorkflowController(profileAddress, { storage: reviewStorage });
  const [preview, setPreview] = useState(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(initialLayersOpen);
  const [layersExplicitlyOpened, setLayersExplicitlyOpened] = useState(false);
  const [decodedDimensions, setDecodedDimensions] = useState(() => new Map());
  const [metadataMode, transitionMetadata] = useReducer(transitionOwnerMetadataMode, OWNER_METADATA_MODE.DOCKED_CLOSED);
  const [workspaceMenu, setWorkspaceMenu] = useState(null);
  const [boardInstanceState, transitionBoardInstance] = useReducer(transitionPresentationBoardInstance, profileAddress,
    (address) => presentationBoardInstanceStateFromShortcut(loadPresentationBoardShortcut(address)));
  const previewReturnFocus = useRef(null);
  const publicationReturnFocus = useRef(null);
  const metadataTransitionRef = useRef(null);
  useEffect(() => () => {
    const transition = metadataTransitionRef.current;
    metadataTransitionRef.current = null;
    transition?.animation?.cancel?.();
  }, []);
  const layout = useOwnerSystemWorkflowLayout();
  const liveIdentity = useProfileIdentity(profileAddress, { sourceMode: reviewProfile ? 'FIXTURE' : 'LIVE' });
  const contractFacts = useProfileContractFacts(profileAddress, { enabled: !reviewProfile });
  const profileIdentity = reviewIdentity(profileAddress, reviewProfile) || liveIdentity;
  const browserEnabled = !reviewAssets;
  const reviewAuthorities = useOwnerSystemWorkflowDevelopmentAuthorities({ categories: reviewCategories, discovery: reviewDiscovery, enabled: Boolean(reviewAssets) });
  const panels = useOwnerSystemWorkflowPanels({ blocked: Boolean(preview || dossierOpen) });
  const publicationPresence = useOwnerSystemWorkflowPanelPresence(publicationOpen);
  const panel = panels.activePanel;
  const referencedAssetIds = useMemo(() => controller.draft.grids
    .flatMap((grid) => grid.placements.map(({ stableAssetId }) => stableAssetId)), [controller.draft.grids]);
  const browser = useOwnerLatticeBrowser(profileAddress, panel === 'library' && browserEnabled, referencedAssetIds);
  const assets = reviewAssets || browser.data.assets;
  const records = reviewAssets || browser.records;
  const refineAsset = useCallback((asset) => ownerSystemWorkflowDecodedAsset(
    asset, decodedDimensions.get(asset?.stableAssetId || asset?.id),
  ), [decodedDimensions]);
  const resolvedAssets = useMemo(() => assets.map(refineAsset), [assets, refineAsset]);
  const canonicalRecords = useMemo(() => records.map(refineAsset), [records, refineAsset]);
  const assetsById = useMemo(() => assetMap(resolvedAssets, canonicalRecords), [canonicalRecords, resolvedAssets]);
  const registerAssetDimensions = useCallback((asset, dimensions) => {
    const id = asset?.stableAssetId || asset?.id;
    const canonicalSources = new Set([asset?.src, asset?.originalImageUrl, asset?.imageUrl].filter(Boolean));
    if (dimensions?.source && !canonicalSources.has(dimensions.source)) return dimensions;
    const refined = ownerSystemWorkflowDecodedAsset(asset, dimensions);
    if (!id || refined === asset) return null;
    const decoded = Object.freeze({
      source: refined.decodedImageSource,
      width: refined.decodedImageWidth,
      height: refined.decodedImageHeight,
    });
    setDecodedDimensions((current) => {
      const previous = current.get(id);
      if (previous?.source === decoded.source && previous.width === decoded.width && previous.height === decoded.height) return current;
      const next = new Map(current); next.set(id, decoded); return next;
    });
    return decoded;
  }, []);
  const resolveAssetDimensions = useCallback(async (asset) => {
    const decoded = await decodeOwnerSystemWorkflowAssetDimensions(asset);
    return decoded ? registerAssetDimensions(asset, decoded) || decoded : null;
  }, [registerAssetDimensions]);
  const crop = useOwnerSystemWorkflowCrop({ assetsById, controller });
  const viewer = useOwnerSystemWorkflowFocusViewer({ assetsById, controller,
    onOpen: () => panels.closePanel({ returnFocus: false }), resolveAssetDimensions });
  const activity = useOwnerSystemWorkflowActivity({ active: panel === 'activity', fixture: reviewActivity, profileAddress });
  const panelOccupied = Boolean(publicationPresence.present || panel
    || Object.values(panels.presence).some(({ present }) => present));
  const metadataPlacement = controller.selectedPlacements.length === 1 ? controller.selectedPlacements[0] : null;
  const metadataEntry = useMemo(() => metadataPlacement
    ? createOwnerSystemWorkflowMetadataViewModel(metadataPlacement, assetsById.get(metadataPlacement.stableAssetId))
    : null, [assetsById, metadataPlacement]);
  const dismissNotice = useCallback(() => {
    controller.clearError();
    setNotice(null);
  }, [controller.clearError]);
  useEffect(() => {
    if (!controller.error && !notice) return undefined;
    const timeout = globalThis.setTimeout(dismissNotice, 4_500);
    return () => globalThis.clearTimeout(timeout);
  }, [controller.error, dismissNotice, notice]);
  useEffect(() => {
    try { globalThis.sessionStorage?.setItem(LAYERS_OPEN_KEY, String(layersOpen)); }
    catch { /* Session preference is optional. */ }
  }, [layersOpen]);
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
    if (options.animate === false || layout.reducedMotion || typeof transitionDocument?.startViewTransition !== 'function') {
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
  const libraryData = useMemo(() => reviewAssets ? {
    assets: resolvedAssets,
    categories: reviewAuthorities.categories || [],
    categoryOrganization: reviewAuthorities.categoryOrganization,
    favorites: [],
    ownerContext: profileAddress,
    readOnly: true,
    rejectedAssetCount: 0,
    status: 'ready',
    usedAssetIds: controller.selectedGrid?.placements.map(({ stableAssetId }) => stableAssetId) || [],
  } : { ...browser.data, assets: resolvedAssets }, [browser.data, controller.selectedGrid, profileAddress, resolvedAssets,
    reviewAssets, reviewAuthorities.categories, reviewAuthorities.categoryOrganization]);
  const profileModel = useMemo(() => createProductionIdentityDossierViewModel({
    assetRecords: assetsById,
    contractFacts,
    identity: profileIdentity,
    identityPresentation: controller.draft?.identityPresentation,
  }), [assetsById, contractFacts, controller.draft?.identityPresentation, profileIdentity]);
  const publicationProfile = useMemo(() => ({
    name: profileIdentity?.status === 'RESOLVED' ? profileIdentity.name : null,
    avatarUrl: profileIdentity?.status === 'RESOLVED' ? profileIdentity.avatarUrl : null,
  }), [profileIdentity]);
  const closePreview = () => {
    setPreview(null);
    const node = previewReturnFocus.current;
    previewReturnFocus.current = null;
    requestAnimationFrame(() => node?.isConnected && node.focus({ preventScroll: true }));
  };
  const startPreview = async (trigger) => {
    previewReturnFocus.current = trigger;
    panels.closePanel({ returnFocus: false });
    try {
      const { buildOwnerSystemWorkflowPreviewDocument, preloadOwnerSystemWorkflowPreviewEntryMedia } =
        await import('../ownerSystemWorkflowPreviewDocument.js');
      const referencedIds = new Set(controller.draft.grids.flatMap((grid) => grid.placements.map(({ stableAssetId }) => stableAssetId)));
      const decodedEntries = await Promise.all([...referencedIds].map(async (id) => {
        const asset = assetsById.get(id);
        return [id, asset ? await resolveAssetDimensions(asset) : null];
      }));
      const previewDimensions = new Map(decodedEntries.filter(([, dimensions]) => dimensions));
      const previewRecords = records.map((asset) => ownerSystemWorkflowDecodedAsset(
        asset, previewDimensions.get(asset?.id) || decodedDimensions.get(asset?.id),
      ));
      const document = buildOwnerSystemWorkflowPreviewDocument({ assetRecords: previewRecords, profile: publicationProfile,
        profileAddress, systemWorkflowDraft: controller.draft });
      await preloadOwnerSystemWorkflowPreviewEntryMedia(document, reviewAssets ? { timeoutMs: 500 } : undefined);
      setPreview(document);
    } catch (error) {
      previewReturnFocus.current = null;
      setNotice(error?.message || 'Preview unavailable');
    }
  };
  const closePublication = useCallback(({ returnFocus = true } = {}) => {
    setPublicationOpen(false);
    if (!returnFocus) publicationReturnFocus.current = null;
  }, []);
  useEffect(() => {
    if (publicationPresence.present) return;
    const node = publicationReturnFocus.current;
    publicationReturnFocus.current = null;
    if (node?.isConnected) requestAnimationFrame(() => node.isConnected && node.focus({ preventScroll: true }));
  }, [publicationPresence.present]);
  const togglePublication = (trigger) => {
    if (publicationOpen) {
      closePublication();
      return;
    }
    publicationReturnFocus.current = trigger;
    panels.closePanel({ returnFocus: false });
    setPublicationOpen(true);
  };
  useEffect(() => {
    if (!publicationOpen) return undefined;
    const dismissFromCanvas = (event) => {
      if (!event.target?.closest?.('[data-system-workflow-artboard]')) return;
      closePublication({ returnFocus: false });
    };
    globalThis.addEventListener?.('pointerdown', dismissFromCanvas, true);
    return () => globalThis.removeEventListener?.('pointerdown', dismissFromCanvas, true);
  }, [closePublication, publicationOpen]);
  const openDockPanel = (name, trigger) => {
    if (publicationOpen) closePublication({ returnFocus: false });
    panels.togglePanel(name, trigger);
  };
  const menuSurface = controller.draft?.appearance.menuSurfaceId;
  const workspaceSurfaceColor = latticeSurfaceColor(controller.draft?.appearance.surfaceId);
  const metadataState = ownerMetadataModeView(metadataMode);
  const moduleAvailability = ownerWorkbenchModuleAvailability(metadataMode, boardInstanceState);
  const moveMetadata = (event) => {
    const metadataElement = () => globalThis.document?.querySelector?.(
      '.system-workflow__metadata-down-host, .system-workflow__metadata-projection.is-side, .system-workflow__metadata-module',
    );
    const animate = (node, keyframes, duration) => node?.animate?.(keyframes, {
      duration,
      easing: 'cubic-bezier(.2, .8, .2, 1)',
      fill: 'both',
    });
    const active = metadataTransitionRef.current;
    const projectedMode = active?.projectedMode || metadataMode;
    const nextMode = transitionOwnerMetadataMode(projectedMode, event);
    if (nextMode === projectedMode) return;
    if (layout.reducedMotion || typeof globalThis.Element?.prototype?.animate !== 'function') {
      const pendingEvents = active?.events || [];
      metadataTransitionRef.current = null;
      active?.animation?.cancel?.();
      flushSync(() => [...pendingEvents, event].forEach((pendingEvent) => transitionMetadata(pendingEvent)));
      return;
    }
    if (active) {
      active.events.push(event);
      active.projectedMode = nextMode;
      return;
    }
    const transition = { animation: null, events: [event], phase: 'idle', projectedMode: nextMode };
    const continueOrFinish = () => {
      if (metadataTransitionRef.current !== transition) return;
      transition.animation = null;
      if (transition.events.length > 0) beginOutgoing();
      else metadataTransitionRef.current = null;
    };
    const commitAndEnter = () => {
      if (metadataTransitionRef.current !== transition) return;
      const pendingEvents = transition.events.splice(0);
      flushSync(() => pendingEvents.forEach((pendingEvent) => transitionMetadata(pendingEvent)));
      const animation = animate(metadataElement(), [{ opacity: 0 }, { opacity: 1 }], 160);
      if (!animation) {
        continueOrFinish();
        return;
      }
      transition.animation = animation;
      transition.phase = 'entering';
      animation.finished.then(continueOrFinish, continueOrFinish);
    };
    function beginOutgoing() {
      if (metadataTransitionRef.current !== transition) return;
      const current = metadataElement();
      if (!current) { commitAndEnter(); return; }
      const animation = animate(current, [{ opacity: 1 }, { opacity: 0 }], 120);
      if (!animation) { commitAndEnter(); return; }
      transition.animation = animation;
      transition.phase = 'outgoing';
      animation.finished.then(commitAndEnter, commitAndEnter);
    }
    metadataTransitionRef.current = transition;
    beginOutgoing();
  };
  return <><main aria-hidden={preview || undefined} className="system-workflow" data-canvas-context="canvas" data-layout={layout.mode}
    data-board-instance-state={boardInstanceState} data-metadata-mode={metadataMode}
    data-lattice-menu-surface data-menu-surface={menuSurface} data-reduced-motion={layout.reducedMotion || undefined}
    data-surface={controller.draft?.appearance.surfaceId} data-previewing={preview ? true : undefined}
    inert={preview ? '' : undefined}>
    <PresentationBoard assetsById={assetsById} instanceState={boardInstanceState}
      documentGeometry={controller.draft?.geometry} identity={profileIdentity}
      inspectionAtmosphere={viewer.atmosphereActive}
      metadataDocked={metadataState.docked} metadataProjection={metadataState.projection}
      onMetadataClose={() => moveMetadata(OWNER_METADATA_EVENT.CLOSE)}
      onMetadataInnerToggle={() => moveMetadata(OWNER_METADATA_EVENT.TOGGLE_INNER)}
      onMetadataSidecarToggle={() => moveMetadata(OWNER_METADATA_EVENT.TOGGLE_SIDECAR)}
      onMetadataUndock={() => moveMetadata(OWNER_METADATA_EVENT.UNDOCK)}
      onMinimize={() => transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.MINIMIZE)}
      onRestore={() => transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.RESTORE)}
      onInspectionCancel={viewer.close}
      onContextMenu={(event) => {
        if (event.target.closest('.system-workflow__metadata-module')) return;
        event.preventDefault();
        setWorkspaceMenu({ x: event.clientX, y: event.clientY });
      }}
      layoutMode={layout.mode} profileAddress={profileAddress} reducedMotion={layout.reducedMotion}
      renderInspection={viewer.placementId ? (container, controlsContainer) => <OwnerSystemWorkflowFocusViewer
        container={container} controlsContainer={controlsContainer} menuSurface={menuSurface}
        viewer={viewer} workspaceSurfaceColor={workspaceSurfaceColor} /> : null}
      renderMetadata={() => <OwnerSystemWorkflowMetadataContent dossier={metadataEntry?.dossier || null} />}>
      <OwnerSystemWorkflowCanvas assetsById={assetsById} controller={controller} crop={crop}
        onAssetDimensions={registerAssetDimensions} onChangeGrid={changeGrid}
        interactionDisabled={panelOccupied || Boolean(viewer.placementId)} onOpenViewer={(placement) => viewer.open(placement.id)}
        onPlacementRef={viewer.registerPlacement} reducedMotion={layout.reducedMotion}
        resolveAssetDimensions={resolveAssetDimensions} viewerPlacementId={viewer.sourcePlacementId} />
    </PresentationBoard>
    {metadataMode === OWNER_METADATA_MODE.DETACHED && <OwnerSystemWorkflowMetadataModule dossier={metadataEntry?.dossier || null}
      onClose={() => moveMetadata(OWNER_METADATA_EVENT.CLOSE)}
      onDock={() => moveMetadata(OWNER_METADATA_EVENT.ATTACH)} />}
    <OwnerSystemWorkflowPanelLayer activity={activity} assets={assets} assetsById={assetsById} browser={browser}
      connectedProfile={connectedProfile} onConnect={onConnect} onDisconnect={onDisconnect} onEnterMyWorld={onEnterMyWorld}
      controller={controller} crop={crop} layersOpen={layersOpen} layout={layout} libraryData={libraryData} menuSurface={menuSurface} onChangeGrid={changeGrid}
      workspaceSurfaceColor={workspaceSurfaceColor}
      onClose={() => panels.closePanel()} onDossierChange={setDossierOpen} onLayersOpenChange={(open) => {
        setLayersOpen(open);
        if (!open) setLayersExplicitlyOpened(false);
      }} onVisitProfile={onVisitProfile}
      panelOccupied={panelOccupied} panels={panels} profileIdentity={profileIdentity} profileModel={profileModel}
      resolveAssetDimensions={resolveAssetDimensions}
      categoryCommands={reviewAuthorities.categoryCommands || browser.commands} discoveryCommands={reviewAuthorities.discoveryCommands}
      discoveryGroups={reviewAuthorities.discoveryGroups} reviewDiscovery={reviewAuthorities.discovery} />
    <OwnerSystemWorkflowGlobalBar activePanel={panel}
      layersActivated={layersExplicitlyOpened && layersOpen && !panelOccupied}
      layersOpen={layersOpen && !panelOccupied}
      onOpen={openDockPanel} onPreview={(event) => {
        if (publicationOpen) closePublication({ returnFocus: false });
        startPreview(event.currentTarget);
      }}
      onPublish={(event) => togglePublication(event.currentTarget)} publicationOpen={publicationOpen}
      onToggleLayers={() => {
        if (publicationOpen) {
          closePublication({ returnFocus: false });
          setLayersOpen(true);
          setLayersExplicitlyOpened(true);
          return;
        }
        if (panelOccupied) {
          panels.closePanel({ returnFocus: false });
          setLayersOpen(true);
          setLayersExplicitlyOpened(true);
          return;
        }
        const nextOpen = !layersOpen;
        setLayersOpen(nextOpen);
        setLayersExplicitlyOpened(nextOpen);
      }}
      unreadCount={activity.unreadCount} />
    {(controller.error || notice) && <button aria-label="Dismiss notification" className="system-workflow__notice"
      type="button" onClick={dismissNotice}>{controller.error || notice}</button>}
    {workspaceMenu && createPortal(<RackMenu anchor={workspaceMenu}
      commands={[{ id: 'add', label: 'ADD' }]}
      getSubmenuCommands={(id) => id === 'add' ? [
        { disabled: !moduleAvailability.presentationBoard, id: 'presentation-board', label: 'PRESENTATION BOARD' },
        { disabled: !moduleAvailability.metadata, id: 'metadata', label: 'METADATA MODULE' },
      ] : []}
      label="Workbench commands" onClose={() => setWorkspaceMenu(null)}
      onCommand={(id) => {
        if (id === 'metadata') moveMetadata(OWNER_METADATA_EVENT.ADD);
        if (id === 'presentation-board') transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.ADD);
        setWorkspaceMenu(null);
      }}
      systemWorkflowOverlay />, document.body)}
  </main>
  {preview && <Suspense fallback={null}><ProfileDocumentV9Preview document={preview} onExit={closePreview} onReturn={closePreview}
    onOpenDirectory={() => {
      const trigger = previewReturnFocus.current;
      setPreview(null); previewReturnFocus.current = null;
      requestAnimationFrame(() => panels.openPanel('discover', trigger));
    }} /></Suspense>}
  {publicationPresence.present && <Suspense fallback={null}><OwnerSystemWorkflowPublicationRack
    assetRecords={canonicalRecords}
    getWalletPublicationContext={getWalletPublicationContext}
    menuSurface={menuSurface}
    onClose={closePublication}
    onMotionComplete={publicationPresence.completeTransition}
    onPublished={(result) => {
      import('../../profileDocument/storage/ownerDraftReconciliation.js').then(({ recordOwnerPublicationBaseline }) => {
        recordOwnerPublicationBaseline({
          document: result?.document,
          draft: controller.draft,
          profileAddress,
          storage: reviewStorage ?? globalThis.localStorage,
        });
      }).catch(() => {});
      onPublicationConfirmed?.(result);
    }}
    onSnapshotChange={({ document }) => onPreviewDocumentChange?.(document)}
    profile={publicationProfile}
    profileAddress={profileAddress}
    publishedResolution={publishedResolution}
    phase={publicationPresence.phase}
    systemWorkflowDraft={controller.draft}
  /></Suspense>}
  </>;
}
