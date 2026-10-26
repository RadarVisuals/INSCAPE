import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import PublishedProfileBoundary from '../src/profileDocument/components/PublishedProfileBoundary.jsx';
import useApplicationNavigation from '../src/profileDiscovery/useApplicationNavigation.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { createWorkbenchCollection, appendWorkbench } from '../src/systemWorkflow/domain/workbenchCollection.js';
import { canvasPublicationCandidates, buildCanvasPublication } from '../src/profileDocument/domain/canvasPublication.js';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
const OwnerSystemWorkflowPublicationRack = lazy(() => import('../src/public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx'));
import '../src/index.css';
const address = `0x${'1'.repeat(40)}`, contract = `0x${'3'.repeat(40)}`;
const assetId = `42:${contract}:0x01`;
const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
draft.identityPresentation.alias = 'Human underneath';
draft.identityPresentation.bio = { mode: 'inscape', customText: 'Illustration, stories and small worlds.' };
draft.identityPresentation.card = { version: 1, columns: 2, background: { type: 'plain', color: '#161818', speed: 1 }, fields: [
  { id: 'field:location', label: 'Location', type: 'text', value: 'Underneath' },
] };
const portrait = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><path fill="#d3d0c8" d="M400 120c-120 0-180 110-180 230l-90 660h540l-90-660c0-120-60-230-180-230Z"/><ellipse cx="400" cy="345" rx="108" ry="145" fill="#252828"/><path fill="none" stroke="#8b8b82" stroke-width="10" d="m220 530 180 180 180-180M270 1050l55-410m205 410-55-410"/></svg>');
const asset = { id: assetId, chainId: 42, contractAddress: contract, tokenId: '0x01', standard: 'LSP8', name: 'Source artwork',
  imageUrl: portrait, originalImageUrl: portrait, imageWidth: 800, imageHeight: 1200, creators: [], attributes: [] };
draft.identityPresentation.avatar = { mode: 'inscape', stableAssetId: assetId, shape: 'square' };
draft.appearance.menuSurfaceId = new URLSearchParams(location.search).get('theme') === 'mist' ? 'mist' : 'carbon';
draft.imageModules = [{ id: 'image:study', visibility: 'PUBLIC', name: 'A closer look', width: 320, height: 480,
  sides: [{ id: 'side:first', asset: createProfileDocumentV9AssetResolver([asset])(assetId), crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }];
draft.workbench = createDefaultWorkbenchPresentation();
draft.workbench.imageModules = [{ id: 'image:study', open: true, position: { left: 180, top: 100 } }];
if (new URLSearchParams(location.search).has('collection')) {
  draft.grids = [];
  draft.workbench.display.open = false;
  draft.workbench.area = { left: 0, top: 0, width: 800, height: 1200 };
  draft.imageModules[0].width = 800; draft.imageModules[0].height = 1200;
  draft.workbench.imageModules[0].position = { left: 0, top: 0 };
}
let published = buildProfileDocumentV9({ profileAddress: address, profileIdentity: { name: 'Nomad' }, assetRecords: [asset], systemWorkflowDraft: draft });
let collection = createWorkbenchCollection(draft);
collection.workbenches[0].name = 'Vision';
collection = appendWorkbench(collection, 'workbench:anatomy', 'Anatomy', draft);
collection = appendWorkbench(collection, 'workbench:private', 'Private experiment', draft);
collection.activeId = 'workbench:main';
if (new URLSearchParams(location.search).has('collection')) {
  published = buildCanvasPublication({ candidates: canvasPublicationCandidates({ record: collection, assetRecords: [asset], profile: { name: 'Nomad' } }),
    selectedIds: ['workbench:main', 'workbench:anatomy'], includeShared: true });
}
const memory = new Map();
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const store = createSystemWorkflowDraftStore({ profileAddress: address, storage });
store.restoreBackup(collection, { expectedGeneration: store.getGeneration() });
window.__galleryStore = store;
window.__overviewPublication = published;
window.__overviewDraft = draft;
function Fixture() {
  const navigation = useApplicationNavigation({ status: 'complete', profileAddress: null, ownershipVerified: false });
  const content = navigation.content;
  if (new URLSearchParams(location.search).has('publish')) return <Suspense fallback={null}><main className="system-workflow">
    <OwnerSystemWorkflowPublicationRack store={store} profileAddress={address} profile={{ name: 'Nomad' }} assetRecords={[asset]}
      systemWorkflowDraft={store.getDraft()} workbench={draft.workbench} publishedResolution={{ status: 'UNAVAILABLE' }}
      getWalletPublicationContext={() => ({})} menuSurface="carbon" phase="open" onClose={() => {}} />
  </main></Suspense>;
  return <div className="application-root"><div className="application-interface" data-visible>
    <PublishedProfileBoundary address={address} resolution={{ status: 'RESOLVED', document: published }}
      returnProfileAddress={new URLSearchParams(location.search).has('owner') ? address : undefined} onReturnToWorkbench={() => {}}
      entry={{ surface: content?.canvas ? 'canvas' : 'overview', target: content?.target, reception: content?.reception }}
      onOpenCanvas={() => navigation.openCanvas(address)} onOpenOverview={() => navigation.openOverview(address)} />
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
