import { useEffect, useMemo, useRef, useState } from 'react';
import '../lattice/rendering/latticeChromePrimitives.css';
import '../lattice/windows/latticeChromeWindow.css';
import '../lattice/browser/browserWorkspace.css';
import './latticeArtworkPlacementChooser.css';

const searchText = (asset) => [asset.title, asset.collection, asset.stableAssetId]
  .filter(Boolean).join(' ').toLocaleLowerCase();

export default function LatticeArtworkPlacementChooser({ assets, error, menuSurfaceId = 'mist', onCancel, onSelect, status }) {
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
  return <div className="lattice-placement-chooser-backdrop" data-lattice-chrome data-lattice-menu-surface
    data-menu-surface={menuSurfaceId} onPointerDown={(event) => {
    if (event.target === event.currentTarget) onCancel();
  }}>
    <section className="lattice-browser-workspace lattice-chrome-window lattice-placement-chooser"
      data-menu-surface={menuSurfaceId} data-position="center" role="dialog" aria-modal="true"
      aria-labelledby="lattice-place-artwork-title">
      <header className="lattice-chrome-window__header"><strong id="lattice-place-artwork-title">PLACE ARTWORK</strong>
        <span>{results.length} PLACEABLE</span><button className="lattice-chrome-close-control" type="button"
          onClick={onCancel} aria-label="Cancel artwork placement">×</button></header>
      <div className="lattice-chrome-window__body lattice-browser-body">
        <div className="lattice-browser-toolbar"><label className="lattice-browser-faceplate-search"><span aria-hidden="true">⌕</span>
          <input ref={ref} aria-label="Search owned artwork" placeholder="SEARCH OWNED ARTWORK" type="search"
            value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        <main className="lattice-browser-results lattice-chrome-scroll-region">{message
          ? <p className="lattice-browser-status" role="status">{message}</p>
          : <div className="lattice-browser-assets">{results.map((asset) => <button aria-label={`Place ${asset.title || 'untitled artwork'}`}
            className="lattice-browser-asset" key={asset.stableAssetId} type="button" onClick={() => onSelect(asset)}>
            <span className="lattice-browser-asset__media" style={{ aspectRatio: `${asset.width} / ${asset.height}` }}>
              {asset.previewSrc ? <img alt="" className="lattice-browser-asset__decoded-image" decoding="async"
                draggable="false" loading="lazy" referrerPolicy="no-referrer" src={asset.previewSrc} /> : <span>IMAGE UNAVAILABLE</span>}
            </span><span className="lattice-browser-asset__record"><strong>{asset.title || 'Untitled artwork'}</strong>
              {asset.collection && <small>{asset.collection}</small>}</span>
          </button>)}</div>}</main>
      </div>
      <footer className="lattice-chrome-window__footer"><span>ACTIVE TABLE / CANONICAL PLACE</span>
        <span>{results.length} RESULTS</span></footer>
    </section>
  </div>;
}
