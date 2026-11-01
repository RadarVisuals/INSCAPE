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

// Control only this fixture owner's acquisition, while retaining the browser's
// real exclusive lock and the production lease's StrictMode/release lifecycle.
const nativeLocks = navigator.locks;
const leaseRequests = [];
let releaseEditorLease;
const editorLeaseGate = new Promise(resolve => { releaseEditorLease = resolve; });
let editorAccess = parameters.get('editorAccess');
const fixtureLocks = {
  request: async (name, options, callback) => {
    if (owner && name === `inscape:profile-editor:${owner.toLowerCase()}`) {
      leaseRequests.push(name);
      if (parameters.has('delayLease')) await editorLeaseGate;
      if (editorAccess === 'busy') return callback(null);
      if (editorAccess === 'unavailable') throw new Error('Fixture editing access unavailable');
    }
    return nativeLocks.request(name, options, callback);
  },
};
if (owner && (parameters.has('delayLease') || editorAccess)) {
  Object.defineProperty(navigator, 'locks', {
    configurable: true, value: editorAccess === 'unsupported' ? undefined : fixtureLocks,
  });
}

useWalletStore.setState({
  authorityLifecycleStatus: 'complete', hostProfileAddress: owner,
  isWalletConnected: Boolean(owner), isHostProfileOwner: Boolean(owner),
  // This fixture supplies the wallet boundary itself; startup must not clear it
  // when the real connector's persisted account is (deliberately) absent.
  initWallet: async () => {}, disposeWallet: () => {}, initializationError: null,
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
  requests, signIns: 0, leaseRequests, releaseEditorLease,
  allowEditing() {
    editorAccess = null;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: fixtureLocks });
    releaseEditorLease();
  },
  resolve(address, status) { pending.get(address)?.(resolution(address, status)); pending.delete(address); },
};
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
