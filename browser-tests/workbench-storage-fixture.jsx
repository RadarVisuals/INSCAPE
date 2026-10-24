import React from 'react';
import { createRoot } from 'react-dom/client';
import Boundary from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createArticle } from '../src/text/domain/article.js';
import { createDefaultWorkbenchPresentation, createTextPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/profileDocument/components/publishedProfileStatus.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

const params = new URLSearchParams(location.search);
const profile = params.get('profile') || `0x${'1'.repeat(40)}`, key = systemWorkflowDraftKey(profile);
if (params.has('seed') && localStorage.getItem(key) === null) {
  const draft = createEmptySystemWorkflowDraft(profile); draft.grids = [];
  draft.texts = [{ id: 'text:private', article: createArticle('Private draft'), visibility: 'PRIVATE' }];
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.texts = [createTextPresentation('text:private', 0)];
  draft.workbench.texts[0].window = { left: 60, top: 100, width: 320, height: 400 };
  localStorage.setItem(key, JSON.stringify(draft));
}
window.fixtureProfile = profile;
window.savedDraft = () => JSON.parse(localStorage.getItem(key));
window.guardedStore = () => createSystemWorkflowDraftStore({ profileAddress: profile, storage: localStorage, requireEditor: true });
const root = createRoot(document.getElementById('root'));
window.leaveEditor = () => root.unmount();
root.render(<Boundary profileAddress={profile} reviewStorage={localStorage} reviewAssets={[]} reviewCategories={[]} reviewActivity={[]}
  reviewProfile={{ name: 'Local storage verification' }} onOpenReception={() => root.render(<p>Published view requested</p>)} />);
