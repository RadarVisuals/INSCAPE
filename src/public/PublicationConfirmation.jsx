import { Check, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { lukso } from 'viem/chains';
import { applicationRouteUrl } from '../profileDiscovery/applicationNavigation.js';
import './ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../lattice/rendering/latticeMenuSurface.css';
import './publicationConfirmation.css';

export default function PublicationConfirmation({ confirmation, onClose }) {
  const { profileAddress, transactionHash } = confirmation;
  const viewUrl = applicationRouteUrl(window.location, { kind: 'profile', address: profileAddress, reception: true });
  const transactionUrl = /^0x[0-9a-f]{64}$/i.test(transactionHash || '')
    ? `${lukso.blockExplorers.default.url}/tx/${transactionHash}` : null;
  return createPortal(<aside className="publication-confirmation system-workflow__token-scope" data-lattice-menu-surface data-menu-surface="carbon"
    aria-label="Publication complete">
    <div role="status" aria-live="polite" aria-atomic="true">
      <h2><Check size={20} aria-hidden="true" />Published successfully</h2>
      <p>Your transaction is confirmed. Your public presentation is live.</p>
    </div>
    <button className="publication-confirmation__close" type="button" aria-label="Dismiss publication confirmation" onClick={onClose}>
      <X size={18} aria-hidden="true" />
    </button>
    <nav aria-label="Publication links">
      <a href={viewUrl} target="_blank" rel="noopener noreferrer">View publication</a>
      {transactionUrl && <a href={transactionUrl} target="_blank" rel="noopener noreferrer">View transaction</a>}
    </nav>
  </aside>, document.body);
}
