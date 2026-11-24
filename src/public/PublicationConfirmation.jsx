import { createPortal } from 'react-dom';
import { lukso } from 'viem/chains';
import { applicationRouteUrl } from '../navigation/applicationNavigation.js';
import WorkbenchDestinationPanel from './ownerSystemWorkflow/WorkbenchDestinationPanel.jsx';
import './ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../lattice/rendering/latticeMenuSurface.css';
import './publicationConfirmation.css';

export default function PublicationConfirmation({ confirmation, onClose }) {
  const { profileAddress, transactionHash, destination, removedTitles = [] } = confirmation;
  const removed = removedTitles.length > 0;
  const viewUrl = applicationRouteUrl(window.location, { kind: 'profile', address: profileAddress,
    reception: 'published', canvas: destination === 'gallery' });
  const transactionUrl = /^0x[0-9a-f]{64}$/i.test(transactionHash || '')
    ? `${lukso.blockExplorers.default.url}/tx/${transactionHash}` : null;
  return createPortal(<WorkbenchDestinationPanel title={removed ? 'Removed from Gallery' : 'Published successfully'} onClose={onClose} closeLabel="Dismiss publication confirmation"
    className="publication-confirmation system-workflow__token-scope" data-lattice-menu-surface
    aria-label="Publication complete">
    <div className="workbench-destination-body">
    <div role="status" aria-live="polite" aria-atomic="true">
      {removedTitles.length > 1 ? <>
        <p>{removedTitles.length} works were removed from your published Gallery.</p>
        <ul aria-label="Removed works">{removedTitles.map((title, index) => <li key={index}>{title}</li>)}</ul>
      </> : <p>{removed ? <><strong>{removedTitles[0]}</strong> was removed from your published Gallery.</> : 'Your transaction is confirmed. Your public presentation is live.'}</p>}
    </div>
    <nav aria-label="Publication links">
      <a className="workbench-destination-action" href={viewUrl} target="_blank" rel="noopener noreferrer">{removed ? 'View Gallery' : 'View publication'}</a>
      {transactionUrl && <a className="workbench-destination-action" href={transactionUrl} target="_blank" rel="noopener noreferrer">View transaction</a>}
    </nav>
    </div>
  </WorkbenchDestinationPanel>, document.body);
}
