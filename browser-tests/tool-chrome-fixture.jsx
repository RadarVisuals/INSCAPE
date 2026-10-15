import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from '../src/systemWorkflow/systemWorkflowAuthoringSession.js';
import { addKeeperDock } from '../src/keeper/keeperSession.js';
import { addShape } from '../src/shapes/shapeSession.js';
import { addImageModule } from '../src/imageModule/imageModuleSession.js';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// Isolated, disposable scene. No user draft or preference is read or written.
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
const profileAddress = '0x9999999999999999999999999999999999999999';
const assets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: asset.src, thumbnailUrl: asset.src, originalImageUrl: asset.src }));
const store = createSystemWorkflowDraftStore({ profileAddress, storage });
const session = createSystemWorkflowAuthoringSession({ store });
const sample = new URLSearchParams(location.search).get('sample');
for (let index = 0; index < (sample === 'layers' ? 24 : 1); index++) {
  session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: assets[index % assets.length].id,
    destination: { column: 2 + index % 6 * 4, row: 2 + Math.floor(index / 6) * 3, columnSpan: 5, rowSpan: 5 } });
}
if (sample === 'keeper') addKeeperDock(store, profileAddress, { position: { left: 24, top: 24 } });
if (sample === 'shape') addShape(store, profileAddress, { position: { left: 100, top: 100 } });
if (sample === 'image') addImageModule(store, profileAddress);
createRoot(document.getElementById('root')).render(<Runtime profileAddress={profileAddress} reviewStorage={storage} reviewAssets={assets}
  reviewCategories={[]} reviewActivity={[]} reviewDiscovery={[]} reviewProfile={{ name: 'Companion tool review' }} />);
