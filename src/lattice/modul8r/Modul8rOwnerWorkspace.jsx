import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FlipHorizontal2, FlipVertical2, Grid2X2, RotateCw } from 'lucide-react';
import Modul8rShell from './Modul8rShell.jsx';
import Modul8rLibraryAdapter from './Modul8rLibraryAdapter.jsx';
import Modul8rActivityAdapter from './Modul8rActivityAdapter.jsx';
import Modul8rPeopleAdapter from './Modul8rPeopleAdapter.jsx';
import { createCreationsStore } from '../../creations/state/useCreationsStore.js';
import { createCreationFocusEntry } from '../../creations/domain/creationFocusViewModel.js';
import { projectLibraryAssetUnion } from '../browser/libraryAssetUnion.js';
import LatticeFocusViewer from '../rendering/LatticeFocusViewer.jsx';
import Modul8rLayersAdapter from './Modul8rLayersAdapter.jsx';
import Modul8rSettingsSurface from './Modul8rSettingsSurface.jsx';

const AUTHORING_TOOL_PRESENTATION = Object.freeze({
  duplicate: Object.freeze({ Icon: Copy, label: 'Duplicate selected placement' }),
  mirrorHorizontal: Object.freeze({ Icon: FlipHorizontal2, label: 'Mirror horizontal' }),
  mirrorVertical: Object.freeze({ Icon: FlipVertical2, label: 'Mirror vertical' }),
  rotate: Object.freeze({ Icon: RotateCw, label: 'Rotate selected placement' }),
});

export default function Modul8rOwnerWorkspace({
  activeTableId,
  arrangeEnabled,
  authoringTools = [],
  categoryCommands,
  data,
  layers,
  menuSurfaceId,
  moduleRequest,
  onArrangeToggle,
  onAssetPointerDown,
  onAuthoringToolActivate,
  onEscape,
  onOpenStateChange,
  onRelatedAssetRecordsChange,
  onRenderableAssetsChange,
  onLayerReorder,
  onLayerSelectionChange,
  onNavigateTable,
  onMenuSurfaceChange,
  onSurfaceChange,
  onVisitProfile,
  closeRequestId = 0,
  initialOpen = true,
  openRequestId = 0,
  profileAddress,
  reorderDisabled,
  returnFocusRef,
  selectedLayerIds,
  surfaceId,
  tables,
  ownedAssetRecords = [],
}) {
  const [open, setOpen] = useState(initialOpen);
  const [viewerSession, setViewerSession] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moduleState, setModuleState] = useState({ masterExpanded: true, openModule: 'library' });
  const [useRelatedCreationsStore] = useState(() => createCreationsStore({ retainOnRetry: true }));
  const createdAssets = useRelatedCreationsStore((state) => state.assets);
  const createdProfileAddress = useRelatedCreationsStore((state) => state.profileAddress);
  const createdStatus = useRelatedCreationsStore((state) => state.status);
  const createdProgress = useRelatedCreationsStore((state) => state.progress);
  const createdError = useRelatedCreationsStore((state) => state.error || state.liveError);
  const loadCreated = useRelatedCreationsStore((state) => state.load);
  const retryCreated = useRelatedCreationsStore((state) => state.retry);
  const cancelCreated = useRelatedCreationsStore((state) => state.cancel);
  const localReopenRef = useRef(null);
  const handledCloseRequestIdRef = useRef(closeRequestId);
  const handledOpenRequestIdRef = useRef(openRequestId);
  const relatedRecordsCallbackRef = useRef(onRelatedAssetRecordsChange);
  const libraryFaceplateAccessoryRef = useRef(null);
  const peopleFaceplateAccessoryRef = useRef(null);
  const settingsReturnFocusRef = useRef(null);
  const effectiveReturnFocusRef = returnFocusRef || localReopenRef;
  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => settingsReturnFocusRef.current?.isConnected
      && settingsReturnFocusRef.current.focus({ preventScroll: true }));
  };

  useEffect(() => { relatedRecordsCallbackRef.current = onRelatedAssetRecordsChange; }, [onRelatedAssetRecordsChange]);
  useEffect(() => {
    if (!open) { cancelCreated(); return; }
    if (profileAddress && (createdProfileAddress !== profileAddress || createdStatus === 'idle')) loadCreated(profileAddress);
  }, [cancelCreated, createdProfileAddress, createdStatus, loadCreated, open, profileAddress]);
  useEffect(() => () => cancelCreated(), [cancelCreated]);
  useEffect(() => {
    if (!openRequestId || openRequestId === handledOpenRequestIdRef.current) return;
    handledOpenRequestIdRef.current = openRequestId;
    setOpen(true);
  }, [openRequestId]);
  useEffect(() => {
    if (!closeRequestId || closeRequestId === handledCloseRequestIdRef.current) return;
    handledCloseRequestIdRef.current = closeRequestId;
    setOpen(false);
  }, [closeRequestId]);
  useEffect(() => {
    if (!moduleRequest?.settings) return;
    settingsReturnFocusRef.current = moduleRequest.trigger || settingsReturnFocusRef.current;
    setSettingsOpen(true);
  }, [moduleRequest]);
  useEffect(() => {
    onOpenStateChange?.({ open, settingsOpen, ...moduleState });
  }, [moduleState, onOpenStateChange, open, settingsOpen]);

  const union = useMemo(() => projectLibraryAssetUnion({ createdAssets, ownedAssets: ownedAssetRecords, profileAddress }),
    [createdAssets, ownedAssetRecords, profileAddress]);
  const acceptedRelatedRecords = useMemo(() => union.records.filter((record) => record.viewedProfileIsCreator === true),
    [union.records]);
  useEffect(() => { onRelatedAssetRecordsChange?.(acceptedRelatedRecords); },
    [acceptedRelatedRecords, onRelatedAssetRecordsChange]);
  useEffect(() => () => relatedRecordsCallbackRef.current?.([]), [profileAddress]);
  const unionData = useMemo(() => ({
    ...data,
    assets: union.assets,
    error: data.assetError,
    progress: data.assetProgress,
    status: data.assetLoadState,
    createdError,
    createdProgress,
    createdRetained: Boolean(createdError && createdAssets.length),
    createdStatus,
  }), [createdAssets.length, createdError, createdProgress, createdStatus, data, union.assets]);
  const unionCategoryCommands = useMemo(() => categoryCommands ? {
    ...categoryCommands,
    setCategoryAsset: (categoryId, assetId, value) => categoryCommands.setCategoryAsset(categoryId, assetId, value,
      union.assets.map((asset) => asset.stableAssetId)),
    setCategoryAssets: (categoryId, assetIds, value) => categoryCommands.setCategoryAssets(categoryId, assetIds, value,
      union.assets.map((asset) => asset.stableAssetId)),
  } : null, [categoryCommands, union.assets]);
  const openAsset = (event, asset) => {
    const entry = createCreationFocusEntry(asset.assetRecord, { width: asset.width, height: asset.height });
    if (!entry) return;
    setViewerSession({ entry, originRectangle: event.currentTarget.getBoundingClientRect(), returnFocus: event.currentTarget });
  };
  const moduleContent = {
    library: <Modul8rLibraryAdapter categoryCommands={unionCategoryCommands} data={unionData}
      faceplateTargetRef={libraryFaceplateAccessoryRef} onAssetActivate={openAsset} onAssetPointerDown={onAssetPointerDown}
      onRenderableAssetsChange={onRenderableAssetsChange} onRetryCreated={retryCreated} />,
    activity: ({ active }) => <Modul8rActivityAdapter active={active} profileAddress={profileAddress} />,
    people: ({ active }) => <Modul8rPeopleAdapter active={active} faceplateTargetRef={peopleFaceplateAccessoryRef}
      onVisitProfile={onVisitProfile} />,
    layers: <Modul8rLayersAdapter activeTableId={activeTableId} layers={layers} onNavigateTable={onNavigateTable}
      onReorder={onLayerReorder} onSelectionChange={onLayerSelectionChange} reorderDisabled={reorderDisabled}
      selectedIds={selectedLayerIds} tables={tables} />,
  };
  const masterAccessory = <>
    <button aria-label="Arrange" aria-pressed={arrangeEnabled} className="modul8r-authoring-tool modul8r-authoring-tool--arrange"
      onClick={onArrangeToggle} type="button"><span>ARRANGE</span><Grid2X2 aria-hidden="true" size={14} strokeWidth={2} /></button>
    {authoringTools.map((tool) => {
      const presentation = AUTHORING_TOOL_PRESENTATION[tool.id];
      if (!presentation) return null;
      const { Icon, label } = presentation;
      return <button aria-disabled={tool.disabled || undefined} aria-label={label} className="modul8r-authoring-tool"
        disabled={tool.disabled} key={tool.id} onClick={() => onAuthoringToolActivate?.(tool.id)}
        title={tool.disabledReason || label} type="button"><Icon aria-hidden="true" size={14} strokeWidth={2} /></button>;
    })}
  </>;

  return open ? <><Modul8rShell masterAccessory={masterAccessory}
    menuSurfaceId={menuSurfaceId} moduleContent={moduleContent} moduleRequest={moduleRequest} onEscape={() => {
      if (onEscape?.()) return true;
      if (!settingsOpen) return false;
      closeSettings();
      return true;
    }}
    moduleFaceplateAccessoryRefs={{ library: libraryFaceplateAccessoryRef, people: peopleFaceplateAccessoryRef }}
    onModuleStateChange={setModuleState}
    onRequestClose={() => { setViewerSession(null); setSettingsOpen(false); setOpen(false); }}
    onSettingsRequest={(trigger) => { settingsReturnFocusRef.current = trigger; setSettingsOpen(true); }}
    returnFocusRef={effectiveReturnFocusRef} />
    {settingsOpen && <Modul8rSettingsSurface menuSurfaceId={menuSurfaceId} onClose={closeSettings}
      onMenuSurfaceChange={onMenuSurfaceChange} onSurfaceChange={onSurfaceChange} surfaceId={surfaceId} />}
    {viewerSession && <LatticeFocusViewer dossier={viewerSession.entry.dossier} entry={viewerSession.entry}
      getReturnRectangle={() => viewerSession.returnFocus?.getBoundingClientRect?.()} gridVisible inspectionVariant="rack"
      menuSurfaceId={menuSurfaceId} onClosed={() => setViewerSession(null)} originRectangle={viewerSession.originRectangle}
      position={0} renderArtwork={(entry) => <div className="modul8r-library__focus-artwork"><img alt={entry.accessibleLabel}
        decoding="async" draggable="false" referrerPolicy="no-referrer" src={entry.media.src} /></div>}
      returnFocus={viewerSession.returnFocus} surfaceColor="var(--lattice-menu-panel)" total={1} />}</>
    : <button className="modul8r-owner-reopen" data-lattice-chrome onClick={() => setOpen(true)}
      ref={localReopenRef} type="button">OPEN MODUL-8R{arrangeEnabled ? ' / ARRANGE ON' : ''}</button>;
}
