import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ProfileNavigationDock from './ProfileNavigationDock.jsx';
import { useLibraryStore } from '../library/index.js';
import { normalizeProfileAddress } from '../library/config.js';
import KeeperSignalsLayer from '../signals/components/KeeperSignalsLayer.jsx';
import { useSignalStore } from '../signals/state/useSignalStore.js';
import { useProfileIdentity } from '../profileIdentity/index.js';
import ProfileDocumentPanel from '../profileDocument/components/ProfileDocumentPanel.jsx';
import ProfileDocumentPreview from '../profileDocument/components/ProfileDocumentPreview.jsx';
import { useProfileDocumentStore } from '../profileDocument/state/useProfileDocumentStore.js';
import { buildProfileDocumentV3 } from '../profileDocument/domain/profileDocumentBuilder.js';
import { assertValidProfileDocument } from '../profileDocument/domain/profileDocumentValidation.js';
import { createProfileDocumentRestorePlan } from '../profileDocument/domain/profileDocumentRestore.js';
import { profileDocumentContentFingerprint } from '../profileDocument/domain/profileDocumentSerialization.js';
import { loadProfileSnapshot, loadRestoredPresentation, profilePresentationKey, saveProfileSnapshot, saveRestoredPresentation } from '../profileDocument/storage/profileDocumentStorage.js';
import { inspectLibraryWorkspaceRecord } from '../library/storage/libraryWorkspaceStorage.js';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';
import { getPublicTheme } from './themeTokens.js';
import { findScenePlacement, findScenePlacementAtPointer, isScenePlacementAvailable, normalizeSpan, packCompactCanvasObjects, packCompactScene } from './sceneGrid.js';
import { normalizeGridRect } from './gridGeometry.js';
import { normalizeIconKey } from './sceneIcons.js';
import { defaultWindowGridRect } from './windowGeometry.js';
import { contextMenuCommands, presentationPatchForCommand, resolveContextTarget } from './menus/contextMenuModel.js';
import DesktopMenu from './menus/DesktopMenu.jsx';
import CategoryRenameDialog from './CategoryRenameDialog.jsx';
import ArtworkInspector from './ArtworkInspector.jsx';
import GalleryWorld from './GalleryWorld.jsx';
import { gallerySpanForAspectRatio } from './galleryLayout.js';
import HomeWorldSurface from './HomeWorldSurface.jsx';
import UpperWorldSurface from './UpperWorldSurface.jsx';
import SpatialLevelNavigation from './SpatialLevelNavigation.jsx';
import { SPATIAL_WORLD_LEVEL } from './spatialWorldLevels.js';
import KeeperDock from './KeeperDock.jsx';
import { CANVAS_OBJECT_KIND, getCanvasObjectDefinition } from '../library/domain/canvasObjectRegistry.js';
import { CANVAS_OBJECT_ORDER_COMMAND } from '../library/domain/canvasObjects.js';
import { runOwnerAuthoringMutation, selectLiveCanvasContent } from './publicAccess.js';
import { readOwnerProfileValue, writeOwnerProfileValue } from './ownerProfileStorage.js';
import ProfileDiscoveryBoundary from '../profileDiscovery/ProfileDiscoveryBoundary.jsx';
import { createVerticalHomePlacementGeometry, createVerticalHomeWorld } from './verticalHomeWorld.js';
import { useOwnerPublicationSync } from './useOwnerPublicationSync.js';
import { useRuntimeWindowOrchestration } from './useRuntimeWindowOrchestration.js';
import { useSpatialWorldNavigation } from './useSpatialWorldNavigation.js';
import {
  MODULE_LAYOUT_STORAGE_KEY,
  LEGACY_MODULE_LAYOUT_STORAGE_KEY,
  clampModulePosition,
  createModuleGridGeometry,
  decodeModuleLayout,
  encodeModuleLayout,
  findNearestAvailableModulePosition,
  getDefaultModulePositions,
  normalizeModulePositions
} from './moduleLayout.js';

import './moduleGrid.css';
import '../library/collection.css';
import '../signals/keeperSignals.css';
import '../profileDocument/profileDocument.css';
import './canvasObjects.css';

const NftFlipViewer = lazy(() => import('./NftFlipViewer.jsx'));
const ArtworkChooser = lazy(() => import('./ArtworkChooser.jsx'));

const MODULES = Object.freeze([
  { id: 'identity', label: 'Profile Card' },
  { id: 'collection', label: 'Library' },
  { id: 'creations', label: 'Creations' },
  { id: 'signals', label: 'Activity' }
]);

const MODULE_ENTRY_ORDER = Object.freeze({
  identity: 0,
  collection: 1,
  signals: 2,
  creations: 3
});

const SYSTEM_SCENE_KEY = 'os-underneath.system-launchers.v1';
// The stage-free home makes the grid a primary world surface. A new preference
// version prevents an old edit-mode-only "off" choice from booting into a void.
const GRID_PREFERENCE_KEY = 'os-underneath.grid-preference.v2';
const SYSTEM_ICONS = Object.freeze({ identity: 'profile', collection: 'collection', creations: 'creations', signals: 'signals' });
const AUTHORING_CONTEXT_COMMANDS = new Set([
  'toggle-edit', 'rename-category', 'create-framed-artwork', 'add-gallery-artwork', 'toggle-artwork-lock', 'lock-all-artwork', 'unlock-all-artwork',
  'edit-artwork', 'replace-artwork',
  'toggle-object-visibility', 'menu-layer', 'object-forward', 'object-backward',
  'object-front', 'object-back', 'remove-artwork', 'toggle-start-open',
  'menu-appearance', 'menu-presentation', 'menu-image-fit', 'menu-frame', 'menu-mat', 'menu-background',
  'presentation-transparent', 'presentation-framed', 'image-fit-contain', 'image-fit-cover',
  'frame-none', 'frame-thin', 'frame-heavy', 'mat-none', 'mat-light', 'mat-dark',
  'background-dark', 'background-light', 'background-neutral'
]);

const createHomePlacementGeometry = createVerticalHomePlacementGeometry;

function defaultSystemPresentation(id, order) { return { appearanceMode: 'label', iconKey: SYSTEM_ICONS[id], span: { columns: 3, rows: 1 }, presentationOrder: order, startOpen: false, windowGeometry: null }; }
function readSystemPresentation(profileAddress) { try { const value = JSON.parse(readOwnerProfileValue(window.localStorage,SYSTEM_SCENE_KEY,profileAddress) || 'null'); return Object.fromEntries(MODULES.map((module, index) => { const item=value?.[module.id]; return [module.id,{ ...defaultSystemPresentation(module.id,index), ...(item || {}), label:module.label, iconKey:normalizeIconKey(item?.iconKey,SYSTEM_ICONS[module.id]), span:normalizeSpan(item?.span,item?.appearanceMode) }]; })); } catch { return Object.fromEntries(MODULES.map((module,index)=>[module.id,{...defaultSystemPresentation(module.id,index),label:module.label}])); } }
function saveSystemPresentation(profileAddress, presentation) { return writeOwnerProfileValue(window.localStorage,SYSTEM_SCENE_KEY,profileAddress,JSON.stringify(presentation)); }
function readGridPreference(){try{return JSON.parse(window.localStorage.getItem(GRID_PREFERENCE_KEY))?.visible!==false}catch{return true}}
function getInitialGeometry() {
  return createModuleGridGeometry(window.innerWidth, window.innerHeight);
}

function readStoredPositions(geometry, profileAddress) {
  try {
    const current=readOwnerProfileValue(window.localStorage,MODULE_LAYOUT_STORAGE_KEY,profileAddress,[MODULE_LAYOUT_STORAGE_KEY,LEGACY_MODULE_LAYOUT_STORAGE_KEY]);
    if(!current)return getDefaultModulePositions(geometry);
    const record=JSON.parse(current);
    const positions=record?.version===3?normalizeModulePositions(record.positions,geometry):decodeModuleLayout(record,geometry);
    if(record?.version===3)writeOwnerProfileValue(window.localStorage,MODULE_LAYOUT_STORAGE_KEY,profileAddress,encodeModuleLayout(positions));
    return positions;
  } catch {
    return getDefaultModulePositions(geometry);
  }
}

export default function ModuleGridShell({
  onRequestAtelier,
  activeActorId,
  avatarSrc,
  residentHandoff,
  keeperReactions,
  stageId = 'moonpurple',
  environment = { type: 'illustrated', shaderId: 'neural-field' },
  onApplyRestoredPresentation,
  onPreviewDocumentChange,
  keeperVisible = true,
  stageVisible = true,
  onKeeperVisibilityChange,
  onStageVisibilityChange,
  registerWorldContextMenu,
  onGalleryOpenChange,
  publishedResolution,
  onPublicationConfirmed,
  interfaceVisible = true,
  ownerAuthoringEnabled = false,
  workspaceProfileAddress,
  getWalletPublicationContext,
  visitorWalletConnected = false,
  viewedProfileAddress: requestedViewedProfileAddress,
  onVisitProfile,
  revealPresentation = { sequence: 'short', reducedMotion: false }
}) {
  const workspace = useLibraryStore((state) => state.workspace);
  const setLibraryProfileAddress = useLibraryStore((state) => state.setProfileAddress);
  const setSignalProfileAddress = useSignalStore((state) => state.setProfileAddress);
  const activateDocumentProfile = useProfileDocumentStore((state) => state.activateProfile);
  const workspaceRecordRef = useRef(new Map());
  useLayoutEffect(() => {
    const profile = normalizeProfileAddress(workspaceProfileAddress);
    if (!profile) return;
    if (!workspaceRecordRef.current.has(profile)) {
      workspaceRecordRef.current.set(profile, inspectLibraryWorkspaceRecord(window.localStorage, profile));
    }
    activateDocumentProfile(profile);
    setLibraryProfileAddress(profile);
    setSignalProfileAddress(profile);
  }, [activateDocumentProfile, setLibraryProfileAddress, setSignalProfileAddress, workspaceProfileAddress]);
  const [geometry, setGeometry] = useState(getInitialGeometry);
  const [positions, setPositions] = useState(() => readStoredPositions(createHomePlacementGeometry(getInitialGeometry()),workspace.profileAddress));
  const [systemPresentation, setSystemPresentation] = useState(() => readSystemPresentation(workspace.profileAddress));
  const [gridVisible, setGridVisible] = useState(readGridPreference);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [profileDiscoveryOpen, setProfileDiscoveryOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeHudCommand, setActiveHudCommand] = useState(null);
  const [gridPalette, setGridPalette] = useState('dark');
  const [avatarShape, setAvatarShape] = useState(() => loadRestoredPresentation(window.localStorage, workspace.profileAddress)?.avatarShape || 'square');
  const [visitorNavigation, setVisitorNavigation] = useState(() => loadRestoredPresentation(window.localStorage, workspace.profileAddress)?.visitorNavigation || { showCategories: true, showCreations: false });
  const [contextMenu, setContextMenu] = useState(null);
  const [galleryPresentationPreview, setGalleryPresentationPreview] = useState(null);
  const [artworkInspector, setArtworkInspector] = useState(null);
  const [selectedCanvasObjectId, setSelectedCanvasObjectId] = useState(null);
  const [galleryRemovalPending, setGalleryRemovalPending] = useState(null);
  const [categoryPendingRename, setCategoryPendingRename] = useState(null);
  const [artworkChooser, setArtworkChooser] = useState(null);
  const [previewObjectId, setPreviewObjectId] = useState(null);
  const [keeperDockActive, setKeeperDockActive] = useState(false);
  useLayoutEffect(() => {
    const profile = normalizeProfileAddress(workspace.profileAddress);
    if (!profile) return;
    setPositions(readStoredPositions(createHomePlacementGeometry(geometry), profile));
    setSystemPresentation(readSystemPresentation(profile));
  }, [geometry, workspace.profileAddress]);
  useLayoutEffect(() => {
    const profile = normalizeProfileAddress(workspace.profileAddress);
    if (profile) {
      const restored = loadRestoredPresentation(window.localStorage, profile);
      setAvatarShape(restored?.avatarShape || 'square');
      setVisitorNavigation(restored?.visitorNavigation || { showCategories: true, showCreations: false });
    }
  }, [workspace.profileAddress]);
  const canvasObjectRefs = useRef(new Map());
  const spatialLayerRef = useRef(null);
  const shellRef = useRef(null);
  const gridRef = useRef(null);
  const artworkChoicePendingRef = useRef(false);
  const resizeFrameRef = useRef(0);

  const openWorldContextMenu = useCallback((event) => {
    if (!interfaceVisible) return;
    event.preventDefault();
    setContextMenu({
      target: { type: 'canvas', id: 'canvas' },
      menu: 'root',
      anchor: { x: event.clientX, y: event.clientY },
      returnFocus: null
    });
  }, [interfaceVisible]);

  const openTargetContextMenu = useCallback((event, desktop) => {
    const target = resolveContextTarget(event.target, desktop);
    if (!target) return;
    event.preventDefault();
    setContextMenu({ target, menu:'root', anchor:{x:event.clientX,y:event.clientY}, returnFocus:event.target.closest?.('button,[tabindex]') });
  }, []);

  useEffect(() => {
    registerWorldContextMenu?.(openWorldContextMenu);
    return () => registerWorldContextMenu?.(null);
  }, [openWorldContextMenu, registerWorldContextMenu]);

  const theme = useMemo(() => getPublicTheme(activeActorId), [activeActorId]);
  const shellTheme = theme;

  const moveKeeperFromHome = useCallback((clientX, clientY) => {
    if (keeperDockActive) return;
    residentHandoff?.moveToScreenPosition?.(clientX, clientY);
  }, [keeperDockActive, residentHandoff]);
  const libraryAssets = useLibraryStore((state) => state.assets);
  const libraryStatus = useLibraryStore((state) => state.status);
  const libraryError = useLibraryStore((state) => state.error || state.liveError);
  const loadLibrary = useLibraryStore((state) => state.load);
  const replaceWorkspace = useLibraryStore((state) => state.replaceWorkspace);
  useEffect(() => {
    if (!ownerAuthoringEnabled || libraryStatus !== 'idle') return;
    void loadLibrary();
  }, [libraryStatus, loadLibrary, ownerAuthoringEnabled, workspace.profileAddress]);
  const signalSettings = useSignalStore((state) => state.settings);
  const replaceSignalSettings = useSignalStore((state) => state.replaceSettings);
  const viewedProfileAddress = requestedViewedProfileAddress || workspace.profileAddress;
  const profileIdentity = useProfileIdentity(viewedProfileAddress);
  const viewedProfile = useMemo(
    () => getIdentityProfileViewModel(profileIdentity, { walletConnected: visitorWalletConnected }),
    [profileIdentity, visitorWalletConnected]
  );
  const documentProfileAddress = normalizeProfileAddress(workspace.profileAddress);
  const snapshot = useProfileDocumentStore((state) => state.profileAddress === documentProfileAddress ? state.snapshot : null);
  const importedDocument = useProfileDocumentStore((state) => state.profileAddress === documentProfileAddress ? state.imported : null);
  const previewDocument = useProfileDocumentStore((state) => state.profileAddress === documentProfileAddress ? state.preview : null);
  const installSnapshot = useProfileDocumentStore((state) => state.installSnapshot);
  const installImported = useProfileDocumentStore((state) => state.installImported);
  const enterPreview = useProfileDocumentStore((state) => state.enterPreview);
  const exitPreview = useProfileDocumentStore((state) => state.exitPreview);
  const setDocumentError = useProfileDocumentStore((state) => state.setError);
  const documentError = useProfileDocumentStore((state) => state.profileAddress === documentProfileAddress ? state.error : null);
  const setFolderPublic = useLibraryStore((state) => state.setFolderPublic);
  const renameFolder = useLibraryStore((state) => state.renameFolder);
  const createCanvasObject = useLibraryStore((state) => state.createCanvasObject);
  const setCanvasObjectGeometry = useLibraryStore((state) => state.setCanvasObjectGeometry);
  const setCanvasObjectLocked = useLibraryStore((state) => state.setCanvasObjectLocked);
  const setAllCanvasObjectsLocked = useLibraryStore((state) => state.setAllCanvasObjectsLocked);
  const setCanvasObjectPresentation = useLibraryStore((state) => state.setCanvasObjectPresentation);
  const replaceCanvasObjectAsset = useLibraryStore((state) => state.replaceCanvasObjectAsset);
  const setCanvasObjectVisitorVisibility = useLibraryStore((state) => state.setCanvasObjectVisitorVisibility);
  const reorderCanvasObject = useLibraryStore((state) => state.reorderCanvasObject);
  const removeCanvasObject = useLibraryStore((state) => state.removeCanvasObject);
  const liveCanvasContent = useMemo(
    () => selectLiveCanvasContent(workspace, ownerAuthoringEnabled),
    [ownerAuthoringEnabled, workspace]
  );
  const canvasObjects = liveCanvasContent.objects;
  const libraryAssetById = useMemo(() => new Map(libraryAssets.map((asset) => [asset.id, asset])), [libraryAssets]);
  const navigationCategories = useMemo(() => {
    const folders = workspace.folders.map((folder) => ({
      id: `library:folder:${folder.id}`,
      label: folder.name,
      public: folder.public === true,
      assets: folder.assetIds.map((id) => libraryAssetById.get(id)).filter(Boolean)
    }));
    return folders;
  }, [libraryAssetById, workspace.folders]);
  const placementGeometry = useMemo(() => createHomePlacementGeometry(geometry), [geometry]);
  const {
    actions: runtimeWindowActions,
    identityPhase,
    open: runtimeWindowOpen,
    runtimeWindows
  } = useRuntimeWindowOrchestration({
    loadSystemPresentation: readSystemPresentation,
    placementGeometry,
    profileAddress: workspace.profileAddress,
    saveSystemPresentation,
    setSystemPresentation,
    systemPresentation
  });
  const identityOpen = runtimeWindowOpen.identity;
  const collectionOpen = runtimeWindowOpen.collection;
  const creationsOpen = runtimeWindowOpen.creations;
  const signalsOpen = runtimeWindowOpen.signals;
  const closeAllWindows = runtimeWindowActions.closeAllWindows;
  const prepareSpatialLevel = useCallback(() => {
    closeAllWindows();
    setEditMode(false);
    setSelectedSceneId(null);
    setSelectedCanvasObjectId(null);
    setArtworkInspector(null);
    setContextMenu(null);
    setActiveHudCommand(null);
  }, [closeAllWindows]);
  const homeWorld = useMemo(() => createVerticalHomeWorld(geometry), [geometry]);
  const homeOrigin = useMemo(() => ({ x:geometry.width, y:geometry.height, zoom:1 }), [geometry.height,geometry.width]);
  const {
    enterGallery, enterUpper, exitGallery, exitUpper,
    galleryGridBasePhaseX, galleryGridOffsetY, galleryOpen, galleryTransitionPhase, galleryWorldMounted,
    homeCamera, homeCameraRef, homeGridPhaseX, homeWorldMounted, homeWorldTransitionPhase,
    setGalleryCameraX, setHomeCameraImmediately, spatialLevel, spatialLevelTransitioning,
    upperGridOffsetY, upperOpen, upperTransitionPhase, upperWorldMounted
  } = useSpatialWorldNavigation({
    canvasObjects,
    geometry,
    homeOrigin,
    homeWorld,
    libraryAssetById,
    libraryStatus,
    loadLibrary,
    onGalleryOpenChange,
    ownerAuthoringEnabled,
    prepareSpatialLevel,
    profileAddress: workspace.profileAddress,
    reducedMotion: revealPresentation.reducedMotion
  });
  const homeZoom = 1;
  const worldContentX = Math.round((geometry.width + geometry.left) / 40) * 40;
  const worldContentY = Math.round((geometry.height + geometry.top) / 40) * 40;
  const homeWorldTransform = geometry.narrow ? 'none' : `translate3d(${(worldContentX-homeCamera.x)*homeZoom}px,${(worldContentY-homeCamera.y)*homeZoom}px,0) scale(${homeZoom})`;
  useEffect(() => {
    if (ownerAuthoringEnabled) return;
    setEditMode(false);
    setSelectedSceneId(null);
    setSelectedCanvasObjectId(null);
    setArtworkInspector(null);
    setArtworkChooser(null);
    setContextMenu(null);
    setActiveHudCommand((command) => command === 'share' ? null : command);
  }, [ownerAuthoringEnabled]);
  const sceneItems = useMemo(() => {
    const items=[];
    MODULES.forEach(({id},index)=>{ const presentation=systemPresentation[id] || defaultSystemPresentation(id,index); const span=normalizeSpan(presentation.span,presentation.appearanceMode,geometry); const requested=positions[id] || getDefaultModulePositions(geometry)[id]; const position=isScenePlacementAvailable(id,requested,span,items,placementGeometry)?requested:findScenePlacement(id,requested,span,items,placementGeometry); const itemGeometry={column:position.column,row:position.row,columnSpan:span.columns,rowSpan:span.rows}; items.push({id,position,span,geometry:itemGeometry,...presentation,presentationOrder:index}); });
    return geometry.narrow ? packCompactScene(items,geometry) : items;
  },[geometry,placementGeometry,positions,systemPresentation]);
  const spatialSceneItems = useMemo(() => sceneItems.filter((item) => !Object.hasOwn(MODULE_ENTRY_ORDER,item.id)), [sceneItems]);
  const canvasPositions = useMemo(() => Object.fromEntries(sceneItems.map((item)=>[item.id,item.position])),[sceneItems]);
  const sceneById = useMemo(() => Object.fromEntries(sceneItems.map((item) => [item.id, item])), [sceneItems]);
  const canvasObjectScenes = useMemo(() => {
    const items=canvasObjects.map((object)=>{const definition=getCanvasObjectDefinition(object.kind);const rect=normalizeGridRect({column:object.placement.column,row:object.placement.row,columnSpan:object.span.columns,rowSpan:object.span.rows},placementGeometry,{minimumSpan:definition.minimumSpan});return {...object,geometry:rect,position:{column:rect.column,row:rect.row},span:{columns:rect.columnSpan,rows:rect.rowSpan}};});
    const responsive=geometry.narrow?packCompactCanvasObjects(items,geometry):items;
    return Object.fromEntries(responsive.map((item) => [item.id, item]));
  },[canvasObjects,geometry,placementGeometry]);
  const canvasObjectById = useMemo(() => Object.fromEntries(canvasObjects.map((object)=>[object.id,object])),[canvasObjects]);
  const draftDocument = useMemo(() => buildProfileDocumentV3({
    profileAddress: workspace.profileAddress, workspace, assets: libraryAssets,
    publicPresentation: { keeperId: activeActorId, stageId, environment, avatarShape, visitorNavigation },
    signalSettings, profileIdentity, modulePositions: positions, systemPresentation, createdAt: 0, exportedAt: 0
  }), [activeActorId, avatarShape, environment, libraryAssets, positions, profileIdentity, signalSettings, stageId, systemPresentation, visitorNavigation, workspace]);
  const {
    draftFingerprint,
    draftSaveStatus,
    getPublicationContext,
    handlePublicationConfirmed
  } = useOwnerPublicationSync({
    activeActorId,
    avatarShape,
    draftDocument,
    effectivePublishedResolution: publishedResolution,
    environment,
    geometry,
    getWalletPublicationContext,
    onApplyRestoredPresentation,
    onPublicationConfirmed,
    ownerAuthoringEnabled,
    positions,
    publicationProfileAddress: workspaceProfileAddress,
    replaceSignalSettings,
    replaceWorkspace,
    saveSystemPresentation,
    setAvatarShape,
    setPositions,
    setSystemPresentation,
    setVisitorNavigation,
    signalSettings,
    stageId,
    systemPresentation,
    visitorNavigation,
    viewedProfileAddress,
    workspace,
    workspaceRecordRef
  });
  const snapshotStale = Boolean(snapshot && useProfileDocumentStore.getState().profileAddress === documentProfileAddress
    && useProfileDocumentStore.getState().snapshotDraftFingerprint !== draftFingerprint);

  useEffect(() => {
    if (snapshot) return;
    const stored = loadProfileSnapshot(window.localStorage, workspace.profileAddress);
    if (stored) installSnapshot(stored, profileDocumentContentFingerprint(stored));
  }, [installSnapshot, snapshot, workspace.profileAddress]);

  const buildSnapshot = useCallback(() => {
    if (!ownerAuthoringEnabled) return;
    try {
      const now = Date.now();
      const document = buildProfileDocumentV3({ profileAddress: workspace.profileAddress, workspace, assets: libraryAssets,
        publicPresentation: { keeperId: activeActorId, stageId, environment, avatarShape, visitorNavigation }, signalSettings, profileIdentity,
        modulePositions: positions, systemPresentation, revision: (snapshot?.revision || 0) + 1, createdAt: snapshot?.createdAt || now, exportedAt: now });
      const valid = assertValidProfileDocument(document); installSnapshot(valid, profileDocumentContentFingerprint(valid));
      saveProfileSnapshot(window.localStorage, valid); setDocumentError(null);
    } catch (error) { setDocumentError(error.message); }
  }, [activeActorId, avatarShape, environment, installSnapshot, libraryAssets, ownerAuthoringEnabled, positions, profileIdentity, setDocumentError, signalSettings, snapshot, stageId, systemPresentation, visitorNavigation, workspace]);

  const startPreview = useCallback((source) => {
    enterPreview(source, source === 'draft' ? draftDocument : undefined);
    setActiveHudCommand(null);
  }, [draftDocument, enterPreview]);
  const stopPreview = useCallback(() => { exitPreview(); onPreviewDocumentChange?.(null); }, [exitPreview, onPreviewDocumentChange]);
  useEffect(() => { onPreviewDocumentChange?.(previewDocument); }, [onPreviewDocumentChange, previewDocument]);

  const restoreImportedPresentation = useCallback(() => {
    if (!ownerAuthoringEnabled) return;
    if (!importedDocument || !window.confirm('Restore this document’s public presentation? Private Favorites, unpinned folders, Activity history, and caches will be preserved.')) return;
    const previousWorkspace = structuredClone(workspace); const previousSettings = { ...signalSettings };
    const previousPresentation = { keeperId: activeActorId, stageId, environment, avatarShape, visitorNavigation }; const key = profilePresentationKey(workspace.profileAddress);
    let previousStoredPresentation; let previousPresentationRead = false; let restoreStarted = false;
    try {
      previousStoredPresentation = window.localStorage.getItem(key);
      previousPresentationRead = true;
      const plan = createProfileDocumentRestorePlan(importedDocument, workspace);
      restoreStarted = true;
      if (!replaceWorkspace(plan.workspace)) throw new Error('Could not persist restored Canvas Spaces');
      if (!replaceSignalSettings(plan.signalSettings)) throw new Error('Could not persist restored Activity settings');
      if (!saveRestoredPresentation(window.localStorage, workspace.profileAddress, { keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment, avatarShape: plan.avatarShape, visitorNavigation: plan.visitorNavigation })) throw new Error('Could not persist restored profile presentation');
      setAvatarShape(plan.avatarShape);
      setVisitorNavigation(plan.visitorNavigation);
      onApplyRestoredPresentation?.({ keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment }); setDocumentError(null);
    } catch (error) {
      if (restoreStarted) {
        try { if (!replaceWorkspace(previousWorkspace)) replaceWorkspace(previousWorkspace, { persist: false }); } catch { /* Best-effort rollback. */ }
        try { if (!replaceSignalSettings(previousSettings)) replaceSignalSettings(previousSettings, { persist: false }); } catch { /* Best-effort rollback. */ }
        if (previousPresentationRead) {
          try { if (previousStoredPresentation == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, previousStoredPresentation); } catch { /* Best-effort rollback. */ }
        }
        setAvatarShape(previousPresentation.avatarShape);
        setVisitorNavigation(previousPresentation.visitorNavigation);
        try { onApplyRestoredPresentation?.(previousPresentation); } catch { /* Best-effort rollback. */ }
      }
      setDocumentError(error instanceof Error ? error.message : String(error));
    }
  }, [activeActorId, avatarShape, environment, importedDocument, onApplyRestoredPresentation, ownerAuthoringEnabled, replaceSignalSettings, replaceWorkspace, setDocumentError, signalSettings, stageId, visitorNavigation, workspace]);

  useEffect(() => {
    const resize = () => {
      if (resizeFrameRef.current) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = 0;
        const nextGeometry = createModuleGridGeometry(window.innerWidth, window.innerHeight);
        setGeometry(nextGeometry);
      });
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      if (resizeFrameRef.current) window.cancelAnimationFrame(resizeFrameRef.current);
    };
  }, []);

  useEffect(() => {
    residentHandoff?.trackActorPosition?.([gridRef.current, shellRef.current]);
    return () => residentHandoff?.trackActorPosition?.(null);
  }, [residentHandoff]);

  const openGalleryContextMenu = useCallback((event, target) => {
    if (!ownerAuthoringEnabled || !target) return;
    event.preventDefault();
    setContextMenu({
      target,
      menu: 'root',
      galleryPlacement: target.placement || null,
      anchor: { x: event.clientX, y: event.clientY },
      returnFocus: event.target.closest?.('button,[tabindex]') || null
    });
  }, [ownerAuthoringEnabled]);

  const toggleGrid = useCallback(() => setGridVisible((value) => { const next=!value; try { window.localStorage.setItem(GRID_PREFERENCE_KEY,JSON.stringify({version:1,visible:next})); } catch {} return next; }), []);

  const handleWorldWheel = useCallback((event) => {
    if (geometry.narrow) return;
    if (event.target.closest?.('.module-shell--expanded,.artwork-inspector,.canvas-artwork-preview,.desktop-menu')) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey || event.deltaY === 0) return;
    const camera = homeCameraRef.current;
    setHomeCameraImmediately({ ...camera, y: camera.y + event.deltaY });
  }, [geometry.narrow, setHomeCameraImmediately]);

  const openCollectionSearch = useCallback(() => {
    setProfileDiscoveryOpen(true);
    setActiveHudCommand('search');
  }, []);

  const openArtworkInspector = useCallback((id, preferredAnchor) => {
    if (!ownerAuthoringEnabled) return;
    const rect=canvasObjectRefs.current.get(id)?.getBoundingClientRect(); const width=Math.min(300,window.innerWidth-24);
    const anchor=preferredAnchor || (rect ? {x:rect.right+10+width<=window.innerWidth-12?rect.right+10:Math.max(12,rect.left-width-10),y:Math.max(12,Math.min(rect.top,window.innerHeight-520))}:{x:Math.max(12,(window.innerWidth-width)/2),y:72});
    setArtworkInspector({id,anchor}); setSelectedCanvasObjectId(id); setSelectedSceneId(null);
  },[ownerAuthoringEnabled]);

  const beginArtworkChoice = useCallback((mode,targetId=null) => {
    if (!ownerAuthoringEnabled) return;
    artworkChoicePendingRef.current=false;
    const definition=getCanvasObjectDefinition(CANVAS_OBJECT_KIND.FRAMED_ARTWORK); const bounds=gridRef.current?.getBoundingClientRect(); const anchor=contextMenu?.anchor || {x:window.innerWidth/2,y:window.innerHeight/2};
    const span={columns:Math.min(definition.defaultSpan.columns,placementGeometry.columns),rows:Math.min(definition.defaultSpan.rows,placementGeometry.rows)};
    const occupied=[...spatialSceneItems,...Object.values(canvasObjectScenes).map((object)=>({id:object.id,position:object.position,span:object.span}))];
    const placement=bounds?findScenePlacementAtPointer({id:'canvas:artwork:pending',pointer:anchor,gridClientRect:bounds,zoom:homeZoom,span,items:occupied,geometry:placementGeometry}):findScenePlacement('canvas:artwork:pending',{column:0,row:2},span,occupied,placementGeometry);
    setArtworkChooser({mode,targetId,placement,anchor}); setContextMenu(null); if(libraryStatus==='idle')loadLibrary();
  },[canvasObjectScenes,contextMenu,geometry,homeZoom,libraryStatus,loadLibrary,ownerAuthoringEnabled,placementGeometry,spatialSceneItems]);

  const beginGalleryArtworkChoice = useCallback(() => {
    if (!ownerAuthoringEnabled || contextMenu?.target?.type !== 'gallery-canvas' || !contextMenu.galleryPlacement) return;
    artworkChoicePendingRef.current = false;
    setArtworkChooser({ mode: 'gallery-create', placement: contextMenu.galleryPlacement, anchor: contextMenu.anchor });
    setContextMenu(null);
    if (libraryStatus === 'idle') loadLibrary();
  }, [contextMenu, libraryStatus, loadLibrary, ownerAuthoringEnabled]);

  const chooseArtwork = useCallback((asset) => {
    if (!ownerAuthoringEnabled) return;
    if(!artworkChooser||artworkChoicePendingRef.current)return; artworkChoicePendingRef.current=true;
    if(artworkChooser.mode==='replace'&&artworkChooser.targetId){replaceCanvasObjectAsset(artworkChooser.targetId,asset.id);setArtworkChooser(null);setSelectedCanvasObjectId(artworkChooser.targetId);return;}
    const ratio = asset.imageWidth && asset.imageHeight ? asset.imageWidth / asset.imageHeight : null;
    const span = artworkChooser.mode === 'gallery-create' ? gallerySpanForAspectRatio(ratio) : undefined;
    const id=createCanvasObject({kind:CANVAS_OBJECT_KIND.FRAMED_ARTWORK,stableAssetId:asset.id,placement:artworkChooser.placement,span,locked:false});
    setArtworkChooser(null);
    if(id && artworkChooser.mode === 'gallery-create') setSelectedCanvasObjectId(id);
    else if(id) openArtworkInspector(id,artworkChooser.anchor);
  },[artworkChooser,createCanvasObject,openArtworkInspector,ownerAuthoringEnabled,replaceCanvasObjectAsset]);

  const openArtworkPreview = useCallback((id)=>{setPreviewObjectId(id);setArtworkInspector(null);setSelectedCanvasObjectId(null);},[]);
  const closeArtworkPreview = useCallback(()=>{const id=previewObjectId;setPreviewObjectId(null);window.requestAnimationFrame(()=>canvasObjectRefs.current.get(id)?.querySelector('button')?.focus());},[previewObjectId]);
  const requestGalleryArtworkRemoval = useCallback((id) => {
    const object = canvasObjectById[id];
    if (!object) return;
    const asset = libraryAssets.find((entry) => entry.id === object.stableAssetId);
    setContextMenu(null);
    setArtworkInspector(null);
    setSelectedCanvasObjectId(null);
    setGalleryRemovalPending({ id, name: asset?.name || 'Untitled artwork' });
  }, [canvasObjectById, libraryAssets]);
  const confirmGalleryArtworkRemoval = useCallback(() => {
    if (!galleryRemovalPending) return;
    removeCanvasObject(galleryRemovalPending.id);
    setGalleryRemovalPending(null);
  }, [galleryRemovalPending, removeCanvasObject]);

  useEffect(()=>{
    if(!previewObjectId)return undefined;
    const close=(event)=>{if(event.key==='Escape'){event.preventDefault();closeArtworkPreview();}};
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[closeArtworkPreview,previewObjectId]);

  const executeContextCommand = useCallback((command) => {
    const target = contextMenu?.target; if (!target) return;
    if (AUTHORING_CONTEXT_COMMANDS.has(command) && !ownerAuthoringEnabled) {
      setContextMenu(null);
      return;
    }
    const runtimeId = target.id?.endsWith('-panel') ? target.id.replace('-panel','') : target.id;
    const presentationPatch = presentationPatchForCommand(command, canvasObjectById[target.id]?.presentation);
    if (command === 'menu-view') { setContextMenu((current) => ({ ...current, menu: 'view' })); return; }
    if (command === 'menu-layer') { setContextMenu((current) => ({ ...current, menu: 'layer' })); return; }
    if (command === 'menu-appearance') { setContextMenu((current) => ({ ...current, menu: 'appearance' })); return; }
    if (command === 'menu-presentation') { setContextMenu((current) => ({ ...current, menu: 'presentation' })); return; }
    if (command === 'menu-image-fit') { setContextMenu((current) => ({ ...current, menu: 'image-fit' })); return; }
    if (command === 'menu-frame') { setContextMenu((current) => ({ ...current, menu: 'frame' })); return; }
    if (command === 'menu-mat') { setContextMenu((current) => ({ ...current, menu: 'mat' })); return; }
    if (command === 'menu-background') { setContextMenu((current) => ({ ...current, menu: 'background' })); return; }
    if (command === 'menu-root') { setContextMenu((current) => ({ ...current, menu: 'root' })); return; }
    if (command === 'preview-as-visitor') { setContextMenu(null); startPreview('draft'); return; }
    if (command === 'create-framed-artwork') { beginArtworkChoice('create'); return; }
    else if (command === 'add-gallery-artwork') { beginGalleryArtworkChoice(); return; }
    else if (command === 'toggle-keeper') onKeeperVisibilityChange?.(!keeperVisible);
    else if (command === 'toggle-stage') onStageVisibilityChange?.(!stageVisible);
    else if (command === 'toggle-edit') setEditMode((value) => !value);
    else if (command === 'toggle-grid') toggleGrid();
    else if (command === 'reset-home-camera') setHomeCameraImmediately(homeOrigin);
    else if (command === 'reset-windows') runtimeWindowActions.resetWindows();
    else if (command === 'close-all') closeAllWindows();
    else if (command === 'open') runtimeWindowActions.toggleWindow(target.id);
    else if (command === 'open-artwork') openArtworkPreview(target.id);
    else if (command === 'toggle-artwork-lock' && canvasObjectById[target.id]) {
      const locked = !canvasObjectById[target.id].locked;
      setCanvasObjectLocked(target.id, locked);
      setSelectedCanvasObjectId(locked ? null : target.id);
    }
    else if (command === 'lock-all-artwork') { setAllCanvasObjectsLocked(true); setSelectedCanvasObjectId(null); setArtworkInspector(null); }
    else if (command === 'unlock-all-artwork') setAllCanvasObjectsLocked(false);
    else if (presentationPatch) setCanvasObjectPresentation(target.id, presentationPatch);
    else if (command === 'edit-artwork') openArtworkInspector(target.id);
    else if (command === 'replace-artwork') { beginArtworkChoice('replace',target.id); return; }
    else if (command === 'toggle-object-visibility' && canvasObjectById[target.id]) setCanvasObjectVisitorVisibility(target.id,!canvasObjectById[target.id].visitorVisible);
    else if (command === 'object-forward') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.FORWARD);
    else if (command === 'object-backward') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.BACKWARD);
    else if (command === 'object-front') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.FRONT);
    else if (command === 'object-back') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.BACK);
    else if (command === 'remove-artwork' && target.type === 'gallery-object') { requestGalleryArtworkRemoval(target.id); return; }
    else if (command === 'remove-artwork' && window.confirm('Remove this artwork from the canvas? The owned asset will remain in your library.')) { removeCanvasObject(target.id); setArtworkInspector(null); setSelectedCanvasObjectId(null); }
    else if (command === 'close') runtimeWindowActions.toggleWindow(runtimeId);
    else if (command === 'reset-window') runtimeWindowActions.resetWindow(runtimeId);
    else if (command === 'toggle-start-open') {
      runtimeWindowActions.toggleStartOpen(runtimeId, defaultWindowGridRect(runtimeId, geometry, canvasPositions[runtimeId]));
    }
    setContextMenu(null);
  }, [beginArtworkChoice, beginGalleryArtworkChoice, canvasObjectById, canvasPositions, closeAllWindows, contextMenu, geometry, homeOrigin, keeperVisible, onKeeperVisibilityChange, onStageVisibilityChange, openArtworkInspector, openArtworkPreview, ownerAuthoringEnabled, removeCanvasObject, reorderCanvasObject, requestGalleryArtworkRemoval, runtimeWindowActions, setAllCanvasObjectsLocked, setCanvasObjectLocked, setCanvasObjectPresentation, setCanvasObjectVisitorVisibility, setHomeCameraImmediately, stageVisible, startPreview, toggleGrid]);

  useEffect(() => {
    if (!contextMenu) return;
    const exists = ['canvas', 'gallery-canvas'].includes(contextMenu.target.type) || sceneById[contextMenu.target.id] || canvasObjectById[contextMenu.target.id] || runtimeWindows.openIds.includes(contextMenu.target.id.replace?.('-panel','')) || contextMenu.target.id.startsWith?.('folder-panel:');
    if (!exists) setContextMenu(null);
  }, [canvasObjectById, contextMenu, runtimeWindows.openIds, sceneById]);

  if (previewDocument) return <ProfileDocumentPreview document={previewDocument} onExit={stopPreview} onMoveKeeper={residentHandoff?.moveToScreenPosition} onMoveKeeperHorizontally={residentHandoff?.moveHorizontallyToScreenPosition} />;

  const spatialLayerTarget = typeof document === 'undefined' ? null : document.querySelector('.application-root');

  return (
    <main
      className="public-shell"
      data-application-mode="public"
      data-identity-open={identityOpen || undefined}
      data-actor-id={activeActorId}
      data-spatial-theme={gridPalette}
      data-layout-mode={geometry.narrow ? 'narrow' : 'desktop'}
      data-interface-visible={interfaceVisible || undefined}
      data-entry-sequence={revealPresentation.sequence}
      data-reduced-motion={revealPresentation.reducedMotion || undefined}
      data-edit-mode={editMode || undefined}
      data-gallery-open={galleryOpen || undefined}
      data-upper-open={upperOpen || undefined}
      style={shellTheme}
      aria-label="INSCAPE public world"
      ref={shellRef}
      onContextMenu={(event) => openTargetContextMenu(event, shellRef.current)}
    >
      {interfaceVisible && <ProfileNavigationDock
        profile={viewedProfile}
        avatarShape={avatarShape}
        profileExpanded={identityOpen}
        onProfileExpandedChange={(expanded) => runtimeWindowActions.setWindowOpen('identity', expanded)}
        categories={navigationCategories}
        assetStatus={libraryStatus}
        onCategoriesOpenChange={(expanded) => {
          if (expanded && libraryStatus === 'idle') loadLibrary();
        }}
        creations={{
          profileAddress: viewedProfileAddress,
          open: creationsOpen,
          onOpenChange: (expanded) => runtimeWindowActions.setWindowOpen('creations', expanded)
        }}
        activity={{
          profileAddress: viewedProfileAddress,
          open: signalsOpen,
          onOpenChange: (expanded) => runtimeWindowActions.setWindowOpen('signals', expanded)
        }}
        gallery={upperOpen ? null : {
          open: galleryOpen,
          onOpenChange: (expanded) => expanded ? enterGallery() : exitGallery()
        }}
        spatialWorldActive={upperOpen}
        ownerIndex={ownerAuthoringEnabled ? {
          open: collectionOpen,
          onToggleCategoryPublic: (category) => {
            const folderId = category.id.startsWith('library:folder:') ? category.id.slice('library:folder:'.length) : null;
            if (folderId) setFolderPublic(folderId, !category.public);
          },
          onRenameCategory: (category) => {
            const folderId = category.id.startsWith('library:folder:') ? category.id.slice('library:folder:'.length) : null;
            const folder = workspace.folders.find((entry) => entry.id === folderId);
            if (folder) setCategoryPendingRename(folder);
          },
          onOpenChange: (expanded) => {
            if (expanded && libraryStatus === 'idle') loadLibrary();
            runtimeWindowActions.setWindowOpen('collection', expanded);
          }
        } : null}
        onDiscover={openCollectionSearch}
        ownerTools={ownerAuthoringEnabled ? {
          onPublish: () => setActiveHudCommand('share'),
          onAtelier: () => onRequestAtelier?.(),
          gridPalette,
          onGridPaletteChange: setGridPalette,
          avatarShape,
          onAvatarShapeChange: setAvatarShape,
          visitorNavigation,
          onVisitorNavigationChange: (key, value) => setVisitorNavigation((current) => ({ ...current, [key]: value }))
        } : null}
      />}
      {interfaceVisible && <SpatialLevelNavigation
        level={spatialLevel}
        disabled={spatialLevelTransitioning}
        arranging={ownerAuthoringEnabled && editMode && spatialLevel === SPATIAL_WORLD_LEVEL.HOME}
        onUp={spatialLevel === SPATIAL_WORLD_LEVEL.GALLERY ? exitGallery : enterUpper}
        onDown={spatialLevel === SPATIAL_WORLD_LEVEL.UPPER ? exitUpper : enterGallery}
        onFinishArranging={() => {
          setEditMode(false);
          setSelectedSceneId(null);
        }}
      />}
      <div className="system-signature" aria-hidden="true"><strong>INSCAPE</strong><span>LUKSO MAINNET</span><i /> <span>LIVE</span></div>
      {!galleryOpen && !upperOpen && keeperVisible && <KeeperDock actorId={activeActorId} residentHandoff={residentHandoff} reducedMotion={revealPresentation.reducedMotion} spatialTheme={gridPalette} onDockStateChange={setKeeperDockActive} />}

      {homeWorldMounted && <HomeWorldSurface
        camera={homeCamera}
        geometry={geometry}
        world={homeWorld}
        gridVisible={gridVisible}
        theme={shellTheme}
        spatialTheme={gridPalette}
        visible={interfaceVisible}
        onCameraChange={setHomeCameraImmediately}
        onMoveKeeper={moveKeeperFromHome}
        onOpenContextMenu={openWorldContextMenu}
        transitionPhase={homeWorldTransitionPhase}
        gridPhaseX={homeGridPhaseX}
      />}

      <section
        className="module-grid"
        aria-label="Modules"
        ref={gridRef}
        data-desktop-canvas
        style={{
          left: 0,
          top: 0,
          width: geometry.usableWidth,
          height: geometry.usableHeight,
          transform: homeWorldTransform,
          transformOrigin: '0 0',
          '--grid-cell-width': `${geometry.cellWidth}px`,
          '--grid-cell-height': `${geometry.cellHeight}px`,
          '--grid-left': `${geometry.left}px`,
          '--grid-top': `${geometry.top}px`
        }}
        onWheel={handleWorldWheel}
      >
        {!galleryOpen && !upperOpen && spatialLayerTarget && createPortal(<div
          ref={spatialLayerRef}
          className="module-grid__spatial-layer"
          data-desktop-canvas
          data-edit-mode={editMode || undefined}
          data-entry-sequence={revealPresentation.sequence}
          data-visible={interfaceVisible || undefined}
          data-spatial-theme={gridPalette}
          style={{
            ...shellTheme,
            left: 0,
            top: 0,
            width: geometry.usableWidth,
            height: geometry.usableHeight,
            transform: homeWorldTransform,
            transformOrigin: '0 0'
          }}
          onContextMenu={(event) => openTargetContextMenu(event, spatialLayerRef.current)}
        >
        {/* Framed artwork now belongs to the Gallery wall. Keeping it out of the
            Home layer prevents one authored object from appearing in two rooms. */}
        </div>, spatialLayerTarget)}

      </section>
      {galleryWorldMounted && <GalleryWorld
        objects={canvasObjects}
        assets={libraryAssets}
        assetStatus={libraryStatus}
        theme={shellTheme}
        spatialTheme={gridPalette}
        ownerAuthoringEnabled={ownerAuthoringEnabled}
        selectedArtworkId={selectedCanvasObjectId}
        presentationPreview={contextMenu?.target?.type === 'gallery-object' ? galleryPresentationPreview : null}
        onOpenArtwork={openArtworkPreview}
        onSelectArtwork={setSelectedCanvasObjectId}
        onOpenContextMenu={openGalleryContextMenu}
        onChangeArtworkGeometry={(id, rect) => runOwnerAuthoringMutation(ownerAuthoringEnabled, () => setCanvasObjectGeometry(id, rect))}
        onRemoveArtwork={requestGalleryArtworkRemoval}
        onRegisterArtworkElement={(id, node) => { if (node) canvasObjectRefs.current.set(id, node); else canvasObjectRefs.current.delete(id); }}
        onExit={exitGallery}
        transitionPhase={galleryTransitionPhase}
        gridPhaseX={galleryGridBasePhaseX}
        gridOffsetY={galleryGridOffsetY}
        onCameraXChange={setGalleryCameraX}
        onMoveKeeper={(clientX, clientY) => residentHandoff?.moveToScreenPosition?.(clientX, clientY)}
        onMoveKeeperHorizontally={(clientX, direction) => residentHandoff?.moveHorizontallyToScreenPosition?.(clientX, direction)}
      />}
      {upperWorldMounted && <UpperWorldSurface
        theme={shellTheme}
        spatialTheme={gridPalette}
        gridPhaseX={homeGridPhaseX}
        gridOffsetY={upperGridOffsetY}
        transitionPhase={upperTransitionPhase}
        onMoveKeeper={(clientX, clientY) => residentHandoff?.moveToScreenPosition?.(clientX, clientY)}
      />}
      {ownerAuthoringEnabled && <>
      {artworkInspector && canvasObjectById[artworkInspector.id] && (()=>{const object=canvasObjectById[artworkInspector.id];const asset=libraryAssets.find((entry)=>entry.id===object.stableAssetId);const definition=getCanvasObjectDefinition(object.kind);return <ArtworkInspector object={object} assetName={asset?.name||'Unavailable artwork'} anchor={artworkInspector.anchor} onClose={()=>{setArtworkInspector(null);setSelectedCanvasObjectId(null);canvasObjectRefs.current.get(object.id)?.querySelector('button')?.focus();}} onPresentation={(patch)=>setCanvasObjectPresentation(object.id,patch)} onGeometry={(span)=>{const columns=Math.max(definition.minimumSpan.columns,Math.min(definition.maximumSpan.columns,Math.round(span.columns)||object.span.columns));const rows=Math.max(definition.minimumSpan.rows,Math.min(definition.maximumSpan.rows,Math.round(span.rows)||object.span.rows));setCanvasObjectGeometry(object.id,{column:object.placement.column,row:object.placement.row,columnSpan:columns,rowSpan:rows});}} onVisibility={()=>setCanvasObjectVisitorVisibility(object.id,!object.visitorVisible)} onReplace={()=>beginArtworkChoice('replace',object.id)} onReorder={(command)=>reorderCanvasObject(object.id,command)} onRemove={()=>requestGalleryArtworkRemoval(object.id)} />;})()}
      </>}
      {contextMenu && (()=>{const runtimeId=contextMenu.target.id?.replace?.('-panel',''); const canvasObject=canvasObjectById[contextMenu.target.id]; const commandContext={target:contextMenu.target,editMode,canvasObject,canvasObjects,startOpen:systemPresentation[runtimeId]?.startOpen,keeperVisible,stageVisible,stageAvailable:false,ownerAuthoringEnabled}; const galleryCascade=contextMenu.target.type==='gallery-object'; const galleryMenu=contextMenu.target.type==='gallery-object'||contextMenu.target.type==='gallery-canvas'; return <DesktopMenu key={`${contextMenu.target.type}:${contextMenu.menu}`} className={galleryMenu?'gallery-context-menu':'home-context-menu'} anchor={contextMenu.anchor} label={`${contextMenu.target.type} commands`} commands={contextMenuCommands({...commandContext,menu:contextMenu.menu})} getSubmenuCommands={(command)=>command.startsWith('menu-')?contextMenuCommands({...commandContext,menu:command.slice(5)}):[]} onPreviewCommand={galleryCascade?(command)=>{const patch=command?presentationPatchForCommand(command,canvasObject?.presentation):null;setGalleryPresentationPreview(patch?{id:contextMenu.target.id,patch}:null);}:undefined} onCommand={(command)=>{setGalleryPresentationPreview(null);executeContextCommand(command);}} onClose={()=>{setGalleryPresentationPreview(null);setContextMenu(null);}} returnFocus={contextMenu.returnFocus}/>;})()}
      {galleryRemovalPending && <div className="gallery-remove-dialog" role="alertdialog" aria-modal="true" aria-labelledby="gallery-remove-title" aria-describedby="gallery-remove-copy" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setGalleryRemovalPending(null); } }}>
        <div className="gallery-remove-dialog__panel">
          <span>GALLERY / REMOVE ARTWORK</span>
          <h2 id="gallery-remove-title">REMOVE {galleryRemovalPending.name}</h2>
          <p id="gallery-remove-copy">THE ARTWORK WILL BE REMOVED FROM THIS GALLERY. THE OWNED ASSET REMAINS IN YOUR INDEX.</p>
          <div><button type="button" autoFocus onClick={() => setGalleryRemovalPending(null)}>CANCEL</button><button type="button" data-danger onClick={confirmGalleryArtworkRemoval}>REMOVE ARTWORK</button></div>
        </div>
      </div>}
      <CategoryRenameDialog
        category={categoryPendingRename}
        onClose={() => setCategoryPendingRename(null)}
        onRename={(name) => {
          renameFolder(categoryPendingRename.id, name);
          setCategoryPendingRename(null);
        }}
      />
      {ownerAuthoringEnabled && <KeeperSignalsLayer
        interfaceReady={interfaceVisible}
        residentHandoffActive={identityPhase !== 'closed' || keeperDockActive}
        reducedMotion={revealPresentation.reducedMotion}
        reactionBridge={keeperReactions}
      />}
      {ownerAuthoringEnabled && activeHudCommand === 'share' && <ProfileDocumentPanel
        draft={draftDocument}
        draftSaveStatus={draftSaveStatus}
        snapshot={snapshot}
        imported={importedDocument}
        stale={snapshotStale}
        error={documentError}
        activeProfileAddress={workspace.profileAddress}
        getPublicationContext={getPublicationContext}
        onBuild={buildSnapshot}
        onPreview={startPreview}
        onImport={installImported}
        onRestore={restoreImportedPresentation}
        onPublished={handlePublicationConfirmed}
        onClose={() => setActiveHudCommand(null)}
      />}
      {ownerAuthoringEnabled && artworkChooser && <Suspense fallback={null}><ArtworkChooser assets={libraryAssets} folders={workspace.folders} status={libraryStatus} error={libraryError} title={artworkChooser.mode==='replace'?'Replace artwork':artworkChooser.mode==='gallery-create'?'Add artwork to gallery':'Choose artwork'} onSelect={chooseArtwork} onCancel={()=>{artworkChoicePendingRef.current=false;setArtworkChooser(null);}} /></Suspense>}
      {previewObjectId && canvasObjectById[previewObjectId] && (()=>{const object=canvasObjectById[previewObjectId];const asset=libraryAssets.find((entry)=>entry.id===object.stableAssetId);if(!asset)return null;return <Suspense fallback={null}><NftFlipViewer asset={asset} onClose={closeArtworkPreview} returnFocus={canvasObjectRefs.current.get(previewObjectId)?.querySelector('button')} /></Suspense>;})()}
      {profileDiscoveryOpen && <ProfileDiscoveryBoundary
        onClose={() => { setProfileDiscoveryOpen(false); setActiveHudCommand((current) => current === 'search' ? null : current); }}
        onSelect={(result) => {
          onVisitProfile?.(result.address);
          setProfileDiscoveryOpen(false);
          setActiveHudCommand(null);
        }}
      />}
    </main>
  );
}
