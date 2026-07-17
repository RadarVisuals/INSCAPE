import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getMissingLibraryViewAssetIds, selectLibraryViewAssets } from '../domain/selectLibraryViewAssets.js';
import { useLibraryStore } from '../state/useLibraryStore.js';
import AssetGrid from './AssetGrid.jsx';
import AssetPreview from './AssetPreview.jsx';
import CollectionToolbar from './CollectionToolbar.jsx';

export default function FolderWindow({ launcher, onClose, dragHandleProps, dragEnabled, escapeEnabled = true, editMode = false }) {
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const state = useLibraryStore();
  const view = launcher.viewType === 'favorites' ? { type: 'favorites', id: null } : { type: 'folder', id: launcher.folderId };
  const folder = state.workspace.folders.find((entry) => entry.id === launcher.folderId);
  const label = launcher.viewType === 'favorites' ? 'Favorites' : folder?.name || 'Missing folder';

  useEffect(() => { state.load(); }, []);
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || !escapeEnabled) return;
      if (selectedAssetId) setSelectedAssetId(null);
      else onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [escapeEnabled, onClose, selectedAssetId]);

  const viewAssets = useMemo(() => selectLibraryViewAssets(state.assets, state.workspace, view, query), [query, state.assets, state.workspace, launcher.id]);
  const missingIds = useMemo(() => getMissingLibraryViewAssetIds(state.assets, state.workspace, view), [state.assets, state.workspace, launcher.id]);
  const selectedAsset = state.assets.find((asset) => asset.id === selectedAssetId) || null;
  const viewExists = launcher.viewType === 'favorites' || Boolean(folder);
  const emptyMessage = !viewExists ? 'This folder no longer exists.'
    : state.status === 'error' ? 'Profile assets could not be loaded. Retry from Collection.'
      : state.status === 'loading' && !state.assets.length ? 'Loading folder assets…'
        : query ? `No assets in ${label} match “${query.trim()}”.`
          : missingIds.length ? `${missingIds.length} assigned asset${missingIds.length === 1 ? '' : 's'} could not be resolved.`
            : `${label} is empty.`;

  return (
    <article className="collection-window folder-window">
      <header className="collection-window__header" {...dragHandleProps} data-enabled={dragEnabled || undefined}>
        <div><span>Space / {launcher.viewType}</span><h2 id={`folder-title-${launcher.id}`}>{label}</h2></div>
        <p>{dragEnabled ? 'Drag to place' : `${viewAssets.length} assets`}</p>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label={`Close ${label}`}><X aria-hidden="true" /></button>
      </header>
      <CollectionToolbar inputRef={searchRef} query={query} onQueryChange={setQuery}
        sourceMode={state.sourceMode} status={state.status} progress={state.progress} liveError={state.liveError}
        onRetry={() => state.load({ forceLive: true })} searchLabel={`Search ${label}`} placeholder={`Search ${label}…`} />
      <div className="collection-window__body folder-window__body">
        <main className="collection-content">
          <div className="collection-content__heading"><h3>{label}</h3><div><span>{viewAssets.length} visible</span>{missingIds.length > 0 && <span>{missingIds.length} unresolved</span>}</div></div>
          <AssetGrid assets={viewAssets} workspace={state.workspace} onSelect={setSelectedAssetId}
            onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} emptyMessage={emptyMessage} authoringEnabled={editMode} />
        </main>
        <AssetPreview asset={selectedAsset} workspace={state.workspace} onClose={() => setSelectedAssetId(null)}
          onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} authoringEnabled={editMode} />
      </div>
    </article>
  );
}
