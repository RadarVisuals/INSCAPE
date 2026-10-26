import { useEffect, useState } from 'react';
import ProfileEditingBoundary from '../systemWorkflow/ProfileEditingBoundary.jsx';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { reconcileOwnerDraftWithPublishedProfile } from '../profileDocument/storage/ownerDraftReconciliation.js';
import WorkbenchBackupControls from '../systemWorkflow/WorkbenchBackupControls.jsx';
import ReceptionEditor from './ReceptionEditor.jsx';

export default function OwnerReception(props) {
  return <ProfileEditingBoundary profileAddress={props.document.profile.address} onView={props.onClose}>
    <OwnerReceptionSession key={props.document.profile.address} {...props} />
  </ProfileEditingBoundary>;
}
function OwnerReceptionSession({ document, onClose, onCanvases, onDiscover, onReturn }) {
  const [root] = useState(() => createSystemWorkflowDraftStore({ profileAddress: document.profile.address, storage: localStorage, requireEditor: true }));
  const [state, setState] = useState(null);
  useEffect(() => {
    let scope;
    try {
      const result = reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: document.profile.address, storage: localStorage, store: root });
      if (['HYDRATION_FAILED', 'LOCAL_DRAFT_UNAVAILABLE'].includes(result.status)) throw new Error('The local draft could not be opened safely. Use private backup recovery or return to Workbench.');
      scope = root.acquireReceptionScope(); setState({ scope });
    } catch (error) { setState({ error: error.message }); }
    return () => scope?.release();
  }, [root, document]);
  if (!state) return <p role="status">Opening Reception…</p>;
  if (state.error) return <main className="public-shell"><p role="alert">{state.error}</p><WorkbenchBackupControls store={root} storage={localStorage} onRestored={onClose} /><button type="button" onClick={onClose}>Return</button></main>;
  return <ReceptionEditor store={state.scope} rootStore={root} publishedDocument={document} onClose={onClose} onCanvases={onCanvases} onDiscover={onDiscover} onReturn={onReturn} />;
}
