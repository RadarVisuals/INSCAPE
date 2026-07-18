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
import { buildProfileDocumentV1 } from '../profileDocument/domain/profileDocumentBuilder.js';
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
import { decodeWindowGridGeometry, defaultWindowGridRect, encodeWindowGridGeometry, windowMinimumSpan } from './windowGeometry.js';
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
  { id: 'signals', label: 'Signals' }
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
const WINDOW_GEOMETRY_KEY = 'os-underneath.window-geometry.v1';
const SYSTEM_ICONS = Object.freeze({ identity: 'profile', collection: 'collection', creations: 'creations', signals: 'signals' });
const GRID_LIFECYCLE_KEY='__OS_UNDERNEATH_GRID_LIFECYCLE__';
if(typeof window!=='undefined'&&!window[GRID_LIFECYCLE_KEY]?.installed){const lifecycle={installed:true,move:null,finish:null};window[GRID_LIFECYCLE_KEY]=lifecycle;window.addEventListener('pointermove',(event)=>lifecycle.move?.(event),true);window.addEventListener('pointerup',(event)=>lifecycle.finish?.(event,false),true);window.addEventListener('pointercancel',(event)=>lifecycle.finish?.(event,true),true);}

function defaultSystemPresentation(id, order) { return { appearanceMode: 'label', iconKey: SYSTEM_ICONS[id], span: { columns: 3, rows: 1 }, presentationOrder: order }; }
function readSystemPresentation() { try { const value = JSON.parse(window.localStorage.getItem(SYSTEM_SCENE_KEY)); return Object.fromEntries(MODULES.map((module, index) => { const item=value?.[module.id]; return [module.id,{ ...defaultSystemPresentation(module.id,index), ...(item || {}), iconKey:normalizeIconKey(item?.iconKey,SYSTEM_ICONS[module.id]), span:normalizeSpan(item?.span,item?.appearanceMode) }]; })); } catch { return Object.fromEntries(MODULES.map((module,index)=>[module.id,defaultSystemPresentation(module.id,index)])); } }
function readGridPreference(){try{return JSON.parse(window.localStorage.getItem(GRID_PREFERENCE_KEY))?.visible!==false}catch{return true}}
function readWindowGeometry(){const geometry=getInitialGeometry();return decodeWindowGridGeometry(window.localStorage.getItem(WINDOW_GEOMETRY_KEY),geometry,readStoredPositions(geometry))}

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
  onApplyRestoredPresentation,
  onPreviewDocumentChange,
  interfaceVisible = true,
  revealPresentation = { sequence: 'short', reducedMotion: false }
}) {
  const [geometry, setGeometry] = useState(getInitialGeometry);
  const [positions, setPositions] = useState(() => readStoredPositions(getInitialGeometry()));
  const [systemPresentation, setSystemPresentation] = useState(readSystemPresentation);
  const [gridVisible, setGridVisible] = useState(readGridPreference);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [windowGeometry,setWindowGeometry]=useState(readWindowGeometry);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityPhase, setIdentityPhase] = useState('closed');
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionSearchRequest, setCollectionSearchRequest] = useState(0);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [openFolderLauncherId, setOpenFolderLauncherId] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeHudCommand, setActiveHudCommand] = useState(null);
  const [availableModuleIds, setAvailableModuleIds] = useState(() => new Set());
  const moduleRefs = useRef(new Map());
  const identityRef = useRef(null);
  const identityPanelRef = useRef(null);
  const collectionPanelRef = useRef(null);
  const signalsPanelRef = useRef(null);
  const folderPanelRef = useRef(null);
  const shellRef = useRef(null);
  const gridRef = useRef(null);
  const [interaction, setInteraction] = useState(null);
  const interactionRef = useRef(null);
  const lifecycleHandlersRef = useRef({move:null,finish:null});
  const resizeFrameRef = useRef(0);
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
  const windowGeometryFor = useCallback((key, anchor) => effectiveGeometry(windowGeometry[key] || defaultWindowGridRect(key,geometry,anchor),interaction,['identity','collection','signals'].includes(key)?`${key}-panel`:`folder-panel:${key}`),[geometry,interaction,windowGeometry]);
  const identityPanelPosition = windowGeometryFor('identity',canvasPositions.identity);
  const collectionPanelPosition = windowGeometryFor('collection',canvasPositions.collection);
  const signalsPanelPosition = windowGeometryFor('signals',canvasPositions.signals);
  const openFolderPosition = openFolderLauncher ? windowGeometryFor(openFolderLauncher.id,canvasPositions[openFolderLauncher.id]) : null;
  const draftDocument = useMemo(() => buildProfileDocumentV1({
    profileAddress: workspace.profileAddress, workspace, assets: libraryAssets,
    publicPresentation: { keeperId: activeActorId, stageId },
    signalSettings, profileIdentity, modulePositions: positions, createdAt: 0, exportedAt: 0
  }), [activeActorId, libraryAssets, positions, profileIdentity, signalSettings, stageId, workspace]);
  const draftFingerprint = useMemo(() => profileDocumentContentFingerprint(draftDocument), [draftDocument]);
  const snapshotStale = Boolean(snapshot && useProfileDocumentStore.getState().snapshotDraftFingerprint !== draftFingerprint);

  useEffect(() => {
    if (snapshot) return;
    const stored = loadProfileSnapshot(window.localStorage, workspace.profileAddress);
    if (stored) installSnapshot(stored, profileDocumentContentFingerprint(stored));
  }, [installSnapshot, snapshot, workspace.profileAddress]);

  const buildSnapshot = useCallback(() => {
    try {
      const now = Date.now();
      const document = buildProfileDocumentV1({ profileAddress: workspace.profileAddress, workspace, assets: libraryAssets,
        publicPresentation: { keeperId: activeActorId, stageId }, signalSettings, profileIdentity,
        modulePositions: positions, revision: (snapshot?.revision || 0) + 1, createdAt: snapshot?.createdAt || now, exportedAt: now });
      const valid = assertValidProfileDocument(document); installSnapshot(valid, profileDocumentContentFingerprint(valid));
      saveProfileSnapshot(window.localStorage, valid); setDocumentError(null);
    } catch (error) { setDocumentError(error.message); }
  }, [activeActorId, installSnapshot, libraryAssets, positions, profileIdentity, setDocumentError, signalSettings, snapshot, stageId, workspace]);

  const startPreview = useCallback((source) => { enterPreview(source); setActiveHudCommand(null); }, [enterPreview]);
  const stopPreview = useCallback(() => { exitPreview(); onPreviewDocumentChange?.(null); }, [exitPreview, onPreviewDocumentChange]);
  useEffect(() => { onPreviewDocumentChange?.(previewDocument); }, [onPreviewDocumentChange, previewDocument]);

  const restoreImportedPresentation = useCallback(() => {
    if (!importedDocument || !window.confirm('Restore this document’s public presentation? Private Favorites, unpinned folders, Signals history, and caches will be preserved.')) return;
    const previousWorkspace = structuredClone(workspace); const previousSettings = { ...signalSettings };
    const previousPresentation = { keeperId: activeActorId, stageId }; const key = profilePresentationKey(workspace.profileAddress);
    const previousStoredPresentation = window.localStorage.getItem(key);
    try {
      const plan = createProfileDocumentRestorePlan(importedDocument, workspace);
      if (!replaceWorkspace(plan.workspace)) throw new Error('Could not persist restored Canvas Spaces');
      if (!replaceSignalSettings(plan.signalSettings)) throw new Error('Could not persist restored Signals settings');
      window.localStorage.setItem(key, JSON.stringify({ version: 1, keeperId: plan.keeperId, stageId: plan.stageId }));
      onApplyRestoredPresentation?.({ keeperId: plan.keeperId, stageId: plan.stageId }); setDocumentError(null);
    } catch (error) {
      replaceWorkspace(previousWorkspace); replaceSignalSettings(previousSettings);
      try { if (previousStoredPresentation == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, previousStoredPresentation); } catch { /* Best-effort rollback. */ }
      onApplyRestoredPresentation?.(previousPresentation); setDocumentError(error.message);
    }
  }, [activeActorId, importedDocument, onApplyRestoredPresentation, replaceSignalSettings, replaceWorkspace, setDocumentError, signalSettings, stageId, workspace]);

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
  const commitWindowGeometry=useCallback((id,rect)=>{const key=id.startsWith('folder-panel:')?id.slice('folder-panel:'.length):id.replace('-panel','');setWindowGeometry((current)=>{const next={...current,[key]:rect};try{window.localStorage.setItem(WINDOW_GEOMETRY_KEY,encodeWindowGridGeometry(next))}catch{}return next});},[]);

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
      setOpenFolderLauncherId(closing ? null : id);
      setActiveModuleId(closing ? null : id);
      return;
    }
    if (id === 'identity' && identityOpen) {
      identityRef.current?.requestClose();
      return;
    }
    if (id === 'collection' && collectionOpen) {
      setCollectionOpen(false);
      setActiveModuleId(null);
      window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
      return;
    }
    if (id === 'signals' && signalsOpen) {
      setSignalsOpen(false);
      setActiveModuleId(null);
      window.requestAnimationFrame(() => moduleRefs.current.get('signals')?.focus());
      return;
    }
    setActiveModuleId(id);
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
  }, [collectionOpen, identityOpen, openFolderLauncherId, pinnedLaunchers, signalsOpen]);

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
    event.currentTarget.dataset.interactionId=String(next.interactionId);
    next.ownerElement=event.currentTarget;
    next.captureElement.setPointerCapture?.(event.pointerId);
    return true;
  },[]);

  const beginInteraction = useCallback((event,{kind,targetId,rect,element,minimumSpan})=>{
    if(geometry.narrow||!editMode||!rect||!element||event.pointerType==='mouse'&&event.button!==0)return;
    if(kind===INTERACTION_KIND.MOVE_WINDOW&&event.target.closest('button,a,input,select,textarea,[data-resize-control]'))return;
    event.preventDefault();
    if(kind.includes('RESIZE'))event.stopPropagation();
    const rendered=element.getBoundingClientRect();
    const resize=kind.includes('RESIZE');
    const next=createInteraction({kind,targetId,pointerId:event.pointerId,originGeometry:rect,gridBounds:{columns:geometry.columns,rows:geometry.rows},cellWidth:geometry.cellWidth,cellHeight:geometry.cellHeight,pointerGrabOffset:resize?{x:event.clientX-rendered.right,y:event.clientY-rendered.bottom}:{x:event.clientX-rendered.left,y:event.clientY-rendered.top},startPointer:{x:event.clientX,y:event.clientY},captureElement:event.target});
    next.gridClientRect=gridRef.current.getBoundingClientRect();next.minimumSpan=minimumSpan;
    const installed=installInteraction(next,event);if(installed){const lifecycle=window[GRID_LIFECYCLE_KEY];lifecycle.move=(pointerEvent)=>lifecycleHandlersRef.current.move?.(pointerEvent);lifecycle.finish=(pointerEvent,cancel)=>lifecycleHandlersRef.current.finish?.(pointerEvent,cancel);next.cleanupLifecycle=()=>{if(lifecycle.interactionId===next.interactionId||lifecycle.interactionId==null){lifecycle.move=null;lifecycle.finish=null;}};lifecycle.interactionId=next.interactionId;}
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
    current.cleanupLifecycle?.();interactionRef.current=null;setInteraction(null);delete current.ownerElement?.dataset.interactionId;
    if(cancel||!current.activated)return;
    if(current.kind===INTERACTION_KIND.MOVE_LAUNCHER||current.kind===INTERACTION_KIND.RESIZE_LAUNCHER)commitLauncherGeometry(current.targetId,current.candidateGeometry);
    else commitWindowGeometry(current.targetId,current.candidateGeometry);
  },[commitLauncherGeometry,commitWindowGeometry]);

  const startDrag=useCallback((event,id,unused,enabled=true)=>{if(enabled)beginInteraction(event,{kind:INTERACTION_KIND.MOVE_LAUNCHER,targetId:id,rect:sceneById[id]?.geometry,element:moduleRefs.current.get(id)});},[beginInteraction,sceneById]);
  const startResize=useCallback((event,id)=>beginInteraction(event,{kind:INTERACTION_KIND.RESIZE_LAUNCHER,targetId:id,rect:sceneById[id]?.geometry,element:moduleRefs.current.get(id),minimumSpan:{columns:sceneById[id]?.appearanceMode==='icon'?1:2,rows:1}}),[beginInteraction,sceneById]);
  const startExpandedPanelDrag=useCallback((event,id,rect,panelRef,enabled)=>{if(enabled)beginInteraction(event,{kind:INTERACTION_KIND.MOVE_WINDOW,targetId:id,rect,element:panelRef.current});},[beginInteraction]);
  const startWindowResize=useCallback((event,id,rect,panelRef)=>beginInteraction(event,{kind:INTERACTION_KIND.RESIZE_WINDOW,targetId:id,rect,element:panelRef.current,minimumSpan:windowMinimumSpan(id,geometry)}),[beginInteraction,geometry]);
  lifecycleHandlersRef.current={move:moveInteraction,finish:finishInteraction};
  useEffect(()=>()=>{interactionRef.current?.cleanupLifecycle?.();interactionRef.current=null;},[]);
  useEffect(()=>{if(!editMode&&interactionRef.current){interactionRef.current=null;setInteraction(null);}},[editMode]);

  const resetLayout = () => {
    const defaults = getDefaultModulePositions(geometry);
    setPositions(defaults);
    resetWorkspaceCanvasLayout();
    setWindowGeometry({});
    try { window.localStorage.removeItem(WINDOW_GEOMETRY_KEY); } catch { /* Optional preference storage. */ }
    if (geometry.narrow) {
      try { window.localStorage.removeItem(MODULE_LAYOUT_STORAGE_KEY); } catch { /* Storage is optional. */ }
    } else persistPositions(defaults);
  };

  const identityDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'identity-panel', identityPanelPosition, identityPanelRef, editMode && identityPhase === 'open'),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  };

  const collectionDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'collection-panel', collectionPanelPosition, collectionPanelRef, editMode),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  };

  const signalsDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'signals-panel', signalsPanelPosition, signalsPanelRef, editMode),
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: (event) => finishInteraction(event,true),
    onLostPointerCapture: (event) => finishInteraction(event,true)
  };

  const folderDragProps = openFolderLauncher ? {
    onPointerDown: (event) => startExpandedPanelDrag(event, `folder-panel:${openFolderLauncher.id}`, openFolderPosition, folderPanelRef, editMode),
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
          <button type="button" onClick={() => setEditMode((current) => !current)} aria-pressed={editMode}>[ {editMode ? 'Done' : 'Edit'} ]</button>
          {editMode && <button type="button" onClick={resetLayout}>[ Reset Layout ]</button>}
          <button
            type="button"
            aria-pressed={activeHudCommand === 'settings'}
            onClick={() => setActiveHudCommand((current) => current === 'settings' ? null : 'settings')}
          >
            [ Settings ]
          </button>
        </nav>
      </header>

      <section
        className="module-grid"
        aria-label="Modules"
        ref={gridRef}
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
          const isActive = activeModuleId === id || (id === 'identity' && identityOpen) || (id === 'collection' && collectionOpen) || (id === 'signals' && signalsOpen);
          const entryAvailable = availableModuleIds.has(id);
          const entryIndex = MODULE_ENTRY_ORDER[id];
          return (
            <button
              className="module-shell module-button"
              data-module-shell
              data-module-id={id}
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
              aria-label={`Open ${label} module`}
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
              onClick={(event) => {
                if (event.detail === 0 || !editMode) openModule(id);
              }}
            >
              {scene?.appearanceMode !== 'label' && <b className="module-button__icon" aria-hidden="true">{iconGlyph(scene.iconKey)}</b>}
              {scene?.appearanceMode !== 'icon' && <span>{label}</span>}
              {editMode && <i className="module-button__resize" data-resize-control aria-label={`Resize ${label}`} onPointerDown={(event)=>startResize(event,id)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
            </button>
          );
        })}

        {pinnedLaunchers.map((launcher, launcherIndex) => {
          const folder = workspace.folders.find((entry) => entry.id === launcher.folderId);
          const label = launcher.viewType === 'favorites' ? 'Favorites' : folder?.name || 'Missing folder';
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
              onClick={(event) => { if (event.detail === 0 || !editMode) openModule(launcher.id); }}
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
            style={windowStyle(identityPanelPosition)}
            role="dialog"
            aria-modal="false"
            aria-labelledby="identity-title"
            onPointerDownCapture={() => setActiveModuleId('identity')}
          >
            <IdentityDossier
              ref={identityRef}
              avatarSrc={avatarSrc}
              actorId={activeActorId}
              residentHandoff={residentHandoff}
              dragHandleProps={identityDragProps}
              dragEnabled={editMode && !geometry.narrow && identityPhase === 'open'}
              onTransitionStateChange={setIdentityPhase}
              onClose={() => {
                setIdentityOpen(false);
                setIdentityPhase('closed');
                setActiveModuleId(collectionOpen ? 'collection' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get('identity')?.focus());
              }}
            />
            {editMode && !geometry.narrow && <i className="module-window__resize" data-resize-control aria-label="Resize Profile Card" onPointerDown={(event)=>startWindowResize(event,'identity-panel',identityPanelPosition,identityPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {collectionOpen && collectionPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection"
            data-module-shell
            data-module-id="collection-panel"
            ref={collectionPanelRef}
            data-interacting={interaction?.targetId === 'collection-panel' || undefined}
            style={windowStyle(collectionPanelPosition)}
            role="dialog"
            aria-modal="false"
            aria-labelledby="collection-title"
            onPointerDownCapture={() => setActiveModuleId('collection')}
          >
            <CollectionWindow
              dragHandleProps={collectionDragProps}
              dragEnabled={editMode && !geometry.narrow}
              editMode={editMode}
              focusSearchRequest={collectionSearchRequest}
              escapeEnabled={activeModuleId === 'collection'}
              onClose={() => {
                setCollectionOpen(false);
                setActiveModuleId(identityOpen ? 'identity' : null);
                setActiveHudCommand((current) => current === 'search' ? null : current);
                window.requestAnimationFrame(() => moduleRefs.current.get('collection')?.focus());
              }}
            />
            {editMode && !geometry.narrow && <i className="module-window__resize" data-resize-control aria-label="Resize Collection" onPointerDown={(event)=>startWindowResize(event,'collection-panel',collectionPanelPosition,collectionPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {signalsOpen && signalsPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--signals"
            data-module-shell
            data-module-id="signals-panel"
            ref={signalsPanelRef}
            data-interacting={interaction?.targetId === 'signals-panel' || undefined}
            style={windowStyle(signalsPanelPosition)}
            role="dialog"
            aria-modal="false"
            aria-labelledby="signals-title"
            onPointerDownCapture={() => setActiveModuleId('signals')}
          >
            <SignalsWindow
              dragHandleProps={signalsDragProps}
              dragEnabled={editMode && !geometry.narrow}
              editMode={editMode}
              escapeEnabled={activeModuleId === 'signals'}
              onClose={() => {
                setSignalsOpen(false);
                setActiveModuleId(identityOpen ? 'identity' : collectionOpen ? 'collection' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get('signals')?.focus());
              }}
            />
            {editMode && !geometry.narrow && <i className="module-window__resize" data-resize-control aria-label="Resize Signals" onPointerDown={(event)=>startWindowResize(event,'signals-panel',signalsPanelPosition,signalsPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}

        {openFolderLauncher && openFolderPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--folder"
            data-module-shell
            data-module-id={`folder-panel:${openFolderLauncher.id}`}
            ref={folderPanelRef}
            data-interacting={interaction?.targetId === `folder-panel:${openFolderLauncher.id}` || undefined}
            style={windowStyle(openFolderPosition)}
            role="dialog"
            aria-modal="false"
            aria-labelledby={`folder-title-${openFolderLauncher.id}`}
            onPointerDownCapture={() => setActiveModuleId(openFolderLauncher.id)}
          >
            <FolderWindow
              launcher={openFolderLauncher}
              dragHandleProps={folderDragProps}
              dragEnabled={editMode && !geometry.narrow}
              editMode={editMode}
              escapeEnabled={activeModuleId === openFolderLauncher.id}
              onClose={() => {
                const launcherId = openFolderLauncher.id;
                setOpenFolderLauncherId(null);
                setActiveModuleId(identityOpen ? 'identity' : collectionOpen ? 'collection' : null);
                window.requestAnimationFrame(() => moduleRefs.current.get(launcherId)?.focus());
              }}
            />
            {editMode && !geometry.narrow && <i className="module-window__resize" data-resize-control aria-label="Resize folder window" onPointerDown={(event)=>startWindowResize(event,`folder-panel:${openFolderLauncher.id}`,openFolderPosition,folderPanelRef)} onPointerMove={moveInteraction} onPointerUp={finishInteraction} onPointerCancel={(event)=>finishInteraction(event,true)} onLostPointerCapture={(event)=>finishInteraction(event,true)} />}
          </section>
        )}
      </section>
      {editMode && selectedSceneId && sceneById[selectedSceneId] && (()=>{ const scene=sceneById[selectedSceneId]; return <aside className="launcher-inspector" aria-label="Launcher appearance">
        <strong>Launcher</strong><span>{selectedSceneId}</span>
        <label>Display<select value={scene.appearanceMode} onChange={(event)=>updatePresentation(selectedSceneId,{appearanceMode:event.target.value,span:normalizeSpan(scene.span,event.target.value,geometry)})}><option value="label">Label</option><option value="icon">Icon</option><option value="icon_label">Icon + label</option></select></label>
        <label>Icon<select value={scene.iconKey} onChange={(event)=>updatePresentation(selectedSceneId,{iconKey:event.target.value})}>{Object.keys(SCENE_ICONS).map((key)=><option key={key} value={key}>{key}</option>)}</select></label>
        <div className="launcher-inspector__presets">{Object.entries(LAUNCHER_SIZE_PRESETS).map(([name,preset])=><button key={name} type="button" onClick={()=>updatePresentation(selectedSceneId,{appearanceMode:preset.appearanceMode,span:{columns:preset.columns,rows:preset.rows}})}>{name}</button>)}</div>
        <label>Width<input aria-label="Launcher width in cells" type="number" min={scene.appearanceMode==='icon'?1:2} max="12" value={scene.span.columns} onChange={(event)=>updatePresentation(selectedSceneId,{span:{...scene.span,columns:Number(event.target.value)}})} /></label>
        <label>Height<input aria-label="Launcher height in cells" type="number" min="1" max="8" value={scene.span.rows} onChange={(event)=>updatePresentation(selectedSceneId,{span:{...scene.span,rows:Number(event.target.value)}})} /></label>
        <button type="button" onClick={()=>setGridVisible((value)=>{const next=!value;try{window.localStorage.setItem(GRID_PREFERENCE_KEY,JSON.stringify({version:1,visible:next}))}catch{}return next})}>Grid {gridVisible?'off':'on'}</button>
      </aside>; })()}
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
