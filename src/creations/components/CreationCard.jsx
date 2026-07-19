export default function CreationCard({ creation, onOpen }) {
  return <article className="creation-card" data-metadata={creation.metadataStatus}>
    <button type="button" onClick={onOpen} aria-label={`Preview ${creation.name}`}>
      {creation.thumbnailUrl
        ? <img src={creation.thumbnailUrl} alt={creation.name} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.dataset.broken = 'true'; }} />
        : <span>Image unavailable</span>}
      {creation.imageGroups?.length > 1 && <b className="creation-card__image-count" aria-label={`${creation.imageGroups.length} artwork images`}>{creation.imageGroups.length} images</b>}
    </button>
    <div><strong>{creation.name}</strong><span>{creation.collectionName || `${creation.standard} creation`}</span></div>
    {creation.metadataStatus !== 'ready' && <small>{creation.metadataStatus === 'unavailable' ? 'Metadata unavailable' : 'Partial metadata'}</small>}
  </article>;
}
