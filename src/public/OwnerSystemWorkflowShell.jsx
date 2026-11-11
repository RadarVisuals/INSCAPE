import { normalizeProfileAddress } from '../library/config.js';
import OwnerSystemWorkflowReconciliationBoundary from './ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx';

export default function OwnerSystemWorkflowShell({
  ownerAuthoringEnabled = true,
  workspaceProfileAddress,
  viewedProfileAddress = workspaceProfileAddress,
  ...runtimeProps
}) {
  const profileAddress = normalizeProfileAddress(workspaceProfileAddress);
  const viewed = normalizeProfileAddress(viewedProfileAddress);
  if (!ownerAuthoringEnabled || !profileAddress || profileAddress !== viewed) return null;
  return <OwnerSystemWorkflowReconciliationBoundary profileAddress={profileAddress} {...runtimeProps} />;
}
