import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { searchProfileAssets } from '../domain/searchProfileAssets.js';
import { useLibraryStore } from '../state/useLibraryStore.js';
import AssetGrid from './AssetGrid.jsx';
import AssetPreview from './AssetPreview.jsx';
import CollectionSidebar from './CollectionSidebar.jsx';
import CollectionToolbar from './CollectionToolbar.jsx';

export default function CollectionWindow({ onClose, dragHandleProps, dragEnabled, focusSearchRequest = 0, escapeEnabled = true }) {
  const searchRef = useRef(null);
  const state = useLibraryStore();

  useEffect(() => { state.load(); }, []);
  useEffect(() => { if (focusSearchRequest) requestAnimationFrame(() => searchRef.current?.focus()); }, [focusSearchRequest]);
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || !escapeEnabled) return;
      if (useLibraryStore.getState().selectedAssetId) useLibraryStore.getState().selectAsset(null);
      else onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [escapeEnabled, onClose]);

  const viewAssets = useMemo(() => {
    let assets = state.assets;
    if (state.activeView.type === 'favorites') assets = assets.filter((asset) => state.workspace.favorites.includes(asset.id));
    if (state.activeView.type === 'folder') {
      const folder = state.workspace.folders.find((entry) => entry.id === state.activeView.id);
      const ids = new Set(folder?.assetIds || []);
      assets = assets.filter((asset) => ids.has(asset.id));
    }
    return searchProfileAssets(assets, state.searchQuery);
  }, [state.activeView, state.assets, state.searchQuery, state.workspace]);
  const selectedAsset = state.assets.find((asset) => asset.id === state.selectedAssetId) || null;
  const activeFolder = state.workspace.folders.find((folder) => folder.id === state.activeView.id);
  const emptyMessage = state.status === 'error' ? 'Live data and the local fixture are unavailable.'
    : state.status === 'loading' && !state.assets.length ? 'Loading profile inventory…'
      : state.searchQuery ? `No loaded images match “${state.searchQuery.trim()}”.${state.status === 'loading' ? ' Loading continues.' : ''}`
        : state.activeView.type === 'favorites' ? 'No favorites yet.'
          : state.activeView.type === 'folder' ? `${activeFolder?.name || 'Folder'} is empty.` : 'No image assets were found.';

  return (
    <article className="collection-window">
      <header className="collection-window__header" {...dragHandleProps} data-enabled={dragEnabled || undefined}>
        <div><span>02 / Library</span><h2 id="collection-title">Collection</h2></div>
        <p>{dragEnabled ? 'Drag to place' : 'Image library'}</p>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label="Close Collection"><X aria-hidden="true" /></button>
      </header>
      <CollectionToolbar inputRef={searchRef} query={state.searchQuery} onQueryChange={state.setSearchQuery}
        sourceMode={state.sourceMode} status={state.status} progress={state.progress} liveError={state.liveError}
        onRetry={() => state.load({ forceLive: true })} />
      <div className="collection-window__body">
        <CollectionSidebar workspace={state.workspace} activeView={state.activeView} onOpenView={state.setActiveView}
          onCreate={state.createFolder} onRename={state.renameFolder} onDelete={state.deleteFolder} />
        <main className="collection-content">
          <div className="collection-content__heading"><h3>{activeFolder?.name || (state.activeView.type === 'favorites' ? 'Favorites' : 'All images')}</h3><span>{viewAssets.length} visible</span></div>
          <AssetGrid assets={viewAssets} workspace={state.workspace} onSelect={state.selectAsset}
            onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} emptyMessage={emptyMessage} />
        </main>
        <AssetPreview asset={selectedAsset} workspace={state.workspace} onClose={() => state.selectAsset(null)}
          onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} />
      </div>
    </article>
  );
}
