import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BROWSER_LIFECYCLE_TIMEOUTS,
  createBrowserTestCleanup,
  runBrowserSetupWithCleanup,
  withinDeadline,
} from './browser-test-lifecycle.mjs';
import {
  DEFAULT_PLAYWRIGHT_EDGE_ARGS,
  createPlaywrightRouteController,
  launchPlaywrightEdge,
} from './playwright-browser-adapter.mjs';

export const OWNER_PRODUCTION_PREVIEW_URL = process.env.INSCAPE_OWNER_PREVIEW_URL
  || 'https://deploy-preview-2--enterinscape.netlify.app';
export const OWNER_PRODUCTION_PREVIEW_PROFILE = '0x1111111111111111111111111111111111111111';
export const OWNER_PREVIEW_TIMEOUT_MS = 10_000;
export const OWNER_PREVIEW_LIFECYCLE_TIMEOUTS = Object.freeze({
  entryReadyMs: 30_000,
  connectAuthorityMs: 10_000,
  startveilRevealMs: 60_000,
  ownerReadyMs: 10_000,
  themeSettingsMs: 30_000,
});
export const OWNER_PREVIEW_DIAGNOSTIC_MARGIN_MS = 5_000;
export const OWNER_PREVIEW_GATE_WATCHDOG_MS = Object.values(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS)
  .reduce((total, timeoutMs) => total + timeoutMs, OWNER_PREVIEW_DIAGNOSTIC_MARGIN_MS);
export const TASK4A_HARDWARE_EDGE_ARGS = Object.freeze([
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-component-update',
  '--disable-background-networking',
  '--disk-cache-size=1',
  '--media-cache-size=1',
]);
export const TASK4A_SOFTWARE_WEBGL_EDGE_ARGS = Object.freeze([
  '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader',
  ...DEFAULT_PLAYWRIGHT_EDGE_ARGS.filter((argument) => argument !== '--disable-gpu'),
]);

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = '/__inscape_owner_production_preview_fixture__';
const providerBundlePath = '/__inscape_up_provider_server__.js';
const rpcOrigin = 'https://rpc.mainnet.lukso.network';
const task4bMediaOrigin = 'https://task4b-fixtures.invalid';
const task4bMediaSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#777"/></svg>';
const graphOrigins = Object.freeze([
  'https://envio.lukso-mainnet.universal.tech',
  'https://indexer.chillwhales.dev',
]);
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const dangerousProviderMethod = /^(?:eth_send|personal_|wallet_|.*sign|.*upload|.*publish)/iu;
const emptyAbiBytes = `0x${'0'.repeat(63)}20${'0'.repeat(64)}`;
const softwareRendererPattern = /swiftshader|llvmpipe|softpipe|lavapipe|software rasterizer|microsoft basic render(?: driver)?|\bwarp\b|gdi generic|mesa offscreen/iu;

export function classifyTask4Renderer(evidence) {
  const contexts = [evidence?.webgl, evidence?.webgl2];
  const unavailable = contexts.some((context) => !context?.available || !context.unmaskedRenderer || !context.unmaskedVendor);
  const softwareMatches = [...new Set(contexts.flatMap((context) =>
    [context?.unmaskedVendor, context?.unmaskedRenderer]
      .filter((value) => typeof value === 'string' && softwareRendererPattern.test(value))))];
  const classification = unavailable ? 'unavailable' : softwareMatches.length ? 'software' : 'hardware';
  return Object.freeze({
    classification,
    hardwareAccelerated: classification === 'hardware',
    softwareMatches,
  });
}

export function assertTask4HardwareRenderer(evidence) {
  const result = classifyTask4Renderer(evidence);
  if (!result.hardwareAccelerated) {
    const error = new Error(`Task 4A requires hardware WebGL/WebGL2; renderer classified as ${result.classification}`);
    error.code = result.classification === 'software' ? 'SOFTWARE_RENDERER' : 'RENDERER_UNAVAILABLE';
    error.rendererClassification = result;
    throw error;
  }
  return result;
}

export function ownerChannelAuthorityAllowed({ enable, allowedAccounts, contextAccounts, profileAddress }) {
  const normalizedProfile = String(profileAddress || '').toLowerCase();
  return enable === true
    && allowedAccounts?.length === 1
    && contextAccounts?.length === 1
    && String(allowedAccounts[0]).toLowerCase() === normalizedProfile
    && String(contextAccounts[0]).toLowerCase() === normalizedProfile;
}

export function classifySyntheticProfileMetadataRpc({ url, postData, profileAddress }) {
  let parsedUrl; let payload;
  try { parsedUrl = new URL(url); payload = JSON.parse(postData || ''); } catch { return { methods: [], fixtureInduced: false }; }
  if (parsedUrl.origin !== rpcOrigin || !/^0x[0-9a-f]{40}$/u.test(String(profileAddress || '').toLowerCase())) {
    return { methods: [], fixtureInduced: false };
  }
  const entries = Array.isArray(payload) ? payload : [payload];
  const normalizedProfile = profileAddress.toLowerCase();
  const methods = entries.map(({ method }) => typeof method === 'string' ? method : 'unknown');
  const fixtureInduced = entries.length > 0 && entries.every(({ method, params }) => {
    if (method === 'eth_getCode') return String(params?.[0] || '').toLowerCase() === normalizedProfile;
    if (method === 'eth_call') return String(params?.[0]?.to || '').toLowerCase() === normalizedProfile;
    return false;
  });
  return { methods, fixtureInduced };
}

export function createPhaseDeadline(timeoutMs,
  monotonicNow = () => Number(process.hrtime.bigint()) / 1_000_000) {
  const startedAt = monotonicNow(); const deadlineAt = startedAt + timeoutMs;
  return {
    elapsedMs: () => monotonicNow() - startedAt,
    remainingBudgetMs: () => Math.max(0, deadlineAt - monotonicNow()),
    remainingMs() {
      const remaining = deadlineAt - monotonicNow();
      if (remaining <= 0) throw Object.assign(new Error(`Phase exceeded its absolute ${timeoutMs}ms deadline`), {
        code: 'ETIMEDOUT',
      });
      return remaining;
    },
  };
}

export async function atomicSettingsSnapshot(settings, deadline) {
  return withinDeadline(settings.evaluate((dialog) => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0
        && rect.width > 0 && rect.height > 0;
    };
    const selects = [...dialog.querySelectorAll('select')];
    const selectFor = (label) => selects.find((select) =>
      select.closest('label')?.querySelector(':scope > span')?.textContent?.trim() === label) || null;
    const describeSelect = (select) => {
      if (!select) return null;
      const rect = select.getBoundingClientRect();
      return {
        attached: select.isConnected,
        id: window.__task4OwnerHarness.nodeId(select),
        label: select.closest('label')?.querySelector(':scope > span')?.textContent?.trim() || null,
        options: [...select.options].map((option) => option.textContent?.trim()),
        values: [...select.options].map((option) => option.value),
        value: select.value,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: getComputedStyle(select).display,
        visibility: getComputedStyle(select).visibility,
        opacity: getComputedStyle(select).opacity,
        computedVisible: visible(select),
      };
    };
    const owner = document.querySelector('main.owner-lattice-shell');
    const modulator = document.querySelector('[aria-label="Modulator"]');
    const workspaceControl = selectFor('WORKSPACE / SURFACE');
    const menuControl = selectFor('MENU / INTERFACE');
    const dialogRect = dialog?.getBoundingClientRect();
    return {
      url: location.href,
      documentId: window.__task4OwnerHarness.documentId,
      ownerId: window.__task4OwnerHarness.nodeId(owner),
      modulatorId: window.__task4OwnerHarness.nodeId(modulator),
      settingsId: window.__task4OwnerHarness.nodeId(dialog),
      workspaceControlId: window.__task4OwnerHarness.nodeId(workspaceControl),
      menuControlId: window.__task4OwnerHarness.nodeId(menuControl),
      ownerAttached: Boolean(owner?.isConnected),
      settingsAttached: Boolean(dialog?.isConnected),
      workspaceControlAttached: Boolean(workspaceControl?.isConnected),
      menuControlAttached: Boolean(menuControl?.isConnected),
      surface: owner?.getAttribute('data-surface') || null,
      menuSurface: owner?.getAttribute('data-menu-surface') || null,
      comboboxCount: selects.length,
      dialogRect: dialogRect && {
        x: dialogRect.x, y: dialogRect.y, width: dialogRect.width, height: dialogRect.height,
      },
      dialogComputedVisible: visible(dialog),
      labelTexts: [...dialog.querySelectorAll('label > span')].map((node) => node.textContent?.trim()),
      selects: [describeSelect(workspaceControl), describeSelect(menuControl)],
    };
  }), deadline.remainingMs(), 'Atomic Settings state snapshot exceeded the remaining Settings phase deadline');
}

function safeDetails(details) {
  return Object.fromEntries(Object.entries(details).map(([key, value]) => [key,
    typeof value === 'string' ? value.replace(/[\r\n\u0000-\u001f\u007f]+/gu, ' ').slice(0, 512) : value]));
}

export function createOwnerPreviewLedger({
  label = 'owner-preview',
  monotonicNow = () => Number(process.hrtime.bigint()) / 1_000_000,
} = {}) {
  const startedAt = Date.now();
  const monotonicStartedAt = monotonicNow();
  const entries = [];
  const record = (type, details = {}) => {
    const monotonicElapsedMs = monotonicNow() - monotonicStartedAt;
    const entry = Object.freeze({
      sequence: entries.length + 1,
      timestamp: new Date().toISOString(),
      elapsedMs: monotonicElapsedMs,
      monotonicElapsedMs,
      type,
      ...safeDetails(details),
    });
    entries.push(entry);
    return entry;
  };
  const dump = () => JSON.stringify({ label, startedAt: new Date(startedAt).toISOString(), entries }, null, 2);
  return { entries, record, dump };
}

export async function recordSettingsStep({ deadline, ledger, step }, operation) {
  ledger.record('settings-step-before', {
    step,
    remainingSettingsMs: deadline.remainingBudgetMs(),
  });
  try {
    const result = await operation();
    ledger.record('settings-step-after', {
      step,
      outcome: 'complete',
      remainingSettingsMs: deadline.remainingBudgetMs(),
    });
    return result;
  } catch (error) {
    ledger.record('settings-step-after', {
      step,
      outcome: 'failed',
      code: error.code || 'ERROR',
      remainingSettingsMs: deadline.remainingBudgetMs(),
    });
    throw error;
  }
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try { await access(candidate); return candidate; } catch { /* try the next installed browser */ }
  }
  throw new Error('No Chromium browser found. Set BROWSER_PATH to Edge, Chrome, or Chromium.');
}

export function createOwnerProductionPreviewFixtureHtml({ previewUrl, profileAddress, authorityProfiles = [profileAddress] }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>INSCAPE owner production preview fixture</title>
<style>html,body,iframe{width:100%;height:100%;margin:0;border:0}iframe{display:block}
[data-owner-connect]{position:fixed;z-index:2147483647;inset:8px auto auto 8px}</style>
<script>
window.require = (moduleName) => {
  if (moduleName === 'crypto') return {
    randomFillSync(target) { globalThis.crypto.getRandomValues(target); return target; },
    randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto)
  };
  throw new Error('Task 4A fixture rejected unexpected server-bundle module: ' + moduleName);
};
</script>
<script src="${providerBundlePath}"></script></head><body data-owner-preview-fixture data-ready="false">
<script>
(async () => {
  const profileAddress = ${JSON.stringify(profileAddress)};
  const authorityProfiles = new Set(${JSON.stringify([].concat(authorityProfiles || []))});
  const listeners = new Map();
  let clientChannel = null;
  const fixture = window.__ownerPreviewFixture = {
    ready: false, profileAddress, connectorContextAccounts: [], channels: 0,
    requests: [], forbiddenRequests: [], startupOrder: [], channelAuthority: null
  };
  const provider = {
    accounts: [], chainId: '0x2a',
    async request({ method }) {
      fixture.requests.push({ method, timestamp: new Date().toISOString() });
      if (${dangerousProviderMethod.toString()}.test(method)) {
        fixture.forbiddenRequests.push(method);
        throw new Error('Task 4A fixture blocked forbidden provider method: ' + method);
      }
      if (method === 'eth_accounts') return [...provider.accounts];
      if (method === 'eth_chainId') return provider.chainId;
      if (method === 'net_version') return '42';
      return null;
    },
    on(event, listener) {
      const eventListeners = listeners.get(event) || new Set();
      eventListeners.add(listener); listeners.set(event, eventListeners); return provider;
    },
    off(event, listener) { listeners.get(event)?.delete(listener); return provider; },
    removeListener(event, listener) { return provider.off(event, listener); }
  };
  const connector = UpProvider.createUPProviderConnector(provider, []);
  connector.on('channelCreated', (_id, channel) => {
    clientChannel = channel;
    fixture.channels += 1;
  });
  await connector.setContextAccounts([profileAddress]);
  fixture.connectorContextAccounts = [...connector.contextAccounts];
  fixture.startupOrder.push('connector-context-configured');
  const connectButton = document.createElement('button');
  connectButton.type = 'button';
  connectButton.dataset.ownerConnect = '';
  connectButton.textContent = 'Connect owner';
  const applyAuthority = async ({ enable = true, allowedAccounts, contextAccounts, chainId = 42 }) => {
    if (!clientChannel) throw new Error('Task 4A owner connect requested before client channel creation');
    const accepted = (values) => Array.isArray(values) && values.every((value) => authorityProfiles.has(value));
    if (!accepted(allowedAccounts) || !accepted(contextAccounts)) {
      throw new Error('Task 4 fixture rejected an authority profile outside its explicit allowlist');
    }
    await connector.setContextAccounts(contextAccounts);
    await clientChannel.setupChannel(enable, allowedAccounts, contextAccounts, chainId);
    fixture.profileAddress = contextAccounts[0] || null;
    fixture.connectorContextAccounts = [...connector.contextAccounts];
    fixture.channelAuthority = {
      ready: true,
      enable: clientChannel.enable,
      allowedAccounts: [...clientChannel.allowedAccounts],
      contextAccounts: [...clientChannel.contextAccounts],
      chainId: clientChannel.chainId,
      ownerAllowed: (${ownerChannelAuthorityAllowed.toString()})({
        enable: clientChannel.enable,
        allowedAccounts: clientChannel.allowedAccounts,
        contextAccounts: clientChannel.contextAccounts,
        profileAddress: contextAccounts[0],
      }),
    };
    document.body.dataset.channelAuthorityReady = 'true';
    return fixture.channelAuthority;
  };
  Object.defineProperty(window, '__task4OwnerApplyAuthority', { value: applyAuthority });
  connectButton.addEventListener('click', async () => {
    connectButton.disabled = true;
    await applyAuthority({ enable: true, allowedAccounts: [profileAddress], contextAccounts: [profileAddress], chainId: 42 });
  });
  document.body.append(connectButton);
  const iframe = document.createElement('iframe');
  iframe.title = 'INSCAPE production preview';
  iframe.src = ${JSON.stringify(`${previewUrl}/`)};
  document.body.append(iframe);
  fixture.startupOrder.push('preview-iframe-created');
  fixture.ready = true;
  document.body.dataset.ready = 'true';
})().catch((error) => {
  window.__ownerPreviewFixture = { ...(window.__ownerPreviewFixture || {}), ready: false,
    startupError: String(error?.stack || error) };
  throw error;
});
</script></body></html>`;
}

function jsonRpcResult(method) {
  if (method === 'eth_call') return emptyAbiBytes;
  if (method === 'eth_chainId') return '0x2a';
  if (method === 'eth_getCode') return '0x';
  if (method === 'eth_getBalance' || method === 'eth_getTransactionCount'
      || method === 'eth_blockNumber' || method === 'eth_gasPrice') return '0x0';
  return null;
}

function rpcFixtureResponse(request) {
  const payload = JSON.parse(request.postData() || '{}');
  const responseFor = (entry) => ({ jsonrpc: '2.0', id: entry.id, result: jsonRpcResult(entry.method) });
  return JSON.stringify(Array.isArray(payload) ? payload.map(responseFor) : responseFor(payload));
}

function attachPageLedger({ authorityProfiles = [profileAddress], expectedControlledConsoleErrors = [],
  expectedControlledGraphAbortOperations = [], page, ledger, problems, profileAddress }) {
  page.on('framenavigated', (frame) => ledger.record('framenavigated', {
    frame: frame === page.mainFrame() ? 'fixture' : 'preview', url: frame.url(),
  }));
  page.on('domcontentloaded', () => ledger.record('domcontentloaded', { frame: 'fixture', url: page.url() }));
  page.on('load', () => ledger.record('load', { frame: 'fixture', url: page.url() }));
  page.on('close', () => ledger.record('page-close', { url: page.url() }));
  page.on('crash', () => { ledger.record('page-crash', { url: page.url() }); problems.push('Page crashed'); });
  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) return;
    const item = `Console ${message.type()}: ${message.text()}`;
    const expectedSyntheticMetadataError = profileAddress === OWNER_PRODUCTION_PREVIEW_PROFILE
      && message.type() === 'error'
      && message.text() === '[wallet-metadata-unavailable] Contract: [hex omitted] does not support ERC725Y interface.';
    if (expectedSyntheticMetadataError) {
      ledger.record('expected-synthetic-profile-metadata-error', {
        profileAddress, text: message.text(), url: message.location().url || '',
      });
      return;
    }
    if (message.type() === 'error' && expectedControlledConsoleErrors.includes(message.text())) {
      ledger.record('expected-controlled-console-error', {
        profileAddress, text: message.text(), url: message.location().url || '',
      });
      return;
    }
    ledger.record('console', { level: message.type(), text: message.text(), url: message.location().url || '' });
    if (message.type() === 'error') problems.push(item);
  });
  page.on('pageerror', (error) => {
    const item = `Page error: ${error.name} ${error.message}`;
    ledger.record('page-error', { name: error.name, message: error.message }); problems.push(item);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown';
    if (/BLOCKED_BY_CLIENT/iu.test(failure)) return;
    const cleanupOwned = ledger.entries.some(({ type }) => type === 'lifecycle:cleanup:start');
    const rpcCandidates = authorityProfiles.map((candidateProfile) => classifySyntheticProfileMetadataRpc({
      url: request.url(), postData: request.postData(), profileAddress: candidateProfile,
    }));
    const rpc = rpcCandidates.find(({ fixtureInduced }) => fixtureInduced) || rpcCandidates[0]
      || { methods: [], fixtureInduced: false };
    const lifecyclePhase = cleanupOwned ? 'cleanup'
      : ledger.entries.some(({ type }) => type === 'startveil-reveal-complete') ? 'post-reveal'
        : ledger.entries.some(({ type }) => type === 'startveil-pointer-activated') ? 'startveil-reveal'
          : ledger.entries.some(({ type }) => type === 'channel-authority-ready') ? 'connected-pre-entry'
            : 'bootstrap';
    const details = {
      methods: rpc.methods.join(','), resourceType: request.resourceType(), failure,
      lifecyclePhase, frameUrl: request.frame()?.url() || '',
    };
    let graphOperation = null;
    try { graphOperation = /query\s+(\w+)/u.exec(JSON.parse(request.postData() || '{}').query || '')?.[1] || null; }
    catch { /* non-GraphQL request */ }
    if (!cleanupOwned && failure === 'net::ERR_ABORTED'
      && graphOrigins.includes(new URL(request.url()).origin)
      && expectedControlledGraphAbortOperations.includes(graphOperation)) {
      ledger.record('expected-controlled-graph-abort', { ...details, graphOperation });
      return;
    }
    if (!cleanupOwned && failure === 'net::ERR_ABORTED' && rpc.fixtureInduced) {
      ledger.record('expected-synthetic-profile-metadata-rpc-abort', details);
      return;
    }
    const item = `Request failed: ${request.method()} ${request.url()} ${failure} methods=${rpc.methods.join(',') || 'unknown'}`;
    ledger.record('request-failed', {
      ...details, phase: cleanupOwned ? 'cleanup' : 'gate',
    });
    if (!cleanupOwned) problems.push(item);
  });
}

async function installDocumentLedger(context, ledger) {
  let detachedResolved = false;
  let resolveDetached;
  const startveilDetached = new Promise((resolveEvent) => { resolveDetached = resolveEvent; });
  await context.exposeBinding('__task4OwnerLedgerRecord', ({ frame }, event) => {
    const entry = ledger.record(event.type, { ...event, frameUrl: frame.url() });
    if (!detachedResolved && event.type === 'startveil-state' && event.state === 'detached') {
      detachedResolved = true;
      resolveDetached(entry);
    }
  });
  await context.addInitScript(() => {
    const documentId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nodeIds = new WeakMap(); let nextNodeId = 0;
    Object.defineProperty(window, '__task4OwnerHarness', { value: Object.freeze({
      documentId,
      nodeId(node) {
        if (!node) return null;
        if (!nodeIds.has(node)) nodeIds.set(node, `${documentId}:node-${++nextNodeId}`);
        return nodeIds.get(node);
      },
    }) });
    const emit = (type, details = {}) => window.__task4OwnerLedgerRecord?.({
      type, documentId, url: location.href, visibility: document.visibilityState, ...details,
    });
    let lastStartveilState;
    let firstCanvasAttached = false;
    let firstOwnerReady = false;
    const probeRuntime = () => {
      const startveil = document.querySelector('[aria-label="INSCAPE entry"]');
      const state = startveil?.getAttribute('data-state') || (lastStartveilState ? 'detached' : null);
      if (state && state !== lastStartveilState) {
        lastStartveilState = state;
        emit('startveil-state', { state, nodeId: startveil ? window.__task4OwnerHarness.nodeId(startveil) : null });
      }
      const canvas = document.querySelector('canvas');
      if (canvas && !firstCanvasAttached) {
        firstCanvasAttached = true;
        emit('pixi-canvas-attached', {
          nodeId: window.__task4OwnerHarness.nodeId(canvas), canvasCount: document.querySelectorAll('canvas').length,
          width: canvas.width, height: canvas.height,
        });
      }
      const toolbar = document.querySelector('nav[aria-label="Owner workspace tools"]');
      const modulator = document.querySelector('[aria-label="Modulator"]');
      if (toolbar && !firstOwnerReady) {
        firstOwnerReady = true;
        emit('owner-modul8r-dom-ready', {
          toolbarNodeId: window.__task4OwnerHarness.nodeId(toolbar),
          modulatorNodeId: window.__task4OwnerHarness.nodeId(modulator),
        });
      }
    };
    new MutationObserver(probeRuntime).observe(document, {
      attributes: true, attributeFilter: ['data-state'], childList: true, subtree: true,
    });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) emit('long-task', {
          duration: entry.duration, startTime: entry.startTime, name: entry.name,
        });
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* Long Task API is optional; CDP metrics remain authoritative. */ }
    addEventListener('DOMContentLoaded', () => emit('domcontentloaded', { frame: 'document' }));
    addEventListener('load', () => emit('load', { frame: 'document' }));
    addEventListener('pagehide', (event) => emit('pagehide', { persisted: event.persisted }));
    addEventListener('pageshow', (event) => emit('pageshow', { persisted: event.persisted }));
    addEventListener('visibilitychange', () => emit('visibilitychange'));
    probeRuntime();
  });
  return { startveilDetached };
}

async function captureRendererEvidence(frame) {
  return frame.evaluate(() => {
    const probe = (kind) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext(kind);
      const extension = context?.getExtension?.('WEBGL_debug_renderer_info');
      const value = (parameter) => {
        try { return context?.getParameter?.(parameter) ?? null; } catch { return null; }
      };
      const result = {
        available: Boolean(context),
        vendor: context ? value(context.VENDOR) : null,
        renderer: context ? value(context.RENDERER) : null,
        unmaskedVendor: context && extension ? value(extension.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: context && extension ? value(extension.UNMASKED_RENDERER_WEBGL) : null,
      };
      context?.getExtension?.('WEBGL_lose_context')?.loseContext?.();
      canvas.remove();
      return result;
    };
    return {
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      documentId: window.__task4OwnerHarness.documentId,
      url: location.href,
      webgl: probe('webgl'),
      webgl2: probe('webgl2'),
      navigatorGpu: Boolean(navigator.gpu),
      canvasCount: document.querySelectorAll('canvas').length,
    };
  });
}

async function recordCdpMetrics(resources, ledger, phase) {
  if (!resources.pageCdp) return;
  try {
    const result = await withinDeadline(resources.pageCdp.send('Performance.getMetrics'),
      BROWSER_LIFECYCLE_TIMEOUTS.commandMs, `CDP performance metrics timed out during ${phase}`);
    const selected = new Set(['Timestamp', 'Documents', 'Frames', 'JSEventListeners', 'Nodes', 'LayoutCount',
      'RecalcStyleCount', 'ScriptDuration', 'TaskDuration', 'JSHeapUsedSize', 'JSHeapTotalSize']);
    ledger.record('cdp-performance', { phase, metrics: Object.fromEntries(result.metrics
      .filter(({ name }) => selected.has(name)).map(({ name, value }) => [name, value])) });
  } catch (error) {
    ledger.record('cdp-performance-unavailable', { phase, code: error.code || 'ERROR', message: error.message });
  }
}

function lifecycleDiagnostic(ledger) {
  return (stage, details = {}) => ledger.record(`lifecycle:${stage}`, details);
}

function errorWithLedger(error, ledger) {
  if (error?.task4aLedgerAttached) return error;
  const wrapped = new Error(`${error.message}\nTask 4A actionable ledger:\n${ledger.dump()}`, { cause: error });
  wrapped.code = error.code;
  wrapped.task4aLedgerAttached = true;
  return wrapped;
}

function operationLabel(operation) {
  if (!operation) return 'none';
  return [operation.phase, operation.control, operation.theme].filter(Boolean).join('/');
}

export function writeTask4AProgress({ phase, control = 'none', theme = 'none' }, write = console.log) {
  write(`Task 4A progress ${JSON.stringify({ phase, control, theme })}`);
}

export function createGateOperationTracker(ledger, write = console.log) {
  let lastStarted = null;
  let lastCompleted = null;
  return {
    start(operation) {
      lastStarted = Object.freeze({ ...operation });
      ledger.record('operation-started', lastStarted);
      writeTask4AProgress(lastStarted, write);
    },
    complete(operation) {
      lastCompleted = Object.freeze({ ...operation });
      ledger.record('operation-completed', lastCompleted);
      writeTask4AProgress(lastCompleted, write);
    },
    snapshot: () => ({ lastStarted, lastCompleted }),
  };
}

export async function runPostSetupGateWithCleanup(executeGate, {
  cleanup,
  context,
  ledger,
  operations,
  timeoutMs = OWNER_PREVIEW_GATE_WATCHDOG_MS,
} = {}) {
  let diagnosis;
  let result;
  let gateError;
  let cleanupResult;
  try {
    result = await withinDeadline(Promise.resolve().then(executeGate), timeoutMs,
      `Task 4A post-setup gate body exceeded its derived ${timeoutMs}ms watchdog`, () => {
        diagnosis = operations.snapshot();
        ledger.record('gate-watchdog-expired', {
          deadlineMs: timeoutMs,
          lastStarted: operationLabel(diagnosis.lastStarted),
          lastCompleted: operationLabel(diagnosis.lastCompleted),
        });
        void context?.close?.().catch?.(() => {});
      });
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      diagnosis ||= operations.snapshot();
      error.message += `; last started operation: ${operationLabel(diagnosis.lastStarted)}; last completed operation: ${operationLabel(diagnosis.lastCompleted)}`;
    }
    gateError = errorWithLedger(error, ledger);
  } finally {
    try { cleanupResult = await cleanup(); }
    catch (cleanupError) {
      gateError = gateError
        ? Object.assign(new AggregateError([gateError, errorWithLedger(cleanupError, ledger)],
          'Task 4A gate and cleanup failed'), { task4aLedgerAttached: true })
        : errorWithLedger(cleanupError, ledger);
    }
  }
  if (gateError) throw gateError;
  return { result, cleanupResult };
}

export async function runOwnerProductionPreviewGate(executeGate, {
  label = 'owner-theme-settings',
  previewUrl = OWNER_PRODUCTION_PREVIEW_URL,
  profileAddress = OWNER_PRODUCTION_PREVIEW_PROFILE,
  browserArgs = TASK4A_HARDWARE_EDGE_ARGS,
  authorityProfiles = [profileAddress],
  contextOptions = {},
  contextInitScript = null,
  contextInitScriptArg,
  graphFixtureResponse = null,
  openModulatorForGate = true,
  expectedControlledConsoleErrors = [],
  expectedControlledGraphAbortOperations = [],
} = {}) {
  const ledger = createOwnerPreviewLedger({ label });
  const runtimePath = resolve(workspaceRoot,
    `.browser-test-runtime-task4a-${process.pid}-${Date.now()}-${randomUUID()}`);
  const resources = {};
  const problems = [];
  let cleanup = createBrowserTestCleanup({ runtimePath, workspaceRoot, diagnostic: lifecycleDiagnostic(ledger) });
  let setupAbortController;
  let cleanupResult;
  let cleanupProgressPromise;
  let result;
  let gateError;
  const operations = createGateOperationTracker(ledger);
  const cleanupWithProgress = () => {
    if (cleanupProgressPromise) return cleanupProgressPromise;
    operations.start({ phase: 'cleanup-before', control: 'cleanup', theme: 'none' });
    cleanupProgressPromise = Promise.resolve().then(() => cleanup(resources)).finally(() => {
      operations.complete({ phase: 'cleanup-after', control: 'cleanup', theme: 'none' });
    });
    return cleanupProgressPromise;
  };
  try {
    await runBrowserSetupWithCleanup(async () => {
      setupAbortController = new AbortController();
      const edgePath = await findBrowser();
      const providerBundle = await readFile(resolve(workspaceRoot,
        'node_modules/@lukso/up-provider/dist/server.global.js'), 'utf8');
      const previewOrigin = new URL(previewUrl).origin;
      const fixture = createOwnerProductionPreviewFixtureHtml({ previewUrl, profileAddress, authorityProfiles });
      const routeController = createPlaywrightRouteController({
        loopbackOrigin: 'http://127.0.0.1:9',
        knownOrigins: [previewOrigin, rpcOrigin, task4bMediaOrigin, ...graphOrigins],
        decideKnown: async ({ origin, request, url }) => {
          if (origin === previewOrigin && url.pathname === fixturePath) {
            return { action: 'fulfill', options: { status: 200, contentType: 'text/html', body: fixture } };
          }
          if (origin === previewOrigin && url.pathname === providerBundlePath) {
            return { action: 'fulfill', options: { status: 200, contentType: 'text/javascript', body: providerBundle } };
          }
          if (origin === previewOrigin) return { action: 'continue' };
          if (origin === task4bMediaOrigin) return { action: 'fulfill', options: {
            status: 200, contentType: 'image/svg+xml', body: task4bMediaSvg,
          } };
          if (origin === rpcOrigin) return { action: 'fulfill', options: {
            status: 200, contentType: 'application/json', body: rpcFixtureResponse(request),
          } };
          return { action: 'fulfill', options: {
            status: 200, contentType: 'application/json',
            body: graphFixtureResponse
              ? JSON.stringify(graphFixtureResponse({ origin, postData: request.postData() }))
              : JSON.stringify({ data: {} }),
          } };
        },
        onUnexpected: (origin) => {
          ledger.record('unexpected-origin', { origin }); problems.push(`Unexpected request origin: ${origin}`);
        },
      });
      await launchPlaywrightEdge({
        edgePath, runtimePath, workspaceRoot, loopbackOrigin: 'http://127.0.0.1:9', routeController, resources,
        browserArgs,
        contextOptions: { reducedMotion: 'reduce', ...contextOptions },
        diagnostic: lifecycleDiagnostic(ledger),
        onBrowserProblem: () => {},
        onOwnedProcess: ({ rootPid, processTree, identity }) => {
          ledger.record('owned-process', { rootPid, identity });
          cleanup = createBrowserTestCleanup({
            rootPid, processTree, runtimePath, workspaceRoot, diagnostic: lifecycleDiagnostic(ledger),
          });
        },
      });
      if (contextInitScript) {
        await resources.context.addInitScript(contextInitScript, contextInitScriptArg);
        ledger.record('context-init-script-installed', { enabled: true });
      }
      attachPageLedger({ authorityProfiles, expectedControlledConsoleErrors, expectedControlledGraphAbortOperations,
        page: resources.page, ledger, problems, profileAddress });
      const documentLedger = await installDocumentLedger(resources.context, ledger);
      resources.startveilDetached = documentLedger.startveilDetached;
      resources.pageCdp = await resources.context.newCDPSession(resources.page);
      await resources.pageCdp.send('Performance.enable');
      ledger.record('browser-args', { arguments: [...browserArgs] });
      ledger.record('dedicated-runtime', { name: basename(runtimePath) });
    }, async () => { cleanupResult = await cleanupWithProgress(); }, {
      timeoutMs: BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs,
      diagnostic: lifecycleDiagnostic(ledger),
      cancelSetup: () => { setupAbortController?.abort(); void resources.browserServer?.kill?.(); },
    });

    const gateOutcome = await runPostSetupGateWithCleanup(async () => {
    const page = resources.page;
    const response = await page.goto(`${previewUrl}${fixturePath}`, {
      waitUntil: 'domcontentloaded', timeout: OWNER_PREVIEW_TIMEOUT_MS,
    });
    assert.equal(response?.ok(), true, `Production preview fixture navigation returned ${response?.status()}`);
    const fixtureRoot = page.locator('[data-owner-preview-fixture][data-ready="true"]');
    await fixtureRoot.waitFor({ state: 'attached', timeout: OWNER_PREVIEW_TIMEOUT_MS });
    const iframe = page.getByTitle('INSCAPE production preview');
    await iframe.waitFor({ state: 'attached', timeout: BROWSER_LIFECYCLE_TIMEOUTS.commandMs });
    const frame = await (await iframe.elementHandle()).contentFrame();
    assert.ok(frame, 'Production preview iframe did not expose a child frame');
    await frame.waitForURL((url) => url.origin === new URL(previewUrl).origin && url.pathname === '/', {
      waitUntil: 'domcontentloaded', timeout: OWNER_PREVIEW_TIMEOUT_MS,
    });
    const rendererEvidence = await withinDeadline(captureRendererEvidence(frame),
      BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Task 4A renderer preflight deadline exceeded');
    const rendererClassification = classifyTask4Renderer(rendererEvidence);
    ledger.record('renderer-preflight', {
      browserArguments: [...browserArgs],
      renderer: rendererEvidence,
      classification: rendererClassification.classification,
      hardwareAccelerated: rendererClassification.hardwareAccelerated,
      softwareMatches: rendererClassification.softwareMatches,
    });
    assertTask4HardwareRenderer(rendererEvidence);
    const entryReadyDeadline = createPhaseDeadline(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.entryReadyMs);
    ledger.record('entry-readiness-start', {
      deadlineMs: OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.entryReadyMs,
    });
    const entry = frame.locator('[aria-label="INSCAPE entry"][data-ready="true"]');
    await entry.waitFor({ state: 'visible', timeout: entryReadyDeadline.remainingMs() });
    ledger.record('entry-readiness-complete', { elapsedMs: entryReadyDeadline.elapsedMs() });
    await page.waitForFunction(() => window.__ownerPreviewFixture?.channels > 0,
      undefined, { timeout: OWNER_PREVIEW_TIMEOUT_MS });
    const ownerBeforeConnect = await frame.evaluate(() => ({
      documentId: window.__task4OwnerHarness.documentId,
      url: location.href,
      ownerMainAttached: Boolean(document.querySelector('main.owner-lattice-shell')),
      ownerToolbarAttached: Boolean(document.querySelector('nav[aria-label="Owner workspace tools"]')),
      modulatorAttached: Boolean(document.querySelector('[aria-label="Modulator"]')),
    }));
    assert.equal(ownerBeforeConnect.ownerMainAttached, false, 'Disconnected fixture unexpectedly mounted owner shell');
    assert.equal(ownerBeforeConnect.ownerToolbarAttached, false, 'Disconnected fixture unexpectedly mounted owner toolbar');
    assert.equal(ownerBeforeConnect.modulatorAttached, false, 'Disconnected fixture unexpectedly mounted MODUL-8R');
    ledger.record('owner-before-connect', ownerBeforeConnect);
    const connectAuthorityDeadline = createPhaseDeadline(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.connectAuthorityMs);
    ledger.record('connect-authority-start', {
      deadlineMs: OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.connectAuthorityMs,
    });
    await page.getByRole('button', { name: 'Connect owner', exact: true })
      .click({ timeout: Math.min(BROWSER_LIFECYCLE_TIMEOUTS.commandMs, connectAuthorityDeadline.remainingMs()) });
    await page.waitForFunction(({ expectedProfile }) => {
      const authority = window.__ownerPreviewFixture?.channelAuthority;
      return authority?.ready === true
        && authority.enable === true
        && authority.allowedAccounts?.length === 1
        && authority.allowedAccounts[0] === expectedProfile
        && authority.contextAccounts?.length === 1
        && authority.contextAccounts[0] === expectedProfile
        && authority.chainId === 42
        && authority.ownerAllowed === true;
    }, { expectedProfile: profileAddress }, { timeout: connectAuthorityDeadline.remainingMs() });
    const channelAuthority = await page.evaluate(() =>
      structuredClone(window.__ownerPreviewFixture.channelAuthority));
    ledger.record('channel-authority-ready', {
      ...channelAuthority, phaseElapsedMs: connectAuthorityDeadline.elapsedMs(),
    });
    const beforeEntry = await frame.evaluate(() => ({
      documentId: window.__task4OwnerHarness.documentId,
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      state: document.querySelector('[aria-label="INSCAPE entry"]')?.getAttribute('data-state'),
    }));
    ledger.record('startveil-ready', beforeEntry);
    ledger.record('renderer-before-entry', {
      ...rendererEvidence,
      classification: rendererClassification.classification,
      hardwareAccelerated: rendererClassification.hardwareAccelerated,
    });
    await recordCdpMetrics(resources, ledger, 'before-entry');
    const startveilRevealDeadline = createPhaseDeadline(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.startveilRevealMs);
    ledger.record('startveil-reveal-start', {
      deadlineMs: OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.startveilRevealMs,
    });
    await frame.getByRole('button', { name: /ENTER/u }).click({
      timeout: Math.min(BROWSER_LIFECYCLE_TIMEOUTS.commandMs, startveilRevealDeadline.remainingMs()),
    });
    ledger.record('startveil-pointer-activated', await frame.locator('[aria-label="INSCAPE entry"]').evaluate((node) => ({
      state: node.getAttribute('data-state'), documentId: window.__task4OwnerHarness.documentId,
      visibility: document.visibilityState, focused: document.hasFocus(),
    })));
    try {
      const detached = await withinDeadline(resources.startveilDetached,
        startveilRevealDeadline.remainingMs(),
        `Startveil lifecycle exceeded its ${OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.startveilRevealMs}ms semantic deadline`);
      ledger.record('startveil-reveal-complete', {
        documentId: detached.documentId, frameUrl: detached.frameUrl, state: detached.state,
        lifecycleElapsedMs: startveilRevealDeadline.elapsedMs(),
      });
    } catch (error) {
      await recordCdpMetrics(resources, ledger, 'startveil-timeout');
      try {
        const snapshot = await withinDeadline(frame.evaluate(() => ({
          documentId: window.__task4OwnerHarness.documentId,
          url: location.href,
          visibility: document.visibilityState,
          state: document.querySelector('[aria-label="INSCAPE entry"]')?.getAttribute('data-state') || 'detached',
          canvasCount: document.querySelectorAll('canvas').length,
        })), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Startveil timeout snapshot deadline exceeded');
        ledger.record('startveil-timeout-snapshot', snapshot);
      } catch (snapshotError) {
        ledger.record('startveil-timeout-snapshot-unavailable', {
          code: snapshotError.code || 'ERROR', message: snapshotError.message,
        });
      }
      throw error;
    }
    const ownerToolbar = frame.getByRole('navigation', { name: 'Owner workspace tools' });
    const modulator = frame.getByRole('region', { name: 'Modulator' });
    const ownerReadyDeadline = createPhaseDeadline(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.ownerReadyMs);
    ledger.record('owner-readiness-start', { deadlineMs: OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.ownerReadyMs });
    try {
      await Promise.all([
        ownerToolbar.waitFor({ state: 'visible', timeout: ownerReadyDeadline.remainingMs() }),
        page.waitForFunction(({ expectedProfile }) => window.__ownerPreviewFixture?.ready
          && window.__ownerPreviewFixture.channels > 0
          && window.__ownerPreviewFixture.profileAddress === expectedProfile
          && window.__ownerPreviewFixture.connectorContextAccounts.length === 1
          && window.__ownerPreviewFixture.connectorContextAccounts[0] === expectedProfile
          && window.__ownerPreviewFixture.startupOrder.join(',') === 'connector-context-configured,preview-iframe-created'
          && window.__ownerPreviewFixture.channelAuthority?.enable === true
          && window.__ownerPreviewFixture.channelAuthority?.allowedAccounts?.length === 1
          && window.__ownerPreviewFixture.channelAuthority.allowedAccounts[0] === expectedProfile
          && window.__ownerPreviewFixture.channelAuthority?.contextAccounts?.length === 1
          && window.__ownerPreviewFixture.channelAuthority.contextAccounts[0] === expectedProfile
          && window.__ownerPreviewFixture.channelAuthority?.chainId === 42
          && window.__ownerPreviewFixture.channelAuthority?.ownerAllowed === true
          && window.__ownerPreviewFixture.requests.some(({ method }) => method === 'eth_accounts')
          && window.__ownerPreviewFixture.requests.some(({ method }) => method === 'eth_chainId'),
        { expectedProfile: profileAddress }, { timeout: ownerReadyDeadline.remainingMs() }),
      ]);
      assert.equal(await modulator.count(), 0, 'MODUL-8R must start closed until the owner explicitly opens Browser');
      ledger.record('owner-modul8r-initially-closed', { closed: true });
      if (openModulatorForGate) {
        await ownerToolbar.getByRole('button', { name: 'BROWSER', exact: true })
          .click({ timeout: ownerReadyDeadline.remainingMs() });
        await modulator.waitFor({ state: 'visible', timeout: ownerReadyDeadline.remainingMs() });
      }
    } catch (error) {
      try {
        ledger.record('owner-readiness-authority', await page.evaluate(() =>
          structuredClone(window.__ownerPreviewFixture)));
        ledger.record('owner-readiness-dom-and-chunks', await withinDeadline(frame.evaluate(() => ({
          documentId: window.__task4OwnerHarness.documentId,
          url: location.href,
          visibility: document.visibilityState,
          ownerMainAttached: Boolean(document.querySelector('main.owner-lattice-shell')),
          ownerToolbarAttached: Boolean(document.querySelector('nav[aria-label="Owner workspace tools"]')),
          modulatorAttached: Boolean(document.querySelector('[aria-label="Modulator"]')),
          startveilAttached: Boolean(document.querySelector('[aria-label="INSCAPE entry"]')),
          scriptResources: performance.getEntriesByType('resource').filter(({ initiatorType, name }) =>
            initiatorType === 'script' || /\.js(?:\?|$)/u.test(name)).map(({ name, duration, responseEnd, transferSize }) => ({
              name, duration, responseEnd, transferSize,
            })),
        })), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Owner readiness DOM/chunk snapshot deadline exceeded'));
      } catch (diagnosticError) {
        ledger.record('owner-readiness-evidence-unavailable', {
          code: diagnosticError.code || 'ERROR', message: diagnosticError.message,
        });
      }
      throw error;
    }
    ledger.record('owner-readiness-complete', { elapsedMs: ownerReadyDeadline.elapsedMs() });
    const authority = await page.evaluate(() => structuredClone(window.__ownerPreviewFixture));
    assert.deepEqual(authority.connectorContextAccounts, [profileAddress],
      'Fixture connector did not expose the exact owner context account');
    assert.ok(authority.channels >= 1, 'Fixture connector did not create a client channel');
    assert.equal(authority.channelAuthority.enable, true, 'Fixture client channel was not enabled');
    assert.deepEqual(authority.channelAuthority.allowedAccounts, [profileAddress],
      'Fixture client channel did not grant the exact connected visitor profile');
    assert.deepEqual(authority.channelAuthority.contextAccounts, [profileAddress],
      'Fixture client channel did not preserve the exact Grid context profile');
    assert.equal(authority.channelAuthority.chainId, 42, 'Fixture client channel did not use LUKSO chain ID 42');
    assert.equal(authority.channelAuthority.ownerAllowed, true, 'Fixture channel did not establish owner authority');
    assert.ok(authority.requests.some(({ method }) => method === 'eth_accounts'),
      'Fixture provider did not receive eth_accounts');
    assert.ok(authority.requests.some(({ method }) => method === 'eth_chainId'),
      'Fixture provider did not receive eth_chainId');
    assert.deepEqual(authority.forbiddenRequests, [], 'Fixture authority setup invoked a forbidden provider operation');
    ledger.record('owner-ready', { profileAddress: authority.profileAddress, channels: authority.channels,
      connectorContextAccounts: authority.connectorContextAccounts.join(','),
      channelEnable: authority.channelAuthority.enable,
      allowedAccounts: authority.channelAuthority.allowedAccounts.join(','),
      channelContextAccounts: authority.channelAuthority.contextAccounts.join(','),
      chainId: authority.channelAuthority.chainId,
      providerMethods: authority.requests.map(({ method }) => method).join(','),
      startupOrder: authority.startupOrder.join(',') });
    ledger.record('owner-identities', await frame.evaluate(() => {
      const toolbar = document.querySelector('nav[aria-label="Owner workspace tools"]');
      const modulator = document.querySelector('[aria-label="Modulator"]');
      return {
        documentId: window.__task4OwnerHarness.documentId,
        url: location.href,
        toolbarNodeId: window.__task4OwnerHarness.nodeId(toolbar),
        modulatorNodeId: window.__task4OwnerHarness.nodeId(modulator),
      };
    }));
    await recordCdpMetrics(resources, ledger, 'owner-ready');
    result = await executeGate({ frame, ledger, operations, page, profileAddress, previewUrl });
    const finalFixture = await page.evaluate(() => structuredClone(window.__ownerPreviewFixture));
    assert.deepEqual(finalFixture.forbiddenRequests, [], 'Theme/Settings gate invoked a forbidden provider operation');
    if (problems.length) throw new Error(`Unexpected browser diagnostics:\n${problems.join('\n')}`);
    return result;
    }, {
      cleanup: cleanupWithProgress,
      context: resources.context,
      ledger,
      operations,
      timeoutMs: OWNER_PREVIEW_GATE_WATCHDOG_MS,
    });
    result = gateOutcome.result;
    cleanupResult = gateOutcome.cleanupResult;
  } catch (error) {
    gateError = errorWithLedger(error, ledger);
  } finally {
    try { cleanupResult ||= await cleanupWithProgress(); }
    catch (error) {
      gateError = gateError
        ? new AggregateError([gateError, errorWithLedger(error, ledger)], 'Task 4A gate and cleanup failed')
        : errorWithLedger(error, ledger);
    }
  }
  if (gateError) throw gateError;
  assert.deepEqual(cleanupResult?.remainingPids, [], 'Owned browser processes remained after cleanup');
  return { result, cleanup: cleanupResult, ledger: ledger.entries, runtimeName: basename(runtimePath) };
}
