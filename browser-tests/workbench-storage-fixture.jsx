import React from 'react';
import { fixtureAsset } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { commitWorkspaceRows } from '../src/workspace/database.js';
import { authoredStorage, confirmWorkspaceSaved, workspaceSession } from '../src/workspace/profileWorkspace.js';
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
  const draft = createEmptySystemWorkflowDraft(profile);

  draft.texts = [{ id: 'text:private', article: createArticle('Private draft'), visibility: 'PRIVATE' }];
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.texts = [createTextPresentation('text:private', 0)];
  draft.workbench.texts[0].window = { left: 60, top: 100, width: 320, height: 400 };
  if (params.has('selection')) {
    let artwork = null;
    if (params.has('firstCell')) {
      draft.workbench.area = { left: 0, top: 0, width: 1280, height: 800 };
      const asset = fixtureAsset({ token: 4, name: 'Red square', width: 240, height: 240, source: 'https://studio.example.invalid/red.png' });
      artwork = { id: 'artwork:square', asset: createProfileDocumentV9AssetResolver([asset])(asset.id),
        crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
    }
    draft.imageModules = [{ id: 'image:gesture', name: 'Gesture Image', width: 240, height: 240, artwork, visibility: 'PRIVATE' }];
    draft.workbench.imageModules = [{ id: 'image:gesture', open: true, position: { left: 420, top: 100 } }];
  }
  localStorage.setItem(key, JSON.stringify(draft));
}
window.fixtureProfile = profile;
window.externalWorkbenchWrite = raw => {
  const session = workspaceSession(profile);
  return commitWorkspaceRows(session.db, session.scope, [['workbenches', { before: session.committed.workbenches, after: raw }]]);
};
window.committedRaw = () => workspaceSession(profile)?.committed?.workbenches;
const draftStorage = authoredStorage(localStorage);
const writeDraft = draftStorage.setItem.bind(draftStorage);
window.failWorkbenchWrites = fail => {
  draftStorage.setItem = fail ? (name, value) => {
    if (name === key) throw new DOMException('Full', 'QuotaExceededError');
    return writeDraft(name, value);
  } : writeDraft;
};
window.savedDraft = () => JSON.parse(workspaceSession(profile)?.committed?.workbenches ?? localStorage.getItem(key));
window.readCommittedDraft = async () => {
  if (!await confirmWorkspaceSaved(profile)) throw new Error('Could not confirm the fixture workspace save.');
  return window.savedDraft();
};
window.guardedStore = () => createSystemWorkflowDraftStore({ profileAddress: profile, storage: localStorage, requireEditor: true });
window.activeArtworkDraft = () => {
  const draft = window.guardedStore().getDraft();
  return draft;
};
window.seedWorkbenchDraft = async draft => {
  const store = window.guardedStore();
  if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() }) || !await store.whenCommitted()) {
    throw new Error('Could not persist fixture draft: ' + store.getLastCommitFailure());
  }
};
const root = createRoot(document.getElementById('root'));
window.leaveEditor = () => root.unmount();
const content = <Boundary profileAddress={profile} reviewStorage={localStorage} reviewAssets={params.has('source-benchmark') ? undefined : []} reviewCategories={[]} reviewActivity={[]}
  ownerDestinations={params.has('source-benchmark') ? { Curation: () => root.render(<p>Curation opened</p>) } : undefined}
  publishedResolution={{ status: 'UNAVAILABLE', address: profile, document: null }}
  reviewProfile={{ name: 'Local storage verification' }} onOpenProfile={() => root.render(<p>Published view requested</p>)} />;
// Use the production shell's CSS boundary when checking route-level interaction.
root.render(params.has('shell') ? <div className="application-root" data-application-mode="public">
  <div className="application-interface" data-visible>{content}</div>
</div> : content);
