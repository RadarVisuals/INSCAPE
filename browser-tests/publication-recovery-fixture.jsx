import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { publicationJournal } from '../src/profileDocument/storage/publicationJournal.js';
import '../src/index.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';
import OwnerSystemWorkflowPublicationRack from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx';

function Fixture() {
  const [address, setAddress] = useState(`0x${'1'.repeat(40)}`);
  window.recoveryFixture = { setAddress, journal: publicationJournal };
  return <main className="system-workflow" data-lattice-menu-surface data-menu-surface="paper">
    <OwnerSystemWorkflowPublicationRack profileAddress={address} profile={{ address, name: 'Test' }}
      assetRecords={[]} systemWorkflowDraft={createEmptySystemWorkflowDraft(address)}
      getWalletPublicationContext={() => ({})} menuSurface="paper" phase="open" onClose={() => {}} />
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
