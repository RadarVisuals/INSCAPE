import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE } from '../../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

export const filledAssets = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map((asset, index) => index === 0
  ? { ...asset, attributes: [{ key: 'Selected artwork', value: 'Vector creature', type: 'string' }] } : asset);
export const filledProfile = OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
