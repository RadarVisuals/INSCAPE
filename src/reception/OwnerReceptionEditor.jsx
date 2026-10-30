import { useEffect, useState } from 'react';
import ProfileEditingBoundary from '../systemWorkflow/ProfileEditingBoundary.jsx';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { reconcileOwnerDraftWithPublishedProfile } from '../profileDocument/storage/ownerDraftReconciliation.js';
import WorkbenchBackupControls from '../systemWorkflow/WorkbenchBackupControls.jsx';
import ReceptionStoreEditor from './ReceptionStoreEditor.jsx';

export default function OwnerReceptionEditor(props) {
  return <ProfileEditingBoundary profileAddress={props.address} onView={props.onClose} viewLabel="Back to Reception">
    <EditingSession {...props} />
  </ProfileEditingBoundary>;
}
function EditingSession({ address, document, onClose, onDone, onCanvases, onDiscover, onReturn }) {
  const [root] = useState(() => createSystemWorkflowDraftStore({ profileAddress: address, storage: localStorage, requireEditor: true }));
  const [state, setState] = useState(null);
  useEffect(() => {
    try {
      const result = reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: address, storage: localStorage, store: root });
      if (['HYDRATION_FAILED', 'LOCAL_DRAFT_UNAVAILABLE'].includes(result.status) || !['valid', 'absent'].includes(root.getRecordState().status))
        throw new Error('The local draft could not be opened safely. Use private backup recovery or return to Workbench.');
      setState({ ready: true });
    } catch (error) { setState({ error: error.message }); }
  }, [root, address, document]);
  if (!state) return <p role="status">Opening Reception…</p>;
  if (state.error) return <main className="public-shell"><p role="alert">{state.error}</p>
    <WorkbenchBackupControls store={root} storage={localStorage} onRestored={onDone} /><button type="button" onClick={onClose}>Return</button></main>;
  return <ReceptionStoreEditor rootStore={root} publishedDocument={document} onClose={onDone} onRestored={onDone}
    onCanvases={onCanvases} onDiscover={onDiscover} onReturn={onReturn} />;
}
