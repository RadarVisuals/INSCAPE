import PublishedIdentityRack from '../profileDocument/components/PublishedIdentityRack.jsx';
import OwnerInventoryRack from './OwnerInventoryRack.jsx';
import '../profileDocument/components/publishedRackBoard.css';

export default function OwnerRackBoard({ identityRack, folders, assets, assetStatus, assetError, AssetPicker, Menu, onIdentityModuleOrderChange, onCreateFolder, onDeleteFolder, onRequestAssets, onRenameFolder, onFolderVisibilityChange, onSetFolderAsset }) {
  return <section className="published-rack-board" aria-label="Owner profile racks">
    <div className="published-rack-column published-rack-column--primary">
      {identityRack && <div className="published-rack-slot published-rack-slot--identity"><PublishedIdentityRack rack={identityRack} onOrderChange={onIdentityModuleOrderChange} /></div>}
    </div>
    <div className="published-rack-column published-rack-column--secondary">
      <div className="published-rack-slot published-rack-slot--inventory"><OwnerInventoryRack folders={folders} assets={assets} assetStatus={assetStatus} assetError={assetError} AssetPicker={AssetPicker} Menu={Menu} onCreate={onCreateFolder} onDelete={onDeleteFolder} onRequestAssets={onRequestAssets} onRename={onRenameFolder} onVisibilityChange={onFolderVisibilityChange} onSetFolderAsset={onSetFolderAsset} /></div>
    </div>
  </section>;
}
