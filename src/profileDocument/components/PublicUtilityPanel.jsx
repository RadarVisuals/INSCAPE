import { useLayoutEffect, useRef } from 'react';
import OwnerSystemWorkflowActivity from '../../public/ownerSystemWorkflow/OwnerSystemWorkflowActivity.jsx';
import OwnerSystemWorkflowSettings from '../../public/ownerSystemWorkflow/OwnerSystemWorkflowSettings.jsx';
import OwnerSystemWorkflowManual from '../../public/ownerSystemWorkflow/OwnerSystemWorkflowManual.jsx';
import useOwnerSystemWorkflowActivity from '../../public/ownerSystemWorkflow/useOwnerSystemWorkflowActivity.js';
import './publicUtilityPanel.css';

const titles = { activity: 'Activity', settings: 'Settings', docs: 'Help & Docs' };

export default function PublicUtilityPanel({ panel, profileAddress, onClose }) {
  const dialog = useRef(null);
  const activity = useOwnerSystemWorkflowActivity({ active: panel === 'activity', profileAddress });
  useLayoutEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} className="public-utility-panel system-workflow__token-scope"
    data-workflow-material="tactile" data-workflow-finish="flat" aria-label={titles[panel]}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {panel === 'activity' && <OwnerSystemWorkflowActivity activity={activity} onClose={onClose} />}
    {panel === 'settings' && <OwnerSystemWorkflowSettings profileAddress={profileAddress} onClose={onClose} canvasGuides={false} />}
    {panel === 'docs' && <OwnerSystemWorkflowManual onClose={onClose} />}
  </dialog>;
}
