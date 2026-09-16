import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { createPortal } from 'react-dom';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import { createProductionIdentityDossierViewModel } from '../identity/productionIdentityDossierViewModel.js';
import { loadIdentityShortcut, saveIdentityShortcut } from '../identity/useIdentityShortcut.js';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import DisplayModule from './DisplayModule.jsx';
import OwnerDisplayInstance from './OwnerDisplayInstance.jsx';
import WorkbenchAlignmentGrid from './WorkbenchAlignmentGrid.jsx';
import { addMirrorModule } from '../../systemWorkflow/mirrorModuleSession.js';
import { addMiniApp } from '../../miniApps/miniAppSession.js';
import { MAX_MINI_APPS } from '../../miniApps/domain/miniApps.js';
import { addTextModule } from '../../text/textSession.js';
import { MAX_TEXT_MODULES } from '../../text/domain/article.js';
import { openMobileModule } from '../../mobile/mobileSession.js';
import useDraftUndo from './useDraftUndo.js';
import { removeWorkbenchModule } from '../../systemWorkflow/removeWorkbenchModule.js';
import { PRIMARY_DISPLAY_ID } from '../../systemWorkflow/domain/displayModules.js';
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
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { captureWorkbenchPresentation } from './workbenchPresentationCapture.js';
import RackMenu from '../menus/RackMenu.jsx';
import {
  decodeOwnerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from './ownerSystemWorkflowAssetDimensions.js';

const OwnerSystemWorkflowPublicationRack = lazy(() => import('./OwnerSystemWorkflowPublicationRack.jsx'));
const ProfileDocumentV9Preview = lazy(() => import('../../profileDocument/components/ProfileDocumentV9Preview.jsx'));
const IdentityModule = lazy(() => import('../identity/IdentityModule.jsx'));
const MirrorWorkbench = lazy(() => import('../../mirror/MirrorWorkbench.jsx'));
const MiniAppsWorkbench = lazy(() => import('../../miniApps/MiniAppsWorkbench.jsx'));
const TextWorkbench = lazy(() => import('../../text/TextWorkbench.jsx'));
const MobileEditor = lazy(() => import('../../mobile/MobileEditor.jsx'));

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
  const [activeDisplayId, setActiveDisplayId] = useState(PRIMARY_DISPLAY_ID);
  const [instanceRecords, setInstanceRecords] = useState({});
  const [instancePresentations, setInstancePresentations] = useState({});
  const [miniAppPresentations, setMiniAppPresentations] = useState({});
  const [textPresentations, setTextPresentations] = useState({});
  const registerTextPresentation = useCallback((id, presentation) => setTextPresentations(current => {
    const next = { ...current }; if (presentation) next[id] = presentation; else delete next[id]; return next;
  }), []);
  const registerMiniAppPresentation = useCallback((id, presentation) => setMiniAppPresentations(current => { const next = { ...current }; if (presentation) next[id] = presentation; else delete next[id]; return next; }), []);
  const registerController = useCallback((id, record) => setInstanceRecords(current => { const next = { ...current }; if (record) next[id] = record; else delete next[id]; return next; }), []);
  const registerPresentation = useCallback((id, presentation) => setInstancePresentations(current => { const next = { ...current }; if (presentation !== undefined) next[id] = presentation; else delete next[id]; return next; }), []);
  const hasPrimaryDisplay = controller.draft.grids.length > 0;
  const selectedInstance = controller.draft.displays?.some(item => item.id === activeDisplayId) ? instanceRecords[activeDisplayId] : null;
  useEffect(() => {
    if (activeDisplayId === PRIMARY_DISPLAY_ID ? !hasPrimaryDisplay : !controller.draft.displays?.some(item => item.id === activeDisplayId))
      setActiveDisplayId(hasPrimaryDisplay ? PRIMARY_DISPLAY_ID : controller.draft.displays?.[0]?.id || PRIMARY_DISPLAY_ID);
  }, [activeDisplayId, hasPrimaryDisplay, controller.draft.displays]);
  const activeController = selectedInstance?.controller || controller;
  const currentError = activeController.error || controller.error;
  const initialWorkbench = useRef(controller.draft.workbench || null);
  const [workbenchLayout, setWorkbenchLayout] = useState(() => controller.draft.workbench || createDefaultWorkbenchPresentation());
  const [shortcutLayout, setShortcutLayout] = useState(null);
  const changeDisplayWindow = useCallback(change => setWorkbenchLayout(current => {
    const display = { ...current.display, ...change };
    return JSON.stringify(display) === JSON.stringify(current.display) ? current : { ...current, display };
  }), []);
  const changeIdentityWindow = useCallback(({ left, top, width }) => setWorkbenchLayout(current => {
    const window = { left, top, width };
    return JSON.stringify(window) === JSON.stringify(current.identity.window) ? current
      : { ...current, identity: { ...current.identity, window } };
  }), []);
  const initialDisplay = useMemo(() => {
    const display = controller.draft.workbench?.display;
    if (!display) return undefined;
    const icon = display.shortcut.icon;
    return { ...display, shortcut: { ...display.shortcut, open: display.open,
      iconAssetId: icon?.stableAssetId || null, iconMedia: icon?.media?.type === 'image'
        ? { url: icon.media.url, width: icon.media.width, height: icon.media.height } : null } };
  }, [hasPrimaryDisplay, profileAddress]);
  const [workbenchPreferences, setWorkbenchPreferences] = useState(() => loadWorkbenchPreferences(
    profileAddress, controller.draft?.appearance.surfaceId,
  ));
  const [preview, setPreview] = useState(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  useDraftUndo(controller.store, Boolean(preview), setNotice);
  const [identityOpen, setIdentityOpen] = useState(() => {
    const mode = loadIdentityShortcut(profileAddress)?.mode;
    return mode ? mode !== 'closed' : Boolean(initialWorkbench.current?.identity.open);
  });
  const identityReturnFocus = useRef(null);
  const identityPresentationRef = useRef(null);
  const openIdentity = trigger => {
    identityReturnFocus.current = trigger || workspaceRef.current;
    panels.closePanel({ returnFocus: false });
    if (!identityPresentationRef.current) saveIdentityShortcut(profileAddress, { ...loadIdentityShortcut(profileAddress), mode: 'window' });
    setIdentityOpen(true);
    identityPresentationRef.current?.restore();
  };
  useEffect(() => {
    const mode = loadIdentityShortcut(profileAddress)?.mode;
    setIdentityOpen(mode ? mode !== 'closed' : Boolean(controller.draft.workbench?.identity.open));
  }, [profileAddress]);
  const displayRef = useRef(null);
  const placementTargetRef = useRef(null);
  const allPlacementTargetsRef = useRef(null);
  const shortcutTargetRef = useRef(null);
  const allShortcutTargetsRef = useRef(null);
  allPlacementTargetsRef.current = {
    placeAsset: (...args) => (selectedInstance?.placementRef || placementTargetRef).current?.placeAsset(...args),
    previewAt: (point, dimensions, options) => {
      for (const ref of [placementTargetRef, ...Object.values(instanceRecords).map(record => record.placementRef)]) {
        const target = ref.current;
        const preview = target?.previewAt(point, dimensions, options);
        if (preview) return { ...preview, target };
      }
      return null;
    },
  };
  allShortcutTargetsRef.current = {
    targetAt: point => [shortcutTargetRef, ...Object.values(instanceRecords).map(record => record.shortcutRef)]
      .map(ref => ref.current).find(target => target?.node?.contains(document.elementFromPoint(point.x, point.y))),
  };
  const identityTargetRef = useRef(null);
  const moduleAssetTargets = useRef(new Map());
  const registerModuleAssetTarget = useCallback((id, target) => {
    if (target) moduleAssetTargets.current.set(id, target); else moduleAssetTargets.current.delete(id);
  }, []);
  const moduleTargetsRef = useRef(null);
  if (!moduleTargetsRef.current) moduleTargetsRef.current = {
    targetAt(point) {
      const hit = document.elementFromPoint(point.x, point.y);
      return [identityTargetRef.current, ...moduleAssetTargets.current.values()].find(target => target?.node?.contains(hit));
    },
    has(target) { return identityTargetRef.current === target || [...moduleAssetTargets.current.values()].includes(target); },
  };
  const workspaceRef = useRef(null);
  const [decodedDimensions, setDecodedDimensions] = useState(() => new Map());
  const [workspaceMenu, setWorkspaceMenu] = useState(null);
  const [boardInstanceState, transitionBoardInstance] = useReducer(transitionPresentationBoardInstance, profileAddress,
    (address) => presentationBoardInstanceStateFromShortcut(initialWorkbench.current?.display || loadPresentationBoardShortcut(address)));
  const previewReturnFocus = useRef(null);
  const publicationReturnFocus = useRef(null);
  const workbenchPreferencesProfileRef = useRef(profileAddress);
  const layout = useOwnerSystemWorkflowLayout();
  const liveIdentity = useProfileIdentity(profileAddress, { sourceMode: reviewProfile ? 'FIXTURE' : 'LIVE' });
  const contractFacts = useProfileContractFacts(profileAddress, { enabled: !reviewProfile });
  const profileIdentity = reviewIdentity(profileAddress, reviewProfile) || liveIdentity;
  const browserEnabled = !reviewAssets;
  const reviewAuthorities = useOwnerSystemWorkflowDevelopmentAuthorities({ categories: reviewCategories, discovery: reviewDiscovery, enabled: Boolean(reviewAssets) });
  const panels = useOwnerSystemWorkflowPanels({ blocked: Boolean(preview) });
  const publicationPresence = useOwnerSystemWorkflowPanelPresence(publicationOpen);
  const panel = panels.activePanel;
  const referencedAssetIds = useMemo(() => [...[...controller.draft.grids, ...(controller.draft.displays || []).flatMap(module => module.grids)]
    .flatMap((grid) => grid.placements.map(({ stableAssetId }) => stableAssetId)),
    ...['background', 'mask', 'artwork'].map(slot => controller.draft.mobile?.front[slot]?.stableAssetId).filter(Boolean),
    ...(controller.draft.mobile?.index.entries || []).map(entry => entry.asset.stableAssetId),
    ...(controller.draft.identityPresentation.avatar.mode === 'inscape' && controller.draft.identityPresentation.avatar.stableAssetId
      ? [controller.draft.identityPresentation.avatar.stableAssetId] : []),
    ...(controller.draft.workbench?.display.shortcut.icon ? [controller.draft.workbench.display.shortcut.icon.stableAssetId] : [])], [controller.draft.grids, controller.draft.displays, controller.draft.identityPresentation.avatar, controller.draft.workbench, controller.draft.mobile]);
  const browser = useOwnerLatticeBrowser(profileAddress, panel === 'library' && browserEnabled, referencedAssetIds);
  const assets = reviewAssets || browser.data.assets;
  const records = reviewAssets || browser.records;
  const refineAsset = useCallback((asset) => ownerSystemWorkflowDecodedAsset(
    asset, decodedDimensions.get(asset?.stableAssetId || asset?.id),
  ), [decodedDimensions]);
  const resolvedAssets = useMemo(() => assets.map(refineAsset), [assets, refineAsset]);
  const canonicalRecords = useMemo(() => records.map(refineAsset), [records, refineAsset]);
  const workbenchProjection = useMemo(() => captureWorkbenchPresentation({
    layout: workbenchLayout, shortcut: shortcutLayout, assetRecords: canonicalRecords, hasPrimaryDisplay,
    displayOpen: hasPrimaryDisplay && boardInstanceState === 'window', identityOpen,
    displays: controller.draft.displays, miniApps: controller.draft.miniApps, texts: controller.draft.texts,
    displayPresentations: instancePresentations, miniAppPresentations, textPresentations,
  }), [hasPrimaryDisplay, workbenchLayout, shortcutLayout, canonicalRecords, boardInstanceState, identityOpen, instancePresentations, controller.draft.displays, controller.draft.miniApps, miniAppPresentations, controller.draft.texts, textPresentations]);
  const workbench = workbenchProjection.value;
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
    controller.clearError(); activeController.clearError();
    setNotice(null);
  }, [controller.clearError, activeController.clearError]);
  useEffect(() => {
    if (!currentError && !notice) return undefined;
    const timeout = globalThis.setTimeout(dismissNotice, 4_500);
    return () => globalThis.clearTimeout(timeout);
  }, [currentError, dismissNotice, notice]);
  useEffect(() => {
    if (workbenchPreferencesProfileRef.current !== profileAddress) {
      workbenchPreferencesProfileRef.current = profileAddress;
      setWorkbenchPreferences(loadWorkbenchPreferences(profileAddress, controller.draft?.appearance.surfaceId));
      return;
    }
    saveWorkbenchPreferences(profileAddress, workbenchPreferences);
  }, [controller.draft?.appearance.surfaceId, profileAddress, workbenchPreferences]);
  const changeGrid = (...args) => (selectedInstance?.displayRef || displayRef).current?.changeGrid(...args) ?? false;
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
      if (workbenchProjection.error) throw new Error(workbenchProjection.error);
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
        profileAddress, systemWorkflowDraft: controller.draft, workbench });
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
  const toggleLibrary = () => {
    if (publicationOpen) closePublication({ returnFocus: false });
    panels.togglePanel('library', workspaceRef.current);
  };
  const openPreview = trigger => {
    if (publicationOpen) closePublication({ returnFocus: false });
    startPreview(trigger);
  };
  const menuSurface = controller.draft?.appearance.menuSurfaceId;
  const workspaceSurfaceColor = latticeSurfaceColor(workbenchPreferences.surfaceId);
  const moduleAvailability = { presentationBoard: !hasPrimaryDisplay || (controller.draft.displays?.length || 0) < 7 };
  const authoringLocked = workbenchPreferences.compositionLocked;
  const instrumentsObscured = panelOccupied;
  const revealInstruments = () => {
    if (publicationOpen) closePublication({ returnFocus: false });
    if (instrumentsObscured) panels.closePanel({ returnFocus: false });
  };
  const deleteDisplay = expected => {
    try {
      if (!removeWorkbenchModule(controller.store, profileAddress, 'display', expected)) { setNotice('Could not delete this Display. Reopen its menu and try again.'); return; }
      requestAnimationFrame(() => workspaceRef.current?.focus());
    } catch (error) { setNotice(error.message || 'Could not delete this Display'); }
  };
  return <><main tabIndex={-1} ref={workspaceRef} aria-hidden={preview || undefined} className="system-workflow" data-canvas-context="canvas" data-layout={layout.mode}
    onContextMenu={event => { if (event.target === event.currentTarget) { event.preventDefault(); setWorkspaceMenu({ x: event.clientX, y: event.clientY }); } }}
    style={workbenchPreferences.dockVisible ? undefined : { '--workflow-dock-height': '0px' }}
    onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) { event.preventDefault(); setWorkspaceMenu({ x: 16, y: 16 }); } }}
    data-authoring-locked={authoringLocked || undefined} data-board-instance-state={boardInstanceState}
    data-chrome-noise={workbenchPreferences.chromeNoise ? 'on' : 'off'}
    data-lattice-menu-surface data-menu-surface={menuSurface} data-reduced-motion={layout.reducedMotion || undefined}
    data-surface={workbenchPreferences.surfaceId} data-previewing={preview ? true : undefined}
    inert={preview ? '' : undefined}>
    <WorkbenchAlignmentGrid hostRef={workspaceRef} color={workbenchPreferences.gridColor} mode={workbenchPreferences.gridMode} />
    {hasPrimaryDisplay && <div className="system-workflow__display-instance" data-display-instance={PRIMARY_DISPLAY_ID} data-active-display={activeDisplayId === PRIMARY_DISPLAY_ID || undefined}
      onPointerDownCapture={() => setActiveDisplayId(PRIMARY_DISPLAY_ID)} onFocusCapture={() => setActiveDisplayId(PRIMARY_DISPLAY_ID)}>
    <DisplayModule ref={displayRef} placementTargetRef={placementTargetRef} shortcutTargetRef={shortcutTargetRef} workspaceRef={workspaceRef} assetsById={assetsById} controller={controller}
      authoringLocked={authoringLocked} active={!preview && boardInstanceState === 'window'}
      panelOccupied={panelOccupied} instrumentsObscured={instrumentsObscured}
      onRevealInstruments={revealInstruments} onToggleLibrary={toggleLibrary}
      onInspect={() => { if (panel !== 'library') panels.closePanel({ returnFocus: false }); }}
      onAuthoringLockToggle={() => setWorkbenchPreferences((current) => ({ ...current, compositionLocked: !current.compositionLocked }))}
      registerAssetDimensions={registerAssetDimensions} resolveAssetDimensions={resolveAssetDimensions}
      menuSurface={menuSurface} reducedMotion={layout.reducedMotion} workspaceSurfaceColor={workspaceSurfaceColor}
      windowProps={{ instanceState: boardInstanceState, onDelete: () => deleteDisplay({ id: PRIMARY_DISPLAY_ID, grids: controller.draft.grids }),
        initialPresentation: initialDisplay, onWindowChange: changeDisplayWindow, onShortcutChange: setShortcutLayout,
        onMinimize: () => transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.MINIMIZE),
        onRestore: () => transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.RESTORE),
        layoutMode: layout.mode, profileAddress, reducedMotion: layout.reducedMotion,
        shortcutSnap: workbenchPreferences.shortcutSnap }} />
    </div>}
    {(controller.draft.displays || []).map((module, index) => <OwnerDisplayInstance key={module.id} id={module.id} index={index + 1}
      onDelete={() => deleteDisplay(module)} store={controller.store} profileAddress={profileAddress} initialPresentation={initialWorkbench.current?.displays?.find(item => item.id === module.id)}
      active={activeDisplayId === module.id} onActivate={setActiveDisplayId} onController={registerController} onPresentation={registerPresentation}
      shared={{ assetsById, panelOccupied, instrumentsObscured, onRevealInstruments: revealInstruments, onToggleLibrary: toggleLibrary,
        onInspect: () => { if (panel !== 'library') panels.closePanel({ returnFocus: false }); },
        registerAssetDimensions, resolveAssetDimensions, menuSurface, reducedMotion: layout.reducedMotion, workspaceSurfaceColor, workspaceRef,
        windowProps: { layoutMode: layout.mode, reducedMotion: layout.reducedMotion, shortcutSnap: workbenchPreferences.shortcutSnap } }} />)}
    {controller.draft.texts?.length > 0 && <Suspense fallback={<p role="status">Opening Text…</p>}><TextWorkbench
      records={controller.draft.texts} store={controller.store} profileAddress={profileAddress} assets={canonicalRecords}
      presentations={initialWorkbench.current?.texts} onPresentationChange={registerTextPresentation}
      registerTarget={registerModuleAssetTarget} suspended={Boolean(preview)} /></Suspense>}
    {controller.draft.mobile && <Suspense fallback={<p role="status">Opening Mobile…</p>}><MobileEditor
      key={profileAddress} mobile={controller.draft.mobile} store={controller.store} profileAddress={profileAddress}
      assetsById={assetsById} identity={profileModel} registerTarget={registerModuleAssetTarget} suspended={Boolean(preview)} /></Suspense>}
    {controller.draft.animations?.length > 0 && <Suspense fallback={<p role="status">Opening Mirror…</p>}><MirrorWorkbench
      records={controller.draft.animations} store={controller.store} profileAddress={profileAddress}
      registerTarget={registerModuleAssetTarget} suspended={Boolean(preview)} /></Suspense>}
    {controller.draft.miniApps?.length > 0 && <Suspense fallback={<p role="status">Opening mini apps…</p>}><MiniAppsWorkbench
      records={controller.draft.miniApps} store={controller.store} profileAddress={profileAddress}
      presentations={initialWorkbench.current?.miniApps} onPresentationChange={registerMiniAppPresentation}
      onConnect={onConnect} suspended={Boolean(preview)} /></Suspense>}
    <OwnerSystemWorkflowPanelLayer moduleAssetTargetRef={moduleTargetsRef} placementTargetRef={allPlacementTargetsRef} shortcutTargetRef={allShortcutTargetsRef} workspaceRef={workspaceRef} activity={activity} assets={assets} assetsById={assetsById} authoringLocked={false} browser={browser}
      connectedProfile={connectedProfile} onConnect={onConnect} onDisconnect={onDisconnect} onEnterMyWorld={onEnterMyWorld}
      controller={activeController} layout={layout} libraryData={libraryData} menuSurface={menuSurface} onChangeGrid={changeGrid}
      workspaceSurfaceColor={workspaceSurfaceColor}
      workbenchPreferences={workbenchPreferences}
      onWorkbenchPreferencesChange={(change) => setWorkbenchPreferences((current) => ({ ...current, ...change }))}
      onClose={() => panels.closePanel()} onVisitProfile={onVisitProfile}
      onOpenIdentity={(event) => {
        openIdentity(event.currentTarget.closest('.system-workflow')?.querySelector('[data-system-workflow-panel-trigger][aria-label="Profile"]'));
      }}
      panelOccupied={panelOccupied} panels={panels} profileIdentity={profileIdentity} profileModel={profileModel}
      resolveAssetDimensions={resolveAssetDimensions}
      categoryCommands={reviewAuthorities.categoryCommands || browser.commands} discoveryCommands={reviewAuthorities.discoveryCommands}
      discoveryGroups={reviewAuthorities.discoveryGroups} reviewDiscovery={reviewAuthorities.discovery} />
    {identityOpen && profileModel && <Suspense fallback={<p role="status">Opening Identity…</p>}>
      <IdentityModule key={profileAddress} model={profileModel} menuSurface={menuSurface}
        presentationRef={identityPresentationRef} onDisconnect={onDisconnect}
        initialWindow={workbenchLayout.identity.window} onWindowChange={changeIdentityWindow}
        assetTargetRef={identityTargetRef} avatar={controller.draft.identityPresentation.avatar}
        onSave={controller.saveIdentity}
        customAvatar={controller.draft.identityPresentation.avatar.mode === 'inscape'}
        portraitChoices={resolvedAssets.filter((asset) => asset.placeable !== false && (asset.originalImageUrl || asset.imageUrl))}
        returnFocus={identityReturnFocus.current} onClose={() => setIdentityOpen(false)} />
    </Suspense>}
    {workbenchPreferences.dockVisible && <OwnerSystemWorkflowGlobalBar activePanel={panel}
      onOpen={openDockPanel} onPreview={event => openPreview(event.currentTarget)}
      onPublish={(event) => togglePublication(event.currentTarget)} publicationOpen={publicationOpen}
      unreadCount={activity.unreadCount} />}
    {(currentError || notice) && <button aria-label="Dismiss notification" className="system-workflow__notice"
      type="button" onClick={dismissNotice}>{currentError || notice}</button>}
    {workspaceMenu && createPortal(<RackMenu anchor={workspaceMenu}
      commands={[{ id: 'add', label: 'ADD' }, { id: 'identity', label: 'IDENTITY' }, { id: 'library', label: 'LIBRARY' },
        { id: 'discover', label: 'DISCOVER' }, { id: 'preview', label: 'PREVIEW' }, { id: 'publish', label: 'PUBLISH' },
        { id: 'toggle-dock', label: workbenchPreferences.dockVisible ? 'HIDE DOCK' : 'SHOW DOCK' }]}
      getSubmenuCommands={(id) => id === 'add' ? [
        { disabled: !moduleAvailability.presentationBoard, id: 'presentation-board', label: 'DISPLAY MODULE' },
        { disabled: (controller.draft.animations?.length || 0) >= 4, id: 'mirror', label: 'MIRROR ANIMATION' },
        { disabled: (controller.draft.miniApps?.length || 0) >= MAX_MINI_APPS, id: 'mini-app', label: 'MINI APP' },
        { disabled: (controller.draft.texts?.length || 0) >= MAX_TEXT_MODULES, id: 'text', label: 'TEXT' },
        { id: 'mobile', label: controller.draft.mobile ? 'OPEN MOBILE' : 'MOBILE MODULE' },
      ] : id === 'presentation-board' ? [
        { disabled: !moduleAvailability.presentationBoard, id: 'add-display-horizontal', label: 'HORIZONTAL 16:9' },
        { disabled: !moduleAvailability.presentationBoard, id: 'add-display-vertical', label: 'VERTICAL 9:16' },
      ] : []}
      label="Workbench commands" menuSurfaceId={menuSurface} returnFocus={workspaceRef.current} onClose={() => setWorkspaceMenu(null)}
      onCommand={(id) => {
        if (id === 'library') toggleLibrary();
        if (id === 'identity') openIdentity(workspaceRef.current);
        if (id === 'discover') openDockPanel('discover', workspaceRef.current);
        if (id === 'preview') openPreview(workspaceRef.current);
        if (id === 'publish') togglePublication(workspaceRef.current);
        if (id === 'mirror') { try { addMirrorModule(controller.store); } catch (error) { setNotice(error.message); } }
        if (id === 'mini-app') { try { addMiniApp(controller.store, profileAddress); } catch (error) { setNotice(error.message); } }
        if (id === 'text') { try { addTextModule(controller.store, profileAddress); } catch (error) { setNotice(error.message); } }
        if (id === 'mobile') { try { openMobileModule(controller.store); } catch (error) { setNotice(error.message); } }
        if (id === 'toggle-dock') {
          setWorkbenchPreferences(current => ({ ...current, dockVisible: !current.dockVisible }));
          requestAnimationFrame(() => workspaceRef.current?.focus());
        }
        if (id === 'add-display-horizontal' || id === 'add-display-vertical') {
          const added = controller.addDisplay(id === 'add-display-vertical' ? 'PORTRAIT' : 'LANDSCAPE');
          if (added) { setActiveDisplayId(added); if (added === PRIMARY_DISPLAY_ID) transitionBoardInstance(PRESENTATION_BOARD_INSTANCE_EVENT.RESTORE); }
        }
        setWorkspaceMenu(null);
      }}
      systemWorkflowOverlay />, document.body)}
  </main>
  {preview && <Suspense fallback={null}><ProfileDocumentV9Preview document={preview} onExit={closePreview} onReturn={closePreview} onConnect={onConnect}
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
    workbench={workbench} onSaveWorkbench={() => controller.saveWorkbench(workbench)} preparationError={workbenchProjection.error}
  /></Suspense>}
  </>;
}
