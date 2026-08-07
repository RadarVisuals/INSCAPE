import { useEffect, useMemo, useRef, useState } from 'react';

const searchText = (asset) => [asset.title, asset.collection, asset.stableAssetId]
  .filter(Boolean).join(' ').toLocaleLowerCase();

export default function LatticeArtworkPlacementChooser({ assets, error, onCancel, onSelect, status }) {
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const results = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    return assets.filter(({ placeable }) => placeable)
      .filter((asset) => tokens.every((token) => searchText(asset).includes(token)));
  }, [assets, query]);
  useEffect(() => {
    ref.current?.focus();
    const keydown = (event) => { if (event.key === 'Escape') { event.preventDefault(); onCancel(); } };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [onCancel]);
  const message = status === 'loading' && !assets.length ? 'LOADING OWNED ARTWORK'
    : error && !assets.length ? error : !results.length ? 'NO PLACEABLE ARTWORK IN THIS VIEW' : null;
  return <div className="artwork-dialog-backdrop" data-lattice-chrome onPointerDown={(event) => {
    if (event.target === event.currentTarget) onCancel();
  }}>
    <section className="artwork-chooser" role="dialog" aria-modal="true" aria-labelledby="lattice-place-artwork-title">
      <header><div><small>PLACE</small><h2 id="lattice-place-artwork-title">Choose artwork</h2></div>
        <button type="button" onClick={onCancel} aria-label="Cancel artwork placement">×</button></header>
      <label>SEARCH OWNED ARTWORK<input ref={ref} type="search" value={query}
        onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="artwork-chooser__grid">{message ? <p className="artwork-chooser__status" role="status">{message}</p>
        : results.map((asset) => <button key={asset.stableAssetId} type="button" onClick={() => onSelect(asset)}>
          <span>{asset.previewSrc ? <img alt="" decoding="async" draggable="false" loading="lazy"
            referrerPolicy="no-referrer" src={asset.previewSrc} /> : 'IMAGE UNAVAILABLE'}</span>
          <strong>{asset.title || 'Untitled artwork'}</strong>{asset.collection && <small>{asset.collection}</small>}
        </button>)}</div>
      <footer><span>{results.length} PLACEABLE</span><button type="button" onClick={onCancel}>CANCEL</button></footer>
    </section>
  </div>;
}
