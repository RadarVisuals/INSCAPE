import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FlipHorizontal2, FlipVertical2, Grid2X2, RotateCw } from 'lucide-react';
import Modul8rShell from './Modul8rShell.jsx';
import Modul8rLibraryAdapter from './Modul8rLibraryAdapter.jsx';
import Modul8rActivityAdapter from './Modul8rActivityAdapter.jsx';
import Modul8rPeopleAdapter from './Modul8rPeopleAdapter.jsx';
import { createCreationsStore } from '../../creations/state/useCreationsStore.js';
import { createCollectionTokensStore } from '../../creations/state/useCollectionTokensStore.js';
import { createCreationFocusEntry } from '../../creations/domain/creationFocusViewModel.js';
import { isStrongCreatedAsset, projectLibraryAssetUnion } from '../browser/libraryAssetUnion.js';
import LatticeFocusViewer from '../rendering/LatticeFocusViewer.jsx';
import Modul8rLayersAdapter from './Modul8rLayersAdapter.jsx';
import Modul8rSettingsSurface from './Modul8rSettingsSurface.jsx';
import useBrowserWorkspace from '../browser/useBrowserWorkspace.js';
import { resolveProfileAssetReferences } from '../../library/data/resolveProfileAssetReferences.js';

const AUTHORING_TOOL_PRESENTATION = Object.freeze({
  duplicate: Object.freeze({ Icon: Copy, label: 'Duplicate selected placement' }),
  mirrorHorizontal: Object.freeze({ Icon: FlipHorizontal2, label: 'Mirror horizontal' }),
  mirrorVertical: Object.freeze({ Icon: FlipVertical2, label: 'Mirror vertical' }),
  rotate: Object.freeze({ Icon: RotateCw, label: 'Rotate selected placement' }),
});

// Data authority outlives the temporary MODUL-8R presentation mount used by
// Preview. The store itself remains profile-scoped and aborts stale profiles.
const useRelatedCreationsStore = createCreationsStore({ retainOnRetry: true });
const libraryPreviewRecords = new Map();

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
  initialOpen = false,
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
  const [activeCollection, setActiveCollection] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [referencedOwnedAssets, setReferencedOwnedAssets] = useState([]);
  const [moduleState, setModuleState] = useState({ masterExpanded: true, openModule: 'library' });
  const [useCollectionTokensStore] = useState(() => createCollectionTokensStore());
  const createdAssets = useRelatedCreationsStore((state) => state.assets);
  const referencedCreatedAssets = useRelatedCreationsStore((state) => state.referencedAssets);
  const createdProfileAddress = useRelatedCreationsStore((state) => state.profileAddress);
  const createdStatus = useRelatedCreationsStore((state) => state.status);
  const createdProgress = useRelatedCreationsStore((state) => state.progress);
  const createdError = useRelatedCreationsStore((state) => state.error || state.liveError);
  const setCreatedProfileAddress = useRelatedCreationsStore((state) => state.setProfileAddress);
  const loadCreated = useRelatedCreationsStore((state) => state.load);
  const retryCreated = useRelatedCreationsStore((state) => state.retry);
  const resolveReferencedCreatedAssets = useRelatedCreationsStore((state) => state.resolveReferencedAssets);
  const collectionTokens = useCollectionTokensStore((state) => state.assets);
  const collectionStatus = useCollectionTokensStore((state) => state.status);
  const collectionProgress = useCollectionTokensStore((state) => state.progress);
  const collectionError = useCollectionTokensStore((state) => state.error);
  const loadCollectionTokens = useCollectionTokensStore((state) => state.load);
  const retryCollectionTokens = useCollectionTokensStore((state) => state.retry);
  const cancelCollectionTokens = useCollectionTokensStore((state) => state.cancel);
  const clearCollectionTokens = useCollectionTokensStore((state) => state.clear);
  const handledCloseRequestIdRef = useRef(closeRequestId);
  const handledOpenRequestIdRef = useRef(openRequestId);
  const acceptedRelatedRecordsSignatureRef = useRef(null);
  const libraryFaceplateAccessoryRef = useRef(null);
  const peopleFaceplateAccessoryRef = useRef(null);
  const settingsReturnFocusRef = useRef(null);
  const usedAssetIdsKey = (data.usedAssetIds || []).join(',');
  const resolvedAssetIdsKey = [...ownedAssetRecords, ...createdAssets, ...referencedCreatedAssets]
    .map(({ id }) => id).sort().join(',');
  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => settingsReturnFocusRef.current?.isConnected
      && settingsReturnFocusRef.current.focus({ preventScroll: true }));
  };

  useEffect(() => {
    if (profileAddress) setCreatedProfileAddress(profileAddress);
  }, [profileAddress, setCreatedProfileAddress]);
  useEffect(() => {
    let current = true;
    setReferencedOwnedAssets([]);
    const resolvedIds = new Set(resolvedAssetIdsKey.split(',').filter(Boolean));
    const unresolvedIds = (data.usedAssetIds || []).filter((id) => !resolvedIds.has(id));
    if (profileAddress && unresolvedIds.length) {
      resolveProfileAssetReferences(profileAddress, unresolvedIds)
        .then((assets) => { if (current) setReferencedOwnedAssets(assets); })
        .catch(() => {});
    }
    return () => { current = false; };
  }, [profileAddress, resolvedAssetIdsKey, usedAssetIdsKey]);
  useEffect(() => {
    if (profileAddress && createdProfileAddress === profileAddress) {
      resolveReferencedCreatedAssets(profileAddress, data.usedAssetIds);
    }
  }, [createdProfileAddress, profileAddress, resolveReferencedCreatedAssets, usedAssetIdsKey]);
  useEffect(() => {
    if (open && moduleState.openModule === 'library' && createdProfileAddress === profileAddress
      && createdStatus === 'idle') loadCreated(profileAddress);
  }, [createdProfileAddress, createdStatus, loadCreated, moduleState.openModule, open, profileAddress]);
  useEffect(() => () => clearCollectionTokens(), [clearCollectionTokens]);
  useEffect(() => { setActiveCollection(null); clearCollectionTokens(); }, [clearCollectionTokens, profileAddress]);
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
  const collectionUnion = useMemo(() => {
    if (!activeCollection) return { assets: [], records: [] };
    const contract = activeCollection.contractAddress;
    return projectLibraryAssetUnion({
      createdAssets: [activeCollection, ...collectionTokens],
      ownedAssets: ownedAssetRecords.filter((record) => record.contractAddress === contract),
      profileAddress,
    });
  }, [activeCollection, collectionTokens, ownedAssetRecords, profileAddress]);
  const collectionAssets = useMemo(() => collectionUnion.assets.map((asset) => ({
    ...asset,
    collectionRole: asset.stableAssetId === activeCollection?.id ? 'cover' : 'token',
  })).sort((left, right) => Number(right.collectionRole === 'cover') - Number(left.collectionRole === 'cover')),
  [activeCollection?.id, collectionUnion.assets]);
  const acceptedRelatedRecords = useMemo(() => {
    const creatorRecords = activeCollection ? [...union.records, ...referencedCreatedAssets, ...collectionUnion.records]
      : [...union.records, ...referencedCreatedAssets];
    const records = [...creatorRecords.filter((record) => isStrongCreatedAsset(record, profileAddress)),
      ...referencedOwnedAssets.filter((record) => record.ownerAddress === profileAddress)];
    return [...new Map(records
      .map((record) => [record.id, record])).values()];
  }, [activeCollection, collectionUnion.records, profileAddress, referencedCreatedAssets, referencedOwnedAssets,
    union.records]);
  useEffect(() => {
    const scopedRecords = [profileAddress, acceptedRelatedRecords];
    const signature = JSON.stringify(scopedRecords);
    if (signature === acceptedRelatedRecordsSignatureRef.current) return;
    acceptedRelatedRecordsSignatureRef.current = signature;
    onRelatedAssetRecordsChange?.(scopedRecords);
  }, [acceptedRelatedRecords, onRelatedAssetRecordsChange, profileAddress]);
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
  const collectionData = useMemo(() => activeCollection ? {
    ...data,
    assets: collectionAssets,
    categories: [],
    error: collectionError,
    progress: collectionProgress,
    status: collectionStatus,
    createdError: null,
    createdStatus: 'ready',
  } : null, [activeCollection, collectionAssets, collectionError, collectionProgress, collectionStatus, data]);
  const libraryData = collectionData || unionData;
  const libraryWorkspace = useBrowserWorkspace(libraryData, libraryPreviewRecords);
  const unionCategoryCommands = useMemo(() => categoryCommands ? {
    ...categoryCommands,
    setCategoryAsset: (categoryId, assetId, value) => categoryCommands.setCategoryAsset(categoryId, assetId, value,
      union.assets.map((asset) => asset.stableAssetId)),
    setCategoryAssets: (categoryId, assetIds, value) => categoryCommands.setCategoryAssets(categoryId, assetIds, value,
      union.assets.map((asset) => asset.stableAssetId)),
  } : null, [categoryCommands, union.assets]);
  const openAsset = (event, asset) => {
    if (asset.isCollection && asset.collectionRole !== 'cover') {
      const collectionRecord = asset.assetRecord;
      setActiveCollection(collectionRecord);
      loadCollectionTokens(profileAddress, collectionRecord);
      return;
    }
    const entry = createCreationFocusEntry(asset.assetRecord, { width: asset.width, height: asset.height });
    if (!entry) return;
    setViewerSession({ entry, originRectangle: event.currentTarget.getBoundingClientRect(), returnFocus: event.currentTarget });
  };
  const moduleContent = {
    library: <Modul8rLibraryAdapter categoryCommands={activeCollection ? null : unionCategoryCommands}
      collectionContext={activeCollection ? { address: activeCollection.contractAddress, name: activeCollection.name,
        resolved: collectionProgress.resolved, total: collectionProgress.total } : null}
      data={libraryData}
      faceplateTargetRef={libraryFaceplateAccessoryRef} onAssetActivate={openAsset} onAssetPointerDown={onAssetPointerDown}
      onExitCollection={() => { cancelCollectionTokens(); setActiveCollection(null); }}
      onRenderableAssetsChange={onRenderableAssetsChange} onRetryCollection={() => retryCollectionTokens(activeCollection)}
      onRetryCreated={retryCreated} workspace={libraryWorkspace} />,
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
    returnFocusRef={returnFocusRef} />
    {settingsOpen && <Modul8rSettingsSurface menuSurfaceId={menuSurfaceId} onClose={closeSettings}
      onMenuSurfaceChange={onMenuSurfaceChange} onSurfaceChange={onSurfaceChange} surfaceId={surfaceId} />}
    {viewerSession && <LatticeFocusViewer dossier={viewerSession.entry.dossier} entry={viewerSession.entry}
      getReturnRectangle={() => viewerSession.returnFocus?.getBoundingClientRect?.()} gridVisible inspectionVariant="rack"
      menuSurfaceId={menuSurfaceId} onClosed={() => setViewerSession(null)} originRectangle={viewerSession.originRectangle}
      position={0} renderArtwork={(entry) => <div className="modul8r-library__focus-artwork"><img alt={entry.accessibleLabel}
        decoding="async" draggable="false" referrerPolicy="no-referrer" src={entry.media.src} /></div>}
      returnFocus={viewerSession.returnFocus} surfaceColor="var(--lattice-menu-panel)" total={1} />}</>
    : null;
}
