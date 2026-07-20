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
  PublishedProfileAvailabilityError,
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

test('hash-valid published content with an insecure asset URL is INVALID', async () => {
  const document = documentFor(); document.profile.cachedIdentity.avatarUrl = 'http://images.example/avatar.png';
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  const result = await repositoryFor({ value: pointerFor(bytes), chunks: [bytes] }).resolve(PROFILE_A);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.INVALID);
  assert.equal(result.errorCode, 'INVALID_DOCUMENT');
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
  await assert.rejects(() => repositoryFor({ value: pointerFor(bytes), fetchImpl: async () => { throw new Error('gateway offline'); } }).resolve(PROFILE_A),
    (error) => error instanceof PublishedProfileAvailabilityError && error.code === 'GATEWAY_UNAVAILABLE');
  const repository = createLuksoPublishedProfileRepository({ fetchImpl: async () => { throw new Error('rpc offline'); } });
  await assert.rejects(() => repository.resolve(PROFILE_A),
    (error) => error instanceof PublishedProfileAvailabilityError && error.code === 'RPC_UNAVAILABLE');
});

test('never-settling RPC times out, aborts, and falls back once per deduplicated endpoint', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor())); const pointer = pointerFor(bytes);
  const calls = []; let primaryAborted = false;
  const repository = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc-one.test/',
    rpcFallbackUrls: ['https://rpc-one.test', 'https://rpc-two.test'], ipfsGateway: 'https://gateway.test/ipfs',
    timeouts: { rpcResponseMs: 8 }, dataReader: (_address, { rpcUrl, signal }) => {
      calls.push(rpcUrl);
      if (rpcUrl === 'https://rpc-one.test') return new Promise(() => signal.addEventListener('abort', () => { primaryAborted = true; }, { once: true }));
      return pointer;
    }, fetchImpl: async () => streamResponse([bytes]) });
  const result = await repository.resolve(PROFILE_A);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.RESOLVED); assert.equal(primaryAborted, true);
  assert.deepEqual(calls, ['https://rpc-one.test', 'https://rpc-two.test']);
});

test('RPC rate-limit and server failures fall back while caller abort never does', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor())); const pointer = pointerFor(bytes);
  for (const status of [429, 503]) {
    const calls = [];
    const repository = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc-one.test', rpcFallbackUrls: 'https://rpc-two.test',
      ipfsGateway: 'https://gateway.test/ipfs', fetchImpl: async (url) => {
        calls.push(url);
        if (url === 'https://rpc-one.test') return new Response('', { status });
        if (url === 'https://rpc-two.test') return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1,
          result: encodeFunctionResult({ abi: [{ type: 'function', name: 'getData', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bytes' }] }], functionName: 'getData', result: pointer }) }));
        return streamResponse([bytes]);
      } });
    assert.equal((await repository.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.RESOLVED);
    assert.deepEqual(calls.slice(0, 2), ['https://rpc-one.test', 'https://rpc-two.test']);
  }
  const controller = new AbortController(); const calls = [];
  const repository = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc-one.test', rpcFallbackUrls: 'https://rpc-two.test',
    dataReader: (_address, { rpcUrl }) => { calls.push(rpcUrl); controller.abort(); return new Promise(() => {}); } });
  await assert.rejects(() => repository.resolve(PROFILE_A, { signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(calls, ['https://rpc-one.test']);
});

test('RPC no-pointer requires every endpoint and conflicting pointers fail closed', async () => {
  const endpoints = ['https://rpc-one.test', 'https://rpc-two.test']; let reads = 0;
  const unavailable = createLuksoPublishedProfileRepository({ rpcUrl: endpoints[0], rpcFallbackUrls: endpoints[1],
    dataReader: () => { reads += 1; return '0x'; } });
  assert.equal((await unavailable.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.UNAVAILABLE); assert.equal(reads, 2);
  const partial = createLuksoPublishedProfileRepository({ rpcUrl: endpoints[0], rpcFallbackUrls: endpoints[1],
    dataReader: (_address, { rpcUrl }) => rpcUrl === endpoints[0] ? '0x' : Promise.reject(new Error('offline')) });
  await assert.rejects(() => partial.resolve(PROFILE_A), (error) => error.code === 'RPC_UNAVAILABLE');
  const one = pointerFor(new Uint8Array([1])); const two = pointerFor(new Uint8Array([2]));
  const conflict = createLuksoPublishedProfileRepository({ rpcUrl: endpoints[0], rpcFallbackUrls: endpoints[1],
    dataReader: (_address, { rpcUrl }) => rpcUrl === endpoints[0] ? one : two });
  const result = await conflict.resolve(PROFILE_A);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.INVALID); assert.equal(result.errorCode, 'RPC_POINTER_CONFLICT');
});

test('gateway response and body timeouts abort or cancel before safe fallback', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor())); const value = pointerFor(bytes);
  let responseAbort = false; const urls = [];
  const responseTimeout = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc.test', dataReader: () => value,
    ipfsGateway: 'https://gateway-one.test/ipfs', ipfsGatewayFallbackUrls: 'https://gateway-two.test/ipfs',
    timeouts: { gatewayResponseMs: 8 }, fetchImpl: (url, { signal }) => {
      urls.push(url);
      if (url.startsWith('https://gateway-one.test')) return new Promise(() => signal.addEventListener('abort', () => { responseAbort = true; }, { once: true }));
      return streamResponse([bytes]);
    } });
  assert.equal((await responseTimeout.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  assert.equal(responseAbort, true); assert.equal(urls.length, 2);

  let cancelled = false;
  const bodyTimeout = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc.test', dataReader: () => value,
    ipfsGateway: 'https://gateway-one.test/ipfs', ipfsGatewayFallbackUrls: 'https://gateway-two.test/ipfs',
    timeouts: { documentReadMs: 8 }, fetchImpl: async (url) => url.startsWith('https://gateway-one.test')
      ? new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes.subarray(0, 10)); }, cancel() { cancelled = true; } }))
      : streamResponse([bytes]) });
  assert.equal((await bodyTimeout.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.RESOLVED); assert.equal(cancelled, true);
});

test('gateway HTTP availability failure falls back without weakening verification', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor())); let calls = 0;
  const repository = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc.test', dataReader: () => pointerFor(bytes),
    ipfsGateway: 'https://gateway-one.test/ipfs', ipfsGatewayFallbackUrls: 'https://gateway-two.test/ipfs',
    fetchImpl: async () => { calls += 1; return calls === 1 ? new Response('', { status: 429 }) : streamResponse([bytes]); } });
  assert.equal((await repository.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.RESOLVED); assert.equal(calls, 2);
});

test('gateway hash mismatch never parses bad bytes and a later exact response resolves', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor())); const bad = new TextEncoder().encode('{"private":"bad"}');
  const urls = [];
  const repository = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc.test', dataReader: () => pointerFor(bytes),
    ipfsGateway: 'https://gateway-one.test/ipfs/', ipfsGatewayFallbackUrls: ['https://gateway-one.test/ipfs', 'https://gateway-two.test/ipfs/'],
    fetchImpl: async (url) => { urls.push(url); return streamResponse([url.startsWith('https://gateway-one.test') ? bad : bytes]); } });
  const result = await repository.resolve(PROFILE_A);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.RESOLVED); assert.deepEqual(urls, [
    'https://gateway-one.test/ipfs/bafy-profile/document.json', 'https://gateway-two.test/ipfs/bafy-profile/document.json']);
});

test('successful attempts clear timers and exhausted timeout is bounded', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(documentFor())); const value = pointerFor(bytes); const signals = [];
  const repository = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc.test', dataReader: (_address, { signal }) => { signals.push(signal); return value; },
    ipfsGateway: 'https://gateway.test/ipfs', timeouts: { rpcResponseMs: 8, gatewayResponseMs: 8, documentReadMs: 8 },
    fetchImpl: async (_url, { signal }) => { signals.push(signal); return streamResponse([bytes]); } });
  assert.equal((await repository.resolve(PROFILE_A)).status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  await new Promise((resolve) => setTimeout(resolve, 15)); assert.equal(signals.every((signal) => !signal.aborted), true);
  let aborted = false;
  const exhausted = createLuksoPublishedProfileRepository({ rpcUrl: 'https://rpc.test', timeouts: { rpcResponseMs: 8 },
    dataReader: (_address, { signal }) => new Promise(() => signal.addEventListener('abort', () => { aborted = true; }, { once: true })) });
  await assert.rejects(() => exhausted.resolve(PROFILE_A), (error) => error.code === 'RPC_TIMEOUT'); assert.equal(aborted, true);
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
  assert.match(boundary, /className="published-profile-retry"/);
  assert.match(boundary, /aria-busy=\{state\?\.busy\}/);
  assert.match(boundary, /state\?\.status !== PUBLISHED_PROFILE_STATUS\.LOADING/);
  assert.doesNotMatch(boundary, /wallet|publish\(|useWalletStore|profileDocumentStorage/);
});
