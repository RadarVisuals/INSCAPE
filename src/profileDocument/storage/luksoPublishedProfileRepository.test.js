import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { encodeDataSourceWithHash, encodeKeyName } from '@erc725/erc725.js';
import { encodeFunctionResult, keccak256 } from 'viem';
import { buildProfileDocumentV3 } from '../domain/profileDocumentBuilder.js';
import { PROFILE_DOCUMENT_LIMITS } from '../domain/constants.js';
import {
  createLuksoPublishedProfileRepository,
  OS_UNDERNEATH_PROFILE_DOCUMENT_KEY,
  OS_UNDERNEATH_PROFILE_DOCUMENT_KEY_NAME,
  PUBLISHED_PROFILE_STATUS
} from './luksoPublishedProfileRepository.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';

function documentFor(address = PROFILE_A) {
  return buildProfileDocumentV3({ profileAddress: address,
    workspace: { version: 3, profileAddress: address, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
    assets: [], publicPresentation: { keeperId: 'abyssal_eye', stageId: 'black' },
    signalSettings: { notifications: true, speech: true, visualEffects: true, audio: false },
    profileIdentity: { name: 'Published profile' }, documentId: 'profile:published', revision: 1, createdAt: 1, exportedAt: 2 });
}

const streamResponse = (chunks, options = {}) => new Response(new ReadableStream({ start(controller) {
  for (const chunk of chunks) controller.enqueue(chunk); controller.close();
} }), { status: 200, headers: options.headers });

function pointerFor(bytes, uri = 'ipfs://bafy-profile/document.json') {
  return encodeDataSourceWithHash({ method: 'keccak256(bytes)', data: keccak256(bytes) }, uri);
}

function repositoryFor({ value, chunks, fetchImpl } = {}) {
  return createLuksoPublishedProfileRepository({ ipfsGateway: 'https://gateway.test/ipfs/',
    dataReader: async () => value,
    fetchImpl: fetchImpl || (async () => streamResponse(chunks)) });
}

test('the frozen singleton key is the LSP2 hash of its key name', () => {
  assert.equal(OS_UNDERNEATH_PROFILE_DOCUMENT_KEY_NAME, 'OSUnderneathProfileDocument');
  assert.equal(OS_UNDERNEATH_PROFILE_DOCUMENT_KEY, '0x4a5b4ddee4f353a47d88a0ad908a9ff0bee45f7d31158b2d79ddafd15817cb4e');
  assert.equal(encodeKeyName(OS_UNDERNEATH_PROFILE_DOCUMENT_KEY_NAME), OS_UNDERNEATH_PROFILE_DOCUMENT_KEY);
});

test('empty ERC725Y data is unavailable without a gateway request', async () => {
  let fetched = false;
  const result = await repositoryFor({ value: '0x', fetchImpl: async () => { fetched = true; } }).resolve(PROFILE_A);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE); assert.equal(fetched, false);
});

test('matching exact bytes, valid schema, and matching authority resolve a detached document', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor()));
  const result = await repositoryFor({ value: pointerFor(bytes), chunks: [bytes.subarray(0, 40), bytes.subarray(40)] }).resolve(PROFILE_A);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  assert.deepEqual(result.document, documentFor()); assert.notStrictEqual(result.document, documentFor());
});

test('the default reader requests the singleton key through mocked ERC725Y RPC', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor()));
  const pointer = pointerFor(bytes); let rpcBody;
  const repository = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc.test', ipfsGateway: 'https://gateway.test/ipfs/',
    fetchImpl: async (url, options) => {
      if (url === 'https://rpc.test') {
        rpcBody = JSON.parse(options.body);
        const result = encodeFunctionResult({ abi: [{ type: 'function', name: 'getData', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bytes' }] }], functionName: 'getData', result: pointer });
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return streamResponse([bytes]);
    } });
  const result = await repository.resolve(PROFILE_A);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  assert.equal(rpcBody.method, 'eth_call'); assert.equal(rpcBody.params[0].to, PROFILE_A);
  assert.match(rpcBody.params[0].data, new RegExp(OS_UNDERNEATH_PROFILE_DOCUMENT_KEY.slice(2), 'i'));
});

test('hash mismatch, malformed pointers, and unsafe URI schemes are invalid', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor()));
  const wrongHash = encodeDataSourceWithHash({ method: 'keccak256(bytes)', data: `0x${'00'.repeat(32)}` }, 'ipfs://bafy-profile');
  assert.equal((await repositoryFor({ value: wrongHash, chunks: [bytes] }).resolve(PROFILE_A)).errorCode, 'HASH_MISMATCH');
  assert.equal((await repositoryFor({ value: '0x1234', chunks: [bytes] }).resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.INVALID);
  assert.equal((await repositoryFor({ value: pointerFor(bytes, 'https://example.test/profile.json'), chunks: [bytes] }).resolve(PROFILE_A)).errorCode, 'UNSAFE_URI');
});

test('oversized content is rejected during streaming and cancels before later chunks', async () => {
  const limit = PROFILE_DOCUMENT_LIMITS.maxJsonBytes; let pulls = 0; let cancelled = false;
  const response = new Response(new ReadableStream({ pull(controller) {
    pulls += 1; controller.enqueue(new Uint8Array(limit / 2 + 1));
  }, cancel() { cancelled = true; } }));
  const value = encodeDataSourceWithHash({ method: 'keccak256(bytes)', data: `0x${'11'.repeat(32)}` }, 'ipfs://bafy-large');
  const result = await repositoryFor({ value, fetchImpl: async () => response }).resolve(PROFILE_A);
  assert.equal(result.errorCode, 'OVERSIZED_DOCUMENT'); assert.equal(cancelled, true); assert.ok(pulls >= 2);
});

test('invalid JSON, unsupported versions, validation failures, and profile mismatch are invalid', async () => {
  const invalidInputs = [
    new TextEncoder().encode('{bad json'),
    new TextEncoder().encode(JSON.stringify({ ...documentFor(), version: 99 })),
    new TextEncoder().encode(JSON.stringify({ ...documentFor(), metadata: { privateRuntime: true } })),
    new TextEncoder().encode(JSON.stringify(documentFor(PROFILE_B)))
  ];
  for (const bytes of invalidInputs) {
    const result = await repositoryFor({ value: pointerFor(bytes), chunks: [bytes] }).resolve(PROFILE_A);
    assert.equal(result.status, PUBLISHED_PROFILE_STATUS.INVALID);
  }
});

test('gateway and RPC failures remain transient errors for the resolution layer', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor()));
  await assert.rejects(() => repositoryFor({ value: pointerFor(bytes), fetchImpl: async () => { throw new Error('gateway offline'); } }).resolve(PROFILE_A), /offline/);
  const repository = createLuksoPublishedProfileRepository({ fetchImpl: async () => { throw new Error('rpc offline'); } });
  await assert.rejects(() => repository.resolve(PROFILE_A), /rpc offline/);
});

test('published rendering sources cannot access local workspace, signals, runtime windows, or persistence', () => {
  const boundary = readFileSync(new URL('../components/PublishedProfileBoundary.jsx', import.meta.url), 'utf8');
  const preview = readFileSync(new URL('../components/PublishedProfileDocumentPreview.jsx', import.meta.url), 'utf8');
  const surface = readFileSync(new URL('../components/ProfileDocumentSurface.jsx', import.meta.url), 'utf8');
  const space = readFileSync(new URL('../components/PublishedProfileDocumentSpaceWindow.jsx', import.meta.url), 'utf8');
  const sources = `${boundary}\n${preview}\n${surface}\n${space}`;
  for (const forbidden of ['useLibraryStore', 'useSignalStore', 'localStorage', 'runtimeWindow', 'profileDocumentStorage', 'ModuleGridShell']) {
    assert.equal(sources.includes(forbidden), false, forbidden);
  }
  assert.match(space, /projectDocumentSpace\(space\)/);
});
