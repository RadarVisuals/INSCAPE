import { ArrowUpRight, Heart, X } from 'lucide-react';

export default function AssetPreview({ asset, workspace, onClose, onFavorite, onFolder }) {
  if (!asset) return null;
  return (
    <section className="asset-preview" aria-label={`${asset.name} details`}>
      <header><div><span>{asset.standard}</span><h3>{asset.name}</h3></div><button type="button" onClick={onClose} aria-label="Close image preview"><X aria-hidden="true" /></button></header>
      <div className="asset-preview__image">{asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} /> : <span>Image unavailable</span>}</div>
      <div className="asset-preview__metadata">
        <p>{asset.collectionName || 'Uncatalogued asset'}</p>
        {asset.description && <p>{asset.description}</p>}
        <dl><div><dt>Contract</dt><dd>{asset.contractAddress}</dd></div>{asset.tokenId && <div><dt>Token ID</dt><dd>{asset.tokenId}</dd></div>}</dl>
        <button type="button" aria-pressed={workspace.favorites.includes(asset.id)} onClick={() => onFavorite(asset.id)}><Heart aria-hidden="true" /> Favorite</button>
        <fieldset><legend>Folder membership</legend>{workspace.folders.length ? workspace.folders.map((folder) => <label key={folder.id}><input type="checkbox" checked={folder.assetIds.includes(asset.id)} onChange={(event) => onFolder(folder.id, asset.id, event.target.checked)} /> {folder.name}</label>) : <span>No personal folders yet.</span>}</fieldset>
        {asset.imageUrl && <a href={asset.imageUrl} target="_blank" rel="noreferrer">Open original <ArrowUpRight aria-hidden="true" /></a>}
      </div>
    </section>
  );
}
