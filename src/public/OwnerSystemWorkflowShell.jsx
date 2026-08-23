import { normalizeProfileAddress } from '../library/config.js';
import '../lattice/rendering/latticeMenuSurface.css';
import OwnerSystemWorkflowRuntime from './ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import './ownerSystemWorkflow/ownerSystemWorkflow.css';

export default function OwnerSystemWorkflowShell({
  ownerAuthoringEnabled = true,
  workspaceProfileAddress,
  viewedProfileAddress = workspaceProfileAddress,
  ...runtimeProps
}) {
  const profileAddress = normalizeProfileAddress(workspaceProfileAddress);
  const viewed = normalizeProfileAddress(viewedProfileAddress);
  if (!ownerAuthoringEnabled || !profileAddress || profileAddress !== viewed) return null;
  return <OwnerSystemWorkflowRuntime profileAddress={profileAddress} {...runtimeProps} />;
}
