import './workspaceStatus.css';
import { useEffect, useSyncExternalStore } from 'react';
import { StartupDestinationReady } from '../startveil/StartupDestinationContext.jsx';
import { confirmWorkspaceSaved, hydrateWorkspace, subscribeWorkspace, workspaceSession } from './profileWorkspace.js';

export function useWorkspaceStatus(profile) {
  return useSyncExternalStore(subscribeWorkspace, () => workspaceSession(profile)?.state);
}

export function useWorkspaceSaveLabel(profile, acceptedLabel) {
  const state = useWorkspaceStatus(profile);
  if (!state || state.status === 'ready') return acceptedLabel;
  if (state.status === 'saving') return 'Saving workspace…';
  return state.status === 'loading' ? 'Opening workspace…' : 'Changes need attention';
}

export default function WorkspaceBoundary({ profile, children }) {
  const state = useWorkspaceStatus(profile);
  useEffect(() => { void hydrateWorkspace(profile); }, [profile]);
  if (!state || state.status === 'loading') return <p role="status">Opening your saved workspace…</p>;
  if (state.status === 'blocked') return <><StartupDestinationReady /><p role="alert">{state.message}</p></>;
  return <>{children}{state.message && <aside role="alert" className="workspace-save-warning">{state.message}
    {state.status === 'unsaved' && <button onClick={() => void confirmWorkspaceSaved(profile)}>Retry save</button>}
  </aside>}</>;
}
