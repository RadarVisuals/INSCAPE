import AssetCard from './AssetCard.jsx';

export default function AssetGrid({ assets, workspace, onSelect, onFavorite, onFolder, emptyMessage }) {
  if (!assets.length) return <div className="collection-empty" role="status">{emptyMessage}</div>;
  return <div className="asset-grid">{assets.map((asset) => <AssetCard key={asset.id} asset={asset}
    favorite={workspace.favorites.includes(asset.id)} folders={workspace.folders} onOpen={() => onSelect(asset.id)}
    onFavorite={() => onFavorite(asset.id)} onFolder={(folderId, included) => onFolder(folderId, asset.id, included)} />)}</div>;
}
