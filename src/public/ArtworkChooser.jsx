import { useEffect, useMemo, useRef, useState } from 'react';
import { searchProfileAssets } from '../library/domain/searchProfileAssets.js';
import { isImageCompatibleAsset } from '../library/domain/canvasObjectRegistry.js';
import './assetIndex.css';

function ChooserThumbnail({ asset }) {
  const [failed, setFailed] = useState(false);
  const source = asset.thumbnailUrl || asset.imageUrl || null;
  useEffect(() => setFailed(false), [source]);
  if (!source || failed) return <span>IMAGE UNAVAILABLE</span>;
  return <img src={source} alt="" loading="lazy" decoding="async" draggable="false" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export default function ArtworkChooser({ assets, folders = [], status, error, title = 'Choose artwork', onSelect, onCancel }) {
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState(null);
  const ref = useRef(null);
  const cancelRef = useRef(onCancel);
  const compatible = useMemo(() => assets.filter(isImageCompatibleAsset), [assets]);
  const scoped = useMemo(() => {
    if (!folderId) return compatible;
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) return compatible;
    const ids = new Set(folder.assetIds);
    return compatible.filter((asset) => ids.has(asset.id));
  }, [compatible, folderId, folders]);
  const results = useMemo(() => searchProfileAssets(scoped, query), [query, scoped]);

  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => {
    if (folderId && !folders.some((folder) => folder.id === folderId)) setFolderId(null);
  }, [folderId, folders]);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('input')?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelRef.current(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, []);

  let message = null;
  if (status === 'loading' && !assets.length) message = 'LOADING OWNED ARTWORK';
  else if (status === 'error') message = error || 'THE OWNED LIBRARY COULD NOT BE LOADED';
  else if (!assets.length) message = 'YOUR OWNED LIBRARY IS EMPTY';
  else if (!compatible.length) message = 'NO COMPATIBLE OWNED IMAGES ARE AVAILABLE';
  else if (!results.length) message = 'NO IMAGES MATCH THIS VIEW';

  const activeFolder = folders.find((folder) => folder.id === folderId) || null;
  return <div className="artwork-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section ref={ref} className="asset-index-workspace gallery-asset-chooser" role="dialog" aria-modal="true" aria-labelledby="artwork-chooser-title">
      <aside>
        <div className="asset-index-workspace__owner"><span>GALLERY</span><i>ASSET SOURCE</i></div>
        <nav aria-label="Artwork sources">
          <button type="button" data-active={!folderId || undefined} onClick={() => setFolderId(null)}><span>ALL OWNED</span><i>{compatible.length}</i></button>
          <p>CATEGORIES / FOLDERS</p>
          {folders.map((folder) => <button type="button" key={folder.id} data-folder data-active={folderId === folder.id || undefined} onClick={() => setFolderId(folder.id)}><span>{folder.name}</span><i>{folder.public ? 'PUBLIC' : 'PRIVATE'} · {folder.assetIds.length}</i></button>)}
        </nav>
      </aside>
      <main>
        <div className="asset-index-workspace__tools">
          <label><span aria-hidden="true">⌕</span><span className="sr-only">Search owned artwork</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH OWNED ARTWORK" /></label>
        </div>
        <header><strong id="artwork-chooser-title">{title}</strong><span>{results.length} RESULTS</span></header>
        <div className="asset-index-workspace__assets">
          {message ? <p role="status">{message}</p> : results.map((asset) => <button key={asset.id} type="button" onClick={() => onSelect(asset)} aria-label={`Choose ${asset.name || 'untitled artwork'}`}>
            <span className="asset-index-workspace__thumb"><ChooserThumbnail asset={asset} /></span>
            <strong>{asset.name || 'Untitled artwork'}</strong>
            {(asset.collectionName || asset.standard) && <small>{[asset.standard, asset.collectionName].filter(Boolean).join(' · ')}</small>}
          </button>)}
        </div>
        <footer><span>{activeFolder ? activeFolder.name : 'ALL OWNED'} / SELECT ARTWORK</span><button type="button" onClick={onCancel}>CANCEL</button></footer>
      </main>
      <button className="gallery-asset-chooser__close" type="button" onClick={onCancel} aria-label="Cancel artwork selection">×</button>
    </section>
  </div>;
}
