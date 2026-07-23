import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ProfileNavigationDock from './ProfileNavigationDock.jsx';
import { CollectionWindow, flushLibraryWorkspace, FolderWindow, useLibraryStore } from '../library/index.js';
import { CreationsWindow } from '../creations/index.js';
import AssetPreview from '../library/components/AssetPreview.jsx';
import KeeperSignalsLayer from '../signals/components/KeeperSignalsLayer.jsx';
import SignalSettings from '../signals/components/SignalSettings.jsx';
import SignalsWindow from '../signals/components/SignalsWindow.jsx';
import { flushSignalDocument, useSignalStore } from '../signals/state/useSignalStore.js';
import { useProfileIdentity } from '../profileIdentity/index.js';
import ProfileDocumentPanel from '../profileDocument/components/ProfileDocumentPanel.jsx';
import ProfileDocumentPreview from '../profileDocument/components/ProfileDocumentPreview.jsx';
import { useProfileDocumentStore } from '../profileDocument/state/useProfileDocumentStore.js';
import { buildProfileDocumentV3 } from '../profileDocument/domain/profileDocumentBuilder.js';
import { reportControlledError } from '../diagnostics.js';
import { assertValidProfileDocument } from '../profileDocument/domain/profileDocumentValidation.js';
import { createProfileDocumentRestorePlan } from '../profileDocument/domain/profileDocumentRestore.js';
import { profileDocumentContentFingerprint } from '../profileDocument/domain/profileDocumentSerialization.js';
import { canonicalPublicationHash, publicationContentFingerprint } from '../profileDocument/domain/profileDocumentPublication.js';
import { loadProfileSnapshot, profilePresentationKey, saveProfileSnapshot, saveRestoredPresentation } from '../profileDocument/storage/profileDocumentStorage.js';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';
import { getPublicTheme } from './themeTokens.js';
import { findScenePlacement, findScenePlacementAtPointer, isScenePlacementAvailable, LAUNCHER_SIZE_PRESETS, normalizeSpan, packCompactCanvasObjects, packCompactScene } from './sceneGrid.js';
import { gridRectToPixelRect, launcherGeometryAvailable, movementCandidateFromPointer, normalizeGridRect, resizeCandidateFromPointer } from './gridGeometry.js';
import { activateInteraction, createInteraction, effectiveGeometry, INTERACTION_KIND } from './gridInteraction.js';
import { iconGlyph, normalizeIconKey, SCENE_ICONS } from './sceneIcons.js';
import { decodeWindowGridGeometry, defaultFolderWindowGridRect, defaultWindowGridRect, windowMinimumSpan } from './windowGeometry.js';
import { createRuntimeWindowState, loadRuntimeWindowState, normalizeRuntimeWindowGeometry, saveRuntimeWindowState, updateRuntimeWindowState, windowZIndex } from './windows/runtimeWindowState.js';
import { contextMenuCommands, resolveContextTarget } from './menus/contextMenuModel.js';
import DesktopMenu from './menus/DesktopMenu.jsx';
import FramedArtwork from './FramedArtwork.jsx';
import ArtworkChooser from './ArtworkChooser.jsx';
import ArtworkInspector from './ArtworkInspector.jsx';
import GalleryWorld from './GalleryWorld.jsx';
import HomeWorldSurface from './HomeWorldSurface.jsx';
import KeeperDock from './KeeperDock.jsx';
import ProfileDiscovery from '../profileDiscovery/ProfileDiscovery.jsx';
import { clampVerticalHomeWorldCamera, getWindowRevealCamera, loadHomeWorldCamera, saveHomeWorldCamera } from './homeWorldCamera.js';
import { CANVAS_OBJECT_KIND, getCanvasObjectDefinition } from '../library/domain/canvasObjectRegistry.js';
import { CANVAS_OBJECT_ORDER_COMMAND } from '../library/domain/canvasObjects.js';
import { runOwnerAuthoringMutation, selectLiveCanvasContent } from './publicAccess.js';
import { createVerticalHomePlacementGeometry, createVerticalHomeWorld } from './verticalHomeWorld.js';
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
import '../creations/creations.css';
import '../signals/signals.css';
import '../profileDocument/profileDocument.css';
import './scenePreview.css';
import './canvasObjects.css';

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

const FULL_MODULE_ENTRY_BASE_MS = 240;
const FULL_MODULE_ENTRY_STAGGER_MS = 220;
const GROUPED_MODULE_ENTRY_MS = 70;
const SYSTEM_SCENE_KEY = 'os-underneath.system-launchers.v1';
// The stage-free home makes the grid a primary world surface. A new preference
// version prevents an old edit-mode-only "off" choice from booting into a void.
const GRID_PREFERENCE_KEY = 'os-underneath.grid-preference.v2';
const LEGACY_WINDOW_GEOMETRY_KEY = 'os-underneath.window-geometry.v1';
const SYSTEM_ICONS = Object.freeze({ identity: 'profile', collection: 'collection', creations: 'creations', signals: 'signals' });
const AUTHORING_CONTEXT_COMMANDS = new Set([
  'toggle-edit', 'menu-create', 'create-folder', 'create-framed-artwork', 'edit-launcher',
  'toggle-visibility', 'unpin', 'edit-artwork', 'replace-artwork',
  'toggle-object-visibility', 'menu-layer', 'object-forward', 'object-backward',
  'object-front', 'object-back', 'remove-artwork', 'toggle-start-open'
]);

const createHomePlacementGeometry = createVerticalHomePlacementGeometry;

function defaultSystemPresentation(id, order) { return { appearanceMode: 'label', iconKey: SYSTEM_ICONS[id], span: { columns: 3, rows: 1 }, presentationOrder: order, startOpen: false, windowGeometry: null }; }
function readSystemPresentation() { try { const value = JSON.parse(window.localStorage.getItem(SYSTEM_SCENE_KEY)); return Object.fromEntries(MODULES.map((module, index) => { const item=value?.[module.id]; return [module.id,{ ...defaultSystemPresentation(module.id,index), ...(item || {}), label:module.label, iconKey:normalizeIconKey(item?.iconKey,SYSTEM_ICONS[module.id]), span:normalizeSpan(item?.span,item?.appearanceMode) }]; })); } catch { return Object.fromEntries(MODULES.map((module,index)=>[module.id,{...defaultSystemPresentation(module.id,index),label:module.label}])); } }
function readGridPreference(){try{return JSON.parse(window.localStorage.getItem(GRID_PREFERENCE_KEY))?.visible!==false}catch{return true}}
function readLegacyWindowGeometry(geometry){return decodeWindowGridGeometry(window.localStorage.getItem(LEGACY_WINDOW_GEOMETRY_KEY),geometry,readStoredPositions(geometry))}

function getInitialGeometry() {
  return createModuleGridGeometry(window.innerWidth, window.innerHeight);
}

function readStoredPositions(geometry) {
  try {
    const current=window.localStorage.getItem(MODULE_LAYOUT_STORAGE_KEY);
    if(current)return decodeModuleLayout(current, geometry);
    const legacy=JSON.parse(window.localStorage.getItem(LEGACY_MODULE_LAYOUT_STORAGE_KEY));
    return legacy?.version===3?normalizeModulePositions(legacy.positions,geometry):getDefaultModulePositions(geometry);
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
  interfaceVisible = true,
  ownerAuthoringEnabled = false,
  getWalletPublicationContext,
  visitorWalletConnected = false,
  viewedProfileAddress: requestedViewedProfileAddress,
  onVisitProfile,
  revealPresentation = { sequence: 'short', reducedMotion: false }
}) {
  const workspace = useLibraryStore((state) => state.workspace);
  const [geometry, setGeometry] = useState(getInitialGeometry);
  const [positions, setPositions] = useState(() => readStoredPositions(createHomePlacementGeometry(getInitialGeometry())));
  const [systemPresentation, setSystemPresentation] = useState(readSystemPresentation);
  const [gridVisible, setGridVisible] = useState(readGridPreference);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [runtimeWindows,setRuntimeWindows]=useState(() => loadRuntimeWindowState(window.localStorage, workspace.profileAddress, { rects: readLegacyWindowGeometry(createHomePlacementGeometry(geometry)) }));
  const [identityOpen, setIdentityOpen] = useState(() => runtimeWindows.openIds.includes('identity'));
  const [identityPhase, setIdentityPhase] = useState('closed');
  const [collectionOpen, setCollectionOpen] = useState(() => runtimeWindows.openIds.includes('collection'));
  const [profileDiscoveryOpen, setProfileDiscoveryOpen] = useState(false);
  const [creationsOpen, setCreationsOpen] = useState(() => runtimeWindows.openIds.includes('creations'));
  const [signalsOpen, setSignalsOpen] = useState(() => runtimeWindows.openIds.includes('signals'));
  const [editMode, setEditMode] = useState(false);
  const [openFolderLauncherId, setOpenFolderLauncherId] = useState(() => runtimeWindows.openIds.find((id) => id.startsWith('library:')) || null);
  const [folderEntryLauncherId, setFolderEntryLauncherId] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeHudCommand, setActiveHudCommand] = useState(null);
  const [draftSaveState, setDraftSaveState] = useState(() => ({ profileAddress: workspace.profileAddress, status: 'saving' }));
  const [contextMenu, setContextMenu] = useState(null);
  const [inspectorAnchor, setInspectorAnchor] = useState(null);
  const [artworkInspector, setArtworkInspector] = useState(null);
  const [selectedCanvasObjectId, setSelectedCanvasObjectId] = useState(null);
  const [artworkChooser, setArtworkChooser] = useState(null);
  const [previewObjectId, setPreviewObjectId] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [homeCameraState, setHomeCameraState] = useState(() => ({
    profileAddress: workspace.profileAddress,
    camera: loadHomeWorldCamera(window.localStorage, workspace.profileAddress, { x: geometry.width, y: geometry.height, zoom: 1 })
  }));
  const [keeperDockActive, setKeeperDockActive] = useState(false);
  const [availableModuleIds, setAvailableModuleIds] = useState(() => new Set());
  const moduleRefs = useRef(new Map());
  const collectionPanelRef = useRef(null);
  const creationsPanelRef = useRef(null);
  const signalsPanelRef = useRef(null);
  const folderPanelRef = useRef(null);
  const launcherInspectorRef = useRef(null);
  const canvasObjectRefs = useRef(new Map());
  const spatialLayerRef = useRef(null);
  const keeperDockRef = useRef(null);
  const shellRef = useRef(null);
  const gridRef = useRef(null);
  const [interaction, setInteraction] = useState(null);
  const interactionRef = useRef(null);
  const lifecycleHandlersRef = useRef({move:null,finish:null});
  const loadedRuntimeProfileRef = useRef(workspace.profileAddress);
  const suppressLauncherClickRef = useRef(false);
  const artworkChoicePendingRef = useRef(false);
  const resizeFrameRef = useRef(0);
  const cameraTransitionFrameRef = useRef(0);
  const homeCameraRef = useRef(homeCameraState.camera);
  const pendingWindowRevealRef = useRef(null);

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
  const shellTheme = useMemo(() => ({
    ...theme,
    '--hu-accent-primary': '#e87945',
    '--hu-accent-secondary': '#e7a36f',
    '--hu-focus': '#f3a078',
    '--hu-signal': '#e87945',
    '--module-accent': '#e87945',
    '--os-accent': '#e87945'
  }), [theme]);

  const moveKeeperFromHome = useCallback((clientX, clientY) => {
    if (keeperDockActive && keeperDockRef.current) {
      keeperDockRef.current.release({ screenTarget: { clientX, clientY } });
      return;
    }
    residentHandoff?.moveToScreenPosition?.(clientX, clientY);
  }, [keeperDockActive, residentHandoff]);
  const libraryAssets = useLibraryStore((state) => state.assets);
  const libraryStatus = useLibraryStore((state) => state.status);
  const libraryError = useLibraryStore((state) => state.error || state.liveError);
  const loadLibrary = useLibraryStore((state) => state.load);
  const replaceWorkspace = useLibraryStore((state) => state.replaceWorkspace);
  const signalSettings = useSignalStore((state) => state.settings);
  const replaceSignalSettings = useSignalStore((state) => state.replaceSettings);
  const viewedProfileAddress = requestedViewedProfileAddress || workspace.profileAddress;
  const profileIdentity = useProfileIdentity(viewedProfileAddress);
  const viewedProfile = useMemo(
    () => getIdentityProfileViewModel(profileIdentity, { walletConnected: visitorWalletConnected }),
    [profileIdentity, visitorWalletConnected]
  );
  const snapshot = useProfileDocumentStore((state) => state.snapshot);
  const snapshotGeneration = useProfileDocumentStore((state) => state.snapshotGeneration);
  const importedDocument = useProfileDocumentStore((state) => state.imported);
  const previewDocument = useProfileDocumentStore((state) => state.preview);
  const installSnapshot = useProfileDocumentStore((state) => state.installSnapshot);
  const installImported = useProfileDocumentStore((state) => state.installImported);
  const enterPreview = useProfileDocumentStore((state) => state.enterPreview);
  const exitPreview = useProfileDocumentStore((state) => state.exitPreview);
  const setDocumentError = useProfileDocumentStore((state) => state.setError);
  const documentError = useProfileDocumentStore((state) => state.error);
  const setLauncherPosition = useLibraryStore((state) => state.setLauncherPosition);
  const setLauncherGeometry = useLibraryStore((state) => state.setLauncherGeometry);
  const setLauncherPresentation = useLibraryStore((state) => state.setLauncherPresentation);
  const resetWorkspaceCanvasLayout = useLibraryStore((state) => state.resetCanvasLayout);
  const setLauncherVisitorVisibility = useLibraryStore((state) => state.setLauncherVisitorVisibility);
  const setLauncherStartOpen = useLibraryStore((state) => state.setLauncherStartOpen);
  const unpinView = useLibraryStore((state) => state.unpinView);
  const createFolder = useLibraryStore((state) => state.createFolder);
  const pinView = useLibraryStore((state) => state.pinView);
  const createCanvasObject = useLibraryStore((state) => state.createCanvasObject);
  const setCanvasObjectGeometry = useLibraryStore((state) => state.setCanvasObjectGeometry);
  const setCanvasObjectPresentation = useLibraryStore((state) => state.setCanvasObjectPresentation);
  const replaceCanvasObjectAsset = useLibraryStore((state) => state.replaceCanvasObjectAsset);
  const setCanvasObjectVisitorVisibility = useLibraryStore((state) => state.setCanvasObjectVisitorVisibility);
  const reorderCanvasObject = useLibraryStore((state) => state.reorderCanvasObject);
  const removeCanvasObject = useLibraryStore((state) => state.removeCanvasObject);
  const liveCanvasContent = useMemo(
    () => selectLiveCanvasContent(workspace, ownerAuthoringEnabled),
    [ownerAuthoringEnabled, workspace]
  );
  const pinnedLaunchers = liveCanvasContent.launchers;
  const canvasObjects = liveCanvasContent.objects;
  const navigationCategories = useMemo(() => pinnedLaunchers
    .filter((launcher) => launcher.visitorVisible === true)
    .map((launcher) => {
      const folder = workspace.folders.find((entry) => entry.id === launcher.folderId);
      return {
        id: launcher.id,
        label: launcher.viewType === 'favorites' ? launcher.label || 'Favorites' : folder?.name || 'Unavailable category'
      };
    }), [pinnedLaunchers, workspace.folders]);
  const homeWorld = useMemo(() => createVerticalHomeWorld(geometry), [geometry]);
  const homeOrigin = useMemo(() => ({ x:geometry.width, y:geometry.height, zoom:1 }), [geometry.height,geometry.width]);
  const homeCamera = geometry.narrow || homeCameraState.profileAddress !== workspace.profileAddress
    ? homeOrigin
    : clampVerticalHomeWorldCamera(homeCameraState.camera, homeWorld, homeOrigin.x);
  homeCameraRef.current = homeCamera;
  const homeZoom = 1;
  const worldContentX = Math.round((geometry.width + geometry.left) / 40) * 40;
  const worldContentY = Math.round((geometry.height + geometry.top) / 40) * 40;
  const placementGeometry = useMemo(() => createHomePlacementGeometry(geometry), [geometry]);
  const homeWorldTransform = geometry.narrow ? 'none' : `translate3d(${(worldContentX-homeCamera.x)*homeZoom}px,${(worldContentY-homeCamera.y)*homeZoom}px,0) scale(${homeZoom})`;
  const pinnedLauncherKey = pinnedLaunchers.map((launcher) => launcher.id).join('|');
  useEffect(() => {
    if (ownerAuthoringEnabled) return;
    setEditMode(false);
    setSelectedSceneId(null);
    setSelectedCanvasObjectId(null);
    setInspectorAnchor(null);
    setArtworkInspector(null);
    setArtworkChooser(null);
    setContextMenu(null);
    setActiveHudCommand((command) => ['share', 'settings'].includes(command) ? null : command);
  }, [ownerAuthoringEnabled]);
  const sceneItems = useMemo(() => {
    const items=[];
    MODULES.forEach(({id},index)=>{ const presentation=systemPresentation[id] || defaultSystemPresentation(id,index); const span=normalizeSpan(presentation.span,presentation.appearanceMode,geometry); const requested=positions[id] || getDefaultModulePositions(geometry)[id]; const position=isScenePlacementAvailable(id,requested,span,items,placementGeometry)?requested:findScenePlacement(id,requested,span,items,placementGeometry); const itemGeometry={column:position.column,row:position.row,columnSpan:span.columns,rowSpan:span.rows}; items.push({id,position,span,geometry:itemGeometry,...presentation,presentationOrder:index}); });
    pinnedLaunchers.forEach((launcher,index)=>{ const span=normalizeSpan(launcher.span,launcher.appearanceMode,geometry); const fallback={column:0,row:2+index}; const requested=launcher.position||fallback; const authoredItems=items.filter((item)=>!Object.hasOwn(MODULE_ENTRY_ORDER,item.id)); const position=isScenePlacementAvailable(launcher.id,requested,span,authoredItems,placementGeometry)?requested:findScenePlacement(launcher.id,requested,span,authoredItems,placementGeometry); const itemGeometry={column:position.column,row:position.row,columnSpan:span.columns,rowSpan:span.rows}; items.push({id:launcher.id,position,span,geometry:itemGeometry,appearanceMode:launcher.appearanceMode||'label',iconKey:normalizeIconKey(launcher.iconKey,launcher.viewType==='favorites'?'favorites':'folder'),presentationOrder:launcher.presentationOrder??MODULES.length+index}); });
    return geometry.narrow ? packCompactScene(items,geometry) : items;
  },[geometry,pinnedLaunchers,placementGeometry,positions,systemPresentation]);
  const spatialSceneItems = useMemo(() => sceneItems.filter((item) => !Object.hasOwn(MODULE_ENTRY_ORDER,item.id)), [sceneItems]);
  const canvasPositions = useMemo(() => Object.fromEntries(sceneItems.map((item)=>[item.id,item.position])),[sceneItems]);
  const sceneById = useMemo(() => Object.fromEntries(sceneItems.map((item)=>{const effective=effectiveGeometry(item.geometry,interaction,item.id);return [item.id,{...item,geometry:effective,position:{column:effective.column,row:effective.row},span:{columns:effective.columnSpan,rows:effective.rowSpan}}]})),[interaction,sceneItems]);
  const canvasObjectScenes = useMemo(() => {
    const items=canvasObjects.map((object)=>{const definition=getCanvasObjectDefinition(object.kind);const rect=normalizeGridRect({column:object.placement.column,row:object.placement.row,columnSpan:object.span.columns,rowSpan:object.span.rows},placementGeometry,{minimumSpan:definition.minimumSpan});return {...object,geometry:rect,position:{column:rect.column,row:rect.row},span:{columns:rect.columnSpan,rows:rect.rowSpan}};});
    const responsive=geometry.narrow?packCompactCanvasObjects(items,geometry):items;
    return Object.fromEntries(responsive.map((item)=>{const effective=effectiveGeometry(item.geometry,interaction,item.id);return [item.id,{...item,geometry:effective,position:{column:effective.column,row:effective.row},span:{columns:effective.columnSpan,rows:effective.rowSpan}}]}));
  },[canvasObjects,geometry,interaction,placementGeometry]);
  const canvasObjectById = useMemo(() => Object.fromEntries(canvasObjects.map((object)=>[object.id,object])),[canvasObjects]);
  const openFolderLauncher = pinnedLaunchers.find((launcher) => launcher.id === openFolderLauncherId) || null;
  const windowGeometryFor = useCallback((key, anchor) => effectiveGeometry(runtimeWindows.rects[key] || defaultWindowGridRect(key,placementGeometry,anchor),interaction,['identity','collection','creations','signals'].includes(key)?`${key}-panel`:`folder-panel:${key}`),[interaction,placementGeometry,runtimeWindows.rects]);
  const collectionPanelPosition = windowGeometryFor('collection',canvasPositions.collection);
  const creationsPanelPosition = windowGeometryFor('creations',canvasPositions.creations);
  const signalsPanelPosition = windowGeometryFor('signals',canvasPositions.signals);
  const openFolderPosition = openFolderLauncher
    ? effectiveGeometry(runtimeWindows.rects[openFolderLauncher.id] || defaultFolderWindowGridRect(placementGeometry,sceneById[openFolderLauncher.id]?.geometry),interaction,`folder-panel:${openFolderLauncher.id}`)
    : null;
  const folderEntryOrigin = useMemo(() => {
    if (!openFolderLauncher || folderEntryLauncherId !== openFolderLauncher.id || !openFolderPosition || geometry.narrow) return null;
    const launcherRect = sceneById[openFolderLauncher.id]?.geometry;
    if (!launcherRect) return null;
    return {
      '--folder-entry-origin-x': `${(launcherRect.column + launcherRect.columnSpan / 2 - openFolderPosition.column) * geometry.cellWidth}px`,
      '--folder-entry-origin-y': `${(launcherRect.row + launcherRect.rowSpan / 2 - openFolderPosition.row) * geometry.cellHeight}px`
    };
  }, [folderEntryLauncherId, geometry.cellHeight, geometry.cellWidth, geometry.narrow, openFolderLauncher, openFolderPosition, sceneById]);
  const authoredWindowDefaults = useMemo(() => {
    const openIds = MODULES.filter(({ id }) => systemPresentation[id]?.startOpen).map(({ id }) => id);
    const rects = {};
    MODULES.forEach(({ id }) => { if (systemPresentation[id]?.windowGeometry) rects[id] = systemPresentation[id].windowGeometry; });
    pinnedLaunchers.forEach((launcher) => { if (launcher.startOpen) openIds.push(launcher.id); if (launcher.windowGeometry) rects[launcher.id] = launcher.windowGeometry; });
    return createRuntimeWindowState({ openIds, zOrder: openIds, rects });
  }, [pinnedLaunchers, systemPresentation]);
  const draftDocument = useMemo(() => buildProfileDocumentV3({
    profileAddress: workspace.profileAddress, workspace, assets: libraryAssets,
    publicPresentation: { keeperId: activeActorId, stageId, environment },
    signalSettings, profileIdentity, modulePositions: positions, systemPresentation, createdAt: 0, exportedAt: 0
  }), [activeActorId, environment, libraryAssets, positions, profileIdentity, signalSettings, stageId, systemPresentation, workspace]);
  const draftFingerprint = useMemo(() => profileDocumentContentFingerprint(draftDocument), [draftDocument]);
  const draftGenerationRef = useRef({ fingerprint: draftFingerprint, generation: 0 });
  if (draftGenerationRef.current.fingerprint !== draftFingerprint) {
    draftGenerationRef.current = { fingerprint: draftFingerprint, generation: draftGenerationRef.current.generation + 1 };
  }
  const snapshotStale = Boolean(snapshot && useProfileDocumentStore.getState().snapshotDraftFingerprint !== draftFingerprint);
  const draftSaveStatus = draftSaveState.profileAddress === workspace.profileAddress ? draftSaveState.status : 'saving';
  const persistOwnerDraft = useCallback(() => {
    const librarySaved = flushLibraryWorkspace();
    const signalsSaved = flushSignalDocument();
    const presentationSaved = saveRestoredPresentation(window.localStorage, workspace.profileAddress, {
      keeperId: activeActorId, stageId, environment
    });
    let layoutSaved = true;
    if (!geometry.narrow) {
      try { window.localStorage.setItem(MODULE_LAYOUT_STORAGE_KEY, encodeModuleLayout(positions)); }
      catch (error) { layoutSaved = false; reportControlledError('module-grid-layout-persist', error); }
    }
    let systemPresentationSaved = true;
    try { window.localStorage.setItem(SYSTEM_SCENE_KEY, JSON.stringify(systemPresentation)); }
    catch (error) { systemPresentationSaved = false; reportControlledError('system-presentation-persist', error); }
    const saved = librarySaved && signalsSaved && presentationSaved && layoutSaved && systemPresentationSaved;
    if (!saved) reportControlledError('owner-draft-persist', new Error('Could not save every owner draft source'));
    setDraftSaveState({ profileAddress: workspace.profileAddress, status: saved ? 'saved' : 'error' });
    return saved;
  }, [activeActorId, environment, geometry.narrow, positions, stageId, systemPresentation, workspace.profileAddress]);

  useEffect(() => {
    if (!ownerAuthoringEnabled) return undefined;
    setDraftSaveState({ profileAddress: workspace.profileAddress, status: 'saving' });
    const timeout = window.setTimeout(persistOwnerDraft, 240);
    return () => window.clearTimeout(timeout);
  }, [draftFingerprint, ownerAuthoringEnabled, persistOwnerDraft, signalSettings, workspace]);

  useEffect(() => {
    if (!ownerAuthoringEnabled) return undefined;
    const flush = () => persistOwnerDraft();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [ownerAuthoringEnabled, persistOwnerDraft]);
  const getPublicationContext = useCallback(() => {
    const wallet = getWalletPublicationContext?.() || {};
    const documentState = useProfileDocumentStore.getState();
    const liveSnapshot = documentState.snapshot;
    const liveWorkspaceAddress = useLibraryStore.getState().workspace.profileAddress;
    const host = wallet.hostProfileAddress?.toLowerCase(); const workspaceAddress = liveWorkspaceAddress?.toLowerCase();
    return { ...wallet, workspaceProfileAddress: liveWorkspaceAddress,
      viewedProfileAddress, snapshotGeneration: documentState.snapshotGeneration,
      snapshotArtifactHash: liveSnapshot ? canonicalPublicationHash(liveSnapshot) : null,
      snapshotContentFingerprint: liveSnapshot ? publicationContentFingerprint(liveSnapshot) : null,
      draftFingerprint: publicationContentFingerprint(draftDocument), draftGeneration: draftGenerationRef.current.generation,
      snapshotStale: Boolean(liveSnapshot && documentState.snapshotDraftFingerprint !== draftFingerprint),
      ownerAuthoringEnabled: Boolean(wallet.isHostProfileOwner && host && host === workspaceAddress && host === viewedProfileAddress?.toLowerCase()) };
  }, [draftDocument, draftFingerprint, getWalletPublicationContext, snapshotGeneration, viewedProfileAddress]);

  useEffect(() => {
    if (snapshot) return;
    const stored = loadProfileSnapshot(window.localStorage, workspace.profileAddress);
    if (stored) installSnapshot(stored, profileDocumentContentFingerprint(stored));
  }, [installSnapshot, snapshot, workspace.profileAddress]);

  useEffect(() => {
    if (cameraTransitionFrameRef.current) window.cancelAnimationFrame(cameraTransitionFrameRef.current);
    cameraTransitionFrameRef.current = 0;
    setHomeCameraState({
      profileAddress: workspace.profileAddress,
      camera: clampVerticalHomeWorldCamera(loadHomeWorldCamera(window.localStorage, workspace.profileAddress, homeOrigin), homeWorld, homeOrigin.x)
    });
  }, [homeOrigin, homeWorld, workspace.profileAddress]);

  useEffect(() => {
    if (homeCameraState.profileAddress !== workspace.profileAddress) return;
    const timeout = window.setTimeout(() => {
      saveHomeWorldCamera(window.localStorage, workspace.profileAddress, homeCameraState.camera);
    }, 140);
    return () => window.clearTimeout(timeout);
  }, [homeCameraState, workspace.profileAddress]);

  useEffect(() => {
    let keyExists = false;
    try { keyExists = window.localStorage.getItem(`os-underneath.runtime-windows.v1:${workspace.profileAddress}`) !== null; } catch { /* Storage is optional. */ }
    const loaded = loadRuntimeWindowState(window.localStorage, workspace.profileAddress, { rects: readLegacyWindowGeometry(createHomePlacementGeometry(geometry)) });
    const next = normalizeRuntimeWindowGeometry(keyExists || Object.keys(loaded.rects).length ? loaded : authoredWindowDefaults, placementGeometry);
    loadedRuntimeProfileRef.current = workspace.profileAddress;
    setRuntimeWindows(next);
    setIdentityOpen(next.openIds.includes('identity')); setCollectionOpen(next.openIds.includes('collection')); setCreationsOpen(next.openIds.includes('creations')); setSignalsOpen(next.openIds.includes('signals'));
    setOpenFolderLauncherId(next.openIds.find((id) => id.startsWith('library:')) || null);
  // Runtime records load only when the active profile changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.profileAddress]);

  useEffect(() => {
    setRuntimeWindows((current) => normalizeRuntimeWindowGeometry(current, placementGeometry));
  }, [placementGeometry]);

  useEffect(() => {
    if (loadedRuntimeProfileRef.current === workspace.profileAddress) saveRuntimeWindowState(window.localStorage, workspace.profileAddress, runtimeWindows);
  }, [runtimeWindows, workspace.profileAddress]);

  const buildSnapshot = useCallback(() => {
    if (!ownerAuthoringEnabled) return;
    try {
      const now = Date.now();
      const document = buildProfileDocumentV3({ profileAddress: workspace.profileAddress, workspace, assets: libraryAssets,
        publicPresentation: { keeperId: activeActorId, stageId, environment }, signalSettings, profileIdentity,
        modulePositions: positions, systemPresentation, revision: (snapshot?.revision || 0) + 1, createdAt: snapshot?.createdAt || now, exportedAt: now });
      const valid = assertValidProfileDocument(document); installSnapshot(valid, profileDocumentContentFingerprint(valid));
      saveProfileSnapshot(window.localStorage, valid); setDocumentError(null);
    } catch (error) { setDocumentError(error.message); }
  }, [activeActorId, environment, installSnapshot, libraryAssets, ownerAuthoringEnabled, positions, profileIdentity, setDocumentError, signalSettings, snapshot, stageId, systemPresentation, workspace]);

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
    const previousPresentation = { keeperId: activeActorId, stageId, environment }; const key = profilePresentationKey(workspace.profileAddress);
    let previousStoredPresentation; let previousPresentationRead = false; let restoreStarted = false;
    try {
      previousStoredPresentation = window.localStorage.getItem(key);
      previousPresentationRead = true;
      const plan = createProfileDocumentRestorePlan(importedDocument, workspace);
      restoreStarted = true;
      if (!replaceWorkspace(plan.workspace)) throw new Error('Could not persist restored Canvas Spaces');
      if (!replaceSignalSettings(plan.signalSettings)) throw new Error('Could not persist restored Activity settings');
      window.localStorage.setItem(key, JSON.stringify({ version: 2, keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment }));
      onApplyRestoredPresentation?.({ keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment }); setDocumentError(null);
    } catch (error) {
      if (restoreStarted) {
        try { if (!replaceWorkspace(previousWorkspace)) replaceWorkspace(previousWorkspace, { persist: false }); } catch { /* Best-effort rollback. */ }
        try { if (!replaceSignalSettings(previousSettings)) replaceSignalSettings(previousSettings, { persist: false }); } catch { /* Best-effort rollback. */ }
        if (previousPresentationRead) {
          try { if (previousStoredPresentation == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, previousStoredPresentation); } catch { /* Best-effort rollback. */ }
        }
        try { onApplyRestoredPresentation?.(previousPresentation); } catch { /* Best-effort rollback. */ }
      }
      setDocumentError(error instanceof Error ? error.message : String(error));
    }
  }, [activeActorId, environment, importedDocument, onApplyRestoredPresentation, ownerAuthoringEnabled, replaceSignalSettings, replaceWorkspace, setDocumentError, signalSettings, stageId, workspace]);

  useEffect(() => {
    if (!interfaceVisible) {
      setAvailableModuleIds(new Set());
      return undefined;
    }

    const groupedEntry = revealPresentation.sequence !== 'full' || revealPresentation.reducedMotion;
    const timers = [...MODULES, ...pinnedLaunchers].map(({ id }, index) => {
      const delay = groupedEntry
        ? GROUPED_MODULE_ENTRY_MS
        : FULL_MODULE_ENTRY_BASE_MS + (MODULE_ENTRY_ORDER[id] ?? index) * FULL_MODULE_ENTRY_STAGGER_MS;
      return window.setTimeout(() => {
        setAvailableModuleIds((current) => {
          const next = new Set(current);
          next.add(id);
          return next;
        });
      }, delay);
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [interfaceVisible, pinnedLauncherKey, revealPresentation.reducedMotion, revealPresentation.sequence]);

  useEffect(() => {
    if (!ownerAuthoringEnabled) return;
    pinnedLaunchers.forEach((launcher) => {
      if (!launcher.position && canvasPositions[launcher.id]) setLauncherPosition(launcher.id, canvasPositions[launcher.id]);
    });
  }, [canvasPositions, ownerAuthoringEnabled, pinnedLauncherKey, setLauncherPosition]);

  useEffect(() => {
    if (openFolderLauncherId && !pinnedLaunchers.some((launcher) => launcher.id === openFolderLauncherId)) {
      setOpenFolderLauncherId(null);
      setActiveModuleId(null);
    }
  }, [openFolderLauncherId, pinnedLauncherKey]);

  useEffect(() => {
    const resize = () => {
      if (resizeFrameRef.current) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = 0;
        const nextGeometry = createModuleGridGeometry(window.innerWidth, window.innerHeight);
        interactionRef.current = null;
        setInteraction(null);
        setGeometry(nextGeometry);
        setPositions(readStoredPositions(createHomePlacementGeometry(nextGeometry)));
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

  const persistPositions = useCallback((nextPositions) => {
    if (geometry.narrow) return;
    try {
      window.localStorage.setItem(MODULE_LAYOUT_STORAGE_KEY, encodeModuleLayout(nextPositions));
    } catch (error) {
      reportControlledError('module-grid-layout-persist', error);
    }
  }, [geometry.narrow]);

  const updatePresentation = useCallback((id, patch) => {
    if (!ownerAuthoringEnabled) return;
    const scene=sceneById[id];
    if(scene&&(patch?.span||patch?.appearanceMode)){
      const appearanceMode=patch.appearanceMode||scene.appearanceMode;
      const span=normalizeSpan(patch.span||scene.span,appearanceMode,geometry);
      const candidate={...scene.geometry,columnSpan:span.columns,rowSpan:span.rows};
      if(!launcherGeometryAvailable(id,candidate,spatialSceneItems,placementGeometry))return;
      patch={...patch,span};
    }
    if (Object.hasOwn(MODULE_ENTRY_ORDER,id)) setSystemPresentation((current)=>{ const next={...current,[id]:{...current[id],...patch}}; try{window.localStorage.setItem(SYSTEM_SCENE_KEY,JSON.stringify(next));}catch{} return next; });
    else setLauncherPresentation(id,patch);
  },[geometry,ownerAuthoringEnabled,placementGeometry,sceneById,setLauncherPresentation,spatialSceneItems]);
  const updateRuntime = useCallback((action) => setRuntimeWindows((current) => updateRuntimeWindowState(current, action)), []);
  const commitWindowGeometry=useCallback((id,rect)=>{const key=id.startsWith('folder-panel:')?id.slice('folder-panel:'.length):id.replace('-panel','');updateRuntime({ type: 'geometry', id: key, rect });},[updateRuntime]);

  const commitLauncherGeometry = useCallback((id,rect) => {
    if (!ownerAuthoringEnabled) return;
    if (!Object.hasOwn(MODULE_ENTRY_ORDER,id)) { setLauncherGeometry(id,rect); return; }
    const nextPositions={...positions,[id]:{column:rect.column,row:rect.row}};setPositions(nextPositions);persistPositions(nextPositions);
    const nextPresentation={...systemPresentation,[id]:{...systemPresentation[id],span:{columns:rect.columnSpan,rows:rect.rowSpan}}};setSystemPresentation(nextPresentation);try{window.localStorage.setItem(SYSTEM_SCENE_KEY,JSON.stringify(nextPresentation))}catch{}
  },[ownerAuthoringEnabled,persistPositions,positions,setLauncherGeometry,systemPresentation]);
  const commitCanvasObjectGeometry = useCallback((id,rect) => runOwnerAuthoringMutation(ownerAuthoringEnabled, () => setCanvasObjectGeometry(id,rect)),[ownerAuthoringEnabled,setCanvasObjectGeometry]);

  const commitPosition = useCallback((id, position) => {
    if (!ownerAuthoringEnabled) return;
    if (!Object.hasOwn(MODULE_ENTRY_ORDER, id)) {
      setLauncherPosition(id, position);
      return;
    }
    setPositions((current) => {
      const next = { ...current, [id]: position };
      persistPositions(next);
      return next;
    });
  }, [ownerAuthoringEnabled, persistPositions, setLauncherPosition]);

  const openModule = useCallback((id) => {
    const folderLauncher = pinnedLaunchers.find((launcher) => launcher.id === id);
    if (folderLauncher) {
      const closing = openFolderLauncherId === id;
      if (!closing && openFolderLauncherId) updateRuntime({ type: 'close', id: openFolderLauncherId });
      if (!closing && !runtimeWindows.rects[id]) {
        updateRuntime({ type: 'geometry', id, rect: defaultFolderWindowGridRect(placementGeometry, sceneById[id]?.geometry) });
        setFolderEntryLauncherId(id);
      } else setFolderEntryLauncherId(null);
      if (closing) {
        if (pendingWindowRevealRef.current === id) pendingWindowRevealRef.current = null;
      } else pendingWindowRevealRef.current = id;
      setOpenFolderLauncherId(closing ? null : id);
      setActiveModuleId(closing ? null : id);
      updateRuntime({ type: closing ? 'close' : 'open', id });
      return;
    }
    if (id === 'identity' && identityOpen) {
      setIdentityOpen(false);
      setIdentityPhase('closed');
      updateRuntime({ type: 'close', id });
      return;
    }
    if (id === 'collection' && collectionOpen) {
      setCollectionOpen(false);
      updateRuntime({ type: 'close', id });
      setActiveModuleId(null);
      window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
      return;
    }
    if (id === 'creations' && creationsOpen) {
      setCreationsOpen(false);
      updateRuntime({ type: 'close', id });
      setActiveModuleId(null);
      window.requestAnimationFrame(() => moduleRefs.current.get('creations')?.focus());
      return;
    }
    if (id === 'signals' && signalsOpen) {
      setSignalsOpen(false);
      updateRuntime({ type: 'close', id });
      setActiveModuleId(null);
      window.requestAnimationFrame(() => moduleRefs.current.get('signals')?.focus());
      return;
    }
    setActiveModuleId(id);
    updateRuntime({ type: 'open', id });
    if (id === 'collection') {
      setCollectionOpen(true);
      return;
    }
    if (id === 'creations') {
      setCreationsOpen(true);
      return;
    }
    if (id === 'signals') {
      setSignalsOpen(true);
      return;
    }
    if (id !== 'identity') return;
    setIdentityPhase('open');
    setIdentityOpen(true);
  }, [collectionOpen, creationsOpen, identityOpen, openFolderLauncherId, pinnedLaunchers, placementGeometry, runtimeWindows.rects, sceneById, signalsOpen, updateRuntime]);

  const moduleStyle = useCallback((id) => gridRectToPixelRect(sceneById[id].geometry,geometry,2), [geometry,sceneById]);
  const windowStyle=useCallback((rect)=>geometry.narrow?{left:0,top:0,width:geometry.usableWidth,height:geometry.usableHeight}:gridRectToPixelRect(rect,geometry,2),[geometry]);

  const installInteraction = useCallback((next,event) => {
    if (interactionRef.current || !next) return false;
    interactionRef.current = next; setInteraction(next);
    next.captureElement.setPointerCapture?.(event.pointerId);
    return true;
  },[]);

  const beginInteraction = useCallback((event,{kind,targetId,rect,element,minimumSpan})=>{
    const authoredKind=[INTERACTION_KIND.MOVE_LAUNCHER,INTERACTION_KIND.RESIZE_LAUNCHER,INTERACTION_KIND.MOVE_CANVAS_OBJECT,INTERACTION_KIND.RESIZE_CANVAS_OBJECT].includes(kind);
    if(geometry.narrow||(authoredKind&&(!ownerAuthoringEnabled||!editMode))||!rect||!element||event.pointerType==='mouse'&&event.button!==0)return;
    if(kind===INTERACTION_KIND.MOVE_WINDOW&&event.target.closest('button,a,input,select,textarea,[data-resize-control]'))return;
    event.preventDefault();
    if(kind.includes('RESIZE'))event.stopPropagation();
    const rendered=element.getBoundingClientRect();
    const resize=kind.includes('RESIZE');
    const next=createInteraction({kind,targetId,pointerId:event.pointerId,originGeometry:rect,gridBounds:{columns:placementGeometry.columns,rows:placementGeometry.rows,minColumn:placementGeometry.minColumn,minRow:placementGeometry.minRow},cellWidth:geometry.cellWidth,cellHeight:geometry.cellHeight,pointerGrabOffset:resize?{x:event.clientX-rendered.right,y:event.clientY-rendered.bottom}:{x:event.clientX-rendered.left,y:event.clientY-rendered.top},startPointer:{x:event.clientX,y:event.clientY},captureElement:event.target});
    next.gridClientRect=gridRef.current.getBoundingClientRect();
    next.minimumSpan=minimumSpan;
    installInteraction(next,event);
  },[editMode,geometry,installInteraction,ownerAuthoringEnabled,placementGeometry]);

  const moveInteraction = useCallback((event)=>{
    const current=interactionRef.current;if(!current||event.pointerId!==current.pointerId)return;
    if(current.kind.includes('RESIZE'))event.stopPropagation();
    if(!current.activated&&Math.hypot(event.clientX-current.startPointer.x,event.clientY-current.startPointer.y)<6)return;
    const interactionGeometry=geometry.narrow?geometry:{...placementGeometry,cellWidth:geometry.cellWidth*homeZoom,cellHeight:geometry.cellHeight*homeZoom};
    const input={pointer:{x:event.clientX,y:event.clientY},gridClientRect:current.gridClientRect,pointerGrabOffset:current.pointerGrabOffset,originGeometry:current.originGeometry,geometry:interactionGeometry,inset:2};
    const proposed=current.kind.includes('RESIZE')?resizeCandidateFromPointer({...input,minimumSpan:current.minimumSpan}):movementCandidateFromPointer(input);
    const launcher=current.kind===INTERACTION_KIND.MOVE_LAUNCHER||current.kind===INTERACTION_KIND.RESIZE_LAUNCHER;
    const valid=!launcher||launcherGeometryAvailable(current.targetId,proposed,spatialSceneItems,placementGeometry);
    const next=activateInteraction(current,proposed,valid);interactionRef.current=next;setInteraction(next);
  },[geometry,homeZoom,placementGeometry,spatialSceneItems]);

  const finishInteraction = useCallback((event,cancel=false)=>{
    const current=interactionRef.current;
    if(!current||current.pointerId!==event.pointerId)return;
    if(event.type==='lostpointercapture'&&event.currentTarget.hasPointerCapture?.(event.pointerId))return;
    interactionRef.current=null;setInteraction(null);
    if(cancel||!current.activated)return;
    if(current.kind===INTERACTION_KIND.MOVE_LAUNCHER||current.kind===INTERACTION_KIND.RESIZE_LAUNCHER){suppressLauncherClickRef.current=true;commitLauncherGeometry(current.targetId,current.candidateGeometry);}
    else if(current.kind===INTERACTION_KIND.MOVE_CANVAS_OBJECT||current.kind===INTERACTION_KIND.RESIZE_CANVAS_OBJECT){suppressLauncherClickRef.current=true;commitCanvasObjectGeometry(current.targetId,current.candidateGeometry);}
    else commitWindowGeometry(current.targetId,current.candidateGeometry);
  },[commitCanvasObjectGeometry,commitLauncherGeometry,commitWindowGeometry]);

  const startDrag=useCallback((event,id,unused,enabled=true)=>{if(enabled)beginInteraction(event,{kind:INTERACTION_KIND.MOVE_LAUNCHER,targetId:id,rect:sceneById[id]?.geometry,element:moduleRefs.current.get(id)});},[beginInteraction,sceneById]);
  const startResize=useCallback((event,id)=>beginInteraction(event,{kind:INTERACTION_KIND.RESIZE_LAUNCHER,targetId:id,rect:sceneById[id]?.geometry,element:moduleRefs.current.get(id),minimumSpan:{columns:sceneById[id]?.appearanceMode==='icon'?1:2,rows:1}}),[beginInteraction,sceneById]);
  const startObjectDrag=useCallback((event,id)=>beginInteraction(event,{kind:INTERACTION_KIND.MOVE_CANVAS_OBJECT,targetId:id,rect:canvasObjectScenes[id]?.geometry,element:canvasObjectRefs.current.get(id)}),[beginInteraction,canvasObjectScenes]);
  const startObjectResize=useCallback((event,id)=>{const definition=getCanvasObjectDefinition(canvasObjectById[id]?.kind);beginInteraction(event,{kind:INTERACTION_KIND.RESIZE_CANVAS_OBJECT,targetId:id,rect:canvasObjectScenes[id]?.geometry,element:canvasObjectRefs.current.get(id),minimumSpan:definition.minimumSpan});},[beginInteraction,canvasObjectById,canvasObjectScenes]);
  const startExpandedPanelDrag=useCallback((event,id,rect,panelRef,enabled)=>{if(enabled)beginInteraction(event,{kind:INTERACTION_KIND.MOVE_WINDOW,targetId:id,rect,element:panelRef.current});},[beginInteraction]);
  const startWindowResize=useCallback((event,id,rect,panelRef)=>beginInteraction(event,{kind:INTERACTION_KIND.RESIZE_WINDOW,targetId:id,rect,element:panelRef.current,minimumSpan:windowMinimumSpan(id,geometry)}),[beginInteraction,geometry]);
  lifecycleHandlersRef.current={move:moveInteraction,finish:finishInteraction};
  useEffect(() => {
    if (!interaction) return undefined;
    const move = (event) => lifecycleHandlersRef.current.move?.(event);
    const up = (event) => lifecycleHandlersRef.current.finish?.(event, false);
    const cancel = (event) => lifecycleHandlersRef.current.finish?.(event, true);
    window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', cancel, true);
    return () => { window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true); };
  }, [interaction?.interactionId]);
  useEffect(()=>()=>{
    interactionRef.current=null;
    if (cameraTransitionFrameRef.current) window.cancelAnimationFrame(cameraTransitionFrameRef.current);
  },[]);

  const resetLayout = () => {
    if (!ownerAuthoringEnabled) return;
    const defaults = getDefaultModulePositions(geometry);
    setPositions(defaults);
    resetWorkspaceCanvasLayout();
    if (geometry.narrow) {
      try { window.localStorage.removeItem(MODULE_LAYOUT_STORAGE_KEY); } catch { /* Storage is optional. */ }
    } else persistPositions(defaults);
  };

  const resetWindows = useCallback(() => {
    setRuntimeWindows((current) => updateRuntimeWindowState(current, { type: 'reset', initial: authoredWindowDefaults }));
    setIdentityOpen(authoredWindowDefaults.openIds.includes('identity'));
    setCollectionOpen(authoredWindowDefaults.openIds.includes('collection'));
    setCreationsOpen(authoredWindowDefaults.openIds.includes('creations'));
    setSignalsOpen(authoredWindowDefaults.openIds.includes('signals'));
    setOpenFolderLauncherId(authoredWindowDefaults.openIds.find((id) => id.startsWith('library:')) || null);
  }, [authoredWindowDefaults]);

  const closeAllWindows = useCallback(() => {
    updateRuntime({ type: 'close-all' }); setIdentityOpen(false); setIdentityPhase('closed'); setCollectionOpen(false); setCreationsOpen(false); setSignalsOpen(false); setOpenFolderLauncherId(null); setActiveModuleId(null);
  }, [updateRuntime]);

  const exitGallery = useCallback(() => {
    setGalleryOpen(false);
    setActiveModuleId(null);
    window.requestAnimationFrame(() => moduleRefs.current.get('gallery')?.focus());
  }, []);

  const enterGallery = useCallback(() => {
    closeAllWindows();
    setEditMode(false);
    setSelectedSceneId(null);
    setSelectedCanvasObjectId(null);
    setInspectorAnchor(null);
    setArtworkInspector(null);
    setContextMenu(null);
    setActiveHudCommand(null);
    setGalleryOpen(true);
    setActiveModuleId('gallery');
  }, [closeAllWindows]);

  useEffect(() => {
    onGalleryOpenChange?.(galleryOpen);
    return () => { if (galleryOpen) onGalleryOpenChange?.(false); };
  }, [galleryOpen, onGalleryOpenChange]);

  const toggleGrid = useCallback(() => setGridVisible((value) => { const next=!value; try { window.localStorage.setItem(GRID_PREFERENCE_KEY,JSON.stringify({version:1,visible:next})); } catch {} return next; }), []);

  const openLauncherInspector = useCallback((id) => {
    if (!ownerAuthoringEnabled) return;
    const rect = moduleRefs.current.get(id)?.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    setSelectedSceneId(id); setInspectorAnchor(rect ? { x: rect.right + 10 + width <= window.innerWidth - 12 ? rect.right + 10 : Math.max(12, rect.left - width - 10), y: Math.max(12, Math.min(rect.top, window.innerHeight - 360)) } : { x: Math.max(12, (window.innerWidth-width)/2), y: 72 });
  }, [ownerAuthoringEnabled]);

  const activateLauncher = useCallback((id) => {
    if (suppressLauncherClickRef.current) { suppressLauncherClickRef.current = false; return; }
    if (ownerAuthoringEnabled && editMode) openLauncherInspector(id);
    else openModule(id);
  }, [editMode, openLauncherInspector, openModule, ownerAuthoringEnabled]);

  const cancelCameraTransition = useCallback(() => {
    if (!cameraTransitionFrameRef.current) return;
    window.cancelAnimationFrame(cameraTransitionFrameRef.current);
    cameraTransitionFrameRef.current = 0;
  }, []);

  const setHomeCameraImmediately = useCallback((camera) => {
    cancelCameraTransition();
    const verticalCamera = clampVerticalHomeWorldCamera(camera, homeWorld, homeOrigin.x);
    homeCameraRef.current = verticalCamera;
    setHomeCameraState({ profileAddress: workspace.profileAddress, camera: verticalCamera });
  }, [cancelCameraTransition, homeOrigin.x, homeWorld, workspace.profileAddress]);

  const handleWorldWheel = useCallback((event) => {
    if (geometry.narrow) return;
    if (event.target.closest?.('.module-shell--expanded,.artwork-inspector,.canvas-artwork-preview,.desktop-menu')) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey || event.deltaY === 0) return;
    const camera = homeCameraRef.current;
    setHomeCameraImmediately({ ...camera, y: camera.y + event.deltaY });
  }, [geometry.narrow, setHomeCameraImmediately]);

  const transitionHomeCamera = useCallback((target) => {
    if (!target) return;
    cancelCameraTransition();
    const start = homeCameraRef.current;
    if (geometry.narrow || revealPresentation.reducedMotion) {
      setHomeCameraImmediately(target);
      return;
    }
    const startedAt = performance.now();
    const duration = 220;
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const camera = {
        x: homeOrigin.x,
        y: start.y + (target.y - start.y) * eased,
        zoom: 1
      };
      homeCameraRef.current = camera;
      setHomeCameraState({ profileAddress: workspace.profileAddress, camera });
      if (progress < 1) cameraTransitionFrameRef.current = window.requestAnimationFrame(step);
      else cameraTransitionFrameRef.current = 0;
    };
    cameraTransitionFrameRef.current = window.requestAnimationFrame(step);
  }, [cancelCameraTransition, geometry.narrow, homeOrigin.x, revealPresentation.reducedMotion, setHomeCameraImmediately, workspace.profileAddress]);

  const focusWorldWindow = useCallback((id,rect) => {
    updateRuntime({type:'focus',id});
    setActiveModuleId(id);
    if (!rect || geometry.narrow) return;
    const target = getWindowRevealCamera(homeCameraRef.current, rect, geometry, homeWorld, {
      worldOffsetX: worldContentX,
      worldOffsetY: worldContentY
    });
    transitionHomeCamera(target);
  },[geometry,homeWorld,transitionHomeCamera,updateRuntime,worldContentX,worldContentY]);

  const activateSystemDestination = useCallback((id) => {
    cancelCameraTransition();
    if (galleryOpen) setGalleryOpen(false);
    if(id==='collection'&&collectionOpen){focusWorldWindow(id,collectionPanelPosition);return;}
    if(id==='creations'&&creationsOpen){focusWorldWindow(id,creationsPanelPosition);return;}
    if(id==='signals'&&signalsOpen){focusWorldWindow(id,signalsPanelPosition);return;}
    pendingWindowRevealRef.current=id;
    openModule(id);
  },[cancelCameraTransition,collectionOpen,collectionPanelPosition,creationsOpen,creationsPanelPosition,focusWorldWindow,galleryOpen,openModule,signalsOpen,signalsPanelPosition]);

  useLayoutEffect(() => {
    const id = pendingWindowRevealRef.current;
    if (id === 'collection' && collectionOpen) {
      pendingWindowRevealRef.current = null;
      focusWorldWindow(id, collectionPanelPosition);
    } else if (id === 'creations' && creationsOpen) {
      pendingWindowRevealRef.current = null;
      focusWorldWindow(id, creationsPanelPosition);
    } else if (id === 'signals' && signalsOpen) {
      pendingWindowRevealRef.current = null;
      focusWorldWindow(id, signalsPanelPosition);
    } else if (id && id === openFolderLauncher?.id && openFolderPosition) {
      pendingWindowRevealRef.current = null;
      focusWorldWindow(id, openFolderPosition);
    }
  }, [collectionOpen, collectionPanelPosition, creationsOpen, creationsPanelPosition, focusWorldWindow, openFolderLauncher, openFolderPosition, signalsOpen, signalsPanelPosition]);

  useEffect(() => {
    if (!folderEntryLauncherId) return undefined;
    const timeout = window.setTimeout(() => setFolderEntryLauncherId(null), 220);
    return () => window.clearTimeout(timeout);
  }, [folderEntryLauncherId]);

  const openCollectionSearch = useCallback(() => {
    setProfileDiscoveryOpen(true);
    setActiveHudCommand('search');
  }, []);

  const createFolderAtContext = useCallback(() => {
    if (!ownerAuthoringEnabled) return;
    const existing = new Set(workspace.folders.map((folder) => folder.name.toLowerCase()));
    let name = 'New Folder'; let suffix = 2;
    while (existing.has(name.toLowerCase())) { name = `New Folder ${suffix}`; suffix += 1; }
    const folderId = createFolder(name);
    if (!folderId) return;
    pinView({ type: 'folder', id: folderId });
    const launcherId = `library:folder:${folderId}`;
    const bounds = gridRef.current?.getBoundingClientRect();
    const requested = bounds ? {
      column: Math.max(placementGeometry.minColumn, Math.min(placementGeometry.minColumn + placementGeometry.columns - 3, Math.floor((contextMenu.anchor.x - bounds.left) / (geometry.cellWidth*homeZoom)))),
      row: Math.max(placementGeometry.minRow, Math.min(placementGeometry.minRow + placementGeometry.rows - 1, Math.floor((contextMenu.anchor.y - bounds.top) / (geometry.cellHeight*homeZoom))))
    } : { column: 0, row: 2 };
    const position = findScenePlacement(launcherId, requested, { columns: 3, rows: 1 }, spatialSceneItems, placementGeometry);
    setLauncherPosition(launcherId, position);
    setSelectedSceneId(launcherId);
    setInspectorAnchor({ x: Math.max(12, Math.min(contextMenu.anchor.x + 12, window.innerWidth - 292)), y: Math.max(12, Math.min(contextMenu.anchor.y, window.innerHeight - 360)) });
  }, [contextMenu, createFolder, geometry, homeZoom, ownerAuthoringEnabled, pinView, placementGeometry, setLauncherPosition, spatialSceneItems, workspace.folders]);

  const openArtworkInspector = useCallback((id, preferredAnchor) => {
    if (!ownerAuthoringEnabled) return;
    const rect=canvasObjectRefs.current.get(id)?.getBoundingClientRect(); const width=Math.min(300,window.innerWidth-24);
    const anchor=preferredAnchor || (rect ? {x:rect.right+10+width<=window.innerWidth-12?rect.right+10:Math.max(12,rect.left-width-10),y:Math.max(12,Math.min(rect.top,window.innerHeight-520))}:{x:Math.max(12,(window.innerWidth-width)/2),y:72});
    setArtworkInspector({id,anchor}); setSelectedCanvasObjectId(id); setSelectedSceneId(null); setInspectorAnchor(null);
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

  const chooseArtwork = useCallback((asset) => {
    if (!ownerAuthoringEnabled) return;
    if(!artworkChooser||artworkChoicePendingRef.current)return; artworkChoicePendingRef.current=true;
    if(artworkChooser.mode==='replace'&&artworkChooser.targetId){replaceCanvasObjectAsset(artworkChooser.targetId,asset.id);setArtworkChooser(null);openArtworkInspector(artworkChooser.targetId,artworkChooser.anchor);return;}
    const id=createCanvasObject({kind:CANVAS_OBJECT_KIND.FRAMED_ARTWORK,stableAssetId:asset.id,placement:artworkChooser.placement});
    setArtworkChooser(null);if(id)openArtworkInspector(id,artworkChooser.anchor);
  },[artworkChooser,createCanvasObject,openArtworkInspector,ownerAuthoringEnabled,replaceCanvasObjectAsset]);

  const openArtworkPreview = useCallback((id)=>{setPreviewObjectId(id);setArtworkInspector(null);setSelectedCanvasObjectId(null);},[]);
  const closeArtworkPreview = useCallback(()=>{const id=previewObjectId;setPreviewObjectId(null);window.requestAnimationFrame(()=>canvasObjectRefs.current.get(id)?.querySelector('button')?.focus());},[previewObjectId]);

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
    const runtimeId = target.id?.endsWith('-panel') ? target.id.replace('-panel','') : target.id?.startsWith('folder-panel:') ? target.id.slice(13) : target.id;
    const launcher = pinnedLaunchers.find((entry) => entry.id === (target.type === 'window' ? runtimeId : target.id));
    if (command === 'menu-create') { setContextMenu((current) => ({ ...current, menu: 'create' })); return; }
    if (command === 'menu-view') { setContextMenu((current) => ({ ...current, menu: 'view' })); return; }
    if (command === 'menu-layer') { setContextMenu((current) => ({ ...current, menu: 'layer' })); return; }
    if (command === 'menu-root') { setContextMenu((current) => ({ ...current, menu: 'root' })); return; }
    if (command === 'create-folder') createFolderAtContext();
    else if (command === 'create-framed-artwork') { beginArtworkChoice('create'); return; }
    else if (command === 'toggle-keeper') onKeeperVisibilityChange?.(!keeperVisible);
    else if (command === 'toggle-stage') onStageVisibilityChange?.(!stageVisible);
    else if (command === 'toggle-edit') setEditMode((value) => !value);
    else if (command === 'toggle-grid') toggleGrid();
    else if (command === 'reset-home-camera') setHomeCameraImmediately(homeOrigin);
    else if (command === 'reset-windows') resetWindows();
    else if (command === 'close-all') closeAllWindows();
    else if (command === 'settings') setActiveHudCommand('settings');
    else if (command === 'open') openModule(target.id);
    else if (command === 'edit-launcher') openLauncherInspector(target.id);
    else if (command === 'toggle-visibility' && launcher) setLauncherVisitorVisibility(launcher.id, !launcher.visitorVisible);
    else if (command === 'unpin' && launcher) unpinView({ type: launcher.viewType, id: launcher.folderId });
    else if (command === 'open-artwork') openArtworkPreview(target.id);
    else if (command === 'edit-artwork') openArtworkInspector(target.id);
    else if (command === 'replace-artwork') { beginArtworkChoice('replace',target.id); return; }
    else if (command === 'toggle-object-visibility' && canvasObjectById[target.id]) setCanvasObjectVisitorVisibility(target.id,!canvasObjectById[target.id].visitorVisible);
    else if (command === 'object-forward') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.FORWARD);
    else if (command === 'object-backward') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.BACKWARD);
    else if (command === 'object-front') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.FRONT);
    else if (command === 'object-back') reorderCanvasObject(target.id,CANVAS_OBJECT_ORDER_COMMAND.BACK);
    else if (command === 'remove-artwork' && window.confirm('Remove this framed artwork from the canvas? The owned asset will remain in your library.')) { removeCanvasObject(target.id); setArtworkInspector(null); setSelectedCanvasObjectId(null); }
    else if (command === 'close') openModule(runtimeId);
    else if (command === 'reset-window') updateRuntime({
      type: 'reset-window',
      id: runtimeId,
      rect: launcher
        ? defaultFolderWindowGridRect(placementGeometry, sceneById[launcher.id]?.geometry)
        : authoredWindowDefaults.rects[runtimeId] || null
    });
    else if (command === 'toggle-start-open') {
      const rect = runtimeWindows.rects[runtimeId] || defaultWindowGridRect(runtimeId, geometry, canvasPositions[runtimeId]);
      if (launcher) setLauncherStartOpen(launcher.id, !launcher.startOpen, rect);
      else setSystemPresentation((current) => { const next={...current,[runtimeId]:{...current[runtimeId],startOpen:!current[runtimeId]?.startOpen,windowGeometry:rect}}; try{window.localStorage.setItem(SYSTEM_SCENE_KEY,JSON.stringify(next));}catch{} return next; });
    }
    setContextMenu(null);
  }, [authoredWindowDefaults, beginArtworkChoice, canvasObjectById, canvasPositions, closeAllWindows, contextMenu, createFolderAtContext, geometry, homeOrigin, keeperVisible, onKeeperVisibilityChange, onStageVisibilityChange, openArtworkInspector, openArtworkPreview, openLauncherInspector, openModule, ownerAuthoringEnabled, pinnedLaunchers, placementGeometry, removeCanvasObject, reorderCanvasObject, resetWindows, runtimeWindows.rects, sceneById, setCanvasObjectVisitorVisibility, setHomeCameraImmediately, setLauncherStartOpen, setLauncherVisitorVisibility, stageVisible, toggleGrid, unpinView, updateRuntime, workspace.profileAddress]);

  useEffect(() => {
    if (!contextMenu) return;
    const exists = contextMenu.target.type === 'canvas' || sceneById[contextMenu.target.id] || canvasObjectById[contextMenu.target.id] || runtimeWindows.openIds.includes(contextMenu.target.id.replace?.('-panel','')) || contextMenu.target.id.startsWith?.('folder-panel:');
    if (!exists) setContextMenu(null);
  }, [canvasObjectById, contextMenu, runtimeWindows.openIds, sceneById]);

  useEffect(() => {
    if (!inspectorAnchor) return undefined;
    const close = (event) => { if (event.key === 'Escape') { setInspectorAnchor(null); moduleRefs.current.get(selectedSceneId)?.focus(); } };
    const outside = (event) => { if (!launcherInspectorRef.current?.contains(event.target) && !moduleRefs.current.get(selectedSceneId)?.contains(event.target)) setInspectorAnchor(null); };
    window.addEventListener('keydown', close); window.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', outside, true); };
  }, [inspectorAnchor, selectedSceneId]);

  const collectionDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'collection-panel', collectionPanelPosition, collectionPanelRef, true),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  };

  const creationsDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'creations-panel', creationsPanelPosition, creationsPanelRef, true),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  };

  const signalsDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'signals-panel', signalsPanelPosition, signalsPanelRef, true),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  };

  const folderDragProps = openFolderLauncher ? {
    onPointerDown: (event) => startExpandedPanelDrag(event, `folder-panel:${openFolderLauncher.id}`, openFolderPosition, folderPanelRef, true),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  } : {};

  if (previewDocument) return <ProfileDocumentPreview document={previewDocument} onExit={stopPreview} />;

  const spatialLayerTarget = typeof document === 'undefined' ? null : document.querySelector('.application-root');

  return (
    <main
      className="public-shell"
      data-application-mode="public"
      data-identity-open={identityOpen || undefined}
      data-actor-id={activeActorId}
      data-layout-mode={geometry.narrow ? 'narrow' : 'desktop'}
      data-interface-visible={interfaceVisible || undefined}
      data-entry-sequence={revealPresentation.sequence}
      data-reduced-motion={revealPresentation.reducedMotion || undefined}
      data-edit-mode={editMode || undefined}
      data-gallery-open={galleryOpen || undefined}
      data-dragging={interaction?.activated ? interaction.targetId : undefined}
      style={shellTheme}
      aria-label="OS Underneath public world"
      ref={shellRef}
      onContextMenu={(event) => openTargetContextMenu(event, shellRef.current)}
    >
      {interfaceVisible && <ProfileNavigationDock
        profile={viewedProfile}
        profileExpanded={identityOpen}
        onProfileExpandedChange={(expanded) => {
          setIdentityOpen(expanded);
          setIdentityPhase(expanded ? 'open' : 'closed');
          setActiveModuleId(expanded ? 'identity' : null);
          updateRuntime({ type: expanded ? 'open' : 'close', id: 'identity' });
        }}
        categories={navigationCategories}
        activeCategoryId={openFolderLauncherId}
        onCategorySelect={(category) => activateLauncher(category.id)}
      />}
      <header className="public-shell__masthead">
        <div className="system-hud__primary">
          <button className="system-sigil" type="button" aria-label="Open OS Underneath system menu" aria-expanded={activeHudCommand === 'system'} onClick={() => { setActiveHudCommand((current)=>current==='system'?null:'system'); setContextMenu(null); }}><img src="/assets/logo/underneath_os.webp" alt="" /></button>
          <nav className="system-hud__destinations" aria-label="Profile destinations">
            {ownerAuthoringEnabled && <button type="button" data-active={signalsOpen || undefined} ref={(node)=>{if(node)moduleRefs.current.set('signals',node);else moduleRefs.current.delete('signals');}} onClick={()=>activateSystemDestination('signals')}>[ Activity ]</button>}
            <button type="button" data-active={galleryOpen || undefined} aria-pressed={galleryOpen} ref={(node)=>{if(node)moduleRefs.current.set('gallery',node);else moduleRefs.current.delete('gallery');}} onClick={()=>{if(!galleryOpen)enterGallery();}}>[ Gallery ]</button>
            <button type="button" data-active={creationsOpen || undefined} aria-expanded={creationsOpen} ref={(node)=>{if(node)moduleRefs.current.set('creations',node);else moduleRefs.current.delete('creations');}} onClick={()=>activateSystemDestination('creations')}>[ Creations ]</button>
            {ownerAuthoringEnabled && <button type="button" data-active={collectionOpen || undefined} ref={(node)=>{if(node)moduleRefs.current.set('collection',node);else moduleRefs.current.delete('collection');}} onClick={()=>activateSystemDestination('collection')}>[ Library ]</button>}
          </nav>
        </div>

        <nav className="system-hud__commands" aria-label="OS Underneath controls">
          <button
            type="button"
            aria-pressed={activeHudCommand === 'search'}
            onClick={openCollectionSearch}
          >
            [ Search ]
          </button>
          {ownerAuthoringEnabled && <button type="button" onClick={() => setActiveHudCommand((current) => current === 'share' ? null : 'share')} aria-expanded={activeHudCommand === 'share'}>[ Share ]</button>}
          {galleryOpen
            ? <button type="button" onClick={exitGallery}>[ Exit Gallery ]</button>
            : ownerAuthoringEnabled && <button type="button" onClick={() => setEditMode((current) => !current)} aria-pressed={editMode}>[ {editMode ? 'Done Arranging' : 'Arrange Desktop'} ]</button>}
          {ownerAuthoringEnabled && editMode && !galleryOpen && <button type="button" onClick={() => { if(window.confirm('Reset the authored desktop layout? Folders, owned assets, visibility, and runtime windows will be preserved.')) resetLayout(); }}>[ Reset Authored Canvas ]</button>}
          {ownerAuthoringEnabled && <button
            type="button"
            aria-pressed={activeHudCommand === 'settings'}
            onClick={() => setActiveHudCommand((current) => current === 'settings' ? null : 'settings')}
          >
            [ Settings ]
          </button>}
        </nav>
      </header>

      <div className="system-signature" aria-hidden="true"><strong>OS_UNDERNEATH</strong><span>LUKSO MAINNET</span><i /> <span>LIVE</span></div>
      {!galleryOpen && keeperVisible && <KeeperDock ref={keeperDockRef} actorId={activeActorId} residentHandoff={residentHandoff} reducedMotion={revealPresentation.reducedMotion} onDockStateChange={setKeeperDockActive} />}

      {!galleryOpen && <HomeWorldSurface
        camera={homeCamera}
        geometry={geometry}
        world={homeWorld}
        gridVisible={gridVisible}
        theme={shellTheme}
        visible={interfaceVisible}
        onCameraChange={setHomeCameraImmediately}
        onMoveKeeper={moveKeeperFromHome}
        onOpenContextMenu={openWorldContextMenu}
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
        {!galleryOpen && spatialLayerTarget && createPortal(<div
          ref={spatialLayerRef}
          className="module-grid__spatial-layer"
          data-desktop-canvas
          data-edit-mode={editMode || undefined}
          data-entry-sequence={revealPresentation.sequence}
          data-visible={interfaceVisible || undefined}
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
        {false && MODULES.map(({ id, label }) => {
          const scene = sceneById[id];
          const displayLabel = scene?.label || label;
          const isActive = activeModuleId === id || (id === 'identity' && identityOpen) || (id === 'collection' && collectionOpen) || (id === 'creations' && creationsOpen) || (id === 'signals' && signalsOpen);
          const entryAvailable = availableModuleIds.has(id);
          const entryIndex = MODULE_ENTRY_ORDER[id];
          return (
            <button
              className="module-shell module-button"
              data-module-shell
              data-module-id={id}
              data-launcher-id={id}
              data-module-entry-index={entryIndex}
              data-entry-state={entryAvailable ? 'ready' : 'pending'}
              data-active={isActive || undefined}
              data-selected={editMode && selectedSceneId === id || undefined}
              data-interacting={interaction?.targetId === id || undefined}
              data-invalid-geometry={interaction?.targetId === id && !interaction.valid || undefined}
              key={id}
              type="button"
              disabled={!entryAvailable}
              aria-hidden={!entryAvailable || undefined}
              aria-expanded={id === 'identity' ? identityOpen : id === 'collection' ? collectionOpen : id === 'creations' ? creationsOpen : id === 'signals' ? signalsOpen : undefined}
              aria-pressed={id === 'identity' ? undefined : isActive}
              aria-label={`Open ${displayLabel} module`}
              style={{
                ...moduleStyle(id, scene?.span, 2),
                '--module-entry-index': entryIndex
              }}
              ref={(node) => {
                if (node) moduleRefs.current.set(id, node);
                else moduleRefs.current.delete(id);
              }}
              onPointerDown={(event) => { if(editMode)setSelectedSceneId(id); startDrag(event, id, scene?.span, editMode); }}
              onPointerMove={moveInteraction}
              onPointerUp={finishInteraction}
              onPointerCancel={(event)=>finishInteraction(event,true)}
              onLostPointerCapture={(event)=>finishInteraction(event,true)}
              onClick={() => activateLauncher(id)}
            >
              {scene?.appearanceMode !== 'label' && <b className="module-button__icon" aria-hidden="true">{iconGlyph(scene.iconKey)}</b>}
              {scene?.appearanceMode !== 'icon' && <span>{displayLabel}</span>}
              {editMode && <i className="module-button__resize" data-resize-control aria-label={`Resize ${displayLabel}`} onPointerDown={(event)=>startResize(event,id)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
            </button>
          );
        })}

        {pinnedLaunchers.map((launcher, launcherIndex) => {
          const folder = workspace.folders.find((entry) => entry.id === launcher.folderId);
          const label = launcher.viewType === 'favorites' ? launcher.label || 'Favorites' : folder?.name || 'Missing folder';
          const count = launcher.viewType === 'favorites' ? workspace.favorites.length : folder?.assetIds.length || 0;
          const isActive = activeModuleId === launcher.id || openFolderLauncherId === launcher.id;
          const entryAvailable = availableModuleIds.has(launcher.id);
          const entryIndex = MODULES.length + launcherIndex;
          const scene = sceneById[launcher.id];
          return (
            <button
              className="module-shell module-button module-button--folder"
              data-module-shell
              data-module-id={launcher.id}
              data-launcher-id={launcher.id}
              data-module-entry-index={entryIndex}
              data-entry-state={entryAvailable ? 'ready' : 'pending'}
              data-active={isActive || undefined}
              data-selected={editMode && selectedSceneId === launcher.id || undefined}
              data-visitor-visible={launcher.visitorVisible || undefined}
              data-interacting={interaction?.targetId === launcher.id || undefined}
              data-invalid-geometry={interaction?.targetId === launcher.id && !interaction.valid || undefined}
              key={launcher.id}
              type="button"
              disabled={!entryAvailable}
              aria-hidden={!entryAvailable || undefined}
              aria-expanded={openFolderLauncherId === launcher.id}
              aria-label={`Open ${label} folder, ${count} assets`}
              style={{ ...moduleStyle(launcher.id, scene?.span, 2), '--module-entry-index': entryIndex }}
              ref={(node) => {
                if (node) moduleRefs.current.set(launcher.id, node);
                else moduleRefs.current.delete(launcher.id);
              }}
              onPointerDown={(event) => { if(editMode)setSelectedSceneId(launcher.id); startDrag(event, launcher.id, scene?.span, editMode); }}
              onPointerMove={moveInteraction}
              onPointerUp={finishInteraction}
              onPointerCancel={(event)=>finishInteraction(event,true)}
              onLostPointerCapture={(event)=>finishInteraction(event,true)}
              onClick={() => activateLauncher(launcher.id)}
            >
              {scene?.appearanceMode !== 'label' && <b className="module-button__icon" aria-hidden="true">{iconGlyph(scene.iconKey)}</b>}
              {scene?.appearanceMode !== 'icon' && <span className="module-button__label">{label}</span>}
              {scene?.appearanceMode !== 'icon' && <small>{count}</small>}
              {editMode && <em className="module-button__visibility">{launcher.visitorVisible ? 'PUBLIC' : 'PRIVATE'}</em>}
              {editMode && <i className="module-button__resize" data-resize-control aria-label={`Resize ${label}`} onPointerDown={(event)=>startResize(event,launcher.id)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
            </button>
          );
        })}

        {/* Authored objects follow the spatial camera. Runtime windows, HUD,
            menus, and dialogs remain viewport-fixed above the resident. */}
        {canvasObjects.map((object) => {
          const scene=canvasObjectScenes[object.id]; if(!scene)return null; const asset=libraryAssets.find((entry)=>entry.id===object.stableAssetId) || null;
          const interactionProps={onPointerDown:(event)=>{setSelectedCanvasObjectId(object.id);startObjectDrag(event,object.id);},onPointerMove:moveInteraction,onPointerUp:finishInteraction,onPointerCancel:(event)=>finishInteraction(event,true),onLostPointerCapture:(event)=>finishInteraction(event,true)};
          const resizeProps={onPointerDown:(event)=>startObjectResize(event,object.id),onPointerMove:moveInteraction,onPointerUp:finishInteraction,onPointerCancel:(event)=>finishInteraction(event,true),onLostPointerCapture:(event)=>finishInteraction(event,true)};
          return <FramedArtwork key={object.id} object={object} asset={asset} arranging={editMode} compact={geometry.narrow} editable={ownerAuthoringEnabled} selected={selectedCanvasObjectId===object.id}
            style={{...gridRectToPixelRect(scene.geometry,geometry,2),zIndex:10+object.presentationOrder}} containerRef={(node)=>{if(node)canvasObjectRefs.current.set(object.id,node);else canvasObjectRefs.current.delete(object.id);}}
            interactionProps={interactionProps} resizeProps={resizeProps} onEdit={()=>openArtworkInspector(object.id)} onActivate={()=>{if(suppressLauncherClickRef.current){suppressLauncherClickRef.current=false;return;}if(editMode){setSelectedCanvasObjectId(object.id);return;}openArtworkPreview(object.id);}} />;
        })}
        </div>, spatialLayerTarget)}

        {ownerAuthoringEnabled && collectionOpen && collectionPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection"
            data-module-shell
            data-module-id="collection-panel"
            ref={collectionPanelRef}
            data-interacting={interaction?.targetId === 'collection-panel' || undefined}
            style={{...windowStyle(collectionPanelPosition),zIndex:windowZIndex(runtimeWindows,'collection')}}
            role="dialog"
            aria-modal="false"
            aria-labelledby="collection-title"
            onPointerDownCapture={() => { setActiveModuleId('collection'); updateRuntime({type:'focus',id:'collection'}); }}
          >
            <CollectionWindow
              dragHandleProps={collectionDragProps}
              dragEnabled={!geometry.narrow}
              canAuthorLibrary={ownerAuthoringEnabled}
              escapeEnabled={activeModuleId === 'collection'}
              onClose={() => {
                setCollectionOpen(false); updateRuntime({type:'close',id:'collection'});
                setActiveModuleId(identityOpen ? 'identity' : null);
                setActiveHudCommand((current) => current === 'search' ? null : current);
                window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
              }}
            />
            {!geometry.narrow && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label="Resize Library" onPointerDown={(event)=>startWindowResize(event,'collection-panel',collectionPanelPosition,collectionPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {creationsOpen && creationsPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--creations"
            data-module-shell
            data-module-id="creations-panel"
            ref={creationsPanelRef}
            data-interacting={interaction?.targetId === 'creations-panel' || undefined}
            style={{...windowStyle(creationsPanelPosition),zIndex:windowZIndex(runtimeWindows,'creations')}}
            role="dialog"
            aria-modal="false"
            aria-labelledby="creations-title"
            onPointerDownCapture={() => { setActiveModuleId('creations'); updateRuntime({type:'focus',id:'creations'}); }}
          >
            <CreationsWindow
              viewedProfileAddress={viewedProfileAddress}
              dragHandleProps={creationsDragProps}
              dragEnabled={!geometry.narrow}
              escapeEnabled={activeModuleId === 'creations'}
              onClose={() => {
                setCreationsOpen(false); updateRuntime({type:'close',id:'creations'});
                setActiveModuleId(identityOpen ? 'identity' : collectionOpen ? 'collection' : signalsOpen ? 'signals' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get('creations')?.focus());
              }}
            />
            {!geometry.narrow && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label="Resize Creations" onPointerDown={(event)=>startWindowResize(event,'creations-panel',creationsPanelPosition,creationsPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {ownerAuthoringEnabled && signalsOpen && signalsPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--signals"
            data-module-shell
            data-module-id="signals-panel"
            ref={signalsPanelRef}
            data-interacting={interaction?.targetId === 'signals-panel' || undefined}
            style={{...windowStyle(signalsPanelPosition),zIndex:windowZIndex(runtimeWindows,'signals')}}
            role="dialog"
            aria-modal="false"
            aria-labelledby="signals-title"
            onPointerDownCapture={() => { setActiveModuleId('signals'); updateRuntime({type:'focus',id:'signals'}); }}
          >
            <SignalsWindow
              dragHandleProps={signalsDragProps}
              dragEnabled={!geometry.narrow}
              editMode={ownerAuthoringEnabled && editMode}
              escapeEnabled={activeModuleId === 'signals'}
              onClose={() => {
                setSignalsOpen(false); updateRuntime({type:'close',id:'signals'});
                setActiveModuleId(identityOpen ? 'identity' : collectionOpen ? 'collection' : creationsOpen ? 'creations' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get('signals')?.focus());
              }}
            />
            {!geometry.narrow && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label="Resize Activity" onPointerDown={(event)=>startWindowResize(event,'signals-panel',signalsPanelPosition,signalsPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {openFolderLauncher && openFolderPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--folder"
            data-module-shell
            data-module-id={`folder-panel:${openFolderLauncher.id}`}
            data-entry-origin={folderEntryOrigin ? 'launcher' : undefined}
            ref={folderPanelRef}
            data-interacting={interaction?.targetId === `folder-panel:${openFolderLauncher.id}` || undefined}
            style={{...windowStyle(openFolderPosition),...(folderEntryOrigin || {}),zIndex:windowZIndex(runtimeWindows,openFolderLauncher.id)}}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`folder-title-${openFolderLauncher.id}`}
            onPointerDownCapture={() => { setActiveModuleId(openFolderLauncher.id); updateRuntime({type:'focus',id:openFolderLauncher.id}); }}
          >
            <FolderWindow
              launcher={openFolderLauncher}
              dragHandleProps={folderDragProps}
              dragEnabled={!geometry.narrow}
              canAuthorLibrary={ownerAuthoringEnabled}
              windowGeometry={openFolderPosition}
              escapeEnabled={activeModuleId === openFolderLauncher.id}
              onClose={() => {
                const launcherId = openFolderLauncher.id;
                setOpenFolderLauncherId(null); updateRuntime({type:'close',id:launcherId});
                setActiveModuleId(identityOpen ? 'identity' : collectionOpen ? 'collection' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get(launcherId)?.focus());
              }}
            />
            {!geometry.narrow && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label="Resize folder window" onPointerDown={(event)=>startWindowResize(event,`folder-panel:${openFolderLauncher.id}`,openFolderPosition,folderPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}
      </section>
      {galleryOpen && <GalleryWorld
        objects={canvasObjects}
        assets={libraryAssets}
        theme={shellTheme}
        onOpenArtwork={openArtworkPreview}
        onExit={exitGallery}
        onMoveKeeper={(clientX, clientY) => residentHandoff?.moveToScreenPosition?.(clientX, clientY)}
        onMoveKeeperHorizontally={(clientX) => residentHandoff?.moveHorizontallyToScreenPosition?.(clientX)}
      />}
      {ownerAuthoringEnabled && <>
      {inspectorAnchor && selectedSceneId && sceneById[selectedSceneId] && (()=>{ const scene=sceneById[selectedSceneId]; const launcher=pinnedLaunchers.find((entry)=>entry.id===selectedSceneId); const folder=launcher?.folderId?workspace.folders.find((entry)=>entry.id===launcher.folderId):null; const fixedName=Object.hasOwn(MODULE_ENTRY_ORDER,selectedSceneId)||Boolean(folder); const currentName=folder?.name||launcher?.label||scene.label||MODULES.find((entry)=>entry.id===selectedSceneId)?.label||'Launcher'; const saveName=(value)=>{if(fixedName)return;const name=value.trim();if(!name)return;if(launcher)setLauncherPresentation(launcher.id,{label:name});}; return <aside key={selectedSceneId} ref={launcherInspectorRef} className="launcher-inspector" aria-label="Launcher appearance" style={{left:inspectorAnchor.x,top:inspectorAnchor.y}}>
        <strong>Launcher</strong><span>{selectedSceneId}</span>
        <label className="launcher-inspector__name">Name<input autoFocus={!fixedName} disabled={fixedName} aria-label="Launcher name" defaultValue={currentName} onBlur={(event)=>saveName(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter'){event.currentTarget.blur();}if(event.key==='Escape'){event.currentTarget.value=currentName;event.currentTarget.blur();}}} /></label>
        <label>Display<select value={scene.appearanceMode} onChange={(event)=>updatePresentation(selectedSceneId,{appearanceMode:event.target.value,span:normalizeSpan(scene.span,event.target.value,geometry)})}><option value="label">Label</option><option value="icon">Icon</option><option value="icon_label">Icon + label</option></select></label>
        <label>Icon<select value={scene.iconKey} onChange={(event)=>updatePresentation(selectedSceneId,{iconKey:event.target.value})}>{Object.keys(SCENE_ICONS).map((key)=><option key={key} value={key}>{key}</option>)}</select></label>
        <div className="launcher-inspector__presets">{Object.entries(LAUNCHER_SIZE_PRESETS).map(([name,preset])=><button key={name} type="button" onClick={()=>updatePresentation(selectedSceneId,{appearanceMode:preset.appearanceMode,span:{columns:preset.columns,rows:preset.rows}})}>{name}</button>)}</div>
        <label>Width<input aria-label="Launcher width in cells" type="number" min={scene.appearanceMode==='icon'?1:2} max="12" value={scene.span.columns} onChange={(event)=>updatePresentation(selectedSceneId,{span:{...scene.span,columns:Number(event.target.value)}})} /></label>
        <label>Height<input aria-label="Launcher height in cells" type="number" min="1" max="8" value={scene.span.rows} onChange={(event)=>updatePresentation(selectedSceneId,{span:{...scene.span,rows:Number(event.target.value)}})} /></label>
        {launcher && !folder && <button type="button" aria-pressed={launcher.visitorVisible} onClick={()=>setLauncherVisitorVisibility(launcher.id,!launcher.visitorVisible)}>{launcher.visitorVisible?'Make private':'Show to visitors'}</button>}
        <button type="button" onClick={toggleGrid}>Grid {gridVisible?'off':'on'}</button>
      </aside>; })()}
      {artworkInspector && canvasObjectById[artworkInspector.id] && (()=>{const object=canvasObjectById[artworkInspector.id];const scene=canvasObjectScenes[object.id];const asset=libraryAssets.find((entry)=>entry.id===object.stableAssetId);const definition=getCanvasObjectDefinition(object.kind);return <ArtworkInspector object={object} assetName={asset?.name||'Unavailable artwork'} anchor={artworkInspector.anchor} onClose={()=>{setArtworkInspector(null);setSelectedCanvasObjectId(null);canvasObjectRefs.current.get(object.id)?.querySelector('button')?.focus();}} onPresentation={(patch)=>setCanvasObjectPresentation(object.id,patch)} onGeometry={(span)=>{const columns=Math.max(definition.minimumSpan.columns,Math.min(definition.maximumSpan.columns,Math.round(span.columns)||object.span.columns));const rows=Math.max(definition.minimumSpan.rows,Math.min(definition.maximumSpan.rows,Math.round(span.rows)||object.span.rows));const rect=normalizeGridRect({...scene.geometry,columnSpan:columns,rowSpan:rows},placementGeometry,{minimumSpan:definition.minimumSpan});setCanvasObjectGeometry(object.id,rect);}} onVisibility={()=>setCanvasObjectVisitorVisibility(object.id,!object.visitorVisible)} onReplace={()=>beginArtworkChoice('replace',object.id)} onReorder={(command)=>reorderCanvasObject(object.id,command)} onRemove={()=>{if(window.confirm('Remove this framed artwork from the canvas? The owned asset will remain in your library.')){removeCanvasObject(object.id);setArtworkInspector(null);setSelectedCanvasObjectId(null);}}} />;})()}
      </>}
      {contextMenu && (()=>{const runtimeId=contextMenu.target.id?.startsWith?.('folder-panel:')?contextMenu.target.id.slice(13):contextMenu.target.id?.replace?.('-panel',''); const launcher=pinnedLaunchers.find((entry)=>entry.id===(contextMenu.target.type==='window'?runtimeId:contextMenu.target.id)); const canvasObject=canvasObjectById[contextMenu.target.id]; const startOpen=launcher?.startOpen||systemPresentation[runtimeId]?.startOpen; return <DesktopMenu key={`${contextMenu.target.type}:${contextMenu.menu}`} anchor={contextMenu.anchor} label={`${contextMenu.target.type} commands`} commands={contextMenuCommands({target:contextMenu.target,editMode,launcher,canvasObject,startOpen,menu:contextMenu.menu,keeperVisible,stageVisible,stageAvailable:false,ownerAuthoringEnabled})} onCommand={executeContextCommand} onClose={()=>setContextMenu(null)} returnFocus={contextMenu.returnFocus}/>;})()}
      {activeHudCommand === 'system' && <DesktopMenu anchor={{x:18,y:68}} label="OS Underneath system menu" commands={[
        {id:'about',label:'About OS_UNDERNEATH'}, {id:'status',label:`Profile / ${workspace.profileAddress.slice(0,8)}…`},
        ...(ownerAuthoringEnabled ? [{id:'atelier',label:'Open Atelier'}, {id:'edit',label:editMode?'Finish Arranging':'Arrange Desktop'}, {id:'settings',label:'Settings'}] : []),
        {id:'home',label:'Return World to Origin'}, {id:'reset',label:'Reset Windows'}, {id:'close-all',label:'Close All Windows'}
      ]} onCommand={(command)=>{if(command==='about'||command==='status')setActiveHudCommand('about');else if(command==='atelier'&&ownerAuthoringEnabled){setActiveHudCommand(null);onRequestAtelier?.();}else if(command==='home'){setHomeCameraImmediately(homeOrigin);setActiveHudCommand(null);}else if(command==='edit'&&ownerAuthoringEnabled){setEditMode((value)=>!value);setActiveHudCommand(null);}else if(command==='reset'){resetWindows();setActiveHudCommand(null);}else if(command==='close-all'){closeAllWindows();setActiveHudCommand(null);}else if(command==='settings'&&ownerAuthoringEnabled)setActiveHudCommand('settings');}} onClose={()=>setActiveHudCommand(null)}/>}
      {activeHudCommand === 'about' && <aside className="system-about" role="dialog" aria-label="About OS Underneath"><strong>OS_UNDERNEATH</strong><p>Your profile is not a page. It is a place.</p><small>{workspace.profileAddress}<br/>LUKSO MAINNET / READ-ONLY</small><button type="button" onClick={()=>setActiveHudCommand(null)}>[ Close ]</button></aside>}
      {ownerAuthoringEnabled && <KeeperSignalsLayer
        interfaceReady={interfaceVisible}
        residentHandoffActive={identityPhase !== 'closed' || keeperDockActive}
        reducedMotion={revealPresentation.reducedMotion}
        reactionBridge={keeperReactions}
      />}
      {ownerAuthoringEnabled && activeHudCommand === 'settings' && <SignalSettings />}
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
        onClose={() => setActiveHudCommand(null)}
      />}
      {ownerAuthoringEnabled && artworkChooser && <ArtworkChooser assets={libraryAssets} status={libraryStatus} error={libraryError} title={artworkChooser.mode==='replace'?'Replace artwork':'Choose artwork'} onSelect={chooseArtwork} onCancel={()=>{artworkChoicePendingRef.current=false;setArtworkChooser(null);}} />}
      {previewObjectId && canvasObjectById[previewObjectId] && (()=>{const object=canvasObjectById[previewObjectId];const asset=libraryAssets.find((entry)=>entry.id===object.stableAssetId)||{id:object.stableAssetId,name:'Unavailable artwork',standard:'UNKNOWN',contractAddress:'Unavailable',tokenId:null,imageUrl:null};return <div className="canvas-artwork-preview" role="dialog" aria-modal="true" aria-label={`Artwork preview: ${asset.name}`}><AssetPreview asset={asset} workspace={workspace} authoringEnabled={false} onClose={closeArtworkPreview} /></div>;})()}
      {profileDiscoveryOpen && <ProfileDiscovery
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
