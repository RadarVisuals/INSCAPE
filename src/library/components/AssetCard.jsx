import { FolderPlus, Heart } from 'lucide-react';

export default function AssetCard({ asset, favorite, folders, onOpen, onFavorite, onFolder }) {
  return (
    <article className="asset-card" data-metadata={asset.metadataStatus}>
      <button className="asset-card__preview" type="button" onClick={onOpen} aria-label={`Preview ${asset.name}`}>
        {asset.thumbnailUrl
          ? <img src={asset.thumbnailUrl} alt={asset.name} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.dataset.broken = 'true'; }} />
          : <span className="asset-card__broken">Image unavailable</span>}
      </button>
      <div className="asset-card__info"><strong>{asset.name}</strong><span>{asset.collectionName || 'Uncatalogued'}</span></div>
      <button className="asset-card__favorite" type="button" aria-pressed={favorite} onClick={onFavorite} aria-label={`${favorite ? 'Remove' : 'Add'} ${asset.name} ${favorite ? 'from' : 'to'} favorites`}>
        <Heart aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} /><span className="sr-only">Favorite</span>
      </button>
      <details className="asset-card__folders">
        <summary aria-label={`Organize ${asset.name}`}><FolderPlus aria-hidden="true" /></summary>
        <div>{folders.length ? folders.map((folder) => <label key={folder.id}><input type="checkbox" checked={folder.assetIds.includes(asset.id)} onChange={(event) => onFolder(folder.id, event.target.checked)} /> {folder.name}</label>) : <span>Create a folder first</span>}</div>
      </details>
    </article>
  );
}
