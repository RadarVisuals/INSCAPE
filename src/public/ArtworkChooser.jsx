import { useEffect, useMemo, useRef, useState } from 'react';
import { searchProfileAssets } from '../library/domain/searchProfileAssets.js';
import { isImageCompatibleAsset } from '../library/domain/canvasObjectRegistry.js';

export default function ArtworkChooser({ assets, status, error, title = 'Choose artwork', onSelect, onCancel }) {
  const [query, setQuery] = useState(''); const ref = useRef(null); const cancelRef = useRef(onCancel); const compatible = useMemo(() => assets.filter(isImageCompatibleAsset), [assets]); const results = useMemo(() => searchProfileAssets(compatible, query), [compatible, query]);
  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => { const previous = document.activeElement; ref.current?.querySelector('input')?.focus(); const keydown = (event) => { if (event.key === 'Escape') { event.preventDefault(); cancelRef.current(); return; } if (event.key !== 'Tab') return; const focusable = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')]; if (!focusable.length) return; const first = focusable[0]; const last = focusable.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; window.addEventListener('keydown', keydown); return () => { window.removeEventListener('keydown', keydown); previous?.focus?.(); }; }, []);
  let message = null; if (status === 'loading' && !assets.length) message = 'Loading owned artwork…'; else if (status === 'error') message = error || 'The owned library could not be loaded.'; else if (!assets.length) message = 'Your owned library is empty.'; else if (!compatible.length) message = 'No compatible owned images are available.'; else if (!results.length) message = 'No images match this search.';
  return <div className="artwork-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section ref={ref} className="artwork-chooser" role="dialog" aria-modal="true" aria-labelledby="artwork-chooser-title">
    <header><div><small>Owned asset library</small><h2 id="artwork-chooser-title">{title}</h2></div><button type="button" onClick={onCancel} aria-label="Cancel artwork selection">×</button></header>
    <label>Search all owned images<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    {message ? <p className="artwork-chooser__status" role="status">{message}</p> : <div className="artwork-chooser__grid">{results.map((asset) => <button key={asset.id} type="button" onClick={() => onSelect(asset)} aria-label={`Choose ${asset.name}`}><span>{asset.thumbnailUrl ? <img src={asset.thumbnailUrl} alt="" loading="lazy" /> : 'Image unavailable'}</span><strong>{asset.name}</strong><small>{asset.collectionName || asset.standard}</small></button>)}</div>}
    <footer><button type="button" onClick={onCancel}>Cancel</button></footer>
  </section></div>;
}
