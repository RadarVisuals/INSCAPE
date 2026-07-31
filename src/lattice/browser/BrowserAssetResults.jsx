import { BROWSER_ASSET_SIZE } from './browserWorkspaceModel.js';

const assetId = (asset) => asset?.stableAssetId || asset?.id;

function BrowserAssetImage({ asset, onUnavailable }) {
  const source = asset.previewSrc;
  return <img alt="" aria-hidden="true" className="lattice-browser-asset__decoded-image"
    decoding="async" draggable="false" loading="lazy"
    onError={() => onUnavailable?.(assetId(asset), source)} src={source} />;
}

export default function BrowserAssetResults({ assetSize = BROWSER_ASSET_SIZE.DEFAULT, assets, displayMode = null, emptyLabel, hideLabels = false, onContext, onMediaUnavailable, onPointerDown, onSelect, onSelectAll, selectedAssetId, selectedAssetIds = [] }) {
  if (!assets.length) return <p className="lattice-browser-status">{emptyLabel}</p>;
  const selectedIds = new Set(selectedAssetIds);
  if (selectedAssetId) selectedIds.add(selectedAssetId);
  const numericAssetSize = Math.min(BROWSER_ASSET_SIZE.MAXIMUM,
    Math.max(BROWSER_ASSET_SIZE.MINIMUM, Number(assetSize) || BROWSER_ASSET_SIZE.DEFAULT));
  const resolvedAssetSize = displayMode === 'list' || numericAssetSize === BROWSER_ASSET_SIZE.LIST ? 'list' : 'grid';
  const assetGridStyle = resolvedAssetSize === 'list' ? undefined : {
    '--lattice-browser-asset-media-max': `${Math.round(numericAssetSize * 1.15)}px`,
    '--lattice-browser-asset-min': `${numericAssetSize}px`,
  };
  return (
    <div className="lattice-browser-assets" data-labels={hideLabels ? 'hidden' : 'visible'} data-size={resolvedAssetSize} style={assetGridStyle} onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'a') {
        event.preventDefault(); event.stopPropagation(); onSelectAll?.();
      }
    }}>
      {assets.map((asset) => {
        const id = assetId(asset);
        const selected = selectedIds.has(id);
        const multiSelected = selected && selectedIds.size > 1;
        const ratio = Number(asset.width) > 0 && Number(asset.height) > 0 ? `${asset.width} / ${asset.height}` : '1 / 1';
        return (
          <button
            aria-label={[asset.title || asset.stableAssetId, asset.collection].filter(Boolean).join(' / ')}
            aria-pressed={selected}
            className="lattice-browser-asset"
            data-multi-selected={multiSelected || undefined}
            data-selected={selected || undefined}
            key={id}
            onClick={(event) => onSelect(id, event)}
            onPointerDown={onPointerDown ? (event) => onPointerDown(event, asset) : undefined}
            onContextMenu={onContext ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onContext(event, asset);
            } : undefined}
            onKeyDown={onContext ? (event) => {
              if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
              event.preventDefault();
              event.stopPropagation();
              onContext(event, asset);
            } : undefined}
            type="button"
          >
            <span className="lattice-browser-asset__media" style={{ aspectRatio: ratio }}>
              <BrowserAssetImage asset={asset} onUnavailable={onMediaUnavailable} />
            </span>
            {!hideLabels && <span className="lattice-browser-asset__record">
              <strong>{asset.title || asset.stableAssetId}</strong>
              {asset.collection && <small>{asset.collection}</small>}
            </span>}
          </button>
        );
      })}
    </div>
  );
}
