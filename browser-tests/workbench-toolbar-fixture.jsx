import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createSystemWorkflowAuthoringSession } from '../src/systemWorkflow/systemWorkflowAuthoringSession.js';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// Dedicated in-memory draft: exercising creation/undo never edits the user's
// development scene or saved profile. Asset requests stay on the local server.
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
const profileAddress = '0x9999999999999999999999999999999999999999';
const assets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: asset.src, thumbnailUrl: asset.src, originalImageUrl: asset.src }));
const store = createSystemWorkflowDraftStore({ profileAddress, storage });
const session = createSystemWorkflowAuthoringSession({ store });
session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: assets[0].id,
  destination: { column: 10, row: 4, columnSpan: 9, rowSpan: 9 } });
createRoot(document.getElementById('root')).render(<Runtime profileAddress={profileAddress} reviewStorage={storage} reviewAssets={assets}
  reviewCategories={[]} reviewActivity={[]} reviewDiscovery={[]} reviewProfile={{ name: 'Toolbar review' }} />);
