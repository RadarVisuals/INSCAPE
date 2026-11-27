import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalletClient, custom, encodeFunctionData } from 'viem';
import { lukso } from 'viem/chains';
import { createInscapeWalletClient } from './createInscapeWalletClient.js';

const account = '0x1111111111111111111111111111111111111111';
const address = '0x2222222222222222222222222222222222222222';
const hash = `0x${'ab'.repeat(32)}`;
const abi = [{ type: 'function', name: 'setData', stateMutability: 'nonpayable',
  inputs: [{ name: 'dataKey', type: 'bytes32' }, { name: 'dataValue', type: 'bytes' }], outputs: [] }];
const call = { address, abi, functionName: 'setData', args: [`0x${'cd'.repeat(32)}`, '0x1234'] };

function fixture(create, { chainId = '0x2a', reject } = {}) {
  const requests = [];
  const provider = { async request(request) {
    requests.push(structuredClone(request));
    if (request.method === 'eth_chainId') return chainId;
    if (reject) throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
    if (request.method === 'personal_sign' || request.method === 'eth_sendTransaction') return hash;
    throw new Error(`Unexpected RPC method: ${request.method}`);
  } };
  return { requests, client: create({ account, chain: lukso, transport: custom(provider, { retryCount: 0 }) }) };
}

test('scoped wallet signs upload messages using the same account, encoding and RPC as Viem', async () => {
  for (const message of ['Upload artwork · Inscape', { raw: new Uint8Array([0, 128, 255]) }]) {
    const standard = fixture(createWalletClient), scoped = fixture(createInscapeWalletClient);
    assert.deepEqual(scoped.client.account, standard.client.account);
    assert.equal(scoped.client.chain, standard.client.chain);
    assert.equal(await scoped.client.signMessage({ account: scoped.client.account, message }),
      await standard.client.signMessage({ account: standard.client.account, message }));
    assert.deepEqual(scoped.requests, standard.requests);
    assert.equal(scoped.requests[0].method, 'personal_sign');
    assert.equal(scoped.requests[0].params[1], account);
  }
});

test('scoped wallet preserves contract encoding, sender and chain checks', async () => {
  const standard = fixture(createWalletClient), scoped = fixture(createInscapeWalletClient);
  assert.equal(await scoped.client.writeContract({ ...call, account: scoped.client.account }),
    await standard.client.writeContract({ ...call, account: standard.client.account }));
  assert.deepEqual(scoped.requests, standard.requests);
  const sent = scoped.requests.find(request => request.method === 'eth_sendTransaction').params[0];
  assert.equal(sent.from, account);
  assert.equal(sent.to, address);
  assert.equal(sent.data, encodeFunctionData(call));

  const wrongChain = fixture(createInscapeWalletClient, { chainId: '0x1' });
  await assert.rejects(wrongChain.client.writeContract(call), /does not match the target chain/);
  assert.deepEqual(wrongChain.requests.map(request => request.method), ['eth_chainId']);
});

test('scoped wallet retains native rejection behavior without retrying a signature or write', async () => {
  for (const action of [client => client.signMessage({ message: 'Upload authorization' }), client => client.writeContract(call)]) {
    const standard = fixture(createWalletClient, { reject: true }), scoped = fixture(createInscapeWalletClient, { reject: true });
    const failure = async client => {
      let caught;
      await assert.rejects(action(client), error => { caught = error; return true; });
      return caught;
    };
    const expected = await failure(standard.client), actual = await failure(scoped.client);
    assert.equal(actual.name, expected.name);
    assert.equal(actual.shortMessage, expected.shortMessage);
    assert.deepEqual(scoped.requests, standard.requests);
    assert.equal(scoped.requests.filter(request => request.method !== 'eth_chainId').length, 1);
  }
});
