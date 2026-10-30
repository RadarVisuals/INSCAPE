// Synthetic local/public profiles; only use in disposable browser contexts.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PublishedProfileBoundary from '/src/profileDocument/components/PublishedProfileBoundary.jsx';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '/src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReception } from '/src/profileDocument/domain/receptionPresentation.js';
import { splitReception } from '/src/reception/receptionLayout.js';
import { createArticle } from '/src/text/domain/article.js';
import { buildProfileDocumentV9 } from '/src/profileDocument/domain/profileDocumentV9Builder.js';
import { serializeWorkbenchBackup } from '/src/systemWorkflow/workbenchBackup.js';
import '/src/index.css';

const address = '0x3333333333333333333333333333333333333333';
const key = systemWorkflowDraftKey(address);
const store = () => createSystemWorkflowDraftStore({ profileAddress: address, storage: localStorage });
const memory = { getItem: () => null, setItem() {} };
const base = createSystemWorkflowDraftStore({ profileAddress: address, storage: memory }).getDraft();
let reception = createReception();
reception = splitReception(reception, reception.regions[0].id, 'x', 'region:second');
const article = createArticle();
article.title = 'LOCAL ARTICLE';
article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local saved introduction with enough content to inspect typography, scrolling and the shared reader.' }] }] };
reception.texts = [{ id: 'text:audit', article, visibility: 'PUBLIC' }];
reception.regions[0].content = 'profile';
reception.regions[1].content = 'text:audit';
reception.branding.name = 'LOCAL A';
const draft = { ...base, reception };
if (!localStorage.getItem(key)) {
  const root = store();
  if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Audit seed failed');
}
const publishedDraft = structuredClone(draft);
publishedDraft.reception.branding.name = 'PUBLIC ONLY';
publishedDraft.reception.texts[0].article.title = 'PUBLIC ARTICLE';
publishedDraft.reception.texts[0].article.content.content[0].content[0].text = 'Published introduction.';
const identity = { status: 'RESOLVED', normalizedAddress: address, name: 'Audit profile', description: 'Synthetic audit profile', tags: [], links: [] };
const document = buildProfileDocumentV9({ profileAddress: address, profileIdentity: identity, systemWorkflowDraft: publishedDraft, assetRecords: [] });
const restored = structuredClone(draft); restored.reception.branding.name = 'RESTORED LOCAL';
window.receptionBoundaryFixture = { address, key, document,
  backup: serializeWorkbenchBackup(restored),
  saved: () => store().getDraft(),
  corrupt: () => localStorage.setItem(key, '{broken'),
};
function Fixture() {
  const [status, setStatus] = useState('RESOLVED'), [owner, setOwner] = useState(true), [revision, setRevision] = useState(0);
  window.receptionBoundaryFixture.setStatus = setStatus;
  window.receptionBoundaryFixture.setOwner = setOwner;
  window.receptionBoundaryFixture.remount = () => setRevision(v => v + 1);
  return <PublishedProfileBoundary key={revision} address={address}
    resolution={{ status, address, ...(['RESOLVED', 'STALE'].includes(status) ? { document } : {}) }}
    returnProfileAddress={owner ? address : undefined} onReturnToWorkbench={owner ? () => {} : undefined}
    onRetry={() => setStatus('RESOLVED')} entry={{ surface: 'overview', reception: true }} onOpenCanvas={() => {}} />;
}
createRoot(window.document.getElementById('root')).render(<Fixture />);
