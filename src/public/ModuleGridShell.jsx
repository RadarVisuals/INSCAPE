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
import {
  MODULE_LAYOUT_STORAGE_KEY,
  clampModulePosition,
  createModuleGridGeometry,
  decodeModuleLayout,
  encodeModuleLayout,
  findNearestAvailableModulePosition,
  findNearestExpandedModulePosition,
  getDefaultModulePositions,
  getCanvasSpaceSpan,
  getCollectionSpan,
  getIdentitySpan,
  isExpandedModulePlacementAvailable,
  isModulePlacementAvailable
} from './moduleLayout.js';
import './moduleGrid.css';
import '../library/collection.css';
import '../signals/signals.css';
import '../profileDocument/profileDocument.css';

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

const profile = getIdentityProfileViewModel();

function getInitialGeometry() {
  return createModuleGridGeometry(window.innerWidth, window.innerHeight);
}

function readStoredPositions(geometry) {
  try {
    return decodeModuleLayout(window.localStorage.getItem(MODULE_LAYOUT_STORAGE_KEY), geometry);
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
      <g className="module-grid__minor-lines">
        {Array.from({ length: geometry.majorRows * 2 }, (_, index) => {
          const majorRow = Math.floor(index / 2);
          const subdivision = (index % 2) + 1;
          const y = Math.round((majorRow + subdivision / 3) * geometry.majorCellHeight);
          return <line key={`minor-h-${index}`} x1="0" y1={y} x2={geometry.usableWidth} y2={y} />;
        })}
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
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityPhase, setIdentityPhase] = useState('closed');
  const [identityPanelPosition, setIdentityPanelPosition] = useState(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionPanelPosition, setCollectionPanelPosition] = useState(null);
  const [collectionSearchRequest, setCollectionSearchRequest] = useState(0);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [signalsPanelPosition, setSignalsPanelPosition] = useState(null);
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
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const resizeFrameRef = useRef(0);
  const theme = useMemo(() => getPublicTheme(activeActorId), [activeActorId]);
  const identitySpan = useMemo(() => getIdentitySpan(geometry), [geometry]);
  const collectionSpan = useMemo(() => getCollectionSpan(geometry), [geometry]);
  const signalsSpan = collectionSpan;
  const folderSpan = useMemo(() => getCanvasSpaceSpan(geometry), [geometry]);
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
  const setLauncherWindowPosition = useLibraryStore((state) => state.setLauncherWindowPosition);
  const resetWorkspaceCanvasLayout = useLibraryStore((state) => state.resetCanvasLayout);
  const pinnedLaunchers = workspace.canvas.launchers;
  const pinnedLauncherKey = pinnedLaunchers.map((launcher) => launcher.id).join('|');
  const canvasPositions = useMemo(() => {
    const next = { ...positions };
    pinnedLaunchers.forEach((launcher, index) => {
      const fallback = {
        column: index % geometry.columns,
        row: Math.min(geometry.rows - 1, 2 + Math.floor(index / geometry.columns) * 2)
      };
      next[launcher.id] = findNearestAvailableModulePosition(
        launcher.id,
        launcher.position || fallback,
        { columns: 1, rows: 1 },
        next,
        geometry
      );
    });
    return next;
  }, [geometry, pinnedLaunchers, positions]);
  const openFolderLauncher = pinnedLaunchers.find((launcher) => launcher.id === openFolderLauncherId) || null;
  const openFolderPosition = openFolderLauncher
    ? findNearestExpandedModulePosition(openFolderLauncher.windowPosition || canvasPositions[openFolderLauncher.id], folderSpan, canvasPositions, geometry)
    : null;
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
    if (!identityOpen) return;
    setIdentityPanelPosition((current) => findNearestExpandedModulePosition(
      current ?? canvasPositions.identity,
      identitySpan,
      canvasPositions,
      geometry
    ));
  }, [canvasPositions, geometry, identityOpen, identitySpan]);

  useEffect(() => {
    if (!collectionOpen) return;
    setCollectionPanelPosition((current) => findNearestExpandedModulePosition(
      current ?? canvasPositions.collection,
      collectionSpan,
      canvasPositions,
      geometry
    ));
  }, [canvasPositions, collectionOpen, collectionSpan, geometry]);

  useEffect(() => {
    if (!signalsOpen) return;
    setSignalsPanelPosition((current) => findNearestExpandedModulePosition(
      current ?? canvasPositions.signals,
      signalsSpan,
      canvasPositions,
      geometry
    ));
  }, [canvasPositions, geometry, signalsOpen, signalsSpan]);

  useEffect(() => {
    const resize = () => {
      if (resizeFrameRef.current) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = 0;
        const nextGeometry = createModuleGridGeometry(window.innerWidth, window.innerHeight);
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
      setCollectionPanelPosition((current) => findNearestExpandedModulePosition(
        current ?? canvasPositions.collection,
        collectionSpan,
        canvasPositions,
        geometry
      ));
      setCollectionOpen(true);
      return;
    }
    if (id === 'signals') {
      setSignalsPanelPosition((current) => findNearestExpandedModulePosition(
        current ?? canvasPositions.signals,
        signalsSpan,
        canvasPositions,
        geometry
      ));
      setSignalsOpen(true);
      return;
    }
    if (id !== 'identity') return;
    setIdentityPanelPosition((current) => findNearestExpandedModulePosition(
      current ?? canvasPositions.identity,
      identitySpan,
      canvasPositions,
      geometry
    ));
    setIdentityPhase('approaching');
    setIdentityOpen(true);
  }, [canvasPositions, collectionOpen, collectionSpan, geometry, identityOpen, identitySpan, openFolderLauncherId, pinnedLaunchers, signalsOpen, signalsSpan]);

  const openCollectionSearch = useCallback(() => {
    if (!collectionOpen) openModule('collection');
    setActiveModuleId('collection');
    setActiveHudCommand('search');
    setCollectionSearchRequest((value) => value + 1);
  }, [collectionOpen, openModule]);

  const positionStyle = useCallback((position, span = { columns: 1, rows: 1 }, inset = 4) => {
    const left = Math.round(position.column * geometry.cellWidth);
    const top = Math.round(position.row * geometry.cellHeight);
    const right = Math.round((position.column + span.columns) * geometry.cellWidth);
    const bottom = Math.round((position.row + span.rows) * geometry.cellHeight);
    return {
      left: left + inset,
      top: top + inset,
      width: right - left - inset * 2,
      height: bottom - top - inset * 2
    };
  }, [geometry]);

  const moduleStyle = useCallback((id, span = { columns: 1, rows: 1 }, inset = 4) => (
    positionStyle(canvasPositions[id], span, inset)
  ), [canvasPositions, positionStyle]);

  const clearDragPresentation = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.frame) window.cancelAnimationFrame(drag.frame);
    if (drag?.shell) {
      drag.shell.style.transform = '';
      delete drag.shell.dataset.dragging;
    }
    if (previewRef.current) previewRef.current.hidden = true;
    if (shellRef.current) delete shellRef.current.dataset.dragging;
    dragRef.current = null;
  }, []);

  const startDrag = useCallback((event, id, span = { columns: 1, rows: 1 }, enabled = true) => {
    if (!enabled || geometry.narrow || (event.button !== undefined && event.button !== 0)) return;
    const shell = moduleRefs.current.get(id);
    if (!shell) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      id,
      span,
      shell,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: canvasPositions[id],
      candidate: canvasPositions[id],
      moved: false,
      frame: 0,
      deltaX: 0,
      deltaY: 0,
      valid: true
    };
  }, [canvasPositions, geometry.narrow]);

  const startExpandedPanelDrag = useCallback((event, id, span, position, panelRef, enabled) => {
    if (geometry.narrow || !enabled || !position) return;
    if (event.button !== undefined && event.button !== 0) return;
    const shell = panelRef.current;
    if (!shell) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      id,
      kind: 'expanded',
      span,
      shell,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
      candidate: position,
      moved: false,
      frame: 0,
      deltaX: 0,
      deltaY: 0,
      valid: true
    };
  }, [geometry.narrow]);

  const moveDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.deltaX = event.clientX - drag.startX;
    drag.deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(drag.deltaX, drag.deltaY) < 6) return;

    drag.moved = true;
    drag.candidate = clampModulePosition({
      column: drag.origin.column + Math.round(drag.deltaX / geometry.cellWidth),
      row: drag.origin.row + Math.round(drag.deltaY / geometry.cellHeight)
    }, drag.span, geometry);
    drag.valid = drag.kind === 'expanded'
      ? isExpandedModulePlacementAvailable(drag.candidate, drag.span, canvasPositions, geometry)
      : isModulePlacementAvailable(drag.id, drag.candidate, drag.span, canvasPositions, geometry);
    drag.shell.dataset.dragging = 'true';
    if (shellRef.current) shellRef.current.dataset.dragging = drag.id;

    if (!drag.frame) {
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = 0;
        drag.shell.style.transform = `translate3d(${drag.deltaX}px, ${drag.deltaY}px, 0)`;
        const preview = previewRef.current;
        if (!preview) return;
        preview.hidden = false;
        preview.dataset.valid = drag.valid ? 'true' : 'false';
        preview.style.left = `${drag.candidate.column * geometry.cellWidth + 4}px`;
        preview.style.top = `${drag.candidate.row * geometry.cellHeight + 4}px`;
        preview.style.width = `${drag.span.columns * geometry.cellWidth - 8}px`;
        preview.style.height = `${drag.span.rows * geometry.cellHeight - 8}px`;
      });
    }
  }, [canvasPositions, geometry]);

  const endDrag = useCallback((event, activateOnClick = false) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const wasMoved = drag.moved;
    const id = drag.id;
    const nextPosition = wasMoved
      ? drag.kind === 'expanded'
        ? findNearestExpandedModulePosition(drag.candidate, drag.span, canvasPositions, geometry)
        : findNearestAvailableModulePosition(id, drag.candidate, drag.span, canvasPositions, geometry)
      : null;
    clearDragPresentation();
    if (wasMoved && drag.kind === 'expanded') {
      if (id === 'identity-panel') setIdentityPanelPosition(nextPosition);
      if (id === 'collection-panel') setCollectionPanelPosition(nextPosition);
      if (id === 'signals-panel') setSignalsPanelPosition(nextPosition);
      if (id.startsWith('folder-panel:')) setLauncherWindowPosition(id.slice('folder-panel:'.length), nextPosition);
    }
    else if (wasMoved) commitPosition(id, nextPosition);
    else if (activateOnClick) openModule(id);
  }, [canvasPositions, clearDragPresentation, commitPosition, geometry, openModule, setLauncherWindowPosition]);

  const resetLayout = () => {
    const defaults = getDefaultModulePositions(geometry);
    setPositions(defaults);
    resetWorkspaceCanvasLayout();
    if (identityOpen) {
      setIdentityPanelPosition(findNearestExpandedModulePosition(
        defaults.identity,
        identitySpan,
        { ...defaults },
        geometry
      ));
    }
    if (collectionOpen) {
      setCollectionPanelPosition(findNearestExpandedModulePosition(
        defaults.collection,
        collectionSpan,
        { ...defaults },
        geometry
      ));
    }
    if (signalsOpen) {
      setSignalsPanelPosition(findNearestExpandedModulePosition(defaults.signals, signalsSpan, { ...defaults }, geometry));
    }
    if (geometry.narrow) {
      try { window.localStorage.removeItem(MODULE_LAYOUT_STORAGE_KEY); } catch { /* Storage is optional. */ }
    } else persistPositions(defaults);
  };

  const identityDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'identity-panel', identitySpan, identityPanelPosition, identityPanelRef, editMode && identityPhase === 'open'),
    onPointerMove: moveDrag,
    onPointerUp: (event) => endDrag(event, false),
    onPointerCancel: clearDragPresentation
  };

  const collectionDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'collection-panel', collectionSpan, collectionPanelPosition, collectionPanelRef, editMode),
    onPointerMove: moveDrag,
    onPointerUp: (event) => endDrag(event, false),
    onPointerCancel: clearDragPresentation
  };

  const signalsDragProps = {
    onPointerDown: (event) => startExpandedPanelDrag(event, 'signals-panel', signalsSpan, signalsPanelPosition, signalsPanelRef, editMode),
    onPointerMove: moveDrag,
    onPointerUp: (event) => endDrag(event, false),
    onPointerCancel: clearDragPresentation
  };

  const folderDragProps = openFolderLauncher ? {
    onPointerDown: (event) => startExpandedPanelDrag(event, `folder-panel:${openFolderLauncher.id}`, folderSpan, openFolderPosition, folderPanelRef, editMode),
    onPointerMove: moveDrag,
    onPointerUp: (event) => endDrag(event, false),
    onPointerCancel: clearDragPresentation
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
        <GridBackdrop geometry={geometry} />
        <div className="module-grid__placement-preview" ref={previewRef} hidden />
        {MODULES.map(({ id, label }) => {
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
              key={id}
              type="button"
              disabled={!entryAvailable}
              aria-hidden={!entryAvailable || undefined}
              aria-expanded={id === 'identity' ? identityOpen : id === 'collection' ? collectionOpen : id === 'signals' ? signalsOpen : undefined}
              aria-pressed={id === 'identity' ? undefined : isActive}
              aria-label={`Open ${label} module`}
              style={{
                ...moduleStyle(id, undefined, 0),
                '--module-entry-index': entryIndex
              }}
              ref={(node) => {
                if (node) moduleRefs.current.set(id, node);
                else moduleRefs.current.delete(id);
              }}
              onPointerDown={(event) => startDrag(event, id, undefined, editMode)}
              onPointerMove={moveDrag}
              onPointerUp={(event) => endDrag(event, true)}
              onPointerCancel={clearDragPresentation}
              onClick={(event) => {
                if (event.detail === 0 || !editMode) openModule(id);
              }}
            >
              <span>{label}</span>
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
          return (
            <button
              className="module-shell module-button module-button--folder"
              data-module-shell
              data-module-id={launcher.id}
              data-module-entry-index={entryIndex}
              data-entry-state={entryAvailable ? 'ready' : 'pending'}
              data-active={isActive || undefined}
              data-visitor-visible={launcher.visitorVisible || undefined}
              key={launcher.id}
              type="button"
              disabled={!entryAvailable}
              aria-hidden={!entryAvailable || undefined}
              aria-expanded={openFolderLauncherId === launcher.id}
              aria-label={`Open ${label} folder, ${count} assets`}
              style={{ ...moduleStyle(launcher.id, undefined, 0), '--module-entry-index': entryIndex }}
              ref={(node) => {
                if (node) moduleRefs.current.set(launcher.id, node);
                else moduleRefs.current.delete(launcher.id);
              }}
              onPointerDown={(event) => startDrag(event, launcher.id, undefined, editMode)}
              onPointerMove={moveDrag}
              onPointerUp={(event) => endDrag(event, true)}
              onPointerCancel={clearDragPresentation}
              onClick={(event) => { if (event.detail === 0 || !editMode) openModule(launcher.id); }}
            >
              <span className="module-button__label">{label}</span>
              <small>{count}</small>
              {editMode && <em className="module-button__visibility">{launcher.visitorVisible ? 'PUBLIC' : 'PRIVATE'}</em>}
            </button>
          );
        })}

        {identityOpen && identityPanelPosition && (
          <section
            className="module-shell module-shell--expanded"
            data-module-shell
            data-module-id="identity-panel"
            data-transition-state={identityPhase}
            ref={identityPanelRef}
            style={positionStyle(identityPanelPosition, identitySpan)}
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
          </section>
        )}

        {collectionOpen && collectionPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection"
            data-module-shell
            data-module-id="collection-panel"
            ref={collectionPanelRef}
            style={positionStyle(collectionPanelPosition, collectionSpan)}
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
          </section>
        )}

        {signalsOpen && signalsPanelPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--signals"
            data-module-shell
            data-module-id="signals-panel"
            ref={signalsPanelRef}
            style={positionStyle(signalsPanelPosition, signalsSpan)}
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
          </section>
        )}

        {openFolderLauncher && openFolderPosition && (
          <section
            className="module-shell module-shell--expanded module-shell--collection module-shell--folder"
            data-module-shell
            data-module-id={`folder-panel:${openFolderLauncher.id}`}
            ref={folderPanelRef}
            style={positionStyle(openFolderPosition, folderSpan)}
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
          </section>
        )}
      </section>
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
