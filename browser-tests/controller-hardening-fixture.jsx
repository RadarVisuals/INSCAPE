import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import useController from '../src/public/ownerSystemWorkflow/useWorkbenchController.js';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profile } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';

const other = '0x2222222222222222222222222222222222222222';
const root = createRoot(document.getElementById('root'));
window.hardening = { profile, other, unmount: () => root.unmount() };
function Fixture() {
  const [address, setAddress] = useState(profile);
  const sharedStore = useMemo(() => createSystemWorkflowDraftStore({ profileAddress: address, storage: createOwnerSystemWorkflowReviewStorage() }), [address]);
  const controller = useController(address, { sharedStore });
  Object.assign(window.hardening, { controller, setAddress });
  return <output>{controller.draft.profileAddress}</output>;
}
root.render(<Fixture />);
