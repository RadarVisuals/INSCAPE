import { useState } from 'react';
import OwnerSystemWorkflowRuntime from '../../../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import ReceptionOverview from '../../../src/reception/ReceptionOverview.jsx';
import { createSystemWorkflowDraftStore } from '../../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { projectReception } from '../../../src/profileDocument/domain/receptionPresentation.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../../../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createReceptionExample, receptionProfile } from '../receptionExample.js';

export const description = 'Reception in the Editor: draw a Rectangle (R), then use Shape settings → Turn into cell. The sample saves separately on this device; your profile is untouched.';
export const sources = ['src/public/ownerSystemWorkflow/OwnerWorkbenchToolbar.jsx', 'src/shapes/ShapeWorkbench.jsx', 'src/public/ownerSystemWorkflow/OwnerWorkbenchSession.jsx'];
export const fullViewport = true;
export const edgeToEdge = true;
const profileAddress = '0x1111111111111111111111111111111111111111';
const prefix = 'inscape:design-lab:reception-editor:';
const storage = {
  getItem: key => localStorage.getItem(prefix + key),
  setItem: (key, value) => localStorage.setItem(prefix + key, value),
  removeItem: key => localStorage.removeItem(prefix + key),
};
export function resetSample() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
const reviewAssets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset,
  originalImageUrl: asset.originalImageUrl?.replace(/^https:\/\/raw\.githubusercontent\.com\/RadarVisuals\/INSCAPE\/[^/]+\/public/u, ''),
  thumbnailUrl: asset.thumbnailUrl?.replace(/^https:\/\/raw\.githubusercontent\.com\/RadarVisuals\/INSCAPE\/[^/]+\/public/u, ''),
}));

export default function ReceptionEditorArtboard() {
  // The ordinary Editor owns a complete viewport, including fixed tools and
  // camera coordinates. An iframe gives the lab the same hosting boundary.
  if (!new URLSearchParams(location.search).has('frame')) {
    const url = new URL(location.href); url.searchParams.set('frame', '1');
    return <iframe title="Reception Editor" src={url.href} style={{ width: '100%', height: 'max(720px, calc(100dvh - 180px))', border: 0, display: 'block' }} />;
  }
  return <ReceptionEditorExample />;
}

function ReceptionEditorExample() {
  const [editing, setEditing] = useState(true);
  const [store] = useState(() => {
    const store = createSystemWorkflowDraftStore({ profileAddress, storage });
    if (!store.getSnapshot().reception) {
      const reception = createReceptionExample();
      if (!store.commitCompletedOperation({ ...store.getDraft(), reception }, { expectedGeneration: store.getGeneration() }))
        throw new Error('The Reception sample could not be saved.');
    }
    return store;
  });
  return <div className="lab-reception-stage">
    {editing ? <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={store} reviewStorage={storage}
      receptionEditorRequested onOpenReception={() => setEditing(false)}
      reviewAssets={reviewAssets} reviewCategories={[]} reviewProfile={{ status: 'RESOLVED', normalizedAddress: profileAddress, name: 'nomad', description: '', tags: [], links: [] }} />
      : <ReceptionOverview reception={projectReception(store.getSnapshot().reception)} model={receptionProfile} onEdit={() => setEditing(true)} />}
  </div>;
}
