import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Preview from '../src/profileDocument/components/ProfileDocumentV9Preview.jsx';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import '../src/inscapeTokens.css';

// Disposable local publication; no owner store, wallet or publication action.
const profileAddress = '0x1111111111111111111111111111111111111111';
const publication = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: createEmptySystemWorkflowDraft(profileAddress) });
function Review() {
  const [entry, setEntry] = useState(new URLSearchParams(location.search).get('surface') === 'overview' ? { surface: 'overview' } : undefined);
  return <Preview document={publication} entry={entry}
    onOpenCanvas={target => setEntry({ surface: 'canvas', target })}
    onOpenOverview={() => setEntry({ surface: 'overview' })} />;
}
createRoot(document.getElementById('root')).render(<Review />);
