import { useState } from 'react';
import WorkspacePreview from '../../workspacePreview.jsx';

export const description = 'Existing design-system workspace: shared controls and disposable adapters. Includes the retained experimental Display reference; this is not the production Workbench host.';
export const sources = ['design-system/workspacePreview.jsx', 'src/public/ownerSystemWorkflow/WorkspaceNavigation.jsx', 'src/public/ownerSystemWorkflow/ArtworkTransformTools.jsx'];

export default function WorkspaceArtboard() {
  const [notice, setNotice] = useState('Explore the existing workspace reference.');
  return <><WorkspacePreview onAction={setNotice} status="Reference" /><p role="status">{notice}</p></>;
}
