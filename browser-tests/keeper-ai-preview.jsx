import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { resolveLibraryImageAsset } from '../src/library/resolveLibraryImageAsset.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// A disposable in-memory scene using the real character and live account
// service. It never reads or writes the owner's Workbench draft.
const profileAddress = OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
const storage = createOwnerSystemWorkflowReviewStorage(), key = systemWorkflowDraftKey(profileAddress);
const contractAddress = '0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21', tokenId = `0x${'0'.repeat(63)}4`;
const stableAssetId = `42:${contractAddress}:${tokenId}`;
const url = 'https://api.universalprofile.cloud/ipfs/QmVedH9YCFGaRNCFF5azSTUGhTCUHS4R6Y84a6MTBXZK3c/images-0-KEEPER-webp-2048.svg';
const asset = await resolveLibraryImageAsset({ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], id: stableAssetId, stableAssetId,
  contractAddress, tokenId, name: 'Octo', title: 'Octo', selectedMedia: { url, width: 2048, height: 2048 } });
const draft = JSON.parse(storage.getItem(key));
draft.keeperDocks = [{ id: 'keeper:ai-preview', name: 'Octo', asset, faces: 'right', movement: 'swim', size: 320, visibility: 'PRIVATE' }];
draft.workbench = createDefaultWorkbenchPresentation();
draft.workbench.display.open = false;
draft.workbench.keeperDocks = [{ id: 'keeper:ai-preview', position: { left: 600, top: 280 } }];
if (new URLSearchParams(location.search).has('artwork')) {
  const study = await resolveLibraryImageAsset(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0]);
  draft.imageModules = [{ id: 'image:keeper-study', name: 'Abyssal study', width: 320, height: 320, visibility: 'PRIVATE',
    sides: [{ id: 'side:keeper-study', asset: study,
      crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }];
  draft.workbench.imageModules = [{ id: 'image:keeper-study', open: true, position: { left: 110, top: 140 } }];
  if (new URLSearchParams(location.search).has('svg')) {
    draft.imageModules.push({ ...draft.imageModules[0], id: 'image:keeper-svg', name: 'SVG study',
      sides: [{ ...draft.imageModules[0].sides[0], id: 'side:keeper-svg', asset }] });
    draft.workbench.imageModules.push({ id: 'image:keeper-svg', open: true, position: { left: 420, top: 420 } });
  }
}
storage.setItem(key, JSON.stringify(draft));
createRoot(document.getElementById('root')).render(<>
  <Runtime profileAddress={profileAddress} reviewStorage={storage} reviewAssets={[]} reviewCategories={[]} reviewActivity={[]} reviewDiscovery={[]} reviewProfile={{ name: 'Keeper AI preview' }} />
  <aside style={{ position: 'fixed', top: 18, left: 18, right: 18, zIndex: 40, pointerEvents: 'none', color: '#555', font: '12px/1.6 "Inscape Sora", sans-serif' }}>
    Keeper AI · local preview<br />Release Octo, click his head, then choose AI chat.
  </aside>
</>);
