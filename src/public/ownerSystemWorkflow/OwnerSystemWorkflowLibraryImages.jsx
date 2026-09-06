import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import { assetForPlacement } from '../../systemWorkflow/domain/placementMedia.js';

export function libraryImageChoices(asset) {
  const seen = new Set();
  return (asset.imageGroups || asset.assetRecord?.imageGroups || []).flatMap((group) => {
    const sources = [...new Set([group.originalImageUrl, group.imageUrl, ...(group.variants || []).map(({ url }) => url)]
      .map(resolvePublishedAssetUrl).filter(Boolean))];
    if (!sources.length || seen.has(sources[0])) return [];
    seen.add(sources[0]); return [{ sources, index: group.index }];
  });
}

function ImageChoice({ asset, choice, number, onActivate, onPointerDown }) {
  const [candidate, setCandidate] = useState(0);
  const [dimensions, setDimensions] = useState(null);
  const src = choice.sources[candidate];
  const selectedAsset = dimensions && assetForPlacement(asset, { selectedMedia: { url: src, ...dimensions } });
  return <button className="lattice-browser-asset" type="button" aria-label={`Image ${number} of ${asset.title || asset.name}`}
    aria-disabled={!selectedAsset} onDoubleClick={(event) => selectedAsset && onActivate(event, selectedAsset)}
    onKeyDown={(event) => { if (event.key === 'Enter' && selectedAsset) { event.preventDefault(); onActivate(event, selectedAsset); } }}
    onPointerDown={(event) => selectedAsset && onPointerDown(event, selectedAsset, { isAssetRenderable: () => true })}>
    <span className="lattice-browser-asset__media">
      {src ? <img alt="" draggable="false" loading="lazy" src={src} onLoad={(event) => {
        setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
      }} onError={() => { setDimensions(null); setCandidate((value) => value + 1); }} /> : <span>Image unavailable</span>}
    </span>
    <span className="lattice-browser-asset__record"><strong>Image {number}</strong>
      {dimensions && <small>{dimensions.width} × {dimensions.height}</small>}</span>
  </button>;
}

export default function OwnerSystemWorkflowLibraryImages({ asset, onBack, onActivate, onPointerDown }) {
  return <section className="system-workflow__library-images" aria-label={`Images of ${asset.title || asset.name}`}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onBack(); } }}>
    <header><button type="button" autoFocus aria-label="Back to Library assets" onClick={onBack}><ArrowLeft size={14} />Back</button>
      <strong>{asset.title || asset.name}</strong></header>
    <p>Drag an image into the scene, or double-click to place it.</p>
    <div className="system-workflow__library-image-options">
      {libraryImageChoices(asset).map((choice, index) => <ImageChoice asset={asset} choice={choice} key={choice.sources[0]}
        number={index + 1} onActivate={onActivate} onPointerDown={onPointerDown} />)}
    </div>
  </section>;
}
