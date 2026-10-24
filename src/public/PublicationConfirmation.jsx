import { createPortal } from 'react-dom';
import { lukso } from 'viem/chains';
import { applicationRouteUrl } from '../profileDiscovery/applicationNavigation.js';
import WorkbenchDestinationPanel from './ownerSystemWorkflow/WorkbenchDestinationPanel.jsx';
import './ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../lattice/rendering/latticeMenuSurface.css';
import './publicationConfirmation.css';

export default function PublicationConfirmation({ confirmation, onClose }) {
  const { profileAddress, transactionHash } = confirmation;
  const viewUrl = applicationRouteUrl(window.location, { kind: 'profile', address: profileAddress, reception: true });
  const transactionUrl = /^0x[0-9a-f]{64}$/i.test(transactionHash || '')
    ? `${lukso.blockExplorers.default.url}/tx/${transactionHash}` : null;
  return createPortal(<WorkbenchDestinationPanel title="Published successfully" onClose={onClose} closeLabel="Dismiss publication confirmation"
    className="publication-confirmation system-workflow__token-scope" data-lattice-menu-surface data-menu-surface={confirmation.menuSurface || 'carbon'}
    aria-label="Publication complete">
    <div className="workbench-destination-body">
    <div role="status" aria-live="polite" aria-atomic="true">
      <p>Your transaction is confirmed. Your public presentation is live.</p>
    </div>
    <nav aria-label="Publication links">
      <a className="workbench-destination-action" href={viewUrl} target="_blank" rel="noopener noreferrer">View publication</a>
      {transactionUrl && <a className="workbench-destination-action" href={transactionUrl} target="_blank" rel="noopener noreferrer">View transaction</a>}
    </nav>
    </div>
  </WorkbenchDestinationPanel>, document.body);
}
