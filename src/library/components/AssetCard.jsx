import { FolderPlus, Heart } from 'lucide-react';

export default function AssetCard({ asset, favorite, folders, onOpen, onFavorite, onFolder, onCreateFolder, authoringEnabled = false, renderImage }) {
  const preview = asset.thumbnailUrl
    ? renderImage?.({ src: asset.thumbnailUrl, alt: asset.name, loading: 'lazy', fallback: <span className="asset-card__broken">Image unavailable</span> })
      || <img src={asset.thumbnailUrl} alt={asset.name} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.dataset.broken = 'true'; }} />
    : <span className="asset-card__broken">Image unavailable</span>;
  return (
    <article className="asset-card" data-metadata={asset.metadataStatus}>
      {onOpen
        ? <button className="asset-card__preview" type="button" onClick={onOpen} aria-label={`Preview ${asset.name}`}>{preview}</button>
        : <div className="asset-card__preview">{preview}</div>}
      <div className="asset-card__info"><strong>{asset.name}</strong><span>{asset.collectionName || 'Uncatalogued'}</span></div>
      {authoringEnabled && <button className="asset-card__favorite" type="button" aria-pressed={favorite} onClick={onFavorite} aria-label={`${favorite ? 'Remove' : 'Add'} ${asset.name} ${favorite ? 'from' : 'to'} favorites`}>
        <Heart aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} /><span className="sr-only">Favorite</span>
      </button>}
      {authoringEnabled && <details className="asset-card__folders">
        <summary aria-label={`Organize ${asset.name}`}><FolderPlus aria-hidden="true" /></summary>
        <div>{folders.map((folder) => <label key={folder.id}><input type="checkbox" checked={folder.assetIds.includes(asset.id)} onChange={(event) => onFolder(folder.id, event.target.checked)} /> {folder.name}</label>)}{onCreateFolder && <button type="button" onClick={onCreateFolder}>+ New folder</button>}</div>
      </details>}
    </article>
  );
}
