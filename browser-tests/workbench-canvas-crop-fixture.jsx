import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import Visitor from '../src/profileDocument/components/ProfileDocumentV9Visitor.jsx';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { addImageModule } from '../src/imageModule/imageModuleSession.js';
import { addShape } from '../src/shapes/shapeSession.js';
import { resizeWorkbenchCanvas } from '../src/systemWorkflow/workbenchAreaSession.js';
import { buildProfileDocumentV9Asset } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { loadWorkbenchLayout } from '../src/public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import { editWorkbenchGroups } from '../src/systemWorkflow/workbenchGroupSession.js';
import { removeWorkbenchModule } from '../src/systemWorkflow/removeWorkbenchModule.js';
import { PRIMARY_DISPLAY_ID } from '../src/systemWorkflow/domain/displayModules.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

const profileAddress = `0x${'9'.repeat(40)}`;
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const store = createSystemWorkflowDraftStore({ profileAddress, storage });
const asset = buildProfileDocumentV9Asset({
  id: `42:${profileAddress}:contract`, chainId: 42, standard: 'LSP7', address: profileAddress,
  contractAddress: profileAddress, tokenId: null, name: 'Crop proof', imageUrl: 'https://assets.example/crop-proof.png',
  imageWidth: 1024, imageHeight: 1024,
}, `42:${profileAddress}:contract`);
if (!store.getDraft().imageModules?.length) {
  for (const [left, top] of [[60, 60], [260, 180], [620, 150]]) {
    addImageModule(store, profileAddress, { position: { left, top }, size: { width: 160, height: 160 },
      side: { id: `side:${left}`, asset: left === 60 ? { ...asset, media: { ...asset.media, url: 'https://assets.example/crop-proof.svg' } } : asset,
        crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } } });
  }
  addShape(store, profileAddress, { kind: 'grid', position: { left: 260, top: 400 }, size: { width: 192, height: 144 } });
  resizeWorkbenchCanvas(store, profileAddress, store.getGeneration(), { width: 800, height: 650 });
  const id = editWorkbenchGroups(store, profileAddress, { type: 'create', name: 'Crop group', memberIds: [store.getDraft().shapes[0].id] });
  editWorkbenchGroups(store, profileAddress, { type: 'visibility', id, expected: store.getDraft().workbenchGroups[0], visibility: 'PUBLIC' });
  if (new URLSearchParams(location.search).has('edges')) removeWorkbenchModule(store, profileAddress, 'display',
    { id: PRIMARY_DISPLAY_ID, grids: store.getDraft().grids });
}
window.canvasSaved = () => JSON.parse(localStorage.getItem(systemWorkflowDraftKey(profileAddress)));
window.canvasLayout = () => loadWorkbenchLayout(profileAddress, window.canvasSaved(), storage).layout || window.canvasSaved().workbench;
window.canvasDocument = () => buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: window.canvasSaved(), workbench: window.canvasLayout(), assetRecords: [] });
const visitor = new URLSearchParams(location.search).has('visitor');
createRoot(document.getElementById('root')).render(visitor ? <Visitor document={window.canvasDocument()} />
  : <Runtime profileAddress={profileAddress} reviewStorage={storage} reviewAssets={[]} reviewCategories={[]}
    reviewActivity={[]} reviewDiscovery={[]} reviewProfile={{ name: 'Canvas crop review' }} />);
