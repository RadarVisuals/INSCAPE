import { randomBytes } from 'node:crypto';
import { createChatgptAuth } from './auth.js';
import { OPENAI_API, keeperInstructions, readReply } from './responses.js';
import { keeperReactionContext } from '../../src/keeper/keeperReactions.js';
import { keeperReplyTool } from './reactions.js';
import { keeperImageInputs } from './vision.js';
import { KEEPER_VISION } from '../../src/keeper/keeperVision.js';
import { keeperMetadataTool, requestKeeperMetadata } from './metadata.js';

export const KEEPER_CHATGPT_PATH = '/__keeper-chatgpt';
const cookieName = 'inscape_keeper_chatgpt';
const loopback = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);
const localHost = value => ['127.0.0.1', 'localhost', '[::1]'].includes(value);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const planEnabled = account => account?.scopes?.includes('chatgpt.tokens.use.direct') && account.scopes.includes('resource.invoke');
const send = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(body));
};
async function readBody(request) {
  if (request.headers['content-type'] !== 'application/json') throw fail('Expected a JSON request.');
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    if ((size += chunk.length) > KEEPER_VISION.count * KEEPER_VISION.imageChars + 32_768) throw fail('The message is too large.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('Invalid request.'); }
}

export function createKeeperChatgptService({ auth = createChatgptAuth(), fetcher = fetch } = {}) {
  const sessions = new Map();
  const closeConnection = connection => { connection.ticket = null; connection.refreshing = null; connection.pending?.cancel(); connection.active?.abort(); };
  const clean = setInterval(() => {
    for (const [id, session] of sessions) if (Date.now() - session.touched > 12 * 60 * 60_000) {
      session.connections.forEach(closeConnection); sessions.delete(id);
    }
  }, 60_000); clean.unref();
  const connectionFor = (session, scope) => {
    if (typeof scope !== 'string' || !scope || scope.length > 700) throw fail('Invalid Keeper identity.');
    if (!session.connections.has(scope)) {
      if (session.connections.size >= 12) throw fail('Too many Keeper connections in this session. Restart the local server to clear them.');
      session.connections.set(scope, { history: [], status: 'disconnected', models: [], lastRequest: 0 });
    }
    return session.connections.get(scope);
  };
  const view = connection => ({ status: connection.status, error: connection.error || '',
    account: connection.account ? { email: connection.account.email, name: connection.account.name } : null,
    models: connection.models, history: connection.history, busy: Boolean(connection.active) });
  async function loadModels(connection) {
    if (!planEnabled(connection.account)) throw fail('Allow ChatGPT plan usage when connecting your account.', 401);
    // All refresh/model operations for this connection share one promise, so
    // rotating refresh credentials cannot race between a poll and a send.
    const ticket = connection.ticket;
    if (!connection.refreshing) {
      const operation = (async () => {
      const account = await auth.refresh(connection.account);
      if (!ticket || connection.ticket !== ticket) throw fail('The connection was closed.', 401);
      connection.account = account;
      const response = await fetcher(`${OPENAI_API}/models`, {
        headers: { Authorization: `Bearer ${account.accessToken}` }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw fail('ChatGPT models could not be loaded. Reconnect or try again.', 502);
      const data = await response.json();
      const models = (data.models || []).filter(model => model.visibility === 'list' && typeof model.slug === 'string' && typeof model.display_name === 'string')
        .slice(0, 100).map(model => ({ id: model.slug, name: model.display_name }));
      if (!models.length) throw fail('This account has no available models for ChatGPT plan usage.', 403);
      if (connection.ticket !== ticket) throw fail('The connection was closed.', 401);
      connection.models = models;
      })().finally(() => { if (connection.refreshing === operation) connection.refreshing = null; });
      connection.refreshing = operation;
    }
    await connection.refreshing;
  }
  const middleware = async (request, response, next) => {
    if (!request.url?.startsWith(`${KEEPER_CHATGPT_PATH}/`)) return next();
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('Vary', 'Origin');
    try {
      const origin = `http://${request.headers.host}`, url = new URL(request.url, origin);
      if (!loopback(request.socket.remoteAddress) || !localHost(url.hostname)
        || request.headers['x-inscape-keeper'] !== '1'
        || (request.headers.origin && request.headers.origin !== origin)
        || ['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']))
        throw fail('Keeper AI is available only from this local Inscape session.', 403);
      const action = url.pathname.slice(KEEPER_CHATGPT_PATH.length);
      if (!(request.method === 'GET' && action === '/status') && !(request.method === 'POST' && ['/connect', '/disconnect', '/cancel-login', '/message', '/metadata-result', '/clear', '/models'].includes(action)))
        throw fail('Unknown Keeper request.', 404);
      const cookies = Object.fromEntries((request.headers.cookie || '').split(';').map(part => part.trim().split('=')));
      let id = cookies[cookieName], session = sessions.get(id);
      if (!session) {
        if (sessions.size >= 32) throw fail('Too many local sessions. Restart Inscape’s local server.', 429);
        id = randomBytes(32).toString('base64url'); session = { touched: Date.now(), connections: new Map() }; sessions.set(id, session);
        response.setHeader('Set-Cookie', `${cookieName}=${id}; Path=${KEEPER_CHATGPT_PATH}; HttpOnly; SameSite=Strict`);
      }
      session.touched = Date.now();
      const body = request.method === 'POST' ? await readBody(request) : { scope: url.searchParams.get('scope') };
      const connection = connectionFor(session, body.scope);
      if (action === '/metadata-result') {
        if (!connection.active || !connection.lookup || body.requestId !== connection.lookup.requestId) throw fail('The metadata request is no longer active.', 409);
        connection.lookup.accept(body.results);
        send(response, 200, { accepted: true }); return;
      }
      if (action === '/status') { send(response, 200, view(connection)); return; }
      if (action === '/connect') {
        closeConnection(connection);
        const ticket = connection.ticket = {};
        connection.history = []; connection.models = []; connection.error = ''; connection.status = 'connecting';
        const previous = connection.account || connection.registration;
        connection.account = null;
        connection.pending = await auth.start(previous, async result => {
          if (connection.ticket !== ticket) return;
          if (result.registration) { connection.registration = result.registration; return; }
          if (result.error) { connection.error = result.error; connection.status = 'failed'; return; }
          connection.account = result.account;
          connection.registration = { clientId: result.account.clientId, subject: result.account.subject };
          connection.status = planEnabled(result.account) ? 'loading-models' : 'permission-required';
          if (connection.status === 'permission-required') return;
          try { await loadModels(connection); if (connection.ticket === ticket) connection.status = 'connected'; }
          catch (error) { if (connection.ticket === ticket) { connection.status = 'failed'; connection.error = error.message; } }
        }).catch(error => {
          if (connection.ticket === ticket) { connection.status = 'failed'; connection.error = 'Sign-in could not start. Please try again.'; }
          throw error;
        });
        send(response, 200, { url: connection.pending.url }); return;
      }
      if (action === '/cancel-login') {
        closeConnection(connection); connection.status = 'disconnected'; connection.account = null; connection.error = '';
        send(response, 200, view(connection)); return;
      }
      if (action === '/disconnect') {
        closeConnection(connection);
        const account = connection.account;
        connection.account = null; connection.history = []; connection.models = []; connection.status = 'disconnected'; connection.error = '';
        try { await auth.revoke(account); }
        catch { connection.error = 'Disconnected locally. Remote revocation could not be confirmed; remove Inscape Keeper in ChatGPT settings.'; }
        send(response, 200, view(connection)); return;
      }
      if (action === '/clear') {
        connection.active?.abort(); connection.history = []; send(response, 200, view(connection)); return;
      }
      if (action === '/models') {
        await loadModels(connection); connection.status = 'connected'; connection.error = ''; send(response, 200, view(connection)); return;
      }
      if (connection.status !== 'connected' || !planEnabled(connection.account)) throw fail('Connect your ChatGPT account first.', 401);
      if (connection.active || Date.now() - connection.lastRequest < 1000) throw fail('Wait for Keeper’s current reply first.', 429);
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) throw fail('Use a message of 1–2000 characters.');
      if (typeof body.name !== 'string' || body.name.length > 48 || !Array.isArray(body.passages)) throw fail('Invalid character context.');
      if (!connection.models.some(model => model.id === body.model)) throw fail('Choose a model available to your account.');
      const controller = connection.active = new AbortController(), ticket = connection.ticket;
      connection.lastRequest = Date.now();
      const abort = () => controller.abort(); response.once('close', abort);
      try {
        if (connection.account.expiresAt < Date.now() + 60_000) await loadModels(connection);
        controller.signal.throwIfAborted();
        const message = { role: 'user', content: body.message.trim() };
        const scene = keeperReactionContext(body.scene);
        const imageInputs = keeperImageInputs(body.images, scene);
        const currentMessage = imageInputs.length ? { role: 'user', content: [{ type: 'input_text', text: message.content }, ...imageInputs] } : message;
        const input = [...connection.history.slice(-24), currentMessage];
        const metadataTool = keeperMetadataTool(scene);
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(150_000)]);
        const emit = event => { if (!response.destroyed) response.write(`${JSON.stringify(event)}\n`); };
        let result;
        // One optional metadata read followed by one final reply. Tool/reasoning
        // output is carried within this turn only, never into session history.
        for (let round = 0; round < 2; round++) {
          const tool = scene ? keeperReplyTool(scene) : null;
          if (round === 0 && metadataTool) tool.tools.push(metadataTool);
          const upstream = await fetcher(`${OPENAI_API}/responses`, { method: 'POST',
            headers: { Authorization: `Bearer ${connection.account.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: body.model, instructions: keeperInstructions(body.name, body.passages, scene, imageInputs.length > 0),
              ...(tool && { tools: [tool], tool_choice: 'required', parallel_tool_calls: false }),
              ...(metadataTool && { include: ['reasoning.encrypted_content'] }), input, store: false, stream: true }), signal });
          if (!response.headersSent) response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Accel-Buffering': 'no' });
          result = await readReply(upstream, delta => emit({ delta }), scene, round === 0 && Boolean(metadataTool));
          if (!result?.lookup) break;
          const results = await requestKeeperMetadata(connection, result.lookup.targets, scene, signal, emit);
          signal.throwIfAborted();
          input.push(...result.output, { type: 'function_call_output', call_id: result.lookup.callId, output: JSON.stringify(results) });
        }
        const text = scene ? result.text : result;
        if (connection.ticket === ticket && !controller.signal.aborted) {
          connection.history = [...connection.history, message, { role: 'assistant', content: text }].slice(-24);
          response.end(`${JSON.stringify({ done: true, ...(scene && { action: result.action }) })}\n`);
        }
      } finally {
        controller.abort(); response.removeListener('close', abort);
        if (connection.active === controller) connection.active = null;
      }
    } catch (error) {
      if (response.destroyed) return;
      const message = error.name === 'TimeoutError' ? 'Keeper’s reply took too long. Please try again.'
        : error.name === 'AbortError' ? 'The reply was stopped.' : error.message || 'The local ChatGPT service could not finish the request.';
      if (response.headersSent) response.end(`${JSON.stringify({ error: message })}\n`);
      else send(response, error.status || 502, { error: message });
    }
  };
  return { middleware, dispose() { clearInterval(clean); sessions.forEach(session => session.connections.forEach(closeConnection)); sessions.clear(); } };
}

export function keeperChatgptPlugin() {
  let service;
  return { name: 'keeper-chatgpt-local', apply: 'serve',
    configureServer(server) {
      service = createKeeperChatgptService(); server.middlewares.use(service.middleware);
      server.httpServer?.once('close', () => service.dispose());
    },
    closeBundle() { service?.dispose(); },
  };
}
