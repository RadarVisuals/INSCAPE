import { useEffect, useMemo, useState } from 'react';

export default function FolderAssetPicker({ assets, folder, emptyMessage = 'No Library assets match this search.', onCancel, onSave }) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set(folder.assetIds));

  useEffect(() => {
    setSelectedIds(new Set(folder.assetIds));
  }, [folder.id]);

  const visibleAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter((asset) => `${asset.name} ${asset.collectionName || ''}`.toLowerCase().includes(needle));
  }, [assets, query]);

  const toggleAsset = (assetId, included) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (included) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  };

  return (
    <div className="folder-asset-picker" role="dialog" aria-modal="true" aria-labelledby="folder-asset-picker-title">
      <form onSubmit={(event) => { event.preventDefault(); onSave(selectedIds); }}>
        <header>
          <div><span>Library / Folder</span><h3 id="folder-asset-picker-title">Add assets to {folder.name}</h3></div>
          <p>{selectedIds.size} selected</p>
        </header>
        <label className="folder-asset-picker__search">
          <span>Search Library</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search owned assets…" />
        </label>
        <div className="folder-asset-picker__grid">
          {visibleAssets.map((asset) => {
            const selected = selectedIds.has(asset.id);
            return <label key={asset.id} data-selected={selected || undefined}>
              <input type="checkbox" checked={selected} onChange={(event) => toggleAsset(asset.id, event.target.checked)} />
              <span>{asset.thumbnailUrl ? <img src={asset.thumbnailUrl} alt="" loading="lazy" /> : <i>Image unavailable</i>}</span>
              <strong>{asset.name}</strong>
              <small>{asset.collectionName || 'Uncatalogued'}</small>
            </label>;
          })}
          {!visibleAssets.length && <p className="folder-asset-picker__empty">{query.trim() ? 'No Library assets match this search.' : emptyMessage}</p>}
        </div>
        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit">Save membership</button>
        </footer>
      </form>
    </div>
  );
}
