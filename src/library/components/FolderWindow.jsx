import { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { getPinnedLauncher } from '../domain/libraryWorkspace.js';
import { getMissingLibraryViewAssetIds, selectLibraryViewAssets } from '../domain/selectLibraryViewAssets.js';
import { useLibraryStore } from '../state/useLibraryStore.js';
import AssetGrid from './AssetGrid.jsx';
import AssetPreview from './AssetPreview.jsx';
import CollectionToolbar from './CollectionToolbar.jsx';
import FolderAssetPicker from './FolderAssetPicker.jsx';

export default function FolderWindow({ launcher, onClose, dragHandleProps, dragEnabled, escapeEnabled = true, canAuthorLibrary = false, windowGeometry = null }) {
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const [query, setQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const state = useLibraryStore();
  const view = launcher.viewType === 'favorites' ? { type: 'favorites', id: null } : { type: 'folder', id: launcher.folderId };
  const folder = state.workspace.folders.find((entry) => entry.id === launcher.folderId);
  const label = launcher.viewType === 'favorites' ? 'Favorites' : folder?.name || 'Missing folder';
  const pinnedLauncher = getPinnedLauncher(state.workspace, view);

  useEffect(() => { state.load(); }, []);
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || !escapeEnabled) return;
      if (pickerOpen) setPickerOpen(false);
      else if (renameOpen) setRenameOpen(false);
      else if (menuOpen) setMenuOpen(false);
      else if (selectedAssetId) setSelectedAssetId(null);
      else onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [escapeEnabled, menuOpen, onClose, pickerOpen, renameOpen, selectedAssetId]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeMenu = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    window.addEventListener('pointerdown', closeMenu);
    return () => window.removeEventListener('pointerdown', closeMenu);
  }, [menuOpen]);

  const viewAssets = useMemo(() => selectLibraryViewAssets(state.assets, state.workspace, view, query), [query, state.assets, state.workspace, launcher.id]);
  const missingIds = useMemo(() => getMissingLibraryViewAssetIds(state.assets, state.workspace, view), [state.assets, state.workspace, launcher.id]);
  const selectedAsset = state.assets.find((asset) => asset.id === selectedAssetId) || null;
  const viewExists = launcher.viewType === 'favorites' || Boolean(folder);
  const emptyMessage = !viewExists ? 'This folder no longer exists.'
    : state.status === 'error' ? 'Profile assets could not be loaded. Retry from Library.'
      : state.status === 'loading' && !state.assets.length ? 'Loading folder assets…'
        : query ? `No assets in ${label} match “${query.trim()}”.`
          : missingIds.length ? `${missingIds.length} assigned asset${missingIds.length === 1 ? '' : 's'} could not be resolved.`
            : `${label} is empty.`;

  const beginRename = () => {
    if (!folder) return;
    setFolderName(folder.name);
    setRenameOpen(true);
    setMenuOpen(false);
  };
  const saveMembership = (selectedIds) => {
    if (!folder) return;
    const currentIds = new Set(folder.assetIds);
    const candidateIds = new Set([...folder.assetIds, ...state.assets.map((asset) => asset.id)]);
    candidateIds.forEach((assetId) => {
      const included = selectedIds.has(assetId);
      if (currentIds.has(assetId) !== included) state.setFolderAsset(folder.id, assetId, included);
    });
    setPickerOpen(false);
  };
  const deleteCurrentFolder = () => {
    if (!folder || !window.confirm(`Delete folder “${folder.name}”? Assets will remain in Library.`)) return;
    state.deleteFolder(folder.id);
    onClose();
  };

  return (
    <article className="collection-window folder-window">
      <header className="collection-window__header" data-window-titlebar={`folder-panel:${launcher.id}`} {...dragHandleProps} data-enabled={dragEnabled || undefined}>
        <div><span>Library / {launcher.viewType === 'folder' ? 'Folder' : 'Collection'}</span><h2 id={`folder-title-${launcher.id}`}>{label}</h2></div>
        <p>{viewAssets.length} assets</p>
        <div className="collection-window__actions">
          {canAuthorLibrary && folder && <div className="folder-window__menu" ref={menuRef}>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Manage ${label}`}><MoreHorizontal aria-hidden="true" /></button>
            {menuOpen && <div role="menu">
              <button role="menuitem" type="button" onClick={() => { setPickerOpen(true); setMenuOpen(false); }}>Add assets</button>
              <button role="menuitem" type="button" onClick={beginRename}>Rename folder</button>
              <button role="menuitem" type="button" onClick={() => { if (pinnedLauncher) { state.unpinView(view); onClose(); } else state.pinView(view); setMenuOpen(false); }}>{pinnedLauncher ? 'Unpin from canvas' : 'Pin to canvas'}</button>
              {pinnedLauncher && <button role="menuitemcheckbox" aria-checked={pinnedLauncher.visitorVisible} type="button" onClick={() => state.setLauncherVisitorVisibility(pinnedLauncher.id, !pinnedLauncher.visitorVisible)}>{pinnedLauncher.visitorVisible ? 'Hide from visitors' : 'Show to visitors'}</button>}
              {pinnedLauncher && <button role="menuitemcheckbox" aria-checked={pinnedLauncher.startOpen} type="button" onClick={() => state.setLauncherStartOpen(pinnedLauncher.id, !pinnedLauncher.startOpen, windowGeometry || pinnedLauncher.windowGeometry)}>{pinnedLauncher.startOpen ? 'Open at startup: On' : 'Open at startup: Off'}</button>}
              <button className="folder-window__delete" role="menuitem" type="button" onClick={deleteCurrentFolder}>Delete folder</button>
            </div>}
          </div>}
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label={`Close ${label}`}><X aria-hidden="true" /></button>
        </div>
      </header>
      <CollectionToolbar inputRef={searchRef} query={query} onQueryChange={setQuery}
        sourceMode={state.sourceMode} status={state.status} progress={state.progress} liveError={state.liveError}
        onRetry={() => state.load({ forceLive: true })} searchLabel={`Search ${label}`} placeholder={`Search ${label}…`} />
      <div className="collection-window__body folder-window__body">
        <main className="collection-content">
          <div className="collection-content__heading"><h3>{label}</h3><div>{canAuthorLibrary && folder && <button type="button" onClick={() => setPickerOpen(true)}>+ Add assets</button>}<span>{viewAssets.length} visible</span>{missingIds.length > 0 && <span>{missingIds.length} unresolved</span>}</div></div>
          <AssetGrid assets={viewAssets} workspace={state.workspace} onSelect={setSelectedAssetId}
            onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} emptyMessage={emptyMessage}
            emptyAction={canAuthorLibrary && folder ? <button type="button" onClick={() => setPickerOpen(true)}>+ Add assets</button> : null} authoringEnabled={canAuthorLibrary} />
        </main>
        <AssetPreview asset={selectedAsset} workspace={state.workspace} onClose={() => setSelectedAssetId(null)}
          onFavorite={state.toggleFavorite} onFolder={state.setFolderAsset} authoringEnabled={canAuthorLibrary} />
      </div>
      {pickerOpen && folder && <FolderAssetPicker assets={state.assets} folder={folder} onCancel={() => setPickerOpen(false)} onSave={saveMembership} />}
      {renameOpen && folder && <div className="collection-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-folder-title">
        <form onSubmit={(event) => { event.preventDefault(); const name = folderName.trim(); if (!name) return; state.renameFolder(folder.id, name); setRenameOpen(false); }}>
          <span>Library / Folder</span><h3 id="rename-folder-title">Rename folder</h3>
          <label htmlFor={`folder-name-${folder.id}`}>Folder name</label>
          <input id={`folder-name-${folder.id}`} autoFocus value={folderName} maxLength={80} onChange={(event) => setFolderName(event.target.value)} />
          <div><button type="button" onClick={() => setRenameOpen(false)}>Cancel</button><button type="submit" disabled={!folderName.trim()}>Save name</button></div>
        </form>
      </div>}
    </article>
  );
}
