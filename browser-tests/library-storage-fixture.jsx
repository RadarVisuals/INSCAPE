import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import useOwnerLatticeBrowser from '../src/public/useOwnerLatticeBrowser.js';
import { resetLibraryStoreForTests, useLibraryStore } from '../src/library/state/useLibraryStore.js';
import { libraryWorkspaceKey } from '../src/library/storage/libraryWorkspaceStorage.js';
import OwnerSystemWorkflowLibraryWorkspace from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx';
import '../src/index.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';
import '../src/public/ownerSystemWorkflow/displayInstruments.css';

const profile = '0x1111111111111111111111111111111111111111';
const storage = {
  getItem: key => localStorage.getItem(`storage-fixture:${key}`),
  setItem: (key, value) => { if (window.storageTest.denied) throw new Error('quota'); localStorage.setItem(`storage-fixture:${key}`, value); },
};
window.storageTest = { denied: false, store: useLibraryStore,
  saved: () => storage.getItem(libraryWorkspaceKey(profile)),
  externalChange: () => storage.setItem(libraryWorkspaceKey(profile), JSON.stringify({ ...useLibraryStore.getState().workspace, favorites: ['external'] })) };
resetLibraryStoreForTests(profile, storage);
function Fixture() {
  const browser = useOwnerLatticeBrowser(profile, false);
  const workspaceRef = useRef(null), placementTargetRef = useRef(null), shortcutTargetRef = useRef(null), moduleAssetTargetRef = useRef(null);
  return <main ref={workspaceRef} className="system-workflow" data-lattice-menu-surface data-menu-surface="paper" data-layout={innerWidth < 800 ? 'narrow' : 'wide'} data-library-open>
    <OwnerSystemWorkflowLibraryWorkspace categoryCommands={browser.commands} placementScope={`${profile}:home`} data={browser.data}
      workspaceRef={workspaceRef} placementTargetRef={placementTargetRef} shortcutTargetRef={shortcutTargetRef} moduleAssetTargetRef={moduleAssetTargetRef}
      menuSurface="paper" onClose={() => {}} phase="open" />
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
