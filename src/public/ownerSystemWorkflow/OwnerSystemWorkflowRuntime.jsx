import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { createPortal } from 'react-dom';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import { createProductionIdentityDossierViewModel } from '../identity/productionIdentityDossierViewModel.js';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import DisplayModule from './DisplayModule.jsx';
import OwnerSystemWorkflowGlobalBar from './OwnerSystemWorkflowGlobalBar.jsx';
import OwnerSystemWorkflowPanelLayer from './OwnerSystemWorkflowPanelLayer.jsx';
import useOwnerSystemWorkflowActivity from './useOwnerSystemWorkflowActivity.js';
import useOwnerSystemWorkflowController from './useOwnerSystemWorkflowController.js';
import useOwnerSystemWorkflowLayout from './useOwnerSystemWorkflowLayout.js';
import useOwnerSystemWorkflowPanels, { useOwnerSystemWorkflowPanelPresence } from './useOwnerSystemWorkflowPanels.js';
import useOwnerSystemWorkflowDevelopmentAuthorities from './useOwnerSystemWorkflowDevelopmentAuthorities.js';
import {
  PRESENTATION_BOARD_INSTANCE_EVENT,
  presentationBoardInstanceStateFromShortcut,
  transitionPresentationBoardInstance,
} from './ownerSystemWorkflowModuleState.js';
import { loadPresentationBoardShortcut } from './presentationBoardShortcutStorage.js';
import { loadWorkbenchPreferences, saveWorkbenchPreferences } from './workbenchPreferences.js';
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

export default function OwnerSystemWorkflowRuntime({ connectedProfile, getWalletPublicationContext, onConnect, onDisconnect, onEnterMyWorld, onOpenDiscover, onPreviewDocumentChange,
  onPublicationConfirmed, profileAddress, publishedResolution, onVisitProfile, reviewStorage, reviewAssets,
  reviewCategories, reviewActivity, reviewDiscovery, reviewProfile }) {
  useStartupDestinationReady();
  const controller = useOwnerSystemWorkflowController(profileAddress, { storage: reviewStorage });
  const [workbenchPreferences, setWorkbenchPreferences] = useState(() => loadWorkbenchPreferences(
    profileAddress, controller.draft?.appearance.surfaceId,
  ));
  const [preview, setPreview] = useState(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const displayRef = useRef(null);
  const placementTargetRef = useRef(null);
  const shortcutTargetRef = useRef(null);
  const workspaceRef = useRef(null);
  const [metadataAvailable, setMetadataAvailable] = useState(false);
  const [decodedDimensions, setDecodedDimensions] = useState(() => new Map());
  const [workspaceMenu, setWorkspaceMenu] = useState(null);
  const [boardInstanceState, transitionBoardInstance] = useReducer(transitionPresentationBoardInstance, profileAddress,
    (address) => presentationBoardInstanceStateFromShortcut(loadPresentationBoardShortcut(address)));
  const previewReturnFocus = useRef(null);
  const publicationReturnFocus = useRef(null);
  const workbenchPreferencesProfileRef = useRef(profileAddress);
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
    if (asset?.selectedMedia) return dimensions;
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
  const activity = useOwnerSystemWorkflowActivity({ active: panel === 'activity', fixture: reviewActivity, profileAddress });
  const panelOccupied = Boolean(publicationPresence.present || (panel && panel !== 'library')
    || Object.entries(panels.presence).some(([id, { present }]) => id !== 'library' && present));
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
    if (workbenchPreferencesProfileRef.current !== profileAddress) {
      workbenchPreferencesProfileRef.current = profileAddress;
      setWorkbenchPreferences(loadWorkbenchPreferences(profileAddress, controller.draft?.appearance.surfaceId));
      return;
    }
    saveWorkbenchPreferences(profileAddress, workbenchPreferences);
  }, [controller.draft?.appearance.surfaceId, profileAddress, workbenchPreferences]);
  const changeGrid = (...args) => displayRef.current?.changeGrid(...args) ?? false;
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
    if (name === 'discover' && onOpenDiscover) { panels.closePanel({ returnFocus: false }); onOpenDiscover(trigger); return; }
    panels.togglePanel(name, trigger);
  };
  const menuSurface = controller.draft?.appearance.menuSurfaceId;
  const workspaceSurfaceColor = latticeSurfaceColor(workbenchPreferences.surfaceId);
  const moduleAvailability = { metadata: metadataAvailable,
    presentationBoard: boardInstanceState === 'absent' };
  const authoringLocked = workbenchPreferences.compositionLocked;
  const instrumentsObscured = panelOccupied || (layout.mode === 'narrow' && panel === 'library');
  const revealInstruments = () => {
    if (publicationOpen) closePublication({ returnFocus: false });
    if (instrumentsObscured) panels.closePanel({ returnFocus: false });
  };
  return <><main ref={workspaceRef} aria-hidden={preview || undefined} className="system-workflow" data-canvas-context="canvas" data-layout={layout.mode}
    data-authoring-locked={authoringLocked || undefined} data-board-instance-state={boardInstanceState}
    data-chrome-noise={workbenchPreferences.chromeNoise ? 'on' : 'off'}
    data-library-open={panel === 'library' || undefined}
    data-lattice-menu-surface data-menu-surface={menuSurface} data-reduced-motion={layout.reducedMotion || undefined}
    data-surface={workbenchPreferences.surfaceId} data-previewing={preview ? true : undefined}
    inert={preview ? '' : undefined}>
    <DisplayModule ref={displayRef} placementTargetRef={placementTargetRef} shortcutTargetRef={shortcutTargetRef} workspaceRef={workspaceRef} assetsById={assetsById} controller={controller}
      authoringLocked={authoringLocked} active={!preview && boardInstanceState === 'window'}
      panelOccupied={panelOccupied} instrumentsObscured={instrumentsObscured}
      onRevealInstruments={revealInstruments}
      onInspect={() => { if (panel !== 'library') panels.closePanel({ returnFocus: false }); }}
      onMetadataAvailabilityChange={setMetadataAvailable}
      onAuthoringLockToggle={() => setWorkbenchPreferences((current) => ({ ...current, compositionLocked: !current.compositionLocked }))}
      registerAssetDimensions={registerAssetDimensions} resolveAssetDimensions={resolveAssetDimensions}
      menuSurface={menuSurface} reducedMotion={layout.reducedMotion} workspaceSurfaceColor={workspaceSurfaceColor}
      windowProps={{ instanceState: boardInstanceState, identity: profileIdentity,
        onMinimize: () => transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.MINIMIZE),
        onRestore: () => transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.RESTORE),
        onContextMenu: (event) => {
          if (event.target.closest('.system-workflow__instrument-bay, .system-workflow__instrument-window')) return;
          event.preventDefault();
          setWorkspaceMenu({ x: event.clientX, y: event.clientY });
        },
        layoutMode: layout.mode, profileAddress, reducedMotion: layout.reducedMotion,
        shortcutSnap: workbenchPreferences.shortcutSnap, workbenchGridColor: workbenchPreferences.gridColor,
        workbenchGridMode: workbenchPreferences.gridMode }} />
    <OwnerSystemWorkflowPanelLayer placementTargetRef={placementTargetRef} shortcutTargetRef={shortcutTargetRef} workspaceRef={workspaceRef} activity={activity} assets={assets} assetsById={assetsById} authoringLocked={authoringLocked} browser={browser}
      connectedProfile={connectedProfile} onConnect={onConnect} onDisconnect={onDisconnect} onEnterMyWorld={onEnterMyWorld}
      controller={controller} layout={layout} libraryData={libraryData} menuSurface={menuSurface} onChangeGrid={changeGrid}
      workspaceSurfaceColor={workspaceSurfaceColor}
      workbenchPreferences={workbenchPreferences}
      onWorkbenchPreferencesChange={(change) => setWorkbenchPreferences((current) => ({ ...current, ...change }))}
      onClose={() => panels.closePanel()} onDossierChange={setDossierOpen} onVisitProfile={onVisitProfile}
      panelOccupied={panelOccupied} panels={panels} profileIdentity={profileIdentity} profileModel={profileModel}
      resolveAssetDimensions={resolveAssetDimensions}
      categoryCommands={reviewAuthorities.categoryCommands || browser.commands} discoveryCommands={reviewAuthorities.discoveryCommands}
      discoveryGroups={reviewAuthorities.discoveryGroups} reviewDiscovery={reviewAuthorities.discovery} />
    <OwnerSystemWorkflowGlobalBar activePanel={panel}
      onOpen={openDockPanel} onPreview={(event) => {
        if (publicationOpen) closePublication({ returnFocus: false });
        startPreview(event.currentTarget);
      }}
      onPublish={(event) => togglePublication(event.currentTarget)} publicationOpen={publicationOpen}
      unreadCount={activity.unreadCount} />
    {(controller.error || notice) && <button aria-label="Dismiss notification" className="system-workflow__notice"
      type="button" onClick={dismissNotice}>{controller.error || notice}</button>}
    {workspaceMenu && createPortal(<RackMenu anchor={workspaceMenu}
      commands={[{ id: 'add', label: 'ADD' }]}
      getSubmenuCommands={(id) => id === 'add' ? [
        { disabled: !moduleAvailability.presentationBoard, id: 'presentation-board', label: 'DISPLAY MODULE' },
        { disabled: !moduleAvailability.metadata, id: 'metadata', label: 'METADATA MODULE' },
      ] : []}
      label="Workbench commands" menuSurfaceId={menuSurface} onClose={() => setWorkspaceMenu(null)}
      onCommand={(id) => {
        if (id === 'metadata') displayRef.current?.openMetadata();
        if (id === 'presentation-board') transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.ADD);
        setWorkspaceMenu(null);
      }}
      systemWorkflowOverlay />, document.body)}
  </main>
  {preview && <Suspense fallback={null}><ProfileDocumentV9Preview document={preview} onExit={closePreview} onReturn={closePreview}
    onOpenDirectory={() => {
      const trigger = previewReturnFocus.current;
      setPreview(null); previewReturnFocus.current = null;
      requestAnimationFrame(() => onOpenDiscover ? onOpenDiscover(trigger) : panels.openPanel('discover', trigger));
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
