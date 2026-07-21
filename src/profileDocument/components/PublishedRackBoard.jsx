import PublishedIdentityRack from './PublishedIdentityRack.jsx';
import PublishedInventoryRack from './PublishedInventoryRack.jsx';
import './publishedRackBoard.css';

export default function PublishedRackBoard({ identityRack, inventoryRack, onIdentityModuleOrderChange }) {
  return <section className="published-rack-board" aria-label="Published profile racks">
    <div className="published-rack-column published-rack-column--primary">
      {identityRack && <div className="published-rack-slot published-rack-slot--identity"><PublishedIdentityRack rack={identityRack} onOrderChange={onIdentityModuleOrderChange} /></div>}
    </div>
    <div className="published-rack-column published-rack-column--secondary">
      {inventoryRack && <div className="published-rack-slot published-rack-slot--inventory"><PublishedInventoryRack rack={inventoryRack} /></div>}
    </div>
  </section>;
}
