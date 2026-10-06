import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { createChatgptAuth, verifyIdentity } from './auth.js';
import { createKeeperChatgptService, KEEPER_CHATGPT_PATH } from './service.js';
import { readReply } from './responses.js';
import { readKeeperChatStream } from '../../src/keeper/keeperChatgptClient.js';
import { keeperMetadataReference } from '../../src/keeper/keeperMetadata.js';

const event = data => `data: ${JSON.stringify(data)}\n\n`;
const reply = text => new Response(event({ type: 'response.output_text.delta', delta: text }) + event({ type: 'response.completed' }));
const scopes = ['resource.invoke', 'chatgpt.tokens.use.direct'];
const account = { accessToken: 'SECRET_ACCESS', refreshToken: 'SECRET_REFRESH', clientId: 'oaiapp_test', subject: 'test-person', email: 'test@example.test',
  scopes, expiresAt: Date.now() + 3_600_000 };

test('OIDC validation requires valid signature, issuer, audience, expiration and nonce', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const token = (changes = {}) => new SignJWT({ sub: 'person', nonce: 'expected', iss: 'https://auth.openai.com', aud: 'client', iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60, ...changes }).setProtectedHeader({ alg: 'RS256' }).sign(privateKey);
  assert.equal((await verifyIdentity(await token(), 'client', 'expected', publicKey)).sub, 'person');
  for (const changes of [{ nonce: 'wrong' }, { iss: 'https://example.test' }, { aud: 'other-client' }, { exp: 1 }])
    await assert.rejects(verifyIdentity(await token(changes), 'client', 'expected', publicKey));
  const other = await generateKeyPair('RS256');
  await assert.rejects(verifyIdentity(await token(), 'client', 'expected', other.publicKey));
});

test('loopback OAuth validates state, binds PKCE and issued client ID, and strips callback secrets', async () => {
  const updates = [], calls = [];
  const auth = createChatgptAuth({ hostId: async () => 'urn:uuid:test', verify: async (_token, client, nonce) => {
    assert.equal(client, 'oaiapp_issued'); assert.equal(nonce, authorize.searchParams.get('nonce')); return { sub: 'person', email: 'person@example.test' };
  }, fetcher: async (url, options) => {
    calls.push({ url, data: Object.fromEntries(options.body) });
    return Response.json({ access_token: 'SECRET', refresh_token: 'REFRESH', id_token: 'SIGNED', expires_in: 3600, scope: scopes.join(' ') });
  } });
  const pending = await auth.start(null, result => updates.push(result)), authorize = new URL(pending.url);
  try {
    assert.equal(authorize.origin, 'https://auth.openai.com');
    assert.equal(authorize.searchParams.get('client_id'), 'dynamic_agent_client');
    const callback = new URL(authorize.searchParams.get('redirect_uri'));
    callback.search = new URLSearchParams({ state: 'wrong', code: 'CODE', client_id: 'oaiapp_issued' });
    assert.equal((await fetch(callback)).status, 400); assert.equal(calls.length, 0);
    callback.searchParams.set('state', authorize.searchParams.get('state'));
    const response = await fetch(callback, { redirect: 'manual' });
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/connected');
    assert.equal(calls[0].data.client_id, 'oaiapp_issued');
    assert.equal(calls[0].data.redirect_uri, authorize.searchParams.get('redirect_uri'));
    assert.equal(createHash('sha256').update(calls[0].data.code_verifier).digest('base64url'), authorize.searchParams.get('code_challenge'));
    assert.equal(updates.at(-1).account.subject, 'person');
    assert.equal((await fetch(callback)).status, 200); assert.equal(calls.length, 1, 'callback cannot exchange the same code twice');
  } finally { pending.cancel(); }
});

test('a returning account rejects changed registration and never exchanges its code', async () => {
  let exchanged = false;
  const updates = [];
  const auth = createChatgptAuth({ hostId: async () => 'urn:uuid:test', fetcher: async () => { exchanged = true; throw Error('unexpected'); } });
  const pending = await auth.start({ clientId: 'original', subject: 'person' }, update => updates.push(update));
  try {
    const authorize = new URL(pending.url), callback = new URL(authorize.searchParams.get('redirect_uri'));
    callback.search = new URLSearchParams({ state: authorize.searchParams.get('state'), code: 'CODE', client_id: 'different' });
    await fetch(callback, { redirect: 'manual' });
    assert.equal(exchanged, false); assert.match(updates.at(-1).error, /expected account registration/);
  } finally { pending.cancel(); }
});

test('SSE reply requires completion, handles split UTF-8 and does not accept partial or failed output', async () => {
  const bytes = new TextEncoder().encode(event({ type: 'response.output_text.delta', delta: 'Hello 🐙' }) + event({ type: 'response.completed' }));
  let text = '';
  const fragmented = new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close(); } }));
  assert.equal(await readReply(fragmented, delta => { text += delta; }), 'Hello 🐙'); assert.equal(text, 'Hello 🐙');
  await assert.rejects(readReply(new Response(event({ type: 'response.output_text.delta', delta: 'Partial' })), () => {}), /interrupted/);
  await assert.rejects(readReply(new Response(event({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } })), () => {}), /Manage usage/);
});

async function serve(options) {
  const service = createKeeperChatgptService(options), server = createServer((request, response) => service.middleware(request, response, () => { response.writeHead(404); response.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  return { origin, async call(action, data = {}, extra = {}) {
    const get = action === 'status';
    const response = await fetch(`${origin}${KEEPER_CHATGPT_PATH}/${action}${get ? `?scope=${encodeURIComponent(data.scope || 'keeper-a')}` : ''}`, {
      method: get ? 'GET' : 'POST', headers: { 'X-Inscape-Keeper': '1', Origin: origin, 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }), ...extra },
      ...(!get && { body: JSON.stringify({ scope: 'keeper-a', ...data }) }),
    });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }, async close() { service.dispose(); await new Promise(resolve => server.close(resolve)); } };
}

test('metadata tool round trip is scoped, one-use, preserves reasoning and stores only the spoken reply', async () => {
  const reference = keeperMetadataReference(`42:0x${'a'.repeat(40)}:0x${'0'.repeat(63)}4`, 'LSP8');
  let complete, calls = 0, lookup;
  const reasoning = { type: 'reasoning', id: 'rs_one', summary: [], encrypted_content: 'private-opaque-reasoning' };
  const fixture = await serve({ auth: { async start(_previous, callback) { complete = callback; return { url: 'https://auth.openai.com/', cancel() {} }; },
    async refresh(value) { return value; } }, fetcher: async (url, options) => {
      if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'model-test', display_name: 'Test', visibility: 'list' }] });
      const body = JSON.parse(options.body); calls++;
      let call;
      if (calls === 1) {
        assert.equal(body.tools[0].tools[1].name, 'read_metadata');
        assert.deepEqual(body.include, ['reasoning.encrypted_content']);
        call = { type: 'function_call', id: 'fc_one', call_id: 'call_one', namespace: 'keeper', name: 'read_metadata', arguments: '{"targets":["art-1"]}' };
      } else {
        assert.equal(body.tools[0].tools.length, 1, 'second lookup is not available');
        assert.deepEqual(body.input.at(-3), reasoning);
        assert.equal(body.input.at(-1).type, 'function_call_output');
        assert.equal(body.input.at(-1).call_id, 'call_one');
        assert.equal(JSON.parse(body.input.at(-1).output)[0].description, 'Public description');
        call = { type: 'function_call', id: 'fc_two', call_id: 'call_two', namespace: 'keeper', name: 'respond', arguments: '{"reply":"Read the token description.","gesture":"none","target":"none"}' };
      }
      return new Response((calls === 1 ? event({ type: 'response.output_item.done', item: reasoning }) : '')
        + event({ type: 'response.output_item.added', item: { ...call, arguments: '' } })
        + event({ type: 'response.output_item.done', item: call }) + event({ type: 'response.completed' }));
    } });
  try {
    await fixture.call('connect'); await complete({ account });
    const response = await fixture.call('message', { name: 'Octo', model: 'model-test', message: 'Fetch metadata', passages: [],
      scene: { artworks: [{ id: 'art-1', title: 'Artwork', metadata: reference }] } });
    let text = '';
    await readKeeperChatStream(response, delta => { text += delta; }, async request => {
      lookup = { ...request, results: [{ id: 'art-1', ...reference, status: 'available', source: 'LSP4MetadataForTokenId (DIRECT LUKSO RPC)',
        readAt: Date.now(), description: 'Public description', private: 'do-not-forward' }] };
      assert.equal((await fixture.call('metadata-result', { ...lookup, scope: 'other-keeper' })).status, 409);
      assert.equal((await fixture.call('metadata-result', { ...lookup, requestId: 'wrong' })).status, 409);
      assert.equal((await fixture.call('metadata-result', lookup)).status, 200);
    });
    assert.equal(text, 'Read the token description.'); assert.equal(calls, 2);
    assert.equal((await fixture.call('metadata-result', lookup)).status, 409);
    const status = await (await fixture.call('status')).json();
    assert.equal(status.history.length, 2);
    assert.ok(!JSON.stringify(status).includes('Public description'));
    assert.ok(!JSON.stringify(status).includes('opaque-reasoning'));
  } finally { await fixture.close(); }
});

test('local service isolates cookies and Keepers, keeps secrets out of responses and commits only completed exchanges', async () => {
  let complete, requested, failStream = false;
  const fixture = await serve({ auth: { async start(_previous, callback) { complete = callback; return { url: 'https://auth.openai.com/api/accounts/authorize', cancel() {} }; },
    async refresh(value) { return value; }, async revoke(value) { assert.equal(value.refreshToken, 'SECRET_REFRESH'); } }, fetcher: async (url, options) => {
      if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'model-test', display_name: 'Test model', visibility: 'list' }, { slug: 'hidden', display_name: 'Hidden', visibility: 'hide' }] });
      requested = JSON.parse(options.body); assert.equal(options.headers.Authorization, 'Bearer SECRET_ACCESS');
      return failStream ? new Response(event({ type: 'response.output_text.delta', delta: 'unfinished' })) : reply('Tell me your joke.');
    } });
  try {
    assert.equal((await fixture.call('status', {}, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await fixture.call('status', {}, { 'X-Inscape-Keeper': '' })).status, 403);
    const reboundStatus = await new Promise((resolve, reject) => {
      const request = httpRequest(`${fixture.origin}${KEEPER_CHATGPT_PATH}/status?scope=keeper-a`, { headers: { Host: 'attacker.test', 'X-Inscape-Keeper': '1' } }, response => { response.resume(); resolve(response.statusCode); });
      request.on('error', reject); request.end();
    });
    assert.equal(reboundStatus, 403);
    await fixture.call('connect'); await complete({ account });
    const status = await (await fixture.call('status')).json(); assert.equal(status.status, 'connected'); assert.equal(status.models.length, 1);
    assert.ok(!JSON.stringify(status).includes('SECRET'));
    const isolated = await fetch(`${fixture.origin}${KEEPER_CHATGPT_PATH}/status?scope=keeper-a`, { headers: { 'X-Inscape-Keeper': '1' } });
    assert.equal((await isolated.json()).status, 'disconnected');
    assert.equal((await (await fixture.call('status', { scope: 'keeper-b' })).json()).status, 'disconnected');
    const message = { name: 'Octo', message: 'Hi!', model: 'model-test', passages: ['A keeper of small things.'] };
    assert.equal((await fixture.call('message', { ...message, model: 'hidden' })).status, 400);
    const response = await fixture.call('message', message), text = await response.text();
    assert.match(text, /"done":true/); assert.ok(!text.includes('SECRET'));
    assert.equal(requested.store, false); assert.equal(requested.stream, true); assert.equal(requested.max_output_tokens, undefined);
    assert.equal((await (await fixture.call('status')).json()).history.length, 2);
    await new Promise(resolve => setTimeout(resolve, 1050)); failStream = true;
    assert.match(await (await fixture.call('message', message)).text(), /"error"/);
    assert.equal((await (await fixture.call('status')).json()).history.length, 2, 'failed text never becomes remembered history');
    await fixture.call('disconnect');
    const cleared = await (await fixture.call('status')).json(); assert.equal(cleared.account, null); assert.deepEqual(cleared.history, []);
    assert.equal((await fixture.call('message', message)).status, 401);
  } finally { await fixture.close(); }
});

test('closing a pending login ignores its late completion', async () => {
  let complete;
  const fixture = await serve({ auth: { async start(_previous, callback) { complete = callback; return { url: 'https://auth.openai.com/api/accounts/authorize', cancel() {} }; } } });
  try {
    await fixture.call('connect'); await fixture.call('cancel-login'); await complete({ account });
    assert.equal((await (await fixture.call('status')).json()).status, 'disconnected');
  } finally { await fixture.close(); }
});

test('gesture requests use one namespaced tool and return only a validated completed action', async () => {
  let complete, requested;
  const fixture = await serve({ auth: { async start(_previous, callback) { complete = callback; return { url: 'https://auth.openai.com/api/accounts/authorize', cancel() {} }; },
    async refresh(value) { return value; } }, fetcher: async (url, options) => {
    if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'test-model', display_name: 'Test model', visibility: 'list' }] });
    requested = JSON.parse(options.body);
    const call = { id: 'fc_test', type: 'function_call', namespace: 'keeper', name: 'respond', arguments: JSON.stringify({ reply: 'That does look suspicious. Let me step back.', gesture: 'retreat', target: 'art-1' }) };
    return new Response(event({ type: 'response.output_item.added', item: { ...call, arguments: '' } })
      + event({ type: 'response.output_item.done', item: call }) + event({ type: 'response.completed' }));
  } });
  try {
    await fixture.call('connect'); await complete({ account });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZV8AAAAASUVORK5CYII=';
    const result = await (await fixture.call('message', { name: 'Octo', message: 'Back away from that painting.', passages: [], model: 'test-model',
      images: [{ id: 'art-1', dataUrl: png }],
      scene: { gestures: true, selection: { kind: 'modules', count: 1, complete: true, moduleIds: ['DO_NOT_SEND'] }, artworks: [{ id: 'art-1', title: 'Abyssal study', selected: true, url: 'DO_NOT_SEND' }], secret: 'DO_NOT_SEND' } })).text();
    assert.match(result, /"done":true,"action":\{"gesture":"retreat","target":"art-1"\}/);
    assert.equal(requested.tools[0].name, 'keeper'); assert.equal(requested.tool_choice, 'required'); assert.equal(requested.parallel_tool_calls, false);
    assert.ok(!JSON.stringify(requested).includes('DO_NOT_SEND'));
    assert.equal(requested.input.at(-1).content.at(-1).image_url, png);
    assert.match(requested.instructions, /source-artwork stills/);
    assert.ok(requested.instructions.includes('"selection":{"kind":"modules","count":1,"complete":true}'));
    assert.ok(requested.instructions.includes('"selected":true'));
    const history = (await (await fixture.call('status')).json()).history;
    assert.equal(history.length, 2); assert.equal(history[1].role, 'assistant'); assert.ok(!history[1].content.includes('function_call'));
    assert.ok(!JSON.stringify(history).includes('data:image'), 'image bytes are never retained in history');
  } finally { await fixture.close(); }
});
