import { useEffect, useState } from 'react';
import ReceptionEditor from './ReceptionEditor.jsx';
import WorkbenchBackupControls from '../systemWorkflow/WorkbenchBackupControls.jsx';
export default function ReceptionStoreEditor({ rootStore, onClose, onCanvases = onClose, ...props }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let scope;
    try { scope = rootStore.acquireReceptionScope(); setState({ scope }); }
    catch (error) { setState({ error: error.message }); }
    return () => scope?.release();
  }, [rootStore]);
  if (!state) return <p role="status">Opening Reception…</p>;
  if (state.error) return <main className="public-shell"><p role="alert">{state.error}</p>
    <WorkbenchBackupControls store={rootStore} storage={props.storage || globalThis.localStorage} onRestored={onClose} />
    <button type="button" onClick={onClose}>Return</button></main>;
  return <ReceptionEditor {...props} rootStore={rootStore} store={state.scope} onClose={() => { state.scope.release(); onClose(); }}
    onCanvases={() => { state.scope.release(); onCanvases(); }} />;
}
