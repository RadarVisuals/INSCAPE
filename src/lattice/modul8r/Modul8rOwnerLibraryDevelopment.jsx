import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function Modul8rOwnerLibraryDevelopment({
  arrangeEnabled,
  categoryCommands,
  data,
  activeTableId,
  layers,
  menuSurfaceId,
  onArrangeToggle,
  onAssetPointerDown,
  onRelatedAssetRecordsChange,
  onRenderableAssetsChange,
  onLayerReorder,
  onLayerSelectionChange,
  onNavigateTable,
  onMenuSurfaceChange,
  onSurfaceChange,
  onVisitProfile,
  profileAddress,
  reorderDisabled,
  selectedLayerIds,
  surfaceId,
  tables,
  ownedAssetRecords = [],
}) {
  const [open, setOpen] = useState(true);
  const [viewerSession, setViewerSession] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [useRelatedCreationsStore] = useState(() => createCreationsStore({ retainOnRetry: true }));
  const createdAssets = useRelatedCreationsStore((state) => state.assets);
  const createdProfileAddress = useRelatedCreationsStore((state) => state.profileAddress);
  const createdStatus = useRelatedCreationsStore((state) => state.status);
  const createdProgress = useRelatedCreationsStore((state) => state.progress);
  const createdError = useRelatedCreationsStore((state) => state.error || state.liveError);
  const loadCreated = useRelatedCreationsStore((state) => state.load);
  const retryCreated = useRelatedCreationsStore((state) => state.retry);
  const cancelCreated = useRelatedCreationsStore((state) => state.cancel);
  const reopenRef = useRef(null);
  const relatedRecordsCallbackRef = useRef(onRelatedAssetRecordsChange);
  const libraryFaceplateAccessoryRef = useRef(null);
  const peopleFaceplateAccessoryRef = useRef(null);
  const settingsReturnFocusRef = useRef(null);
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
  return open ? <><Modul8rShell masterAccessory={<button aria-pressed={arrangeEnabled}
    onClick={onArrangeToggle} type="button">ARRANGE</button>}
    menuSurfaceId={menuSurfaceId} moduleContent={moduleContent} onEscape={() => {
      if (!settingsOpen) return false;
      closeSettings();
      return true;
    }}
    moduleFaceplateAccessoryRefs={{ library: libraryFaceplateAccessoryRef, people: peopleFaceplateAccessoryRef }}
    onRequestClose={() => { setViewerSession(null); setSettingsOpen(false); setOpen(false); }}
    onSettingsRequest={(trigger) => { settingsReturnFocusRef.current = trigger; setSettingsOpen(true); }} returnFocusRef={reopenRef} />
    {settingsOpen && <Modul8rSettingsSurface menuSurfaceId={menuSurfaceId} onClose={closeSettings}
      onMenuSurfaceChange={onMenuSurfaceChange} onSurfaceChange={onSurfaceChange} surfaceId={surfaceId} />}
    {viewerSession && <LatticeFocusViewer dossier={viewerSession.entry.dossier} entry={viewerSession.entry}
      getReturnRectangle={() => viewerSession.returnFocus?.getBoundingClientRect?.()} gridVisible inspectionVariant="rack"
      menuSurfaceId={menuSurfaceId} onClosed={() => setViewerSession(null)} originRectangle={viewerSession.originRectangle}
      position={0} renderArtwork={(entry) => <div className="modul8r-library__focus-artwork"><img alt={entry.accessibleLabel}
        decoding="async" draggable="false" referrerPolicy="no-referrer" src={entry.media.src} /></div>}
      returnFocus={viewerSession.returnFocus} surfaceColor="var(--lattice-menu-panel)" total={1} />}</>
    : <button className="modul8r-development-reopen" data-lattice-chrome onClick={() => setOpen(true)} ref={reopenRef} type="button">
      OPEN MODUL-8R{arrangeEnabled ? ' / ARRANGE ON' : ''}
    </button>;
}
