import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectLibraryViewAssets } from '../library/domain/selectLibraryViewAssets.js';
import { useLibraryStore } from '../library/state/useLibraryStore.js';
import DesktopMenu from './menus/DesktopMenu.jsx';
import NftFlipViewer from './NftFlipViewer.jsx';
import {
  initialCategoryBrowserRect,
  resizeCategoryBrowserByKey,
  resizeCategoryBrowserRect
} from './categoryAssetBrowserModel.js';
import './assetIndex.css';

const FILTERS = ['ALL', 'IMAGE', 'AUDIO', 'VIDEO', 'ANIMATION'];
const viewportSize = () => ({ width: globalThis.innerWidth || 1280, height: globalThis.innerHeight || 720 });

function assetKind(asset) {
  const value = String(asset?.mediaType || asset?.mimeType || asset?.type || '').toUpperCase();
  if (value.includes('VIDEO')) return 'VIDEO';
  if (value.includes('AUDIO')) return 'AUDIO';
  if (value.includes('ANIMATION') || value.includes('MODEL')) return 'ANIMATION';
  return 'IMAGE';
}

function assetImage(asset) {
  return asset?.thumbnailUrl || asset?.imageUrl || asset?.originalImageUrl || null;
}

function IndexThumbnail({ asset }) {
  const [failed, setFailed] = useState(false);
  const source = assetImage(asset);
  useEffect(() => setFailed(false), [source]);
  if (!source || failed) return <span>IMAGE UNAVAILABLE</span>;
  return <img src={source} alt="" loading="lazy" decoding="async" draggable="false" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export default function AssetIndex({ visible = false, open = false, onOpenChange, profileName = '' }) {
  const assets = useLibraryStore((state) => state.assets);
  const workspace = useLibraryStore((state) => state.workspace);
  const status = useLibraryStore((state) => state.status);
  const sourceMode = useLibraryStore((state) => state.sourceMode);
  const progress = useLibraryStore((state) => state.progress);
  const error = useLibraryStore((state) => state.error || state.liveError);
  const load = useLibraryStore((state) => state.load);
  const createFolder = useLibraryStore((state) => state.createFolder);
  const deleteFolder = useLibraryStore((state) => state.deleteFolder);
  const setFolderAsset = useLibraryStore((state) => state.setFolderAsset);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const [view, setView] = useState({ type: 'all', id: null });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [sort, setSort] = useState('RECENT');
  const [organizing, setOrganizing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewerAsset, setViewerAsset] = useState(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderContext, setFolderContext] = useState(null);
  const [folderPendingDelete, setFolderPendingDelete] = useState(null);
  const viewerTriggerRef = useRef(null);
  const resizeRef = useRef(null);
  const [viewport, setViewport] = useState(viewportSize);
  const [rect, setRect] = useState(() => initialCategoryBrowserRect(viewportSize()));

  useEffect(() => {
    const resize = () => {
      const nextViewport = viewportSize();
      setViewport(nextViewport);
      setRect((current) => resizeCategoryBrowserRect(current, { x: 0, y: 0 }, nextViewport));
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (open && status === 'idle') load();
    if (!open) {
      setOrganizing(false);
      setSelectedIds([]);
      setViewerAsset(null);
      setNewFolderOpen(false);
      setFolderContext(null);
      setFolderPendingDelete(null);
    }
  }, [load, open, status]);

  useEffect(() => {
    if (!folderPendingDelete) return undefined;
    const close = (event) => {
      if (event.key === 'Escape') setFolderPendingDelete(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [folderPendingDelete]);

  const filteredAssets = useMemo(() => {
    const scoped = selectLibraryViewAssets(assets, workspace, view, query)
      .filter((asset) => filter === 'ALL' || assetKind(asset) === filter);
    if (sort === 'A-Z') return [...scoped].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (sort === 'COLLECTION') return [...scoped].sort((a, b) => String(a.collectionName || '').localeCompare(String(b.collectionName || '')));
    return [...scoped].reverse();
  }, [assets, filter, query, sort, view, workspace]);

  const viewLabel = view.type === 'favorites'
    ? 'FAVORITES'
    : view.type === 'folder'
      ? workspace.folders.find((folder) => folder.id === view.id)?.name || 'FOLDER'
      : 'ALL OWNED';
  const ownerLabel = profileName || workspace.profileAddress || '';

  const activateAsset = (event, asset) => {
    if (organizing) {
      setSelectedIds((current) => current.includes(asset.id)
        ? current.filter((id) => id !== asset.id)
        : [...current, asset.id]);
      return;
    }
    viewerTriggerRef.current = event.currentTarget;
    setViewerAsset(asset);
  };

  const submitFolder = (event) => {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const id = createFolder(name);
    if (id) setView({ type: 'folder', id });
    setNewFolderName('');
    setNewFolderOpen(false);
  };

  const confirmFolderDelete = () => {
    if (!folderPendingDelete) return;
    deleteFolder(folderPendingDelete.id);
    if (view.type === 'folder' && view.id === folderPendingDelete.id) setView({ type: 'all', id: null });
    setFolderPendingDelete(null);
  };

  const addSelectionToFolder = () => {
    if (view.type !== 'folder') return;
    selectedIds.forEach((assetId) => setFolderAsset(view.id, assetId, true));
    setSelectedIds([]);
  };

  const beginResize = (event) => {
    if (viewport.width < 720 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    resizeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect };
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveResize = (event) => {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setRect(resizeCategoryBrowserRect(active.rect, { x: event.clientX - active.x, y: event.clientY - active.y }, viewport));
  };
  const finishResize = (event) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };
  const resizeByKey = (event) => {
    const next = resizeCategoryBrowserByKey(rect, event.key, viewport);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setRect(next);
  };

  const workspaceContent = open && typeof document !== 'undefined' ? createPortal(<>
    <section className="asset-index-workspace" aria-label="Private asset index" style={rect} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <aside>
        <div className="asset-index-workspace__owner"><span>{ownerLabel}</span><i>PRIVATE</i></div>
        <nav aria-label="Asset index views">
          <button type="button" data-active={view.type === 'all' || undefined} onClick={() => setView({ type: 'all', id: null })}><span>ALL OWNED</span><i>{assets.length}</i></button>
          <button type="button" data-active={view.type === 'favorites' || undefined} onClick={() => setView({ type: 'favorites', id: null })}><span>FAVORITES</span><i>{workspace.favorites.length}</i></button>
          <p>FOLDERS</p>
          {workspace.folders.map((folder) => <button type="button" key={folder.id} data-folder data-active={view.type === 'folder' && view.id === folder.id || undefined} onClick={() => setView({ type: 'folder', id: folder.id })} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setFolderContext({ folder, anchor: { x: event.clientX, y: event.clientY }, returnFocus: event.currentTarget }); }}><span>{folder.name}</span><i>{folder.assetIds.length}</i></button>)}
        </nav>
        <button className="asset-index-workspace__new" type="button" onClick={() => setNewFolderOpen(true)}>+ CREATE FOLDER</button>
      </aside>
      <main>
        <div className="asset-index-workspace__tools">
          <label><span aria-hidden="true">⌕</span><span className="sr-only">Search asset pool</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH ASSET POOL" /></label>
          <button type="button" data-active={organizing || undefined} onClick={() => { setOrganizing((current) => !current); setSelectedIds([]); }}>{organizing ? 'DONE' : 'ORGANIZE'}</button>
        </div>
        <div className="asset-index-workspace__filters"><span>FILTER</span>{FILTERS.map((kind) => <button type="button" key={kind} data-active={filter === kind || undefined} onClick={() => setFilter(kind)}>{kind}</button>)}<label><span>SORT</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="RECENT">RECENT</option><option value="A-Z">A–Z</option><option value="COLLECTION">COLLECTION</option></select></label></div>
        <header><strong>{viewLabel}</strong><span>{filteredAssets.length} RESULTS</span></header>
        <div className="asset-index-workspace__assets">
          {(status === 'idle' || status === 'loading') && !filteredAssets.length && <p>LOADING ASSET INDEX{sourceMode === 'RPC' ? ' / DIRECT RPC' : ''}{progress.total ? ` ${progress.resolved}/${progress.total}` : ''}</p>}
          {status === 'error' && !filteredAssets.length && <div className="asset-index-workspace__error" role="alert"><strong>ASSET SOURCE OFFLINE</strong><p>{error || 'ASSET INDEX UNAVAILABLE'}</p><button type="button" onClick={() => load({ forceLive: true })}>RETRY</button></div>}
          {status !== 'idle' && status !== 'loading' && status !== 'error' && !filteredAssets.length && <p>NO ASSETS MATCH THIS VIEW</p>}
          {filteredAssets.map((asset) => <button type="button" key={asset.id} data-selected={selectedIds.includes(asset.id) || undefined} onClick={(event) => activateAsset(event, asset)} aria-label={`${organizing ? 'Select' : 'Inspect'} ${asset.name || 'untitled asset'}`}>
            <span className="asset-index-workspace__thumb"><IndexThumbnail asset={asset} /></span>
            <strong>{asset.name || 'Untitled asset'}</strong>
            {(asset.collectionName || assetKind(asset)) && <small>{[assetKind(asset), asset.collectionName].filter(Boolean).join(' · ')}</small>}
          </button>)}
        </div>
        <footer><span>{organizing ? `${selectedIds.length} SELECTED` : ''}</span>{organizing && <button type="button" disabled={!selectedIds.length || view.type !== 'folder'} onClick={addSelectionToFolder}>ADD TO FOLDER</button>}</footer>
      </main>
      <button className="asset-index-workspace__resize" type="button" aria-label="Resize asset index" onKeyDown={resizeByKey} onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize}><i aria-hidden="true">›</i></button>
      {newFolderOpen && <div className="asset-index-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-index-folder-title"><form onSubmit={submitFolder}><span>INDEX / NEW DIRECTORY</span><h2 id="asset-index-folder-title">CREATE FOLDER</h2><label htmlFor="asset-index-folder-name">FOLDER NAME</label><input id="asset-index-folder-name" autoFocus maxLength="80" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} /><div><button type="button" onClick={() => setNewFolderOpen(false)}>CANCEL</button><button type="submit" disabled={!newFolderName.trim()}>CREATE</button></div></form></div>}
      {folderPendingDelete && <div className="asset-index-folder-dialog" role="alertdialog" aria-modal="true" aria-labelledby="asset-index-delete-title" aria-describedby="asset-index-delete-copy"><div className="asset-index-folder-dialog__panel"><span>INDEX / REMOVE DIRECTORY</span><h2 id="asset-index-delete-title">DELETE {folderPendingDelete.name}</h2><p id="asset-index-delete-copy">THE FOLDER WILL BE REMOVED. ITS {folderPendingDelete.assetIds.length} {folderPendingDelete.assetIds.length === 1 ? 'ASSET REMAINS' : 'ASSETS REMAIN'} IN YOUR INDEX.</p><div><button type="button" autoFocus onClick={() => setFolderPendingDelete(null)}>CANCEL</button><button type="button" data-danger onClick={confirmFolderDelete}>DELETE FOLDER</button></div></div></div>}
    </section>
    {folderContext && <DesktopMenu className="asset-index-context-menu" anchor={folderContext.anchor} label={`${folderContext.folder.name} commands`} commands={[{ id: 'delete-folder', label: 'Delete Folder' }]} onCommand={() => { setFolderPendingDelete(folderContext.folder); setFolderContext(null); }} onClose={() => setFolderContext(null)} returnFocus={folderContext.returnFocus} />}
    {viewerAsset && <NftFlipViewer asset={viewerAsset} onClose={() => setViewerAsset(null)} returnFocus={viewerTriggerRef.current} />}
  </>, document.body) : null;

  return <>
    <section className="asset-index-card" aria-hidden={!visible} data-visible={visible || undefined} data-expanded={open || undefined}>
      <button type="button" tabIndex={visible ? 0 : -1} aria-expanded={open} onClick={() => onOpenChange?.(!open)}><strong>INDEX</strong><i aria-hidden="true">›</i></button>
    </section>
    {workspaceContent}
  </>;
}
