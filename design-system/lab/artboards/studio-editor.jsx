import { useState } from 'react';
import OwnerSystemWorkflowRuntime from '../../../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore } from '../../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../../../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

export const description = 'Composition in the Editor: draw a Rectangle (R), then use Shape settings → Turn into cell. The sample saves separately on this device; your profile is untouched.';
export const sources = ['src/public/ownerSystemWorkflow/OwnerWorkbenchToolbar.jsx', 'src/shapes/ShapeWorkbench.jsx', 'src/public/ownerSystemWorkflow/OwnerWorkbenchSession.jsx'];
export const fullViewport = true;
export const edgeToEdge = true;
const profileAddress = '0x1111111111111111111111111111111111111111';
const prefix = 'inscape:design-lab:composition-editor:';
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

export default function CompositionEditorArtboard() {
  // The ordinary Editor owns a complete viewport, including fixed tools and
  // camera coordinates. An iframe gives the lab the same hosting boundary.
  if (!new URLSearchParams(location.search).has('frame')) {
    const url = new URL(location.href); url.searchParams.set('frame', '1');
    return <iframe title="Composition Editor" src={url.href} style={{ width: '100%', height: 'max(720px, calc(100dvh - 180px))', border: 0, display: 'block' }} />;
  }
  return <CompositionEditorExample />;
}

function CompositionEditorExample() {
  const [store] = useState(() => createSystemWorkflowDraftStore({ profileAddress, storage }));
  return <div className="lab-composition-stage">
    <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={store} reviewStorage={storage}
      reviewAssets={reviewAssets} reviewCategories={[]} reviewProfile={{ status: 'RESOLVED', normalizedAddress: profileAddress, name: 'nomad', description: '', tags: [], links: [] }} />
  </div>;
}
