import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import IdentityDossier from './IdentityDossier.jsx';
import { CollectionWindow, FolderWindow, useLibraryStore } from '../library/index.js';
import KeeperSignalsLayer from '../signals/components/KeeperSignalsLayer.jsx';
import SignalSettings from '../signals/components/SignalSettings.jsx';
import SignalsWindow from '../signals/components/SignalsWindow.jsx';
import { useSignalStore } from '../signals/state/useSignalStore.js';
import { useProfileIdentity } from '../profileIdentity/index.js';
import ProfileDocumentPanel from '../profileDocument/components/ProfileDocumentPanel.jsx';
import ProfileDocumentPreview from '../profileDocument/components/ProfileDocumentPreview.jsx';
import { useProfileDocumentStore } from '../profileDocument/state/useProfileDocumentStore.js';
import { buildProfileDocumentV3 } from '../profileDocument/domain/profileDocumentBuilder.js';
import { assertValidProfileDocument } from '../profileDocument/domain/profileDocumentValidation.js';
import { createProfileDocumentRestorePlan } from '../profileDocument/domain/profileDocumentRestore.js';
import { profileDocumentContentFingerprint } from '../profileDocument/domain/profileDocumentSerialization.js';
import { loadProfileSnapshot, profilePresentationKey, saveProfileSnapshot } from '../profileDocument/storage/profileDocumentStorage.js';
import { getIdentityProfileViewModel } from './identity/profileViewModel.js';
import { getPublicTheme } from './themeTokens.js';
import { findScenePlacement, isScenePlacementAvailable, LAUNCHER_SIZE_PRESETS, normalizeSpan, packCompactScene } from './sceneGrid.js';
import { gridRectToPixelRect, launcherGeometryAvailable, movementCandidateFromPointer, normalizeGridRect, resizeCandidateFromPointer } from './gridGeometry.js';
import { activateInteraction, createInteraction, effectiveGeometry, INTERACTION_KIND } from './gridInteraction.js';
import { iconGlyph, normalizeIconKey, SCENE_ICONS } from './sceneIcons.js';
import { decodeWindowGridGeometry, defaultWindowGridRect, windowMinimumSpan } from './windowGeometry.js';
import { createRuntimeWindowState, loadRuntimeWindowState, saveRuntimeWindowState, updateRuntimeWindowState, windowZIndex } from './windows/runtimeWindowState.js';
import { contextMenuCommands, resolveContextTarget } from './menus/contextMenuModel.js';
import DesktopMenu from './menus/DesktopMenu.jsx';
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
import '../signals/signals.css';
import '../profileDocument/profileDocument.css';
import './scenePreview.css';

const MODULES = Object.freeze([
  { id: 'identity', label: 'Profile Card' },
  { id: 'collection', label: 'Collection' },
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
const GRID_PREFERENCE_KEY = 'os-underneath.grid-preference.v1';
const LEGACY_WINDOW_GEOMETRY_KEY = 'os-underneath.window-geometry.v1';
const SYSTEM_ICONS = Object.freeze({ identity: 'profile', collection: 'collection', creations: 'creations', signals: 'signals' });

function defaultSystemPresentation(id, order) { return { appearanceMode: 'label', iconKey: SYSTEM_ICONS[id], span: { columns: 3, rows: 1 }, presentationOrder: order, startOpen: false, windowGeometry: null }; }
function readSystemPresentation() { try { const value = JSON.parse(window.localStorage.getItem(SYSTEM_SCENE_KEY)); return Object.fromEntries(MODULES.map((module, index) => { const item=value?.[module.id]; return [module.id,{ ...defaultSystemPresentation(module.id,index), ...(item || {}), label:typeof item?.label==='string'&&item.label.trim()?item.label.trim().slice(0,80):module.label, iconKey:normalizeIconKey(item?.iconKey,SYSTEM_ICONS[module.id]), span:normalizeSpan(item?.span,item?.appearanceMode) }]; })); } catch { return Object.fromEntries(MODULES.map((module,index)=>[module.id,{...defaultSystemPresentation(module.id,index),label:module.label}])); } }
function readGridPreference(){try{return JSON.parse(window.localStorage.getItem(GRID_PREFERENCE_KEY))?.visible!==false}catch{return true}}
function readLegacyWindowGeometry(geometry){return decodeWindowGridGeometry(window.localStorage.getItem(LEGACY_WINDOW_GEOMETRY_KEY),geometry,readStoredPositions(geometry))}

const profile = getIdentityProfileViewModel();

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

function GridBackdrop({ geometry }) {
  const intersections = [];
  for (let row = 0; row <= geometry.majorRows; row += 1) {
    for (let column = 0; column <= geometry.columns; column += 1) {
      intersections.push({
        x: Math.round(column * geometry.cellWidth),
        y: Math.round(row * geometry.majorCellHeight),
        key: `${column}-${row}`
      });
    }
  }

  return (
    <svg
      className="module-grid__backdrop"
      viewBox={`0 0 ${geometry.usableWidth} ${geometry.usableHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="module-grid__lines">
        {Array.from({ length: geometry.columns + 1 }, (_, index) => (
          <line key={`v-${index}`} x1={Math.round(index * geometry.cellWidth)} y1="0" x2={Math.round(index * geometry.cellWidth)} y2={geometry.usableHeight} />
        ))}
        {Array.from({ length: geometry.majorRows + 1 }, (_, index) => (
          <line key={`h-${index}`} x1="0" y1={Math.round(index * geometry.majorCellHeight)} x2={geometry.usableWidth} y2={Math.round(index * geometry.majorCellHeight)} />
        ))}
      </g>
      <g className="module-grid__crosses">
        {intersections.map(({ x, y, key }) => (
          <circle key={key} cx={x} cy={y} r="1.5" />
        ))}
      </g>
    </svg>
  );
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
  interfaceVisible = true,
  revealPresentation = { sequence: 'short', reducedMotion: false }
}) {
  const [geometry, setGeometry] = useState(getInitialGeometry);
  const [positions, setPositions] = useState(() => readStoredPositions(getInitialGeometry()));
  const [systemPresentation, setSystemPresentation] = useState(readSystemPresentation);
  const [gridVisible, setGridVisible] = useState(readGridPreference);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [runtimeWindows,setRuntimeWindows]=useState(createRuntimeWindowState);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityPhase, setIdentityPhase] = useState('closed');
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionSearchRequest, setCollectionSearchRequest] = useState(0);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [openFolderLauncherId, setOpenFolderLauncherId] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeHudCommand, setActiveHudCommand] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [inspectorAnchor, setInspectorAnchor] = useState(null);
  const [availableModuleIds, setAvailableModuleIds] = useState(() => new Set());
  const moduleRefs = useRef(new Map());
  const identityRef = useRef(null);
  const identityPanelRef = useRef(null);
  const collectionPanelRef = useRef(null);
  const signalsPanelRef = useRef(null);
  const folderPanelRef = useRef(null);
  const launcherInspectorRef = useRef(null);
  const shellRef = useRef(null);
  const gridRef = useRef(null);
  const [interaction, setInteraction] = useState(null);
  const interactionRef = useRef(null);
  const lifecycleHandlersRef = useRef({move:null,finish:null});
  const loadedRuntimeProfileRef = useRef(null);
  const suppressLauncherClickRef = useRef(false);
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

  useEffect(() => {
    registerWorldContextMenu?.(openWorldContextMenu);
    return () => registerWorldContextMenu?.(null);
  }, [openWorldContextMenu, registerWorldContextMenu]);

  const theme = useMemo(() => getPublicTheme(activeActorId), [activeActorId]);
  const workspace = useLibraryStore((state) => state.workspace);
  const libraryAssets = useLibraryStore((state) => state.assets);
  const replaceWorkspace = useLibraryStore((state) => state.replaceWorkspace);
  const signalSettings = useSignalStore((state) => state.settings);
  const replaceSignalSettings = useSignalStore((state) => state.replaceSettings);
  const profileIdentity = useProfileIdentity(workspace.profileAddress);
  const snapshot = useProfileDocumentStore((state) => state.snapshot);
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
  const renameFolder = useLibraryStore((state) => state.renameFolder);
  const pinView = useLibraryStore((state) => state.pinView);
  const pinnedLaunchers = workspace.canvas.launchers;
  const pinnedLauncherKey = pinnedLaunchers.map((launcher) => launcher.id).join('|');
  const sceneItems = useMemo(() => {
    const items=[];
    MODULES.forEach(({id},index)=>{ const presentation=systemPresentation[id] || defaultSystemPresentation(id,index); const span=normalizeSpan(presentation.span,presentation.appearanceMode,geometry); const requested=positions[id] || getDefaultModulePositions(geometry)[id]; const position=isScenePlacementAvailable(id,requested,span,items,geometry)?requested:findScenePlacement(id,requested,span,items,geometry); const itemGeometry={column:position.column,row:position.row,columnSpan:span.columns,rowSpan:span.rows}; items.push({id,position,span,geometry:itemGeometry,...presentation,presentationOrder:index}); });
    pinnedLaunchers.forEach((launcher,index)=>{ const span=normalizeSpan(launcher.span,launcher.appearanceMode,geometry); const fallback={column:0,row:2+index}; const requested=launcher.position||fallback; const position=isScenePlacementAvailable(launcher.id,requested,span,items,geometry)?requested:findScenePlacement(launcher.id,requested,span,items,geometry); const itemGeometry={column:position.column,row:position.row,columnSpan:span.columns,rowSpan:span.rows}; items.push({id:launcher.id,position,span,geometry:itemGeometry,appearanceMode:launcher.appearanceMode||'label',iconKey:normalizeIconKey(launcher.iconKey,launcher.viewType==='favorites'?'favorites':'folder'),presentationOrder:launcher.presentationOrder??MODULES.length+index}); });
    return geometry.narrow ? packCompactScene(items,geometry) : items;
  },[geometry,pinnedLaunchers,positions,systemPresentation]);
  const canvasPositions = useMemo(() => Object.fromEntries(sceneItems.map((item)=>[item.id,item.position])),[sceneItems]);
  const sceneById = useMemo(() => Object.fromEntries(sceneItems.map((item)=>{const effective=effectiveGeometry(item.geometry,interaction,item.id);return [item.id,{...item,geometry:effective,position:{column:effective.column,row:effective.row},span:{columns:effective.columnSpan,rows:effective.rowSpan}}]})),[interaction,sceneItems]);
  const openFolderLauncher = pinnedLaunchers.find((launcher) => launcher.id === openFolderLauncherId) || null;
  const windowGeometryFor = useCallback((key, anchor) => effectiveGeometry(runtimeWindows.rects[key] || defaultWindowGridRect(key,geometry,anchor),interaction,['identity','collection','signals'].includes(key)?`${key}-panel`:`folder-panel:${key}`),[geometry,interaction,runtimeWindows.rects]);
  const identityPanelPosition = windowGeometryFor('identity',canvasPositions.identity);
  const collectionPanelPosition = windowGeometryFor('collection',canvasPositions.collection);
  const signalsPanelPosition = windowGeometryFor('signals',canvasPositions.signals);
  const openFolderPosition = openFolderLauncher ? windowGeometryFor(openFolderLauncher.id,canvasPositions[openFolderLauncher.id]) : null;
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
  const snapshotStale = Boolean(snapshot && useProfileDocumentStore.getState().snapshotDraftFingerprint !== draftFingerprint);

  useEffect(() => {
    if (snapshot) return;
    const stored = loadProfileSnapshot(window.localStorage, workspace.profileAddress);
    if (stored) installSnapshot(stored, profileDocumentContentFingerprint(stored));
  }, [installSnapshot, snapshot, workspace.profileAddress]);

  useEffect(() => {
    let keyExists = false;
    try { keyExists = window.localStorage.getItem(`os-underneath.runtime-windows.v1:${workspace.profileAddress}`) !== null; } catch { /* Storage is optional. */ }
    const loaded = loadRuntimeWindowState(window.localStorage, workspace.profileAddress, { rects: readLegacyWindowGeometry(geometry) });
    const next = keyExists || Object.keys(loaded.rects).length ? loaded : authoredWindowDefaults;
    loadedRuntimeProfileRef.current = workspace.profileAddress;
    setRuntimeWindows(next);
    setIdentityOpen(next.openIds.includes('identity')); setCollectionOpen(next.openIds.includes('collection')); setSignalsOpen(next.openIds.includes('signals'));
    setOpenFolderLauncherId(next.openIds.find((id) => id.startsWith('library:')) || null);
  // Runtime records load only when the active profile changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.profileAddress]);

  useEffect(() => {
    if (loadedRuntimeProfileRef.current === workspace.profileAddress) saveRuntimeWindowState(window.localStorage, workspace.profileAddress, runtimeWindows);
  }, [runtimeWindows, workspace.profileAddress]);

  const buildSnapshot = useCallback(() => {
    try {
      const now = Date.now();
      const document = buildProfileDocumentV3({ profileAddress: workspace.profileAddress, workspace, assets: libraryAssets,
        publicPresentation: { keeperId: activeActorId, stageId, environment }, signalSettings, profileIdentity,
        modulePositions: positions, systemPresentation, revision: (snapshot?.revision || 0) + 1, createdAt: snapshot?.createdAt || now, exportedAt: now });
      const valid = assertValidProfileDocument(document); installSnapshot(valid, profileDocumentContentFingerprint(valid));
      saveProfileSnapshot(window.localStorage, valid); setDocumentError(null);
    } catch (error) { setDocumentError(error.message); }
  }, [activeActorId, environment, installSnapshot, libraryAssets, positions, profileIdentity, setDocumentError, signalSettings, snapshot, stageId, systemPresentation, workspace]);

  const startPreview = useCallback((source) => { enterPreview(source); setActiveHudCommand(null); }, [enterPreview]);
  const stopPreview = useCallback(() => { exitPreview(); onPreviewDocumentChange?.(null); }, [exitPreview, onPreviewDocumentChange]);
  useEffect(() => { onPreviewDocumentChange?.(previewDocument); }, [onPreviewDocumentChange, previewDocument]);

  const restoreImportedPresentation = useCallback(() => {
    if (!importedDocument || !window.confirm('Restore this document’s public presentation? Private Favorites, unpinned folders, Signals history, and caches will be preserved.')) return;
    const previousWorkspace = structuredClone(workspace); const previousSettings = { ...signalSettings };
    const previousPresentation = { keeperId: activeActorId, stageId, environment }; const key = profilePresentationKey(workspace.profileAddress);
    const previousStoredPresentation = window.localStorage.getItem(key);
    try {
      const plan = createProfileDocumentRestorePlan(importedDocument, workspace);
      if (!replaceWorkspace(plan.workspace)) throw new Error('Could not persist restored Canvas Spaces');
      if (!replaceSignalSettings(plan.signalSettings)) throw new Error('Could not persist restored Signals settings');
      window.localStorage.setItem(key, JSON.stringify({ version: 2, keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment }));
      onApplyRestoredPresentation?.({ keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment }); setDocumentError(null);
    } catch (error) {
      replaceWorkspace(previousWorkspace); replaceSignalSettings(previousSettings);
      try { if (previousStoredPresentation == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, previousStoredPresentation); } catch { /* Best-effort rollback. */ }
      onApplyRestoredPresentation?.(previousPresentation); setDocumentError(error.message);
    }
  }, [activeActorId, environment, importedDocument, onApplyRestoredPresentation, replaceSignalSettings, replaceWorkspace, setDocumentError, signalSettings, stageId, workspace]);

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
    pinnedLaunchers.forEach((launcher) => {
      if (!launcher.position && canvasPositions[launcher.id]) setLauncherPosition(launcher.id, canvasPositions[launcher.id]);
    });
  }, [canvasPositions, pinnedLauncherKey, setLauncherPosition]);

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
        setPositions(readStoredPositions(nextGeometry));
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
    const closeIdentity = (event) => {
      if (event.key === 'Escape' && identityOpen && activeModuleId === 'identity') identityRef.current?.requestClose();
    };
    window.addEventListener('keydown', closeIdentity);
    return () => window.removeEventListener('keydown', closeIdentity);
  }, [activeModuleId, identityOpen]);

  useEffect(() => {
    residentHandoff?.trackActorPosition?.([gridRef.current, shellRef.current]);
    return () => residentHandoff?.trackActorPosition?.(null);
  }, [residentHandoff]);

  useEffect(() => {
    if (!identityOpen) return undefined;
    const frame = window.requestAnimationFrame(() => identityRef.current?.updateEntryBounds?.());
    return () => window.cancelAnimationFrame(frame);
  }, [geometry, identityOpen, identityPanelPosition]);

  const persistPositions = useCallback((nextPositions) => {
    if (geometry.narrow) return;
    try {
      window.localStorage.setItem(MODULE_LAYOUT_STORAGE_KEY, encodeModuleLayout(nextPositions));
    } catch (error) {
      console.warn('[ModuleGrid] Could not persist layout:', error);
    }
  }, [geometry.narrow]);

  const updatePresentation = useCallback((id, patch) => {
    const scene=sceneById[id];
    if(scene&&(patch?.span||patch?.appearanceMode)){
      const appearanceMode=patch.appearanceMode||scene.appearanceMode;
      const span=normalizeSpan(patch.span||scene.span,appearanceMode,geometry);
      const candidate={...scene.geometry,columnSpan:span.columns,rowSpan:span.rows};
      if(!launcherGeometryAvailable(id,candidate,sceneItems,geometry))return;
      patch={...patch,span};
    }
    if (Object.hasOwn(MODULE_ENTRY_ORDER,id)) setSystemPresentation((current)=>{ const next={...current,[id]:{...current[id],...patch}}; try{window.localStorage.setItem(SYSTEM_SCENE_KEY,JSON.stringify(next));}catch{} return next; });
    else setLauncherPresentation(id,patch);
  },[geometry,sceneById,sceneItems,setLauncherPresentation]);
  const updateRuntime = useCallback((action) => setRuntimeWindows((current) => updateRuntimeWindowState(current, action)), []);
  const commitWindowGeometry=useCallback((id,rect)=>{const key=id.startsWith('folder-panel:')?id.slice('folder-panel:'.length):id.replace('-panel','');updateRuntime({ type: 'geometry', id: key, rect });},[updateRuntime]);

  const commitLauncherGeometry = useCallback((id,rect) => {
    if (!Object.hasOwn(MODULE_ENTRY_ORDER,id)) { setLauncherGeometry(id,rect); return; }
    const nextPositions={...positions,[id]:{column:rect.column,row:rect.row}};setPositions(nextPositions);persistPositions(nextPositions);
    const nextPresentation={...systemPresentation,[id]:{...systemPresentation[id],span:{columns:rect.columnSpan,rows:rect.rowSpan}}};setSystemPresentation(nextPresentation);try{window.localStorage.setItem(SYSTEM_SCENE_KEY,JSON.stringify(nextPresentation))}catch{}
  },[persistPositions,positions,setLauncherGeometry,systemPresentation]);

  const commitPosition = useCallback((id, position) => {
    if (!Object.hasOwn(MODULE_ENTRY_ORDER, id)) {
      setLauncherPosition(id, position);
      return;
    }
    setPositions((current) => {
      const next = { ...current, [id]: position };
      persistPositions(next);
      return next;
    });
  }, [persistPositions, setLauncherPosition]);

  const openModule = useCallback((id) => {
    const folderLauncher = pinnedLaunchers.find((launcher) => launcher.id === id);
    if (folderLauncher) {
      const closing = openFolderLauncherId === id;
      if (!closing && openFolderLauncherId) updateRuntime({ type: 'close', id: openFolderLauncherId });
      setOpenFolderLauncherId(closing ? null : id);
      setActiveModuleId(closing ? null : id);
      updateRuntime({ type: closing ? 'close' : 'open', id });
      return;
    }
    if (id === 'identity' && identityOpen) {
      identityRef.current?.requestClose();
      return;
    }
    if (id === 'collection' && collectionOpen) {
      setCollectionOpen(false);
      updateRuntime({ type: 'close', id });
      setActiveModuleId(null);
      window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
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
    if (id === 'signals') {
      setSignalsOpen(true);
      return;
    }
    if (id !== 'identity') return;
    setIdentityPhase('approaching');
    setIdentityOpen(true);
  }, [collectionOpen, identityOpen, openFolderLauncherId, pinnedLaunchers, signalsOpen, updateRuntime]);

  const openCollectionSearch = useCallback(() => {
    if (!collectionOpen) openModule('collection');
    setActiveModuleId('collection');
    setActiveHudCommand('search');
    setCollectionSearchRequest((value) => value + 1);
  }, [collectionOpen, openModule]);

  const moduleStyle = useCallback((id) => gridRectToPixelRect(sceneById[id].geometry,geometry,2), [geometry,sceneById]);
  const windowStyle=useCallback((rect)=>geometry.narrow?{left:0,top:0,width:geometry.usableWidth,height:geometry.usableHeight}:gridRectToPixelRect(rect,geometry,2),[geometry]);

  const installInteraction = useCallback((next,event) => {
    if (interactionRef.current || !next) return false;
    interactionRef.current = next; setInteraction(next);
    next.captureElement.setPointerCapture?.(event.pointerId);
    return true;
  },[]);

  const beginInteraction = useCallback((event,{kind,targetId,rect,element,minimumSpan})=>{
    const launcherKind=kind===INTERACTION_KIND.MOVE_LAUNCHER||kind===INTERACTION_KIND.RESIZE_LAUNCHER;
    if(geometry.narrow||(launcherKind&&!editMode)||!rect||!element||event.pointerType==='mouse'&&event.button!==0)return;
    if(kind===INTERACTION_KIND.MOVE_WINDOW&&event.target.closest('button,a,input,select,textarea,[data-resize-control]'))return;
    event.preventDefault();
    if(kind.includes('RESIZE'))event.stopPropagation();
    const rendered=element.getBoundingClientRect();
    const resize=kind.includes('RESIZE');
    const next=createInteraction({kind,targetId,pointerId:event.pointerId,originGeometry:rect,gridBounds:{columns:geometry.columns,rows:geometry.rows},cellWidth:geometry.cellWidth,cellHeight:geometry.cellHeight,pointerGrabOffset:resize?{x:event.clientX-rendered.right,y:event.clientY-rendered.bottom}:{x:event.clientX-rendered.left,y:event.clientY-rendered.top},startPointer:{x:event.clientX,y:event.clientY},captureElement:event.target});
    next.gridClientRect=gridRef.current.getBoundingClientRect();next.minimumSpan=minimumSpan;
    installInteraction(next,event);
  },[editMode,geometry,installInteraction]);

  const moveInteraction = useCallback((event)=>{
    const current=interactionRef.current;if(!current||event.pointerId!==current.pointerId)return;
    if(current.kind.includes('RESIZE'))event.stopPropagation();
    if(!current.activated&&Math.hypot(event.clientX-current.startPointer.x,event.clientY-current.startPointer.y)<6)return;
    const input={pointer:{x:event.clientX,y:event.clientY},gridClientRect:current.gridClientRect,pointerGrabOffset:current.pointerGrabOffset,originGeometry:current.originGeometry,geometry,inset:2};
    const proposed=current.kind.includes('RESIZE')?resizeCandidateFromPointer({...input,minimumSpan:current.minimumSpan}):movementCandidateFromPointer(input);
    const launcher=current.kind===INTERACTION_KIND.MOVE_LAUNCHER||current.kind===INTERACTION_KIND.RESIZE_LAUNCHER;
    const valid=!launcher||launcherGeometryAvailable(current.targetId,proposed,sceneItems,geometry);
    const next=activateInteraction(current,proposed,valid);interactionRef.current=next;setInteraction(next);
  },[geometry,sceneItems]);

  const finishInteraction = useCallback((event,cancel=false)=>{
    const current=interactionRef.current;
    if(!current||current.pointerId!==event.pointerId)return;
    if(event.type==='lostpointercapture'&&event.currentTarget.hasPointerCapture?.(event.pointerId))return;
    interactionRef.current=null;setInteraction(null);
    if(cancel||!current.activated)return;
    if(current.kind===INTERACTION_KIND.MOVE_LAUNCHER||current.kind===INTERACTION_KIND.RESIZE_LAUNCHER){suppressLauncherClickRef.current=true;commitLauncherGeometry(current.targetId,current.candidateGeometry);}
    else commitWindowGeometry(current.targetId,current.candidateGeometry);
  },[commitLauncherGeometry,commitWindowGeometry]);

  const startDrag=useCallback((event,id,unused,enabled=true)=>{if(enabled)beginInteraction(event,{kind:INTERACTION_KIND.MOVE_LAUNCHER,targetId:id,rect:sceneById[id]?.geometry,element:moduleRefs.current.get(id)});},[beginInteraction,sceneById]);
  const startResize=useCallback((event,id)=>beginInteraction(event,{kind:INTERACTION_KIND.RESIZE_LAUNCHER,targetId:id,rect:sceneById[id]?.geometry,element:moduleRefs.current.get(id),minimumSpan:{columns:sceneById[id]?.appearanceMode==='icon'?1:2,rows:1}}),[beginInteraction,sceneById]);
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
  useEffect(()=>()=>{interactionRef.current=null;},[]);

  const resetLayout = () => {
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
    setSignalsOpen(authoredWindowDefaults.openIds.includes('signals'));
    setOpenFolderLauncherId(authoredWindowDefaults.openIds.find((id) => id.startsWith('library:')) || null);
  }, [authoredWindowDefaults]);

  const closeAllWindows = useCallback(() => {
    updateRuntime({ type: 'close-all' }); setIdentityOpen(false); setIdentityPhase('closed'); setCollectionOpen(false); setSignalsOpen(false); setOpenFolderLauncherId(null); setActiveModuleId(null);
  }, [updateRuntime]);

  const toggleGrid = useCallback(() => setGridVisible((value) => { const next=!value; try { window.localStorage.setItem(GRID_PREFERENCE_KEY,JSON.stringify({version:1,visible:next})); } catch {} return next; }), []);

  const openLauncherInspector = useCallback((id) => {
    const rect = moduleRefs.current.get(id)?.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    setSelectedSceneId(id); setInspectorAnchor(rect ? { x: rect.right + 10 + width <= window.innerWidth - 12 ? rect.right + 10 : Math.max(12, rect.left - width - 10), y: Math.max(12, Math.min(rect.top, window.innerHeight - 360)) } : { x: Math.max(12, (window.innerWidth-width)/2), y: 72 });
  }, []);

  const activateLauncher = useCallback((id) => {
    if (suppressLauncherClickRef.current) { suppressLauncherClickRef.current = false; return; }
    if (editMode) openLauncherInspector(id);
    else openModule(id);
  }, [editMode, openLauncherInspector, openModule]);

  const createFolderAtContext = useCallback(() => {
    const existing = new Set(workspace.folders.map((folder) => folder.name.toLowerCase()));
    let name = 'New Folder'; let suffix = 2;
    while (existing.has(name.toLowerCase())) { name = `New Folder ${suffix}`; suffix += 1; }
    const folderId = createFolder(name);
    if (!folderId) return;
    pinView({ type: 'folder', id: folderId });
    const launcherId = `library:folder:${folderId}`;
    const bounds = gridRef.current?.getBoundingClientRect();
    const requested = bounds ? {
      column: Math.max(0, Math.min(geometry.columns - 3, Math.floor((contextMenu.anchor.x - bounds.left) / geometry.cellWidth))),
      row: Math.max(0, Math.min(geometry.rows - 1, Math.floor((contextMenu.anchor.y - bounds.top) / geometry.cellHeight)))
    } : { column: 0, row: 2 };
    const position = findScenePlacement(launcherId, requested, { columns: 3, rows: 1 }, sceneItems, geometry);
    setLauncherPosition(launcherId, position);
    setSelectedSceneId(launcherId);
    setInspectorAnchor({ x: Math.max(12, Math.min(contextMenu.anchor.x + 12, window.innerWidth - 292)), y: Math.max(12, Math.min(contextMenu.anchor.y, window.innerHeight - 360)) });
  }, [contextMenu, createFolder, geometry, pinView, sceneItems, setLauncherPosition, workspace.folders]);

  const executeContextCommand = useCallback((command) => {
    const target = contextMenu?.target; if (!target) return;
    const runtimeId = target.id?.endsWith('-panel') ? target.id.replace('-panel','') : target.id?.startsWith('folder-panel:') ? target.id.slice(13) : target.id;
    const launcher = pinnedLaunchers.find((entry) => entry.id === (target.type === 'window' ? runtimeId : target.id));
    if (command === 'menu-create') { setContextMenu((current) => ({ ...current, menu: 'create' })); return; }
    if (command === 'menu-view') { setContextMenu((current) => ({ ...current, menu: 'view' })); return; }
    if (command === 'menu-root') { setContextMenu((current) => ({ ...current, menu: 'root' })); return; }
    if (command === 'create-folder') createFolderAtContext();
    else if (command === 'toggle-keeper') onKeeperVisibilityChange?.(!keeperVisible);
    else if (command === 'toggle-stage') onStageVisibilityChange?.(!stageVisible);
    else if (command === 'toggle-edit') setEditMode((value) => !value);
    else if (command === 'toggle-grid') toggleGrid();
    else if (command === 'reset-windows') resetWindows();
    else if (command === 'close-all') closeAllWindows();
    else if (command === 'settings') setActiveHudCommand('settings');
    else if (command === 'open') openModule(target.id);
    else if (command === 'edit-launcher') openLauncherInspector(target.id);
    else if (command === 'toggle-visibility' && launcher) setLauncherVisitorVisibility(launcher.id, !launcher.visitorVisible);
    else if (command === 'unpin' && launcher) unpinView({ type: launcher.viewType, id: launcher.folderId });
    else if (command === 'close') openModule(runtimeId);
    else if (command === 'reset-window') updateRuntime({ type: 'reset-window', id: runtimeId, rect: authoredWindowDefaults.rects[runtimeId] || null });
    else if (command === 'toggle-start-open') {
      const rect = runtimeWindows.rects[runtimeId] || defaultWindowGridRect(runtimeId, geometry, canvasPositions[runtimeId]);
      if (launcher) setLauncherStartOpen(launcher.id, !launcher.startOpen, rect);
      else setSystemPresentation((current) => { const next={...current,[runtimeId]:{...current[runtimeId],startOpen:!current[runtimeId]?.startOpen,windowGeometry:rect}}; try{window.localStorage.setItem(SYSTEM_SCENE_KEY,JSON.stringify(next));}catch{} return next; });
    }
    setContextMenu(null);
  }, [authoredWindowDefaults, canvasPositions, closeAllWindows, contextMenu, createFolderAtContext, geometry, keeperVisible, onKeeperVisibilityChange, onStageVisibilityChange, openLauncherInspector, openModule, pinnedLaunchers, resetWindows, runtimeWindows.rects, setLauncherStartOpen, setLauncherVisitorVisibility, stageVisible, toggleGrid, unpinView, updateRuntime]);

  useEffect(() => {
    if (!contextMenu) return;
    const exists = contextMenu.target.type === 'canvas' || sceneById[contextMenu.target.id] || runtimeWindows.openIds.includes(contextMenu.target.id.replace?.('-panel','')) || contextMenu.target.id.startsWith?.('folder-panel:');
    if (!exists) setContextMenu(null);
  }, [contextMenu, runtimeWindows.openIds, sceneById]);

  useEffect(() => {
    if (!inspectorAnchor) return undefined;
    const close = (event) => { if (event.key === 'Escape') { setInspectorAnchor(null); moduleRefs.current.get(selectedSceneId)?.focus(); } };
    const outside = (event) => { if (!launcherInspectorRef.current?.contains(event.target) && !moduleRefs.current.get(selectedSceneId)?.contains(event.target)) setInspectorAnchor(null); };
    window.addEventListener('keydown', close); window.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', outside, true); };
  }, [inspectorAnchor, selectedSceneId]);

  const identityDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'identity-panel', identityPanelPosition, identityPanelRef, identityPhase === 'open'),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  };

  const collectionDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'collection-panel', collectionPanelPosition, collectionPanelRef, true),
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
      data-dragging={interaction?.activated ? interaction.targetId : undefined}
      style={theme}
      aria-label="OS Underneath public world"
      ref={shellRef}
      onContextMenu={(event) => { const target=resolveContextTarget(event.target,shellRef.current); if(!target)return; event.preventDefault(); setContextMenu({ target, menu:'root', anchor:{x:event.clientX,y:event.clientY}, returnFocus:event.target.closest?.('button,[tabindex]') }); }}
    >
      <header className="public-shell__masthead">
        <div className="system-hud__identity">
          <h1 aria-label="OS Underneath">
            <span className="system-hud__bracket" aria-hidden="true">[</span>
            {' OS_'}<span className="system-hud__brand-accent">UNDERNEATH</span>{' '}
            <span className="system-hud__bracket" aria-hidden="true">]</span>
          </h1>
          <span className="system-hud__operator">{profile.artistName}</span>
          <span className="system-hud__live"><i aria-hidden="true" />Live</span>
        </div>

        <nav className="system-hud__commands" aria-label="OS Underneath controls">
          <button
            type="button"
            aria-pressed={activeHudCommand === 'search'}
            onClick={openCollectionSearch}
          >
            [ Search ]
          </button>
          <button type="button" onClick={() => setActiveHudCommand((current) => current === 'share' ? null : 'share')} aria-expanded={activeHudCommand === 'share'}>[ Share ]</button>
          <button type="button" onClick={() => setEditMode((current) => !current)} aria-pressed={editMode}>[ {editMode ? 'Done Arranging' : 'Arrange Desktop'} ]</button>
          {editMode && <button type="button" onClick={() => { if(window.confirm('Reset the authored canvas launcher layout? Folders, assets, visibility, and runtime windows will be preserved.')) resetLayout(); }}>[ Reset Authored Canvas ]</button>}
          <button
            type="button"
            aria-pressed={activeHudCommand === 'settings'}
            onClick={() => setActiveHudCommand((current) => current === 'settings' ? null : 'settings')}
          >
            [ Settings ]
          </button>
        </nav>
        <button className="system-sigil" type="button" aria-label="Open OS Underneath system menu" aria-expanded={activeHudCommand === 'system'} onClick={() => { setActiveHudCommand((current)=>current==='system'?null:'system'); setContextMenu(null); }}><img src="/assets/logo/underneath_os.webp" alt="" /></button>
      </header>

      <section
        className="module-grid"
        aria-label="Modules"
        ref={gridRef}
        data-desktop-canvas
        style={{
          left: geometry.left,
          top: geometry.top,
          width: geometry.usableWidth,
          height: geometry.usableHeight,
          '--grid-cell-width': `${geometry.cellWidth}px`,
          '--grid-cell-height': `${geometry.cellHeight}px`,
          '--grid-left': `${geometry.left}px`,
          '--grid-top': `${geometry.top}px`
        }}
      >
        {editMode && gridVisible && <GridBackdrop geometry={geometry} />}
        {MODULES.map(({ id, label }) => {
          const scene = sceneById[id];
          const displayLabel = scene?.label || label;
          const isActive = activeModuleId === id || (id === 'identity' && identityOpen) || (id === 'collection' && collectionOpen) || (id === 'signals' && signalsOpen);
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
              aria-expanded={id === 'identity' ? identityOpen : id === 'collection' ? collectionOpen : id === 'signals' ? signalsOpen : undefined}
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

        {identityOpen && identityPanelPosition && (
          <section
            className="module-shell module-shell--expanded"
            data-module-shell
            data-module-id="identity-panel"
            data-transition-state={identityPhase}
            data-interacting={interaction?.targetId === 'identity-panel' || undefined}
            ref={identityPanelRef}
            style={{...windowStyle(identityPanelPosition),zIndex:windowZIndex(runtimeWindows,'identity')}}
            role="dialog"
            aria-modal="false"
            aria-labelledby="identity-title"
            onPointerDownCapture={() => { setActiveModuleId('identity'); updateRuntime({type:'focus',id:'identity'}); }}
          >
            <IdentityDossier
              ref={identityRef}
              avatarSrc={avatarSrc}
              actorId={activeActorId}
              residentHandoff={residentHandoff}
              dragHandleProps={identityDragProps}
              dragEnabled={!geometry.narrow && identityPhase === 'open'}
              onTransitionStateChange={setIdentityPhase}
              onClose={() => {
                setIdentityOpen(false); updateRuntime({type:'close',id:'identity'});
                setIdentityPhase('closed');
                setActiveModuleId(collectionOpen ? 'collection' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get('identity')?.focus());
              }}
            />
            {!geometry.narrow && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label="Resize Profile Card" onPointerDown={(event)=>startWindowResize(event,'identity-panel',identityPanelPosition,identityPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {collectionOpen && collectionPanelPosition && (
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
              editMode={editMode}
              focusSearchRequest={collectionSearchRequest}
              escapeEnabled={activeModuleId === 'collection'}
              onClose={() => {
                setCollectionOpen(false); updateRuntime({type:'close',id:'collection'});
                setActiveModuleId(identityOpen ? 'identity' : null);
                setActiveHudCommand((current) => current === 'search' ? null : current);
                window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
              }}
            />
            {!geometry.narrow && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label="Resize Collection" onPointerDown={(event)=>startWindowResize(event,'collection-panel',collectionPanelPosition,collectionPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {signalsOpen && signalsPanelPosition && (
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
              editMode={editMode}
              escapeEnabled={activeModuleId === 'signals'}
              onClose={() => {
                setSignalsOpen(false); updateRuntime({type:'close',id:'signals'});
                setActiveModuleId(identityOpen ? 'identity' : collectionOpen ? 'collection' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get('signals')?.focus());
              }}
            />
            {!geometry.narrow && <i className="module-window__resize" data-resize-control tabIndex="0" aria-label="Resize Signals" onPointerDown={(event)=>startWindowResize(event,'signals-panel',signalsPanelPosition,signalsPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {openFolderLauncher && openFolderPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--folder"
            data-module-shell
            data-module-id={`folder-panel:${openFolderLauncher.id}`}
            ref={folderPanelRef}
            data-interacting={interaction?.targetId === `folder-panel:${openFolderLauncher.id}` || undefined}
            style={{...windowStyle(openFolderPosition),zIndex:windowZIndex(runtimeWindows,openFolderLauncher.id)}}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`folder-title-${openFolderLauncher.id}`}
            onPointerDownCapture={() => { setActiveModuleId(openFolderLauncher.id); updateRuntime({type:'focus',id:openFolderLauncher.id}); }}
          >
            <FolderWindow
              launcher={openFolderLauncher}
              dragHandleProps={folderDragProps}
              dragEnabled={!geometry.narrow}
              editMode={editMode}
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
      {inspectorAnchor && selectedSceneId && sceneById[selectedSceneId] && (()=>{ const scene=sceneById[selectedSceneId]; const launcher=pinnedLaunchers.find((entry)=>entry.id===selectedSceneId); const folder=launcher?.folderId?workspace.folders.find((entry)=>entry.id===launcher.folderId):null; const currentName=folder?.name||launcher?.label||scene.label||MODULES.find((entry)=>entry.id===selectedSceneId)?.label||'Launcher'; const saveName=(value)=>{const name=value.trim();if(!name)return;if(folder)renameFolder(folder.id,name);else if(launcher)setLauncherPresentation(launcher.id,{label:name});else updatePresentation(selectedSceneId,{label:name});}; return <aside key={selectedSceneId} ref={launcherInspectorRef} className="launcher-inspector" aria-label="Launcher appearance" style={{left:inspectorAnchor.x,top:inspectorAnchor.y}}>
        <strong>Launcher</strong><span>{selectedSceneId}</span>
        <label className="launcher-inspector__name">Name<input autoFocus aria-label="Launcher name" defaultValue={currentName} onBlur={(event)=>saveName(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter'){event.currentTarget.blur();}if(event.key==='Escape'){event.currentTarget.value=currentName;event.currentTarget.blur();}}} /></label>
        <label>Display<select value={scene.appearanceMode} onChange={(event)=>updatePresentation(selectedSceneId,{appearanceMode:event.target.value,span:normalizeSpan(scene.span,event.target.value,geometry)})}><option value="label">Label</option><option value="icon">Icon</option><option value="icon_label">Icon + label</option></select></label>
        <label>Icon<select value={scene.iconKey} onChange={(event)=>updatePresentation(selectedSceneId,{iconKey:event.target.value})}>{Object.keys(SCENE_ICONS).map((key)=><option key={key} value={key}>{key}</option>)}</select></label>
        <div className="launcher-inspector__presets">{Object.entries(LAUNCHER_SIZE_PRESETS).map(([name,preset])=><button key={name} type="button" onClick={()=>updatePresentation(selectedSceneId,{appearanceMode:preset.appearanceMode,span:{columns:preset.columns,rows:preset.rows}})}>{name}</button>)}</div>
        <label>Width<input aria-label="Launcher width in cells" type="number" min={scene.appearanceMode==='icon'?1:2} max="12" value={scene.span.columns} onChange={(event)=>updatePresentation(selectedSceneId,{span:{...scene.span,columns:Number(event.target.value)}})} /></label>
        <label>Height<input aria-label="Launcher height in cells" type="number" min="1" max="8" value={scene.span.rows} onChange={(event)=>updatePresentation(selectedSceneId,{span:{...scene.span,rows:Number(event.target.value)}})} /></label>
        {launcher && <button type="button" aria-pressed={launcher.visitorVisible} onClick={()=>setLauncherVisitorVisibility(launcher.id,!launcher.visitorVisible)}>{launcher.visitorVisible?'Make private':'Show to visitors'}</button>}
        <button type="button" onClick={toggleGrid}>Grid {gridVisible?'off':'on'}</button>
      </aside>; })()}
      {contextMenu && (()=>{const runtimeId=contextMenu.target.id?.startsWith?.('folder-panel:')?contextMenu.target.id.slice(13):contextMenu.target.id?.replace?.('-panel',''); const launcher=pinnedLaunchers.find((entry)=>entry.id===(contextMenu.target.type==='window'?runtimeId:contextMenu.target.id)); const startOpen=launcher?.startOpen||systemPresentation[runtimeId]?.startOpen; return <DesktopMenu key={`${contextMenu.target.type}:${contextMenu.menu}`} anchor={contextMenu.anchor} label={`${contextMenu.target.type} commands`} commands={contextMenuCommands({target:contextMenu.target,editMode,launcher,startOpen,menu:contextMenu.menu,keeperVisible,stageVisible})} onCommand={executeContextCommand} onClose={()=>setContextMenu(null)} returnFocus={contextMenu.returnFocus}/>;})()}
      {activeHudCommand === 'system' && <DesktopMenu anchor={{x:window.innerWidth/2-90,y:48}} label="OS Underneath system menu" commands={[
        {id:'about',label:'About OS_UNDERNEATH'}, {id:'status',label:`Profile / ${workspace.profileAddress.slice(0,8)}…`}, {id:'atelier',label:'Open Atelier'}, {id:'edit',label:editMode?'Finish Arranging':'Arrange Desktop'}, {id:'reset',label:'Reset Windows'}, {id:'close-all',label:'Close All Windows'}, {id:'settings',label:'Settings'}
      ]} onCommand={(command)=>{if(command==='about'||command==='status')setActiveHudCommand('about');else if(command==='atelier'){setActiveHudCommand(null);onRequestAtelier?.();}else if(command==='edit'){setEditMode((value)=>!value);setActiveHudCommand(null);}else if(command==='reset'){resetWindows();setActiveHudCommand(null);}else if(command==='close-all'){closeAllWindows();setActiveHudCommand(null);}else if(command==='settings')setActiveHudCommand('settings');}} onClose={()=>setActiveHudCommand(null)}/>}
      {activeHudCommand === 'about' && <aside className="system-about" role="dialog" aria-label="About OS Underneath"><strong>OS_UNDERNEATH</strong><p>Your profile is not a page. It is a place.</p><small>{workspace.profileAddress}<br/>LUKSO MAINNET / READ-ONLY</small><button type="button" onClick={()=>setActiveHudCommand(null)}>[ Close ]</button></aside>}
      <KeeperSignalsLayer
        interfaceReady={interfaceVisible}
        residentHandoffActive={identityPhase !== 'closed'}
        reducedMotion={revealPresentation.reducedMotion}
        reactionBridge={keeperReactions}
      />
      {activeHudCommand === 'settings' && <SignalSettings />}
      {activeHudCommand === 'share' && <ProfileDocumentPanel
        snapshot={snapshot}
        imported={importedDocument}
        stale={snapshotStale}
        error={documentError}
        activeProfileAddress={workspace.profileAddress}
        onBuild={buildSnapshot}
        onPreview={startPreview}
        onImport={installImported}
        onRestore={restoreImportedPresentation}
        onClose={() => setActiveHudCommand(null)}
      />}
    </main>
  );
}
