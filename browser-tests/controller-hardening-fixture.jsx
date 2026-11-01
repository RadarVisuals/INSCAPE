import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import useController from '../src/public/ownerSystemWorkflow/useOwnerSystemWorkflowController.js';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profile } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';

const other = '0x2222222222222222222222222222222222222222';
const draft = JSON.parse(createOwnerSystemWorkflowReviewStorage().getItem(systemWorkflowDraftKey(profile)));
for (const address of [profile, other]) localStorage.setItem(systemWorkflowDraftKey(address), JSON.stringify({ ...draft, profileAddress: address }));
const root = createRoot(document.getElementById('root'));
window.hardening = { profile, other, unmount: () => root.unmount() };
function Fixture() {
  const [address, setAddress] = useState(profile);
  const controller = useController(address);
  Object.assign(window.hardening, { controller, setAddress });
  return <output>{controller.draft.profileAddress}</output>;
}
root.render(<Fixture />);
