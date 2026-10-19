import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import useOwnerLatticeBrowser from '../src/public/useOwnerLatticeBrowser.js';
import { resetLibraryStoreForTests, useLibraryStore } from '../src/library/state/useLibraryStore.js';
import { chillwhalesProfileRepository } from '../src/library/data/chillwhalesProfileRepository.js';
import { luksoRpcProfileRepository } from '../src/library/data/luksoRpcProfileRepository.js';
import { saveLibraryAssetCache, loadLibraryAssetCache } from '../src/library/storage/libraryAssetCache.js';
import OwnerSystemWorkflowLibraryWorkspace from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx';
import '../src/index.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';
import '../src/public/ownerSystemWorkflow/displayInstruments.css';

// Synthetic repositories and memory-only storage; the production loader, data
// adapter, Library and Retry command are used without a wallet or Workbench draft.
const profile = '0x1111111111111111111111111111111111111111';
const mode = new URLSearchParams(location.search).get('mode') || 'metadata';
const values = new Map();
const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value) };
const asset = (digit, name) => ({ id:`42:0x${digit.repeat(40)}:contract`, chainId:42,
  contractAddress:`0x${digit.repeat(40)}`, ownerAddress:profile, tokenId:null, standard:'LSP7', name,
  imageUrl:'https://assets.example/library-recovery-art.svg', imageWidth:160, imageHeight:160,
  mediaFileType:'image/svg+xml', fieldProvenance:{}, attributes:[] });
const known = asset('2', 'Retained artwork'), recovered = asset('3', 'Recovered artwork');
resetLibraryStoreForTests(profile,storage);
if (mode !== 'empty') {
  saveLibraryAssetCache(storage,profile,[known]);
  useLibraryStore.setState({ assets:[known] });
}
const state = { allowRecovery:false, loads:0, repairing:false, releaseRepair:null, store:useLibraryStore,
  cached:() => loadLibraryAssetCache(storage,profile), originalWorkspace:JSON.stringify(useLibraryStore.getState().workspace) };
window.libraryRecovery = state;
chillwhalesProfileRepository.loadProfileAssets = async function* () {
  state.loads++;
  if (mode !== 'metadata' && !state.allowRecovery) throw new Error('Test indexer unavailable');
  yield { assets:mode === 'metadata' ? [known] : [known,recovered],
    unresolvedAssetIds:mode === 'metadata' ? [recovered.id] : [],
    failures:mode === 'metadata' ? 1 : 0, resolved:2, total:2, complete:true };
};
luksoRpcProfileRepository.loadProfileAssets = async function* () {
  if (mode !== 'metadata') throw new Error('Test RPC unavailable');
  if (state.allowRecovery) {
    state.repairing = true;
    await new Promise(resolve => { state.releaseRepair = resolve; });
    yield { assets:[recovered], failures:0, resolved:1, total:1, complete:true };
  } else yield { assets:[], failures:1, resolved:1, total:1, complete:true };
};
function Fixture() {
  const browser = useOwnerLatticeBrowser(profile,false);
  const workspaceRef = useRef(null), placementTargetRef = useRef(null), shortcutTargetRef = useRef(null), moduleAssetTargetRef = useRef(null);
  return <main ref={workspaceRef} className="system-workflow" data-lattice-menu-surface data-menu-surface="paper" data-layout={innerWidth < 800 ? 'narrow' : 'wide'} data-library-open>
    <OwnerSystemWorkflowLibraryWorkspace categoryCommands={browser.commands} placementScope={`${profile}:test`} data={browser.data}
      workspaceRef={workspaceRef} placementTargetRef={placementTargetRef} shortcutTargetRef={shortcutTargetRef} moduleAssetTargetRef={moduleAssetTargetRef}
      menuSurface="paper" onClose={() => {}} phase="open" />
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
void useLibraryStore.getState().load();
