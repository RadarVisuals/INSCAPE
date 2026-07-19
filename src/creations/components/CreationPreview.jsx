import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react';

export default function CreationPreview({ creation, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const imageGroups = useMemo(() => {
    if (!creation) return [];
    if (creation.imageGroups?.length) return creation.imageGroups;
    return creation.imageUrl ? [{ index: 0, imageUrl: creation.imageUrl, thumbnailUrl: creation.thumbnailUrl, originalImageUrl: creation.originalImageUrl }] : [];
  }, [creation]);
  useEffect(() => setActiveIndex(0), [creation?.id]);
  if (!creation) return null;
  const activeImage = imageGroups[Math.min(activeIndex, Math.max(0, imageGroups.length - 1))] || null;
  const selectRelative = (delta) => setActiveIndex((current) => (current + delta + imageGroups.length) % imageGroups.length);
  return <section className="creation-preview" aria-label={`${creation.name} details`}>
    <header><div><span>{creation.standard} · {creation.creatorAttributionLevel} attribution</span><h3>{creation.name}</h3></div><button type="button" onClick={onClose} aria-label="Close creation preview"><X aria-hidden="true" /></button></header>
    <div className="creation-preview__media">
      <div className="creation-preview__image">{activeImage
        ? <img key={activeImage.imageUrl} src={activeImage.imageUrl} alt={`${creation.name}${imageGroups.length > 1 ? ` — image ${activeIndex + 1} of ${imageGroups.length}` : ''}`} onLoad={(event) => { delete event.currentTarget.parentElement.dataset.broken; }} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.dataset.broken = 'true'; }} />
        : <span>Image unavailable</span>}
        {imageGroups.length > 1 && <nav className="creation-preview__pager" aria-label="Artwork images">
          <button type="button" onClick={() => selectRelative(-1)} aria-label="Previous artwork image"><ArrowLeft aria-hidden="true" /></button>
          <span>{activeIndex + 1} / {imageGroups.length}</span>
          <button type="button" onClick={() => selectRelative(1)} aria-label="Next artwork image"><ArrowRight aria-hidden="true" /></button>
        </nav>}
      </div>
      {imageGroups.length > 1 && <div className="creation-preview__thumbnails" aria-label="Select artwork image">{imageGroups.map((group, index) => <button key={`${group.index}:${group.imageUrl}`} type="button" data-active={index === activeIndex || undefined} aria-pressed={index === activeIndex} aria-label={`Show artwork image ${index + 1}`} onClick={() => setActiveIndex(index)}><img src={group.thumbnailUrl || group.imageUrl} alt="" /></button>)}</div>}
    </div>
    <div className="creation-preview__metadata">
      <p>{creation.collectionName || 'Creator-attributed digital asset'}</p>
      {creation.description ? <p>{creation.description}</p> : <p>Metadata description unavailable.</p>}
      <dl>
        <div><dt>Creator{creation.creators.length === 1 ? '' : 's'}</dt><dd>{creation.creators.map((creator) => creator.name || creator.address).join(', ')}</dd></div>
        <div><dt>Contract</dt><dd>{creation.contractAddress}</dd></div>
        {creation.tokenId && <div><dt>Token ID</dt><dd>{creation.tokenId}</dd></div>}
        <div><dt>Current ownership</dt><dd>{creation.ownershipKnown ? creation.isOwnedByViewedProfile ? 'Held by viewed profile' : 'Not held by viewed profile' : 'Unknown'}</dd></div>
      </dl>
      {activeImage?.originalImageUrl && <a href={activeImage.originalImageUrl} target="_blank" rel="noreferrer noopener">Original image {imageGroups.length > 1 ? activeIndex + 1 : ''} <ArrowUpRight aria-hidden="true" /></a>}
    </div>
  </section>;
}
