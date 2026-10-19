import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { addShape } from '../src/shapes/shapeSession.js';
import { addImageModule } from '../src/imageModule/imageModuleSession.js';
import { addTextModule } from '../src/text/textSession.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// Disposable profile and storage, served only by the browser regression test.
const profileAddress = '0x8888888888888888888888888888888888888888';
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const store = createSystemWorkflowDraftStore({ profileAddress, storage });
if (!store.getDraft().shapes?.length) {
  for (let i = 0; i < 5; i++) addImageModule(store, profileAddress);
  for (let i = 0; i < 2; i++) addTextModule(store, profileAddress);
  addShape(store, profileAddress, { kind: 'grid', position: { left: 80, top: 200 }, size: { width: 192, height: 144 } });
}
window.gridResizeSaved = () => JSON.parse(localStorage.getItem(systemWorkflowDraftKey(profileAddress)));
createRoot(document.getElementById('root')).render(<Runtime profileAddress={profileAddress} reviewStorage={storage}
  reviewAssets={[]} reviewCategories={[]} reviewActivity={[]} reviewDiscovery={[]} reviewProfile={{ name: 'Grid resize release review' }} />);
