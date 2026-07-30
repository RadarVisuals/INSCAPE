const assetId = (asset) => asset?.stableAssetId || asset?.id;

export default function BrowserAssetResults({ actionLabel = null, assets, emptyLabel, onSelect, selectedAssetId }) {
  if (!assets.length) return <p className="lattice-browser-status">{emptyLabel}</p>;
  return (
    <div className="lattice-browser-assets">
      {assets.map((asset) => {
        const id = assetId(asset);
        const ratio = Number(asset.width) > 0 && Number(asset.height) > 0 ? `${asset.width} / ${asset.height}` : '1 / 1';
        return (
          <button
            aria-pressed={selectedAssetId === id}
            className="lattice-browser-asset"
            data-selected={selectedAssetId === id || undefined}
            key={id}
            onClick={() => onSelect(id)}
            type="button"
          >
            <span className="lattice-browser-asset__media" style={{ aspectRatio: ratio }}>
              {asset.previewSrc || asset.src ? <img alt="" draggable="false" src={asset.previewSrc || asset.src} /> : <span>MEDIA UNRESOLVED</span>}
            </span>
            <span className="lattice-browser-asset__record">
              <strong>{asset.title || 'UNRESOLVED ASSET'}</strong>
              <small>{asset.mediaType ? asset.mediaType.toUpperCase() : 'TYPE UNRESOLVED'}{actionLabel ? ` / ${actionLabel}` : ''}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
