import { useMemo } from 'react';
import OwnerSystemWorkflowShell from '../OwnerSystemWorkflowShell.jsx';
import {
  createOwnerSystemWorkflowReviewStorage,
  OWNER_SYSTEM_WORKFLOW_REVIEW_ACTIVITY,
  OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
  OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES,
  OWNER_SYSTEM_WORKFLOW_REVIEW_DISCOVERY,
  OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
} from './ownerSystemWorkflowDevelopmentFixture.js';

export default function OwnerSystemWorkflowDevelopmentEntrance() {
  const storage = useMemo(createOwnerSystemWorkflowReviewStorage, []);
  return <OwnerSystemWorkflowShell ownerAuthoringEnabled workspaceProfileAddress={OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE} viewedProfileAddress={OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE}
    reviewStorage={storage} reviewAssets={OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS} reviewCategories={OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES}
    reviewActivity={OWNER_SYSTEM_WORKFLOW_REVIEW_ACTIVITY} reviewDiscovery={OWNER_SYSTEM_WORKFLOW_REVIEW_DISCOVERY}
    reviewProfile={{
      name: 'RADAR VISUALS',
      avatarUrl: null,
      description: 'A visual research practice tracing signal, memory and synthetic terrain across LUKSO.',
      tags: ['SYSTEMS', 'IMAGE', 'FIELD NOTES'],
      links: [
        { id: 'studio', label: 'STUDIO INDEX', url: 'https://example.com/studio' },
        { id: 'archive', label: 'FIELD ARCHIVE', url: 'https://example.com/archive' },
      ],
    }} />;
}
