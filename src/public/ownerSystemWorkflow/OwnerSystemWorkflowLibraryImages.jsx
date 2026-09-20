import { useState } from 'react';
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

export function ImageChoice({ asset, choice, number, onActivate, onPointerDown, workspace, onContext }) {
  const [candidate, setCandidate] = useState(0);
  const [dimensions, setDimensions] = useState(null);
  const src = choice.sources[candidate];
  const id = asset.stableAssetId || asset.id;
  const selected = workspace?.selectedAssetIds.includes(id);
  const selectedAsset = dimensions && assetForPlacement(asset, { selectedMedia: { url: src, ...dimensions } });
  return <button className="lattice-browser-asset" type="button" aria-label={`Image ${number} of ${asset.title || asset.name}`}
    data-selected={selected || undefined} aria-pressed={workspace ? selected : undefined}
    onClick={(event) => workspace?.selectAsset(id, event)}
    onContextMenu={(event) => { if (onContext) { event.preventDefault(); event.stopPropagation(); onContext(event, asset); } }}
    aria-disabled={!selectedAsset} onDoubleClick={(event) => selectedAsset && onActivate(event, selectedAsset)}
    onKeyDown={(event) => {
      if (onContext && (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10')) {
        event.preventDefault(); event.stopPropagation(); onContext(event, asset); return;
      }
      if (event.key === 'Enter' && selectedAsset) { event.preventDefault(); onActivate(event, selectedAsset); } }}
    onPointerDown={(event) => selectedAsset && onPointerDown(event, selectedAsset, { isAssetRenderable: () => true })}>
    <span className="lattice-browser-asset__media">
      {src ? <img alt="" draggable="false" loading="lazy" src={src} onLoad={(event) => {
        setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
      }} onError={() => { setDimensions(null); setCandidate((value) => value + 1); }} /> : <span>Image unavailable</span>}
    </span>
    {!workspace?.hideLabels && <span className="lattice-browser-asset__record"><strong>Image {number}</strong>
      {workspace && <small>{librarySourceLabel(asset)}</small>}
      {dimensions && <small>{dimensions.width} × {dimensions.height}</small>}</span>}
  </button>;
}

export function librarySourceLabel(asset) {
  const tokenId = asset.assetRecord?.tokenId || asset.tokenId || asset.stableAssetId?.split(':')[2];
  let token = null;
  if (/^0x[0-9a-f]+$/iu.test(tokenId || '')) {
    const decimal = BigInt(tokenId).toString();
    token = decimal.length <= 10 ? '#' + decimal : tokenId.slice(0, 8) + '…' + tokenId.slice(-4);
  }
  return [asset.title || asset.name, token].filter(Boolean).join(' · ');
}
