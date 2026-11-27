import { StartupDestinationContext } from '../src/startveil/StartupDestinationContext.jsx';
import { interfaceTheme } from '../src/interfaceTheme.js';
if (!localStorage.getItem('inscape:interface-theme') && new URLSearchParams(location.search).has('theme')) {
  interfaceTheme.setMode(['light', 'mist'].includes(new URLSearchParams(location.search).get('theme')) ? 'light' : 'dark');
}
import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
const PublicationConfirmation = lazy(() => import('../src/public/PublicationConfirmation.jsx'));
const OwnerWorkspace = lazy(() => import('../src/public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx'));
import PublishedProfileBoundary from '../src/profileDocument/components/PublishedProfileBoundary.jsx';
import { useLibraryStore } from '../src/library/state/useLibraryStore.js';
import { GalleryStudioMotion } from '../src/navigation/galleryStudioMotion.js';
import GalleryStudioStage from '../src/navigation/GalleryStudioStage.jsx';
import useApplicationNavigation from '../src/navigation/useApplicationNavigation.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { createWorkbenchCollection, appendWorkbench } from '../src/systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../src/profileDocument/domain/canvasPublication.js';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
const OwnerSystemWorkflowPublicationRack = lazy(() => import('../src/public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx'));
import '../src/index.css';
import { createArticle } from '../src/text/domain/article.js';
import { createStudioComposition } from '../src/systemWorkflow/domain/studioComposition.js';
import { createTextPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
const address = `0x${'1'.repeat(40)}`, contract = `0x${'3'.repeat(40)}`;
const assetId = `42:${contract}:0x01`;
const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
draft.identityPresentation.alias = 'Human underneath';
draft.identityPresentation.bio = { mode: 'inscape', customText: 'Illustration, stories and small worlds.' };
draft.identityPresentation.card = { version: 1, columns: 2, background: { type: 'plain', color: '#161818', speed: 1 }, fields: [
  { id: 'field:location', label: 'Location', type: 'text', value: 'Underneath' },
] };
const portrait = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><path fill="#bd956b" d="M400 120c-120 0-180 110-180 230l-90 660h540l-90-660c0-120-60-230-180-230Z"/><ellipse cx="400" cy="345" rx="108" ry="145" fill="#252828"/><path fill="none" stroke="#8b8b82" stroke-width="10" d="m220 530 180 180 180-180M270 1050l55-410m205 410-55-410"/></svg>');
const asset = { id: assetId, chainId: 42, contractAddress: contract, tokenId: '0x01', standard: 'LSP8', name: 'Source artwork',
  imageUrl: portrait, originalImageUrl: portrait, imageWidth: 800, imageHeight: 1200, creators: [], attributes: [] };
if (new URLSearchParams(location.search).has('owner')) {
  useLibraryStore.getState().setProfileAddress(address);
  useLibraryStore.setState({ assets: [{ ...asset, ownerAddress: address }], referencedAssets: [], status: 'ready' });
}
draft.identityPresentation.avatar = { mode: 'inscape', stableAssetId: assetId, shape: 'square' };
draft.imageModules = [{ id: 'image:study', visibility: 'PUBLIC', name: 'A closer look', width: 320, height: 480,
  artwork: { id: 'artwork:first', asset: createProfileDocumentV9AssetResolver([asset])(assetId), crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } } }];
draft.workbench = createDefaultWorkbenchPresentation();
draft.workbench.imageModules = [{ id: 'image:study', open: true, position: { left: 180, top: 100 } }];
if (new URLSearchParams(location.search).has('collection')) {


  draft.workbench.area = { left: 0, top: 0, width: 800, height: 1200 };
  draft.imageModules[0].width = 800; draft.imageModules[0].height = 1200;
  draft.workbench.imageModules[0].position = { left: 0, top: 0 };
}
let published = buildProfileDocumentV9({ profileAddress: address, profileIdentity: { name: 'Nomad' }, assetRecords: [asset], systemWorkflowDraft: draft });
let collection = createWorkbenchCollection(draft);
collection.workbenches[0].name = 'Vision';
collection.workbenches[0].introduction = 'A study of the figure in shadow.';
collection = appendWorkbench(collection, 'workbench:anatomy', 'Anatomy', draft);
collection = appendWorkbench(collection, 'workbench:private', 'Private experiment', draft);
collection.activeId = 'workbench:main';
if (new URLSearchParams(location.search).has('landscape-gallery')) {
  const anatomy = collection.workbenches.find(item => item.id === 'workbench:anatomy');
  anatomy.content = structuredClone(anatomy.content);
  anatomy.content.workbench.area = { left: 0, top: 0, width: 1600, height: 900 };
}
const extraGalleryIds = [];
if (new URLSearchParams(location.search).has('large-gallery')) {
  for (let number = 1; number <= 16; number++) {
    const id = 'workbench:study-' + number;
    collection = appendWorkbench(collection, id, 'Study ' + number, draft);
    extraGalleryIds.push(id);
  }
  collection.activeId = 'workbench:main';
}
if (new URLSearchParams(location.search).has('collection')) {
  published = buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: collection, assetRecords: [asset], profile: { name: 'Nomad' } }),
    selectedIds: ['workbench:main', 'workbench:anatomy', ...extraGalleryIds], includeShared: true });
}
if (new URLSearchParams(location.search).has('mixed')) {
  const composition = createStudioComposition('bento');
  const image = structuredClone(draft.imageModules[0]);
  composition.imageModules.push(image);
  composition.cells[0].members.push(image.id);
  composition.workbench.imageModules.push({ ...draft.workbench.imageModules[0] });
  composition.artworkLayers.push(image.id);
  const free = { id: 'text:free-caption', visibility: 'PUBLIC', article: createArticle('Free caption') };
  composition.texts.push(free);
  composition.workbench.texts.push({ ...createTextPresentation(free.id), open: true,
    window: { left: 140, top: 112, width: 320, height: 140 } });
  composition.artworkLayers.push(free.id);
  const fresh = createEmptySystemWorkflowDraft(address);

  fresh.composition = composition;
  collection = appendWorkbench(collection, 'workbench:mixed', 'Mixed study', fresh);
  published = buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: collection, assetRecords: [asset], profile: { name: 'Nomad' } }),
    selectedIds: ['workbench:main', 'workbench:mixed'], includeShared: true,
    placements: { 'workbench:main': ['profile'], 'workbench:mixed': ['gallery', 'profile'] } });
}
if (new URLSearchParams(location.search).has('bulk')) {
  collection = appendWorkbench(collection, 'workbench:bento', 'Bento', { ...createEmptySystemWorkflowDraft(address), composition: createStudioComposition('bento') });
  collection = appendWorkbench(collection, 'workbench:profile-link', 'Profile link', draft);
  published = buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: collection, assetRecords: [asset], profile: { name: 'Nomad' } }),
    selectedIds: ['workbench:main', 'workbench:anatomy', 'workbench:profile-link', 'workbench:bento'], includeShared: true,
    placements: { 'workbench:main': ['gallery'], 'workbench:anatomy': ['gallery'],
      'workbench:profile-link': ['profile'], 'workbench:bento': ['gallery', 'profile'] } });
}
if (new URLSearchParams(location.search).has('last-gallery')) {
  published = buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: collection, assetRecords: [asset], profile: { name: 'Nomad' } }),
    selectedIds: ['workbench:main'], includeShared: true, placements: { 'workbench:main': ['gallery'] } });
}
if (new URLSearchParams(location.search).has('revised')) {
  const anatomy = collection.workbenches.find(item => item.id === 'workbench:anatomy');
  const content = structuredClone(anatomy.content);
  content.workbench.area = { left: 0, top: 0, width: 1200, height: 800 };
  content.imageModules[0] = { ...content.imageModules[0], name: 'Unpublished studio revision', width: 320, height: 480 };
  content.workbench.imageModules[0].position = { left: 720, top: 160 };
  anatomy.content = content;
}
// Isolate fixture drafts from application data while retaining saves across reloads.
const storage = {
  getItem: key => sessionStorage.getItem('profile-overview-fixture:' + key),
  setItem: (key, value) => sessionStorage.setItem('profile-overview-fixture:' + key, value),
  removeItem: key => sessionStorage.removeItem('profile-overview-fixture:' + key),
};
const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
if (store.getRecordState().status === 'absent' && !new URLSearchParams(location.search).has('no-saved-compositions')) {
  const local = new URLSearchParams(location.search).has('publishedOnly')
    ? { ...collection, workbenches: collection.workbenches.filter(item => item.id !== 'workbench:anatomy') } : collection;
  store.restoreBackup(local, { expectedGeneration: store.getGeneration() });
}
window.__galleryStore = store;
window.__overviewPublication = published;
window.__overviewDraft = draft;
const initialResolution = new URLSearchParams(location.search).has('unpublished')
  ? { status: 'UNAVAILABLE', address } : { status: 'RESOLVED', document: published };
function Fixture() {
  const [resolution, setResolution] = useState(() => {
    const stored = sessionStorage.getItem('profile-overview-fixture:verified-publication');
    return stored ? { status: 'RESOLVED', document: JSON.parse(stored), address } : initialResolution;
  });
  const [confirmation, setConfirmation] = useState(null);
  const publicationConfirmed = (result, context) => {
    if (result?.status !== 'RESOLVED') return;
    sessionStorage.setItem('profile-overview-fixture:verified-publication', JSON.stringify(result.document));
    setResolution(result);
    setConfirmation({ profileAddress: address, transactionHash: result.transactionHash, ...context });
  };
  const replacementTest = new URLSearchParams(location.search).has('invalid-publication');
  const [publicationResolution, setPublicationResolution] = useState(() => replacementTest
    ? { status: 'INVALID', errorCode: 'INVALID_DOCUMENT', address }
    : { status: 'UNAVAILABLE', address });
  const owner = new URLSearchParams(location.search).has('owner');
  const navigation = useApplicationNavigation({ status: 'complete', profileAddress: owner ? address : null, ownershipVerified: owner });
  const content = navigation.destination;
  if (new URLSearchParams(location.search).has('publish')) return <Suspense fallback={null}><main className="system-workflow">
    {replacementTest && <div style={{ position: 'fixed', right: 12, top: 12, zIndex: 999 }}>
      <button onClick={() => setPublicationResolution(current => ({ ...current }))}>Recheck publication fixture</button>
      <button onClick={() => setPublicationResolution({ status: 'ERROR', address })}>Network failure fixture</button>
    </div>}
    <OwnerSystemWorkflowPublicationRack store={store} profileAddress={address} profile={{ name: 'Nomad' }} assetRecords={[asset]}
      systemWorkflowDraft={store.getDraft()} workbench={draft.workbench} publishedResolution={publicationResolution}
      getWalletPublicationContext={() => ({})} phase="open" onClose={() => {}} />
  </main></Suspense>;
  const account = owner ? { address, name: 'Nomad', avatarUrl: '/assets/PFP/PFP.png' }
    : new URLSearchParams(location.search).has('viewer') ? { address: '0x' + '2'.repeat(40), name: 'Reader', avatarUrl: '/assets/PFP/PFP.webp' } : null;
  const ownerDestinations = account && {
    Profile: () => navigation.openOverview(account.address), Gallery: () => navigation.openCanvas(account.address),
    Writing: () => navigation.openWriting(account.address), Studio: owner ? () => navigation.openStudio(address) : undefined,
  };
  const destinationReady = () => {
    const ticket = navigation.motion.chrome.current;
    if (ticket?.route === navigation.route) ticket.ready();
  };
  return <GalleryStudioMotion.Provider value={navigation.motion}>
    <StartupDestinationContext.Provider value={destinationReady}><div className="application-root" data-application-mode="public"><div className="application-interface" data-visible>
    {content?.kind === 'workbench' ? <Suspense fallback={null}>
      <OwnerWorkspace profileAddress={address} canvasOverviewRequested={content.canvas === true}
        requestedWorkId={content.worksEditorId}
        publishedResolution={resolution} connectedProfile={account} ownerDestinations={ownerDestinations}
        initialNew={content.newComposition === true} onNewOpened={navigation.consumeNewComposition}
        onManageCompositions={() => navigation.manageCompositions(address)} onOpenGallery={() => navigation.openCanvas(address)}
        returnLabel={navigation.studioReturnLabel} onOpenWriting={() => navigation.openWriting(address)}
        onOpenProfile={() => navigation.openOverview(address)}
        onEditorDocumentChange={(id, options) => navigation.editWork(address, id, options)}
        getWalletPublicationContext={() => window.publicationBoundaryWallet} onPublicationConfirmed={publicationConfirmed}
        onReturnToWorks={() => navigation.returnToWorks(address)}
        reviewStorage={storage} reviewProfile={{ name: 'Nomad' }} reviewAssets={[asset]} />
    </Suspense> : <PublishedProfileBoundary address={address} resolution={resolution} connectedProfile={account}
      getWalletPublicationContext={() => window.publicationBoundaryWallet}
      onPublicationConfirmed={publicationConfirmed} onRetry={async () => {
        if (!new URLSearchParams(location.search).has('changed-publication')) return resolution;
        await window.__pausePublicationVerification?.();
        const newerDocument = structuredClone(resolution.document);
        newerDocument.canvas.name = 'Published in another session';
        return { ...resolution, document: newerDocument };
      }}
      returnProfileAddress={account?.address} ownerDestinations={ownerDestinations} onReturnToWorkbench={owner ? ownerDestinations.Studio : undefined}
      onManageWorks={owner ? () => navigation.manageCompositions(address) : undefined}
            onNewComposition={owner ? () => navigation.openStudio(address, { create: true }) : undefined}
      onEditComposition={owner ? id => navigation.editWork(address, id) : undefined}
      onOpenWriting={() => navigation.openWriting(address)} onDisconnect={() => { window.__fixtureDisconnected = true; }}
      entry={{ surface: content?.writing ? 'writing' : content?.canvas ? 'canvas' : 'overview', target: content?.target }}
      onOpenCanvas={() => navigation.openCanvas(address)} onOpenOverview={() => navigation.openOverview(address)} />}
    {confirmation && <Suspense fallback={null}><PublicationConfirmation confirmation={confirmation} onClose={() => setConfirmation(null)} /></Suspense>}
  <GalleryStudioStage /></div></div></StartupDestinationContext.Provider></GalleryStudioMotion.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
