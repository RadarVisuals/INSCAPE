import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App.jsx';
import { useWalletStore } from '../src/store/useWalletStore.js';
import { publishedProfileResolutionStore } from '../src/profileDocument/state/publishedProfileResolutionStore.js';
import { luksoProfileDiscoveryRepository } from '../src/profileDiscovery/data/luksoProfileDiscoveryRepository.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { FEATURED_WORLD_PROFILE_ADDRESS } from '../src/startveil/featuredWorld.js';
import '../src/index.css';

const parameters = new URLSearchParams(location.search);
const owner = parameters.get('owner');
const delayed = parameters.has('delay');
const requests = [];
const pending = new Map();
const otherAddress = '0x1111111111111111111111111111111111111111';
const nameFor = (address) => address === FEATURED_WORLD_PROFILE_ADDRESS ? 'Featured artist' : 'Other artist';

useWalletStore.setState({
  authorityLifecycleStatus: 'complete', hostProfileAddress: owner,
  isWalletConnected: Boolean(owner), isHostProfileOwner: Boolean(owner),
  initWallet: async () => {}, initializationError: null,
});
luksoProfileDiscoveryRepository.list = async () => {
  if (parameters.has('directoryError')) throw new Error('Fixture directory unavailable');
  return [otherAddress, FEATURED_WORLD_PROFILE_ADDRESS].map((address) => ({
    address, name: nameFor(address), avatarUrl: null,
  }));
};

function resolution(address, status = 'RESOLVED') {
  const draft = createEmptySystemWorkflowDraft(address);
  draft.grids[0].title = `${nameFor(address)} scene`;
  return {
    address, status,
    document: status === 'RESOLVED' ? buildProfileDocumentV9({
      profileAddress: address, profileIdentity: { name: nameFor(address), avatarUrl: null },
      systemWorkflowDraft: draft, assetRecords: [], createdAt: 1, exportedAt: 2,
    }) : null,
    errorCode: status === 'ERROR' ? 'NETWORK_ERROR' : null,
  };
}

publishedProfileResolutionStore.repository = {
  resolve: async (address) => {
    requests.push(address);
    if (!delayed) return resolution(address);
    return new Promise((resolve) => pending.set(address, resolve));
  },
};

window.__startup = {
  requests, signIns: 0,
  resolve(address, status) { pending.get(address)?.(resolution(address, status)); pending.delete(address); },
};
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
