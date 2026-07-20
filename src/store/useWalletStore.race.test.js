import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { ERC725 } from '@erc725/erc725.js';
import { resetWalletStoreForTests, useWalletStore } from './useWalletStore.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const CONTROLLER_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTROLLER_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const originalFetchData = ERC725.prototype.fetchData;
const originalGetPermissions = ERC725.prototype.getPermissions;

function deferred() {
  let resolve; let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

function profileResult(name) {
  return { value: { LSP3Profile: { name, description: '', profileImage: [], backgroundImage: [], tags: [], links: [] } } };
}

afterEach(() => {
  ERC725.prototype.fetchData = originalFetchData;
  if (originalGetPermissions) ERC725.prototype.getPermissions = originalGetPermissions;
  else delete ERC725.prototype.getPermissions;
  resetWalletStoreForTests();
});

test('profile A metadata cannot commit after the active host changes to profile B', async () => {
  resetWalletStoreForTests();
  const requests = new Map([[PROFILE_A, deferred()], [PROFILE_B, deferred()]]);
  ERC725.prototype.fetchData = function () { return requests.get(this.options.address.toLowerCase()).promise; };
  const clientA = { transport: { url: 'http://chain-a' } };
  const clientB = { transport: { url: 'http://chain-b' } };

  useWalletStore.setState({ hostProfileAddress: PROFILE_A, publicClient: clientA, chainId: '0x2a' });
  const requestA = useWalletStore.getState().fetchProfileMetadata();
  useWalletStore.setState({ hostProfileAddress: PROFILE_B, publicClient: clientB, chainId: '0x1069', profileMetadata: null, lastFetchedAddress: null });
  const requestB = useWalletStore.getState().fetchProfileMetadata();

  requests.get(PROFILE_A).resolve(profileResult('Profile A'));
  await requestA;
  assert.equal(useWalletStore.getState().profileMetadata, null);
  assert.equal(useWalletStore.getState().isProfileLoading, true);

  requests.get(PROFILE_B).resolve(profileResult('Profile B'));
  await requestB;
  assert.equal(useWalletStore.getState().profileMetadata.name, 'Profile B');
});

test('an old permission result cannot grant ownership after controller, profile, and chain change', async () => {
  resetWalletStoreForTests();
  const permissionA = deferred(); const permissionB = deferred();
  ERC725.prototype.getPermissions = function (controller) {
    return controller.toLowerCase() === CONTROLLER_A ? permissionA.promise : permissionB.promise;
  };
  ERC725.prototype.fetchData = async () => { throw new Error('metadata unavailable'); };
  const clientA = { transport: { url: 'http://chain-a' } };
  const clientB = { transport: { url: 'http://chain-b' } };

  useWalletStore.setState({ accounts: [CONTROLLER_A], contextAccounts: [PROFILE_A], hostProfileAddress: PROFILE_A, publicClient: clientA, chainId: '0x2a' });
  const oldRequest = useWalletStore.getState()._checkPermissions();
  useWalletStore.setState({ accounts: [CONTROLLER_B], contextAccounts: [PROFILE_B], publicClient: clientB, chainId: '0x2a', isHostProfileOwner: true, loggedInUserUPAddress: PROFILE_A });
  const contextChange = useWalletStore.getState()._updateConnectionStatus();

  assert.equal(useWalletStore.getState().isHostProfileOwner, false, 'new context fails closed while unresolved');
  assert.equal(useWalletStore.getState().loggedInUserUPAddress, null);
  permissionA.resolve({ SUPER_SETDATA: true });
  await oldRequest;
  assert.equal(useWalletStore.getState().isHostProfileOwner, false, 'old grant is ignored');

  permissionB.reject(new Error('permission lookup failed'));
  await contextChange;
  assert.equal(useWalletStore.getState().isHostProfileOwner, false, 'failed current lookup remains closed');
  assert.equal(useWalletStore.getState().loggedInUserUPAddress, null);
});

test('failed metadata resolution clears deduplication and can be retried', async () => {
  resetWalletStoreForTests();
  let attempts = 0;
  ERC725.prototype.fetchData = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary failure');
    return profileResult('Retried profile');
  };
  useWalletStore.setState({ hostProfileAddress: PROFILE_A, publicClient: { transport: { url: 'http://chain-a' } }, chainId: '0x2a' });

  await useWalletStore.getState().fetchProfileMetadata();
  assert.equal(useWalletStore.getState().lastFetchedAddress, null);
  await useWalletStore.getState().fetchProfileMetadata();
  assert.equal(attempts, 2);
  assert.equal(useWalletStore.getState().profileMetadata.name, 'Retried profile');
});
