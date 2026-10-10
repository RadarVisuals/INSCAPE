import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = 'https://auth.openai.com';
const resource = 'https://api.openai.com/v1';
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
const scope = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random = () => randomBytes(32).toString('base64url');
const timeout = () => AbortSignal.timeout(20_000);

export async function verifyIdentity(token, clientId, nonce, keySet = jwks) {
  const { payload } = await jwtVerify(token, keySet, { issuer, audience: clientId, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'] });
  if (payload.nonce !== nonce) throw new Error('The sign-in response could not be verified. Please try again.');
  return payload;
}

// Only this public installation identifier is persisted. OAuth credentials and
// conversations deliberately live in server memory for this local experiment.
export async function getHostId() {
  const directory = join(process.env.LOCALAPPDATA || join(homedir(), '.config'), 'Inscape', 'keeper-chatgpt');
  const path = join(directory, 'host-id');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try { await writeFile(path, `urn:uuid:${randomUUID()}`, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const id = (await readFile(path, 'utf8')).trim();
  if (!/^urn:uuid:[0-9a-f-]{36}$/i.test(id)) throw new Error('The local ChatGPT installation ID is invalid.');
  return id;
}

export function createChatgptAuth({ fetcher = fetch, verify = verifyIdentity, hostId = getHostId } = {}) {
  let installationId;
  const post = async (path, data) => {
    const response = await fetcher(`${issuer}/api/accounts/${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data), signal: timeout() });
    if (!response.ok) throw new Error('OpenAI could not complete the account request. Reconnect and try again.');
    return path === 'oauth/revoke' ? null : response.json();
  };
  const credentials = (tokens, previous = {}) => {
    if (typeof tokens.access_token !== 'string' || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0)
      throw new Error('OpenAI returned an incomplete sign-in. Please reconnect.');
    return { ...previous, accessToken: tokens.access_token, refreshToken: tokens.refresh_token || previous.refreshToken,
      scopes: typeof tokens.scope === 'string' ? tokens.scope.split(' ') : previous.scopes || [],
      expiresAt: Date.now() + tokens.expires_in * 1000 };
  };
  return {
    async start(previous, complete) {
      const state = random(), nonce = random(), verifier = random();
      const installation = await (installationId ||= hostId().catch(error => { installationId = null; throw error; }));
      let pending = true, redirectUri, timer;
      const cancel = () => { pending = false; clearTimeout(timer); server.close(); };
      const server = createServer(async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        const url = new URL(request.url, redirectUri);
        if (request.method !== 'GET' || url.pathname !== '/auth/callback' || url.searchParams.get('state') !== state || !pending) {
          response.writeHead(400); response.end('This sign-in attempt is not valid. Return to Inscape and try again.'); return;
        }
        pending = false; clearTimeout(timer);
        try {
          if (url.searchParams.has('error')) throw new Error('Sign-in was not completed. You can try again in Inscape.');
          const clientId = url.searchParams.get('client_id') || previous?.clientId;
          if (!clientId || clientId === 'dynamic_agent_client' || clientId.length > 200 || (previous?.clientId && clientId !== previous.clientId))
            throw new Error('OpenAI did not return the expected account registration. Please reconnect.');
          // Retain registration across a failed exchange, but never activate it
          // until the signature, audience, nonce, and account identity check pass.
          complete({ registration: { clientId, subject: previous?.subject } });
          const code = url.searchParams.get('code');
          if (!code || code.length > 8192) throw new Error('OpenAI did not return an authorization code.');
          const tokens = await post('oauth/token', { grant_type: 'authorization_code', client_id: clientId,
            code, code_verifier: verifier, redirect_uri: redirectUri, resource });
          const identity = await verify(tokens.id_token, clientId, nonce);
          if (previous?.subject && identity.sub !== previous.subject) throw new Error('The returned account does not match this connection.');
          const account = credentials(tokens, { clientId, subject: identity.sub, email: identity.email || '', name: identity.name || '' });
          complete({ account });
          // Redirect strips authorization code and state from the visible URL.
          response.writeHead(303, { Location: '/connected' }); response.end();
        } catch (error) {
          complete({ error: error.message });
          response.writeHead(303, { Location: '/failed' }); response.end();
        }
        server.removeAllListeners('request');
        server.on('request', (_request, result) => {
          result.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
          result.end('<!doctype html><meta charset="utf-8"><title>Return to Inscape</title><h1>Return to Inscape</h1><p>Your sign-in result is shown beside Keeper. You can close this tab.</p>');
          setTimeout(() => server.close(), 500).unref();
        });
        timer = setTimeout(cancel, 30_000); timer.unref();
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      redirectUri = `http://127.0.0.1:${server.address().port}/auth/callback`;
      timer = setTimeout(() => { cancel(); complete({ error: 'Sign-in expired. Please try again.' }); }, 15 * 60_000); timer.unref();
      const url = new URL(`${issuer}/api/accounts/authorize`);
      url.search = new URLSearchParams({ client_id: previous?.clientId || 'dynamic_agent_client',
        ...(!previous?.clientId && { agent_name_hint: 'Inscape Keeper' }), ext_agent_host_id: installation,
        response_type: 'code', redirect_uri: redirectUri, scope, resource, state, nonce,
        code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
      return { url: url.href, cancel };
    },
    async refresh(account) {
      if (account.expiresAt > Date.now() + 60_000) return account;
      if (!account.refreshToken) throw new Error('Your connection expired. Reconnect with ChatGPT.');
      return credentials(await post('oauth/token', { grant_type: 'refresh_token', client_id: account.clientId,
        refresh_token: account.refreshToken, resource }), account);
    },
    async revoke(account) {
      if (account?.refreshToken) await post('oauth/revoke', { token: account.refreshToken, token_type_hint: 'refresh_token', client_id: account.clientId });
    },
  };
}
