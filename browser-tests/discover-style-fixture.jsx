import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Portal from '../src/startveil/PublicEntryPortal.jsx';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as source } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import '../src/index.css';
const params = new URLSearchParams(location.search);
const profiles = Array.from({ length: 25 }, (_, i) => ({ address: '0x' + (i + 1).toString(16).padStart(40, '0'), name: 'World ' + String(i + 1).padStart(2, '0') }));
const draft = JSON.parse(createOwnerSystemWorkflowReviewStorage().getItem(systemWorkflowDraftKey(source)));
draft.appearance.guideMode = 'NONE';
draft.grids.find(grid => grid.id === 'grid:world-cover').placements = [
 { ...structuredClone(draft.grids[0].placements[0]), id: 'cover-backdrop', stableAssetId: assets[6].id, column: 0, row: 0, columnSpan: 32, rowSpan: 18, layer: 0, navigationOrder: 0 },
 { ...structuredClone(draft.grids[0].placements[0]), id: 'cover-character', column: 8, row: 0, columnSpan: 18, rowSpan: 18, layer: 1, navigationOrder: 1 },
];
const documents = new Map(profiles.map(profile => [profile.address, buildProfileDocumentV9({
  profileAddress: source, systemWorkflowDraft: draft, profileIdentity: { name: profile.name },
  assetRecords: assets, createdAt: 1, exportedAt: 2,
})]));
const snapshots = new Map(profiles.map(profile => [profile.address, { status: 'RESOLVED', document: documents.get(profile.address), busy: false }]));
window.discoverReview = { requests: 0, visits: [], connects: 0, disconnects: 0, entered: 0, closes: 0 };
let resolveDirectory;
const repository = { list: async () => {
  window.discoverReview.requests++;
  if (params.has('delay') && window.discoverReview.requests === 1) return new Promise(resolve => { resolveDirectory = resolve; });
  if (params.has('error') && window.discoverReview.requests === 1) throw Error('Directory unavailable');
  return profiles;
} };
window.resolveDirectory = () => resolveDirectory(profiles);
const resolutionStore = { get: address => snapshots.get(address), subscribe: () => () => {}, resolve: async address => snapshots.get(address) };
function Review() {
 const [open, setOpen] = useState(params.has('landing'));
 return <><button id="discover-trigger" onClick={() => setOpen(true)}>Open Discover</button>
 {open && <Portal initialMode={params.has('landing') ? 'landing' : 'explore'} menuSurface={params.get('theme') || 'mist'}
   connectedProfile={params.has('connected') ? { address: source, name: 'Artist with a long profile name' } : null}
   discoveryRepository={repository} resolutionStore={resolutionStore}
   onConnect={() => window.discoverReview.connects++} onDisconnect={() => window.discoverReview.disconnects++}
   onEnterMyWorld={() => window.discoverReview.entered++}
   onClose={params.has('landing') ? undefined : () => { setOpen(false); window.discoverReview.closes++; document.getElementById('discover-trigger')?.focus(); }}
   onVisitProfile={address => window.discoverReview.visits.push(address)} />}</>;
}
createRoot(document.getElementById('root')).render(<Review />);
