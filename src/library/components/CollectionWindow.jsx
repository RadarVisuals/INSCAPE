import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { getPinnedLauncher } from '../domain/libraryWorkspace.js';
import { selectLibraryViewAssets } from '../domain/selectLibraryViewAssets.js';
import { useLibraryStore } from '../state/useLibraryStore.js';
import AssetGrid from './AssetGrid.jsx';
import AssetPreview from './AssetPreview.jsx';
import CollectionSidebar from './CollectionSidebar.jsx';
import CollectionToolbar from './CollectionToolbar.jsx';

export default function CollectionWindow({ onClose, dragHandleProps, dragEnabled, focusSearchRequest = 0, escapeEnabled = true, editMode = false }) {
  const searchRef = useRef(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState('create');
  const [folderDialogFolderId, setFolderDialogFolderId] = useState(null);
  const [folderName, setFolderName] = useState('');
  const state = useLibraryStore();

  useEffect(() => { state.load(); }, []);
  useEffect(() => { if (focusSearchRequest) requestAnimationFrame(() => searchRef.current?.focus()); }, [focusSearchRequest]);
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || !escapeEnabled) return;
      if (folderDialogOpen) setFolderDialogOpen(false);
      else if (useLibraryStore.getState().selectedAssetId) useLibraryStore.getState().selectAsset(null);
      else onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [escapeEnabled, folderDialogOpen, onClose]);

  const viewAssets = useMemo(() => {
    return selectLibraryViewAssets(state.assets, state.workspace, state.activeView, state.searchQuery);
  }, [state.activeView, state.assets, state.searchQuery, state.workspace]);
  const selectedAsset = state.assets.find((asset) => asset.id === state.selectedAssetId) || null;
  const requestCreateFolder = () => {
    setFolderDialogMode('create');
    setFolderDialogFolderId(null);
    setFolderName('');
    setFolderDialogOpen(true);
  };
  const requestRenameFolder = (folder) => {
    setFolderDialogMode('rename');
    setFolderDialogFolderId(folder.id);
    setFolderName(folder.name);
    setFolderDialogOpen(true);
  };
  const submitFolderName = (event) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    if (folderDialogMode === 'rename' && folderDialogFolderId) state.renameFolder(folderDialogFolderId, name);
    else state.createFolder(name);
    setFolderDialogOpen(false);
    setFolderDialogFolderId(null);
    setFolderName('');
  };
  const activeFolder = state.workspace.folders.find((folder) => folder.id === state.activeView.id);
  const pinnableView = state.activeView.type === 'favorites' || state.activeView.type === 'folder' ? state.activeView : null;
  const pinnedLauncher = pinnableView ? getPinnedLauncher(state.workspace, pinnableView) : null;
  const pinned = Boolean(pinnedLauncher);
  const emptyMessage = state.status === 'error' ? 'Live data and the local fixture are unavailable.'
    : state.status === 'loading' && !state.assets.length ? 'Loading profile inventory…'
      : state.searchQuery ? `No loaded images match “${state.searchQuery.trim()}”.${state.status === 'loading' ? ' Loading continues.' : ''}`
        : state.activeView.type === 'favorites' ? 'No favorites yet.'
          : state.activeView.type === 'folder' ? `${activeFolder?.name || 'Folder'} is empty.` : 'No image assets were found.';

  return (
    <article className="collection-window">
      <header className="collection-window__header" data-window-titlebar="collection-panel" {...dragHandleProps} data-enabled={dragEnabled || undefined}>
        <div><span>02 / Library</span><h2 id="collection-title">Collection</h2></div>
        <p>{dragEnabled ? 'Drag to place' : 'Image library'}</p>
        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label="Close Collection"><X aria-hidden="true" /></button>
      </header>
      <CollectionToolbar inputRef={searchRef} query={state.searchQuery} onQueryChange={state.setSearchQuery}
        sourceMode={state.sourceMode} status={state.status} progress={state.progress} liveError={state.liveError}
        onRetry={() => state.load({ forceLive: true })} />
      <div className="collection-window__body">
        <CollectionSidebar workspace={state.workspace} activeView={state.activeView} onOpenView={state.setActiveView}
          onCreate={requestCreateFolder} onRename={requestRenameFolder} onDelete={state.deleteFolder} editMode={editMode} />
        <main className="collection-content">
          <div className="collection-content__heading"><h3>{activeFolder?.name || (state.activeView.type === 'favorites' ? 'Favorites' : 'All images')}</h3><div><span>{viewAssets.length} visible</span>{editMode && pinnableView && <button type="button" onClick={() => pinned ? state.unpinView(pinnableView) : state.pinView(pinnableView)}>{pinned ? 'Unpin from canvas' : 'Pin to canvas'}</button>}{editMode && pinnedLauncher && <button className="collection-content__visibility" type="button" aria-pressed={pinnedLauncher.visitorVisible} aria-label={`Show ${activeFolder?.name || 'Favorites'} to visitors`} onClick={() => state.setLauncherVisitorVisibility(pinnedLauncher.id, !pinnedLauncher.visitorVisible)}>Show to visitors <b>{pinnedLauncher.visitorVisible ? 'ON' : 'OFF'}</b></button>}</div></div>
          <AssetGrid assets={viewAssets} workspace={state.workspace} onSelect={state.selectAsset}
            onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} onCreateFolder={requestCreateFolder} emptyMessage={emptyMessage} authoringEnabled={editMode} />
        </main>
        <AssetPreview asset={selectedAsset} workspace={state.workspace} onClose={() => state.selectAsset(null)}
          onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} onCreateFolder={requestCreateFolder} authoringEnabled={editMode} />
      </div>
      {folderDialogOpen && <div className="collection-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title">
        <form onSubmit={submitFolderName}>
          <span>Collection / {folderDialogMode === 'rename' ? 'Edit directory' : 'New directory'}</span>
          <h3 id="folder-dialog-title">{folderDialogMode === 'rename' ? 'Rename folder' : 'Create folder'}</h3>
          <label htmlFor="folder-name">Folder name</label>
          <input id="folder-name" autoFocus value={folderName} maxLength={80} onChange={(event) => setFolderName(event.target.value)} placeholder="1/1 Art" />
          <div>
            <button type="button" onClick={() => setFolderDialogOpen(false)}>Cancel</button>
            <button type="submit" disabled={!folderName.trim()}>{folderDialogMode === 'rename' ? 'Save name' : 'Create folder'}</button>
          </div>
        </form>
      </div>}
    </article>
  );
}
