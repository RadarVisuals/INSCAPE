import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import useOwnerLatticeBrowser from '../src/public/useOwnerLatticeBrowser.js';
import { useLibraryStore, resetLibraryStoreForTests } from '../src/library/state/useLibraryStore.js';
import { chillwhalesProfileRepository } from '../src/library/data/chillwhalesProfileRepository.js';
import { luksoCreationsRepository } from '../src/creations/data/luksoCreationsRepository.js';
import { lsp8CollectionMetadataResolver } from '../src/library/data/lsp8TokenMetadataResolver.js';
import { createEditorPreferencesStore } from '../src/public/ownerSystemWorkflow/editorPreferencesStore.js';
import OwnerSystemWorkflowLibraryWorkspace from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx';
import '../src/index.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';
import '../src/public/ownerSystemWorkflow/displayInstruments.css';

const profileA = '0x1111111111111111111111111111111111111111';
const profileB = '0x3333333333333333333333333333333333333333';
const contract = '0x2222222222222222222222222222222222222222';
const tokenId = n => `0x${n.toString(16).padStart(64, '0')}`;
const token = (n, profile) => ({ id: `42:${contract}:${tokenId(n)}`, chainId: 42, standard: 'LSP8',
  contractAddress: contract, tokenId: tokenId(n), name: `${profile === profileA ? 'A' : 'B'} token ${n}`,
  ownerAddress: profile, imageUrl: 'https://assets.inscape.test/old.webp',
  imageGroups: [0, 1].map(index => ({ index, imageUrl: `https://assets.inscape.test/${index && location.search.includes('images') ? 'chosen' : 'old'}.webp`, variants: [] })),
  attributes: [], creators: [], fieldProvenance: {} });
const collection = { id: `42:${contract}:contract`, chainId: 42, contractAddress: contract, standard: 'LSP8',
  tokenId: null, isCollection: true, viewedProfileIsCreator: true, creatorAttributionLevel: 'contract',
  creators: [{ address: profileA }], name: 'My collection', imageUrl: 'https://assets.inscape.test/old.webp' };
let release;
const gate = new Promise(resolve => { release = resolve; });
const probe = window.libraryDemandTest = { ownedPages: 0, createdPages: 0, collectionPages: 0, referencePages: 0,
  metadataIds: [], released: false, release() { probe.released = true; release(); }, store: useLibraryStore };
chillwhalesProfileRepository.loadProfileAssets = async function* (profile, { signal, requestedAssetIds } = {}) {
  if (requestedAssetIds) {
    probe.referencePages++;
    yield { assets: requestedAssetIds.map(id => token(Number.parseInt(id.split(':')[2], 16), profile)),
      complete: true, resolved: requestedAssetIds.length, total: requestedAssetIds.length, failures: 0 };
    return;
  }
  for (let offset = 0; offset < 5000; offset += 24) {
    signal?.throwIfAborted(); probe.ownedPages++;
    const count = Math.min(24, 5000 - offset);
    yield { assets: Array.from({ length: count }, (_, i) => token(offset + i + 1, profile)),
      complete: offset + count === 5000, resolved: offset + count, total: 5000, failures: 0 };
  }
};
luksoCreationsRepository.loadCreations = async function* () {
  probe.createdPages++;
  yield { assets: [collection], complete: true, resolved: 1, total: 1, failures: 0 };
};
luksoCreationsRepository.loadReferencedCreations = async function* () {
  yield { assets: [], complete: true, resolved: 0, total: 0, failures: 0 };
};
luksoCreationsRepository.loadCollectionTokens = async function* () {
  for (let offset = 0; offset < 5000; offset += 24) {
    probe.collectionPages++;
    yield { assets: Array.from({ length: Math.min(24, 5000-offset) }, (_, i) => ({ ...token(offset+i+1, profileA),
      ownerAddress: profileB, viewedProfileIsCollectionCreator: true, creatorAttributionLevel: 'contract',
      creators: [{ address: profileA }] })), complete: offset + 24 >= 5000, resolved: Math.min(offset+24,5000), total: 5000, failures: 0 };
  }
};
lsp8CollectionMetadataResolver.resolve = async (_contract, assets) => {
  probe.metadataIds.push(...assets.map(asset => asset.id));
  await gate;
  return new Map(assets.map(asset => [asset.tokenId, { name: `Fresh ${asset.name}`, description: 'Current metadata',
    images: [{ url: 'https://assets.inscape.test/new.webp', width: 640, height: 640 }], attributes: [],
    metadataSource: 'LSP4MetadataForTokenId (DIRECT LUKSO RPC)' }]));
};
resetLibraryStoreForTests(profileA, localStorage);
if (!useLibraryStore.getState().workspace.folders.length) {
  const id = useLibraryStore.getState().createFolder('Curated');
  useLibraryStore.getState().setFolderAsset(id, token(4501,profileA).id, true);
  useLibraryStore.getState().setFolderAsset(id, token(4502,profileA).id, true);
}
function Profile({ profile }) {
  const [open, setOpen] = useState(true);
  const [preferences] = useState(() => createEditorPreferencesStore({ profile, storage: localStorage, delay: 0 }));
  const workspaceRef = useRef(null);
  const browser = useOwnerLatticeBrowser(profile, open);
  probe.data = browser.data;
  return <><button style={{ position: 'fixed', right: 0, top: 0, zIndex: 2147483647 }} onClick={() => setOpen(value => !value)}>{open ? 'Close fixture Library' : 'Open fixture Library'}</button>
    <main ref={workspaceRef} className="system-workflow" data-lattice-menu-surface data-menu-surface="paper"
      data-layout={innerWidth < 800 ? 'narrow' : 'wide'} data-library-open={open || undefined}>
      <OwnerSystemWorkflowLibraryWorkspace placementScope={`${profile}:fixture`} data={browser.data}
        categoryCommands={browser.commands} preferenceStore={preferences.section('library')}
        workspaceRef={workspaceRef} menuSurface="paper" onClose={() => setOpen(false)} phase={open ? 'open' : 'closed'} />
    </main></>;
}
function Fixture() {
  const [profile,setProfile] = useState(profileA);
  return <><button style={{ position: 'fixed', right: 0, top: 28, zIndex: 2147483647 }} onClick={() => setProfile(profileB)}>Switch fixture profile</button><Profile key={profile} profile={profile} /></>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
