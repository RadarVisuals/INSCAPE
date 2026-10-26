import { useRef, useState } from 'react';
import useBrowserWorkspace from '../lattice/browser/useBrowserWorkspace.js';
import OwnerSystemWorkflowLibraryPresenter from '../public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryPresenter.jsx';
import WorkspaceRail from '../public/ownerSystemWorkflow/OwnerSystemWorkflowWorkspaceControls.jsx';
import { OwnerSystemWorkflowWorkspaceShell } from '../public/ownerSystemWorkflow/OwnerSystemWorkflowBrowserWorkspace.jsx';
import '../lattice/browser/browserWorkspace.css';
import '../public/ownerSystemWorkflow/libraryWorkspace.css';

// The same browsing/presentation controls as Workbench, with selection as its
// only content action. No Workbench drop routing, camera or window runtime.
export default function ProfileLibraryPicker({ library, menuSurface, onChoose, onClose }) {
  const records = useRef(new Map());
  const workspace = useBrowserWorkspace(library.libraryData, records.current);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const choose = async asset => {
    if (busy) return;
    if (asset.isCollection && asset.collectionRole !== 'cover') { library.libraryData.onOpenCollection?.(asset.assetRecord); return; }
    setBusy(true); setError('');
    try { if (!await onChoose(asset)) setError('This selection is no longer current. Close Library and select the region again.'); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const selected = library.libraryData.assets.find(a => (a.stableAssetId || a.id) === workspace.selectedAssetIds[0]);
  return <OwnerSystemWorkflowWorkspaceShell className="reception-library" label="Choose Reception image" phase="open"
    rail={<><WorkspaceRail menuSurface={menuSurface} workspace={workspace} onClose={onClose} />
      <button className="workflow-tactile-control" type="button" disabled={busy || !selected || workspace.selectedAssetIds.length !== 1}
        onClick={() => choose(selected)}>{busy ? 'Preparing image…' : 'Use selected image'}</button></>}>
    {error && <p role="alert">{error}</p>}
    <OwnerSystemWorkflowLibraryPresenter data={library.libraryData} workspace={workspace} categoryCommands={library.categoryCommands}
      menuSurfaceId={menuSurface} onAssetActivate={(_event, asset) => choose(asset)} onImageActivate={(_event, asset) => choose(asset)} />
  </OwnerSystemWorkflowWorkspaceShell>;
}
