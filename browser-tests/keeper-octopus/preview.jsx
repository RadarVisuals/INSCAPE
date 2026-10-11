import React from 'react';
import { createRoot } from 'react-dom/client';
import Runtime from '../../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { systemWorkflowDraftKey } from '../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createDefaultWorkbenchPresentation } from '../../src/profileDocument/domain/workbenchPresentation.js';
import { resolveLibraryImageAsset } from '../../src/library/resolveLibraryImageAsset.js';
import '../../src/index.css';
import '../../src/inscapeTokens.css';
import '../../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../../src/lattice/rendering/latticeMenuSurface.css';

// The real Keeper dock and Workbench, with separate in-memory draft storage.
// This preview never selects/replaces artwork in the owner's saved profile.
const transport = await navigator.serviceWorker.register('./worker.js', { scope: './' });
const worker = transport.installing || transport.waiting || transport.active;
if (worker?.state !== 'activated') await new Promise(resolve => worker.addEventListener('statechange', () => { if (worker.state === 'activated') resolve(); }));
if (!navigator.serviceWorker.controller) await new Promise(resolve => {
  const timer = setTimeout(() => location.reload(), 500);
  navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true });
});
await transport.unregister();
const storage = createOwnerSystemWorkflowReviewStorage(), profile = OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
const key = systemWorkflowDraftKey(profile), draft = JSON.parse(storage.getItem(key));
const asset = await resolveLibraryImageAsset({ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], name: 'Goo Keeper', title: 'Goo Keeper',
  selectedMedia: { url: 'https://keeper-octopus.inscape.test/artwork.svg', width: 2048, height: 2048 } });
draft.keeperDocks = [{ id: 'keeper:octopus-preview', name: 'Goo Keeper', asset, faces: 'right', movement: 'svg', size: 384, visibility: 'PRIVATE' }];
draft.workbench = createDefaultWorkbenchPresentation();
draft.workbench.display.open = false;
draft.workbench.keeperDocks = [{ id: 'keeper:octopus-preview', position: { left: 180, top: 200 } }];
storage.setItem(key, JSON.stringify(draft));
createRoot(document.getElementById('root')).render(<>
  <Runtime profileAddress={profile} reviewStorage={storage} reviewAssets={[]} reviewCategories={[]} reviewActivity={[]} reviewDiscovery={[]} reviewProfile={{ name: 'Goo Keeper preview' }} />
  <aside style={{ position: 'fixed', top: 12, left: 20, right: 20, maxWidth: 600, zIndex: 60, padding: 8,
    color: 'var(--workflow-ink, #eee)', background: 'var(--workflow-panel, #222)', font: '12px/1.6 "Inscape Sora", sans-serif' }}>
    Octopus Keeper · temporary dock preview<br />
    Release, then click empty space or hold the right mouse button to swim. Move your pointer near its eyes. Click the head to talk.<br />
    Your saved Workbench is untouched. In your own dock, choose the uploaded SVG from Library and select SVG float.
  </aside>
</>);
