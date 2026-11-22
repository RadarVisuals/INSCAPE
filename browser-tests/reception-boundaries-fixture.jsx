// Synthetic local/public profiles; only use in disposable browser contexts.
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PublishedProfileBoundary from '/src/profileDocument/components/PublishedProfileBoundary.jsx';
import OwnerRuntimeBoundary from '/src/public/OwnerRuntimeBoundary.jsx';
import useApplicationNavigation from '/src/profileDiscovery/useApplicationNavigation.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '/src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReception } from '/src/profileDocument/domain/receptionPresentation.js';
import { splitReception } from '/src/reception/receptionLayout.js';
import { createArticle } from '/src/text/domain/article.js';
import { buildProfileDocumentV9 } from '/src/profileDocument/domain/profileDocumentV9Builder.js';
import { authoredStorage, confirmWorkspaceSaved } from '/src/workspace/profileWorkspace.js';
import { serializeWorkbenchBackup } from '/src/systemWorkflow/workbenchBackup.js';
import { createDefaultWorkbenchPresentation } from '/src/profileDocument/domain/workbenchPresentation.js';
import '/src/index.css';

const address = '0x3333333333333333333333333333333333333333';
const params = new URLSearchParams(location.search);
if (!params.has('view')) {
  params.set('view', address); params.set('reception', '1');
  history.replaceState(null, '', `${location.pathname}?${params}`);
}
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
const draft = { ...base, workbench: createDefaultWorkbenchPresentation(), reception };
// The native Display frame excludes the retired 32px titlebar height.
draft.workbench.display.window.height = 540;
if (!localStorage.getItem(key)) {
  localStorage.setItem(key, JSON.stringify(draft));
}
const publishedDraft = structuredClone(draft);
publishedDraft.reception.branding.name = 'PUBLIC ONLY';
publishedDraft.reception.texts[0].article.title = 'PUBLIC ARTICLE';
publishedDraft.reception.texts[0].article.content.content[0].content[0].text = 'Published introduction.';
const identity = { status: 'RESOLVED', normalizedAddress: address, name: 'Audit profile', description: 'Synthetic audit profile', tags: [], links: [] };
const document = buildProfileDocumentV9({ profileAddress: address, profileIdentity: identity, systemWorkflowDraft: publishedDraft, assetRecords: [] });
const restored = structuredClone(draft);
restored.reception.branding.name = 'RESTORED LOCAL';
restored.reception.texts[0].article.title = 'Restored local article';
window.receptionBoundaryFixture = { address, key, document,
  backup: serializeWorkbenchBackup(restored),
  saved: () => store().getDraft(),
  canvases: () => {
    const current = store();
    return current.listWorkbenches().map(meta => {
      const { reception: _reception, ...draft } = current.readWorkbench(meta.id).draft;
      return { ...meta, draft };
    });
  },
  corrupt: async () => { authoredStorage(localStorage).setItem(key, '{broken'); await confirmWorkspaceSaved(address); },
};
function Fixture() {
  const [status, setStatus] = useState('RESOLVED'), [owner, setOwner] = useState(true), [revision, setRevision] = useState(0);
  window.receptionBoundaryFixture.setStatus = setStatus;
  window.receptionBoundaryFixture.setOwner = setOwner;
  window.receptionBoundaryFixture.remount = () => setRevision(v => v + 1);
  return <RoutedFixture key={revision} status={status} owner={owner} onRetry={() => setStatus('RESOLVED')} />;
}
function RoutedFixture({ status, owner, onRetry }) {
  const navigation = useApplicationNavigation({ status: 'complete', profileAddress: owner ? address : null, ownershipVerified: owner });
  const resolution = useMemo(() => ({ status, address, ...(['RESOLVED', 'STALE'].includes(status) ? { document } : {}) }), [status]);
  const content = navigation.content;
  const enterEditor = () => navigation.openStudio(address);
  const editReception = () => navigation.editReception(address);
  const connectedProfile = owner ? { address, name: 'Audit profile' } : null;
  const ownerDestinations = owner && {
    Profile: () => navigation.openOverview(address), Gallery: () => navigation.openCanvas(address),
    Writing: () => navigation.openWriting(address), Studio: enterEditor, Discover: navigation.openDiscover,
  };
  const openReception = mode => navigation.openReception(address, mode === 'published' ? 'published' : true);
  return content?.kind === 'workbench' ? <OwnerRuntimeBoundary ownerAuthoringEnabled
    workspaceProfileAddress={address} viewedProfileAddress={address}
    receptionEditorRequested={content.receptionEditorRequested === true} canvasOverviewRequested={content.canvas === true}
    ownerDestinations={ownerDestinations} returnLabel={navigation.studioReturnLabel}
    onOpenGallery={() => navigation.openCanvas(address)} onManageCompositions={() => navigation.manageCompositions(address)}
    requestedWorkId={content.worksEditorId} onReturnToWorks={() => navigation.returnToWorks(address)} connectedProfile={connectedProfile}
    publishedResolution={resolution} reviewAssets={[]} reviewCategories={[]} reviewActivity={[]}
    reviewProfile={{ name: 'Audit profile' }} interfaceVisible onOpenReception={openReception}
    onEnterMyWorld={enterEditor} onEditorDocumentChange={(kind, id, options) => kind === 'reception' ? navigation.editReception(address, options) : navigation.editWork(address, id, options)} />
    : <PublishedProfileBoundary address={address} resolution={resolution} connectedProfile={connectedProfile}
      returnProfileAddress={owner ? address : undefined} onReturnToWorkbench={owner ? enterEditor : undefined}
      ownerDestinations={ownerDestinations} onOpenOverview={() => navigation.openOverview(address)}
      onEditComposition={owner ? id => navigation.editWork(address, id) : undefined}
      onEditReception={owner ? editReception : undefined} onRetry={onRetry}
      entry={{ surface: content?.canvas ? 'canvas' : 'overview', reception: content?.reception, target: content?.target }}
      onOpenCanvas={() => navigation.openCanvas(address)} />;
}
createRoot(window.document.getElementById('root')).render(params.has('strict') ? <React.StrictMode><Fixture /></React.StrictMode> : <Fixture />);
