import AssetCard from './AssetCard.jsx';

export default function AssetGrid({ assets, workspace, onSelect, onFavorite, onFolder, onCreateFolder, emptyMessage, emptyAction, authoringEnabled = false, renderImage }) {
  if (!assets.length) return <div className="collection-empty"><p role="status">{emptyMessage}</p>{emptyAction}</div>;
  return <div className="asset-grid">{assets.map((asset) => <AssetCard key={asset.id} asset={asset}
    favorite={workspace.favorites.includes(asset.id)} folders={workspace.folders} onOpen={onSelect ? () => onSelect(asset.id) : undefined}
    onFavorite={() => onFavorite(asset.id)} onFolder={(folderId, included) => onFolder(folderId, asset.id, included)}
    onCreateFolder={onCreateFolder} authoringEnabled={authoringEnabled} renderImage={renderImage} />)}</div>;
}
