import React from 'react';
import { createRoot } from 'react-dom/client';
import OwnerSystemWorkflowShell from '../src/public/OwnerSystemWorkflowShell.jsx';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profile,
  OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets, OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES as categories,
} from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { buildOwnerSystemWorkflowPreviewDocument } from '../src/public/ownerSystemWorkflowPreviewDocument.js';
import '../src/index.css';

const fixtures = assets.map((asset, index) => index ? asset : { ...asset,
  imageGroups: ['main', 'transparent', 'unavailable'].map((name, index) => ({ index,
    originalImageUrl: `https://images.inscape.test/${name}.webp`, imageUrl: `https://images.inscape.test/${name}.webp`,
    variants: name === 'transparent' ? [{ url: 'https://images.inscape.test/transparent-fallback.webp' }] : [],
  })),
});
const seed = createOwnerSystemWorkflowReviewStorage();
const storage = {
  getItem: (key) => localStorage.getItem(`image-test:${key}`) || seed.getItem(key),
  setItem: (key, value) => localStorage.setItem(`image-test:${key}`, value),
  removeItem: (key) => localStorage.removeItem(`image-test:${key}`),
};
window.__imageTest = {
  draft: () => JSON.parse(storage.getItem(systemWorkflowDraftKey(profile))),
  preview: () => buildOwnerSystemWorkflowPreviewDocument({ assetRecords: fixtures, profileAddress: profile,
    systemWorkflowDraft: window.__imageTest.draft() }),
};
createRoot(document.getElementById('root')).render(<OwnerSystemWorkflowShell ownerAuthoringEnabled
  workspaceProfileAddress={profile} viewedProfileAddress={profile} reviewStorage={storage}
  reviewAssets={fixtures} reviewCategories={categories} reviewProfile={{ name: 'Image selection fixture' }} />);
