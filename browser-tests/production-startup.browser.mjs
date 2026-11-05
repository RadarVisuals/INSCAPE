import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { analyzeProductionBuild } from '../scripts/productionBuild.js';
const root=resolve(import.meta.dirname,'..');
const productionDirectory=resolve(root,process.env.INSCAPE_PRODUCTION_DIR || 'dist');
const output=resolve(process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/production-startup');

test('mobile runtime loads only after explicit choice on desktop and phone, and load failure remains recoverable', { timeout: 30000 }, async () => {
  const report = await analyzeProductionBuild(productionDirectory);
  const graph = JSON.parse(await readFile(resolve(productionDirectory, 'owner-runtime-graph.json'), 'utf8'));
  assert.ok(graph.mobileWalletFiles?.length);
  const mobileFiles = new Set(graph.mobileWalletFiles.map(file => '/' + file));
  const server = await preview({ root, build: { outDir: productionDirectory }, preview: { host: '127.0.0.1', port: 0, open: false } });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const phone of [false, true]) {
      const context = await browser.newContext(phone ? {
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      } : {});
      try {
        const requests = [];
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (mobileFiles.has(url.pathname)) {
            requests.push(url.pathname);
            return route.abort(); // Exercise download failure without a real wallet relay.
          }
          return url.origin === origin ? route.continue() : route.abort();
        });
        await context.routeWebSocket('**/*', socket => socket.close());
        const page = await context.newPage();
        // Isolate wallet failure handling from the app's generic chunk-reload
        // recovery. Do not preventDefault: Vite must still reject the import.
        await page.addInitScript(() => window.addEventListener('vite:preloadError', event => event.stopImmediatePropagation()));
        await page.goto(origin, { waitUntil: 'networkidle' });
        await page.evaluate(async file => {
          const exports = await import('/' + file);
          const wallet = [exports, ...Object.values(exports)].find(value => typeof value?.acquireStandaloneWalletSession === 'function');
          window.__mobileCheck = { errors: [] };
          const probe = window.__mobileCheck;
          probe.acquisition = wallet.acquireStandaloneWalletSession({
            initializeWallet: async () => true, disposeWallet() {}, beginWalletTransition() {},
            onError(error) { probe.errors.push(String(error)); },
          });
          probe.session = await probe.acquisition.session;
          await probe.session.showSignIn();
        }, report.standaloneWalletEntry.file);
        const modal = page.locator('connect-modal');
        await modal.getByText('Wallet Connect to the UP! App', { exact: true }).waitFor();
        if (!phone) await modal.getByText('Browser Extension', { exact: true }).waitFor();
        assert.equal(await modal.getByText('Continue in the UP! App', { exact: true }).count(), phone ? 1 : 0);
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: resolve(output, `wallet-choice-${phone ? 'phone' : 'desktop'}.png`), animations: 'disabled' });
        await page.waitForLoadState('networkidle');
        assert.deepEqual(requests, [], 'Opening the modal must not preload WalletConnect');
        await modal.getByText('Wallet Connect to the UP! App', { exact: true }).click();
        await page.waitForFunction(() => window.__mobileCheck.errors.length > 0, null, { timeout: 10000 });
        assert.ok(requests.length > 0, 'Choosing mobile must request its provider code');
        // Failed download releases busy state; the choice is available again.
        const busy = await modal.locator('connection-view').evaluate(view => view.isConnecting);
        assert.equal(busy, false);
        await page.evaluate(() => window.__mobileCheck.acquisition.release());
      } finally { await context.close(); }
    }
  } finally { await browser?.close(); await new Promise(resolveClose => server.httpServer.close(resolveClose)); }
});

test('built mobile SDK preserves one pending pairing, its approval toast and cancellation recovery', { timeout: 30000 }, async () => {
  const report = await analyzeProductionBuild(productionDirectory);
  const server = await preview({ root, build: { outDir: productionDirectory }, preview: { host: '127.0.0.1', port: 0, open: false } });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const cancelled of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        await context.routeWebSocket('**/*', socket => socket.close());
        const page = await context.newPage(), errors = [];
        page.setDefaultTimeout(5000);
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin, { waitUntil: 'networkidle' });
        await page.evaluate(async file => {
          await import('/' + file);
          const listeners = new Map();
          const probe = window.__mobileSdk = { connects: 0, providers: 0, tabs: 0, closed: 0, events: [], attempts: [] };
          const provider = {
            on(name, callback) { const callbacks = listeners.get(name) || new Set(); callbacks.add(callback); listeners.set(name, callbacks); },
            off(name, callback) { listeners.get(name)?.delete(callback); },
          };
          probe.emit = (name, value) => { for (const callback of [...(listeners.get(name) || [])]) callback(value); };
          probe.listeners = () => [...listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0);
          window.open = () => { probe.tabs++; return { location: { set href(value) { probe.link = value; } }, close() { probe.closed++; } }; };
          const view = probe.view = document.createElement('connection-view');
          view.connectors = [{ type: 'mobile', id: 'test-mobile-uid', rdns: 'walletConnect',
            async getProvider() { probe.providers++; return provider; },
            connect() { probe.connects++; return new Promise((resolve, reject) => probe.attempts.push({ resolve, reject })); },
          }];
          for (const name of ['on-connect', 'on-error']) view.addEventListener(name, () => probe.events.push(name));
          document.body.append(view);
          await view.updateComplete;
        }, report.standaloneWalletEntry.file);
        assert.deepEqual(await page.evaluate(() => ({ connects: window.__mobileSdk.connects, providers: window.__mobileSdk.providers })), { connects: 0, providers: 0 });
        await page.evaluate(() => { window.__mobileSdk.result = window.__mobileSdk.view.handleConnectMobile(); });
        await page.waitForFunction(() => !!window.__mobileSdk.view._pendingWalletConnect).catch(async error => {
          console.error('Mobile SDK preparation', await page.evaluate(() => ({
            connects: window.__mobileSdk.connects, providers: window.__mobileSdk.providers, events: window.__mobileSdk.events,
            connected: window.__mobileSdk.view.isConnected, mobile: window.__mobileSdk.view.device?.isMobile,
            connecting: window.__mobileSdk.view.isConnecting, tabs: window.__mobileSdk.tabs,
          })), errors);
          throw error;
        });
        const toast = page.locator('[data-up-wc-approval-toast]').locator('[part="toast"]');
        await toast.waitFor();
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: resolve(output, `wallet-pending-${cancelled ? 'cancel' : 'approve'}.png`), animations: 'disabled' });
        if (cancelled) {
          // Reject before display_uri: waiting for the URI must not hang forever.
          await page.evaluate(() => window.__mobileSdk.attempts[0].reject(new Error('User rejected connection')));
          await page.waitForFunction(() => window.__mobileSdk.events.includes('on-error') && !window.__mobileSdk.view.isConnecting);
          assert.equal(await page.evaluate(() => window.__mobileSdk.closed), 1);
        } else {
          await page.evaluate(() => {
            window.__mobileSdk.emit('display_uri', 'wc:test-pairing@2?relay-protocol=irn&symKey=test');
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('pageshow'));
          });
          await page.waitForFunction(() => !!window.__mobileSdk.link);
          assert.equal(await page.evaluate(() => window.__mobileSdk.connects), 1, 'Returning from the app must preserve the same pairing');
          await page.evaluate(() => {
            window.__mobileSdk.emit('connect', {});
            window.__mobileSdk.attempts[0].resolve();
          });
          await page.waitForFunction(() => window.__mobileSdk.events.includes('on-connect') && !window.__mobileSdk.view.isConnecting);
        }
        await toast.waitFor({ state: 'hidden' });
        await page.evaluate(async () => { await window.__mobileSdk.result; window.__mobileSdk.view.remove(); });
        const result = await page.evaluate(() => ({ events: window.__mobileSdk.events, tabs: window.__mobileSdk.tabs, listeners: window.__mobileSdk.listeners() }));
        assert.deepEqual(result.events, [cancelled ? 'on-error' : 'on-connect']);
        assert.equal(result.tabs, 1);
        assert.equal(result.listeners, 0);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser?.close(); await new Promise(done => server.httpServer.close(done)); }
});

test('built fresh entry stays below 1 MB JS without wallet/owner acquisition; built connector remains importable',{timeout:60000},async()=>{
  const report=await analyzeProductionBuild(productionDirectory);
  const server=await preview({root,build:{outDir:productionDirectory},preview:{host:'127.0.0.1',port:0,open:false}});
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    const forbidden=new Set([...report.standaloneWalletJavaScript,...report.ownerJavaScript].map(x=>'/'+x.file));
    const rows=[];
    for(const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
      const requests=[];
      page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.js')) requests.push(new URL(r.url()).pathname);});
      await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.getByRole('button',{name:'Connect',exact:true}).waitFor();
      assert.deepEqual(requests.filter(p=>forbidden.has(p)),[]);
      const bytes=await page.evaluate(()=>performance.getEntriesByType('resource')
        .filter(x=>new URL(x.name).pathname.endsWith('.js')).reduce((sum,x)=>sum+x.decodedBodySize,0));
      assert.ok(bytes>0 && bytes<=1_000_000,`Fresh-entry JavaScript ${bytes} exceeds 1 MB`);
      // Preserve the fresh-visit requests before the deliberate connector import.
      rows.push({width,bytes,requests:[...requests]});
      await mkdir(output,{recursive:true});
      await page.screenshot({path:resolve(output,`entry-${width}.png`)});
      // Import only: never initialize a real connector or request wallet access.
      const wallet=report.standaloneWalletEntry;
      assert.ok(wallet);
      assert.equal(await page.evaluate(async file=>{
        const exports=await import('/'+file);
        // Rollup may put the original module namespace in a shared chunk export.
        return [exports,...Object.values(exports)].some(value=>typeof value?.acquireStandaloneWalletSession==='function');
      },wallet.file),true);
      // Check actual built imports as well as the manifest: both read routes
      // must stay usable without evaluating editor or owner Library code.
      const ownerOnly = new Set(report.ownerRuntimeGraph.ownerChunks.map(chunk => '/' + chunk.file));
      for (const name of ['publicAbout', 'ownerAbout', 'receptionEditing']) {
        const route = report.receptionRoutes[name];
        assert.ok(route, 'Missing route report: ' + name);
        assert.ok(route.entryFile, 'Missing built route entry: ' + name);
        const start = requests.length;
        assert.equal(await page.evaluate(async file => Object.values(await import('/' + file)).some(value =>
          typeof value === 'function' || value && typeof value.default === 'function'), route.entryFile), true);
        if (name !== 'receptionEditing') assert.deepEqual(requests.slice(start).filter(path => ownerOnly.has(path)), []);
      }
      await page.close();
    }
    await writeFile(resolve(output,'results.json'),JSON.stringify(rows,null,2));
  } finally {await browser?.close();await new Promise(r=>server.httpServer.close(r));}
});

test('built wallet connects, restores, follows account and chain changes, and disconnects through the injected UP connector', { timeout: 90000 }, async () => {
  const report = await analyzeProductionBuild(productionDirectory);
  const server = await preview({ root, build: { outDir: productionDirectory }, preview: { host: '127.0.0.1', port: 0, open: false } });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const rpcCalls = [];
    const graph = JSON.parse(await readFile(resolve(productionDirectory, 'owner-runtime-graph.json'), 'utf8'));
    assert.ok(graph.mobileWalletFiles?.length, 'Build identifies the mobile provider chunks');
    const mobileRequests = [];
    page.on('request', request => {
      if (graph.mobileWalletFiles.some(file => new URL(request.url()).pathname === '/' + file)) mobileRequests.push(request.url());
    });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    // Real connector code, disposable providers only. External HTTP and WebSocket
    // requests cannot reach a wallet, relay, RPC service or publication endpoint.
    await page.routeWebSocket('**/*', socket => socket.close());
    await page.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin) return route.continue();
      if (request.url() === 'https://rpc.mainnet.lukso.network/' || request.url() === 'https://rpc.mainnet.lukso.network') {
        const body = request.postDataJSON();
        const calls = Array.isArray(body) ? body : [body];
        rpcCalls.push(...calls);
        const responses = calls.map(call => ({ jsonrpc: '2.0', id: call.id,
          ...(call.method === 'eth_call' && call.params?.[0]?.data?.startsWith('0x01ffc9a7')
            ? { result: `0x${'0'.repeat(63)}1` }
            : { error: { code: -32601, message: 'Unsupported test RPC request' } }) }));
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(Array.isArray(body) ? responses : responses[0]) });
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      const listeners = new Map();
      const probe = window.__walletProbe = {
        accounts: [], chainId: '0x2a', connected: null, initializations: [], requests: [], errors: [], transitions: 0,
      };
      const provider = {
        on(event, callback) {
          const callbacks = listeners.get(event) || new Set();
          callbacks.add(callback);
          listeners.set(event, callbacks);
          return provider;
        },
        removeListener(event, callback) { listeners.get(event)?.delete(callback); return provider; },
        async request({ method, params }) {
          probe.requests.push(method);
          if (method === 'eth_requestAccounts') {
            probe.accounts = ['0x1111111111111111111111111111111111111111'];
            return [...probe.accounts];
          }
          if (method === 'eth_accounts') return [...probe.accounts];
          if (method === 'eth_chainId') return probe.chainId;
          if (method === 'wallet_switchEthereumChain') {
            probe.emit('chainChanged', params[0].chainId);
            return null;
          }
          if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') {
            return [{ parentCapability: 'eth_accounts' }];
          }
          if (method === 'wallet_revokePermissions') return null;
          throw new Error(`Unexpected test-provider request: ${method}`);
        },
      };
      probe.emit = (event, value) => {
        if (event === 'accountsChanged') probe.accounts = value;
        if (event === 'chainChanged') probe.chainId = value;
        for (const listener of [...(listeners.get(event) || [])]) listener(value);
      };
      window.ethereum = provider;
      window.lukso = provider;
      const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: { info: { uuid: 'f18120bb-d7e0-4209-9f79-660d63221cc4', name: 'Universal Profile Test',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rdns: 'cloud.universalprofile' }, provider },
      }));
      window.addEventListener('eip6963:requestProvider', announce);
      announce();
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Connect', exact: true }).waitFor();
    assert.ok(report.standaloneWalletEntry?.file, 'Build must identify the actual wallet entry');
    await page.evaluate(async file => {
      const exports = await import('/' + file);
      const wallet = [exports, ...Object.values(exports)].find(value => typeof value?.acquireStandaloneWalletSession === 'function');
      if (!wallet) throw new Error('Built wallet session export is unavailable');
      const probe = window.__walletProbe;
      probe.acquire = async () => {
        probe.acquisition = wallet.acquireStandaloneWalletSession({
          async initializeWallet({ provider, resolveContextAccounts }) {
            const accounts = await provider.request({ method: 'eth_accounts' });
            const profiles = await resolveContextAccounts({ accounts });
            probe.connected = profiles[0] || null;
            probe.initializations.push(probe.connected);
            return true;
          },
          disposeWallet() { probe.connected = null; },
          beginWalletTransition() { probe.connected = null; probe.transitions += 1; },
          onError(error) { probe.errors.push(String(error?.message || error)); },
        });
        probe.session = await probe.acquisition.session;
      };
      await probe.acquire();
      await probe.session.showSignIn();
    }, report.standaloneWalletEntry.file);
    const modal = page.locator('connect-modal');
    await modal.getByText('Browser Extension', { exact: true }).waitFor();
    await modal.getByText('Wallet Connect to the UP! App', { exact: true }).waitFor();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: resolve(output, 'wallet-modal-1440.png'), animations: 'disabled' });
    assert.equal(await page.evaluate(() => window.__walletProbe.requests.includes('eth_requestAccounts')), false,
      'Showing the connector UI must not request accounts');
    await modal.getByText('Browser Extension', { exact: true }).click();
    await page.waitForFunction(() => window.__walletProbe.connected === '0x1111111111111111111111111111111111111111', null, { timeout: 10000 }).catch(async error => {
      console.error('Wallet connection diagnostics', await page.evaluate(() => {
        const { requests, errors, connected } = window.__walletProbe;
        return { requests, errors, connected, modal: document.querySelector('connect-modal')?.shadowRoot?.textContent };
      }), { pageErrors, rpcCalls });
      throw error;
    });
    await page.evaluate(() => window.__walletProbe.emit('accountsChanged', ['0x2222222222222222222222222222222222222222']));
    await page.waitForFunction(() => window.__walletProbe.connected === '0x2222222222222222222222222222222222222222');
    await page.evaluate(() => window.__walletProbe.emit('chainChanged', '0x1'));
    await page.waitForFunction(() => window.__walletProbe.connected === null);
    await page.evaluate(() => window.__walletProbe.emit('chainChanged', '0x2a'));
    await page.waitForFunction(() => window.__walletProbe.connected === '0x2222222222222222222222222222222222222222');
    const requestsBeforeRestore = await page.evaluate(() => window.__walletProbe.requests.filter(method => method === 'eth_requestAccounts').length);
    await page.evaluate(() => window.__walletProbe.acquisition.release());
    await page.waitForFunction(() => !document.querySelector('connect-modal') && window.__walletProbe.connected === null);
    await page.evaluate(() => window.__walletProbe.acquire());
    await page.waitForFunction(() => window.__walletProbe.connected === '0x2222222222222222222222222222222222222222');
    assert.equal(await page.evaluate(() => window.__walletProbe.requests.filter(method => method === 'eth_requestAccounts').length), requestsBeforeRestore,
      'Restoring the persisted connector must not prompt for accounts again');
    await page.evaluate(() => window.__walletProbe.session.disconnect());
    await page.waitForFunction(() => window.__walletProbe.connected === null);
    const result = await page.evaluate(() => {
      const probe = window.__walletProbe;
      probe.acquisition.release();
      return { initializations: probe.initializations, requests: probe.requests, errors: probe.errors, transitions: probe.transitions };
    });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(mobileRequests, [], 'Extension connect/restore must never acquire the mobile runtime');
    assert.deepEqual(pageErrors, []);
    // Reception also requests public metadata while the wallet is unopened.
    // Every RPC stays read-only; each simulated profile must be UP-validated.
    assert.ok(rpcCalls.every(call => call.method === 'eth_call'), 'Only read-only RPC calls are allowed');
    for (const address of ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222']) {
      assert.ok(rpcCalls.some(call => call.params?.[0]?.to === address
        && call.params[0].data?.startsWith('0x01ffc9a724871b3d')), `Missing LSP0 supportsInterface validation for ${address}`);
    }
    assert.equal(result.requests.some(method => /sendTransaction|sign|sendRawTransaction/iu.test(method)), false);
    await mkdir(output, { recursive: true });
    await writeFile(resolve(output, 'wallet-session.json'), JSON.stringify({ ...result, rpcCalls: rpcCalls.length,
      scope: 'Compiled connector with a fake EIP-1193 provider and mocked RPC; no real wallet, relay, signing or publication.' }, null, 2));
    await page.close();
  } finally {
    await browser?.close();
    await new Promise(resolveClose => server.httpServer.close(resolveClose));
  }
});
