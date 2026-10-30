import { useEffect, useState, useLayoutEffect } from 'react';
import ReceptionEditor from './ReceptionEditor.jsx';
import { createEditorPreferencesStore } from '../public/ownerSystemWorkflow/editorPreferencesStore.js';
import { beforeProfileEditorRelease } from '../systemWorkflow/profileEditorLease.js';
import WorkbenchBackupControls from '../systemWorkflow/WorkbenchBackupControls.jsx';
export default function ReceptionStoreEditor({ rootStore, onClose, onRestored = onClose, onCanvases = onClose, editorPreferences, ...props }) {
  const [preferences] = useState(() => editorPreferences || createEditorPreferencesStore({ profile: rootStore.getProfileAddress(),
    storage: props.storage || globalThis.localStorage, canSave: rootStore.hasWriteAccess, width: innerWidth }));
  useLayoutEffect(() => {
    if (editorPreferences) return;
    preferences.resume();
    const flush = () => preferences.flush(), stop = beforeProfileEditorRelease(rootStore.getProfileAddress(), flush);
    addEventListener('beforeunload', flush);
    return () => { stop(); removeEventListener('beforeunload', flush); preferences.dispose(); };
  }, [preferences, editorPreferences, rootStore]);
  const [state, setState] = useState(null);
  useEffect(() => {
    let scope;
    try { scope = rootStore.acquireReceptionScope(); setState({ scope }); }
    catch (error) { setState({ error: error.message }); }
    return () => scope?.release();
  }, [rootStore]);
  if (!state) return <p role="status">Opening Reception…</p>;
  if (state.error) return <main className="public-shell"><p role="alert">{state.error}</p>
    <WorkbenchBackupControls store={rootStore} storage={props.storage || globalThis.localStorage} onRestored={onRestored} />
    <button type="button" onClick={onClose}>Return</button></main>;
  return <ReceptionEditor {...props} editorPreferences={preferences} rootStore={rootStore} store={state.scope} onClose={() => { preferences.flush(); state.scope.release(); onClose(); }}
    onRestored={notice => { preferences.flush(); state.scope.release(); onRestored(notice); }}
    onCanvases={() => { preferences.flush(); state.scope.release(); onCanvases(); }} />;
}
