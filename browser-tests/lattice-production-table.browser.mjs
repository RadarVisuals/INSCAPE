import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { chromium } from 'playwright-core';
import {
  BROWSER_LIFECYCLE_TIMEOUTS,
  createBrowserTestCleanup,
  createLifecycleDiagnostics,
  runBrowserSetupWithCleanup,
  withinDeadline,
} from './browser-test-lifecycle.mjs';
import {
  createPlaywrightRouteController,
  launchPlaywrightEdge,
  settlePlaywrightAnimationFrames,
} from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root, '.browser-test-runtime');
const fixturePath = '/browser-tests/lattice-production-table-fixture.html';
const interactiveMode = process.argv.includes('--visual');
const interactivePort = 4173;
const browserCandidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const resources = {};
const browserProblems = [];
const diagnostic = createLifecycleDiagnostics();
let baseUrl;
let cleanupBrowserTest;
let setupAbortController;
let page;
let releaseLoadingMedia;
let loadingMediaGate;

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolvePort(port));
    });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, 'Timed out acquiring a Phase 3 browser-test port', () => socket.close());
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try {
      await withinDeadline(access(candidate), BROWSER_LIFECYCLE_TIMEOUTS.commandMs, `Timed out inspecting browser candidate: ${candidate}`);
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error('No Chromium browser found. Set BROWSER_PATH to Edge, Chrome, or Chromium.');
}

async function waitForViteReadiness(url, signal, timeoutMs = 5_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    signal.throwIfAborted();
    try {
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(2_000)]) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) { lastError = error; }
    await delay(50);
  }
  throw new Error(`Phase 3 Vite server did not become ready${lastError ? `: ${lastError.message}` : ''}`);
}

function fixtureSvg(url) {
  if (url.includes('transparent')) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><path fill="#76a7a1" fill-opacity=".72" d="M320 180h960v540H320z"/><circle cx="800" cy="450" r="190" fill="none" stroke="#fff" stroke-width="24"/></svg>';
  }
  const portrait = url.includes('portrait');
  const square = url.includes('square');
  const loading = url.includes('loading');
  const opaque = url.includes('opaque');
  const width = portrait ? 900 : square ? 1200 : loading ? 1000 : opaque ? 1400 : 1600;
  const height = portrait ? 1600 : square ? 1200 : loading ? 1000 : opaque ? 800 : 900;
  const ink = portrait ? '#f07848' : square ? '#76a7a1' : '#d8d4ca';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill="${ink}" d="M0 0h${width}v${height}H0z"/><path fill="#0b0c0c" fill-opacity=".72" d="M${width * 0.12} ${height * 0.14}h${width * 0.76}v${height * 0.72}H${width * 0.12}z"/><circle cx="${width * 0.5}" cy="${height * 0.5}" r="${Math.min(width, height) * 0.22}" fill="none" stroke="#fff" stroke-width="12"/></svg>`;
}

function createPhase3RouteController(loopbackOrigin, problems = browserProblems) {
  return createPlaywrightRouteController({
    loopbackOrigin,
    knownOrigins: ['https://published-images.invalid'],
    onUnexpected: (origin) => problems.push(`Unexpected external request blocked: ${origin}`),
    decideKnown: async ({ request }) => {
      if (request.url().includes('phase-3-loading')) await loadingMediaGate;
      return {
        action: 'fulfill',
        options: {
          status: 200,
          contentType: 'image/svg+xml',
          headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
          body: request.url().includes('phase-3-failed') ? '<not-valid-svg' : fixtureSvg(request.url()),
        },
      };
    },
  });
}

function sampleRenderer(context) {
  return context.evaluate(() => {
    const latticeCoordinate = (value) => Math.round(value * 1_000) / 1_000;
    const relativeRectangle = (node, origin, cell) => {
      if (!node) return null;
      const rectangle = node.getBoundingClientRect();
      return {
        left: latticeCoordinate((rectangle.left - origin.left) / cell),
        top: latticeCoordinate((rectangle.top - origin.top) / cell),
        width: latticeCoordinate(rectangle.width / cell),
        height: latticeCoordinate(rectangle.height / cell),
      };
    };
    const root = document.querySelector('.lattice-production-table');
    const plane = root.querySelector('.lattice-production-table__authored-plane');
    const rootRect = root.getBoundingClientRect();
    const style = getComputedStyle(root);
    const cell = Number.parseFloat(style.getPropertyValue('--lattice-production-cell-size'));
    const field = Object.fromEntries(['left', 'top', 'width', 'height'].map((key) => [key, Number.parseFloat(plane.style[key])]));
    const fieldOrigin = { left: rootRect.left + field.left, top: rootRect.top + field.top };
    const placements = [...root.querySelectorAll('.lattice-production-placement')].map((node) => {
      const placementRect = node.getBoundingClientRect();
      const opening = node.querySelector('.lattice-production-placement__opening');
      const image = opening?.querySelector('img');
      const mat = node.querySelector('.lattice-production-placement__mat');
      return {
        id: node.dataset.placementId,
        frameId: node.dataset.frameId,
        transparency: node.dataset.transparencyMode,
        layer: Number.parseFloat(node.style.zIndex),
        mediaState: node.dataset.mediaState,
        footprint: relativeRectangle(node, fieldOrigin, cell),
        opening: relativeRectangle(opening, placementRect, cell),
        image: relativeRectangle(image, opening?.getBoundingClientRect() || placementRect, cell),
        imageNatural: image ? { width: image.naturalWidth, height: image.naturalHeight, complete: image.complete } : null,
        imageBackground: image ? getComputedStyle(image).backgroundColor : null,
        openingBackground: opening ? getComputedStyle(opening).backgroundColor : null,
        placementBackground: getComputedStyle(node).backgroundColor,
        mat: relativeRectangle(mat, placementRect, cell),
        matColor: mat ? getComputedStyle(mat).backgroundColor : null,
        status: node.querySelector('.lattice-production-placement__status')?.textContent || null,
      };
    });
    const label = root.querySelector('.lattice-production-table__label');
    return {
      root: { width: rootRect.width, height: rootRect.height },
      cell,
      field,
      placements,
      gridOrigin: {
        x: Number.parseFloat(style.getPropertyValue('--lattice-production-grid-origin-x')),
        y: Number.parseFloat(style.getPropertyValue('--lattice-production-grid-origin-y')),
      },
      gridStyle: {
        positionX: style.backgroundPositionX,
        positionY: style.backgroundPositionY,
        size: style.backgroundSize,
      },
      label: label ? {
        anchorLeft: latticeCoordinate((Number.parseFloat(label.style.left) - field.left) / cell),
        anchorTop: latticeCoordinate((Number.parseFloat(label.style.top) - field.top) / cell),
        transform: label.style.transform,
        title: label.querySelector('strong')?.textContent || '',
        subtitle: label.querySelector('span')?.textContent || '',
      } : null,
      navigationOrder: placements.map(({ id }) => id),
      visualLayerOrder: [...placements].sort((left, right) => left.layer - right.layer).map(({ id }) => id),
      fingerprint: window.__latticePhase3.fingerprint,
      currentFingerprint: JSON.stringify(window.__latticePhase3.lattice),
      storageOps: window.__phase3StorageOps,
    };
  });
}

const expectedFootprints = Object.freeze({
  'phase3-transparent': { left: 1, top: 2, width: 8, height: 5 },
  'phase3-crop': { left: 11, top: 1, width: 6, height: 10 },
  'phase3-backed': { left: 19, top: 2, width: 6, height: 6 },
  'phase3-opaque-fallback': { left: 26, top: 2, width: 5, height: 4 },
  'phase3-auto-loading': { left: 2, top: 10, width: 7, height: 5 },
  'phase3-failed': { left: 11, top: 13, width: 5, height: 4 },
  'phase3-unsupported': { left: 19, top: 11, width: 5, height: 4 },
});
const navigationOrder = Object.freeze(Object.keys(expectedFootprints));
const visualLayerOrder = Object.freeze([
  'phase3-transparent', 'phase3-opaque-fallback', 'phase3-failed', 'phase3-backed',
  'phase3-unsupported', 'phase3-auto-loading', 'phase3-crop',
]);
const readyPlacementIds = Object.freeze([
  'phase3-transparent', 'phase3-crop', 'phase3-backed', 'phase3-opaque-fallback', 'phase3-auto-loading',
]);

function assertRectangle(actual, expected, message, tolerance = 0.002) {
  assert.ok(actual, `${message}: rectangle is missing`);
  for (const key of ['left', 'top', 'width', 'height']) {
    assert.ok(Math.abs(actual[key] - expected[key]) <= tolerance, `${message}.${key}: expected ${expected[key]}, received ${actual[key]}`);
  }
}

function cssNumbers(value) {
  return (String(value).match(/-?\d+(?:\.\d+)?/gu) || []).map(Number);
}

function assertCompletedSample(result) {
  assert.ok(result.cell > 0);
  assert.ok(Math.abs(result.field.width / result.cell - 32) < 1e-3);
  assert.ok(Math.abs(result.field.height / result.cell - 18) < 1e-3);
  assert.ok(result.field.left >= -1e-4 && result.field.top >= -1e-4);
  assert.ok(result.field.left + result.field.width <= result.root.width + 1e-4);
  assert.ok(result.field.top + result.field.height <= result.root.height + 1e-4);
  assert.ok(Math.abs(result.gridOrigin.x - result.field.left) < 1e-4);
  assert.ok(Math.abs(result.gridOrigin.y - result.field.top) < 1e-4);
  const gridX = cssNumbers(result.gridStyle.positionX);
  const gridY = cssNumbers(result.gridStyle.positionY);
  assert.equal(gridX.length, 2);
  assert.equal(gridY.length, 2);
  assert.ok(gridX.every((value) => Math.abs(value - result.gridOrigin.x) < 1e-4));
  assert.ok(gridY.every((value) => Math.abs(value - result.gridOrigin.y) < 1e-4));
  assert.ok(cssNumbers(result.gridStyle.size).every((value) => Math.abs(value - result.cell) < 1e-4));
  assert.equal(cssNumbers(result.gridStyle.size).length, 4);
  assert.deepEqual(result.navigationOrder, navigationOrder);
  assert.deepEqual(result.visualLayerOrder, visualLayerOrder);
  assert.equal(result.fingerprint, result.currentFingerprint, 'renderer input was mutated');
  assert.deepEqual(result.storageOps, []);
  assert.deepEqual(result.label, {
    anchorLeft: 30,
    anchorTop: 2,
    transform: 'translate(-100%, 0%)',
    title: 'Canonical center',
    subtitle: '32 × 18 / same public value',
  });

  const placements = Object.fromEntries(result.placements.map((placement) => [placement.id, placement]));
  for (const [id, footprint] of Object.entries(expectedFootprints)) assertRectangle(placements[id]?.footprint, footprint, `${id} footprint`);
  for (const id of readyPlacementIds) {
    assert.equal(placements[id].mediaState, 'ready', `${id} did not finish loading`);
    assert.equal(placements[id].status, null, `${id} retained a loading fallback`);
    assert.equal(placements[id].imageNatural.complete, true);
    assert.ok(placements[id].imageNatural.width > 0 && placements[id].imageNatural.height > 0);
  }

  const transparent = placements['phase3-transparent'];
  assertRectangle(transparent.opening, { left: 0, top: 0, width: 8, height: 5 }, 'transparent opening');
  assertRectangle(transparent.image, { left: 0, top: 0.25, width: 8, height: 4.5 }, 'native-ratio transparent image');
  assert.equal(transparent.imageNatural.width / transparent.imageNatural.height, 1600 / 900);
  assert.equal(transparent.openingBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(transparent.imageBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(transparent.placementBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(transparent.mat, null);

  const crop = placements['phase3-crop'];
  assertRectangle(crop.mat, { left: 0, top: 0, width: 6, height: 10 }, 'crop mat');
  assertRectangle(crop.opening, { left: 0.24, top: 0.6, width: 5.52, height: 8.6 }, 'asymmetric crop opening');
  assertRectangle(crop.image, { left: -0.69, top: -0.852, width: 6.9, height: 12.267 }, 'projected crop image');
  assert.ok(crop.image.left <= 0 && crop.image.top <= 0
    && crop.image.left + crop.image.width >= crop.opening.width
    && crop.image.top + crop.image.height >= crop.opening.height, 'cropped media must cover its opening');
  assert.equal(crop.matColor, 'rgb(216, 212, 202)');
  assert.equal(crop.openingBackground, 'rgba(0, 0, 0, 0)');

  const backed = placements['phase3-backed'];
  assertRectangle(backed.mat, { left: 0, top: 0, width: 6, height: 6 }, 'backed mat');
  assertRectangle(backed.opening, { left: 0.24, top: 0.24, width: 5.52, height: 4.8 }, 'backed opening');
  assert.equal(backed.matColor, 'rgb(9, 10, 10)');
  assert.equal(backed.openingBackground, 'rgb(201, 198, 189)');

  const opaque = placements['phase3-opaque-fallback'];
  assert.equal(opaque.openingBackground, 'rgb(216, 212, 202)');
  assert.equal(opaque.mat, null);
  assert.equal(placements['phase3-auto-loading'].openingBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(placements['phase3-failed'].openingBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(placements['phase3-unsupported'].openingBackground, 'rgba(0, 0, 0, 0)');
  assert.deepEqual(result.placements.filter(({ openingBackground }) => openingBackground !== 'rgba(0, 0, 0, 0)').map(({ id }) => id), [
    'phase3-backed', 'phase3-opaque-fallback',
  ]);

  const failed = placements['phase3-failed'];
  assert.equal(failed.mediaState, 'failed');
  assert.equal(failed.status, 'Artwork unavailable');
  assert.ok(failed.imageNatural?.complete);
  const unsupported = placements['phase3-unsupported'];
  assert.equal(unsupported.mediaState, 'unsupported');
  assert.equal(unsupported.status, 'Artwork unavailable');
  assert.equal(unsupported.image, null);
  return placements;
}

if (!interactiveMode) describe('Phase 3 production table renderer comparison', { concurrency: false }, () => {
  before(async () => runBrowserSetupWithCleanup(async () => {
    setupAbortController = new AbortController();
    const { signal } = setupAbortController;
    const browserPath = await findBrowser();
    const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    loadingMediaGate = new Promise((resolveLoading) => { releaseLoadingMedia = resolveLoading; });
    cleanupBrowserTest = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    resources.vite = await createViteServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
    await withinDeadline(resources.vite.listen(), BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs, 'Phase 3 Vite listen deadline exceeded');
    await waitForViteReadiness(`${baseUrl}${fixturePath}`, signal);

    const routeController = createPhase3RouteController(baseUrl);
    await launchPlaywrightEdge({
      edgePath: browserPath,
      runtimePath: runtimeDir,
      workspaceRoot: root,
      loopbackOrigin: baseUrl,
      routeController,
      resources,
      diagnostic,
      onBrowserProblem: (problem) => browserProblems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => {
        cleanupBrowserTest = createBrowserTestCleanup({ rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      },
    });
    page = resources.page;
    await page.setViewportSize({ width: 1280, height: 900 });
  }, async () => {
    cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    await cleanupBrowserTest(resources);
  }, {
    timeoutMs: BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs,
    diagnostic,
    cancelSetup: () => { setupAbortController?.abort(); void resources.browserServer?.kill?.(); },
  }));

  after(async () => {
    const failures = [];
    try {
      cleanupBrowserTest ||= createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
      await cleanupBrowserTest(resources);
    } catch (error) { failures.push(error); }
    if (browserProblems.length) failures.push(new Error(`Unexpected browser diagnostics:\n${browserProblems.join('\n')}`));
    if (failures.length) throw new AggregateError(failures, 'Phase 3 browser cleanup failed');
  });

  test('same canonical public table renders media and presentation contracts identically direct, framed, and resized', async () => {
    const response = await page.goto(`${baseUrl}${fixturePath}`, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    assert.ok(response?.ok());
    await page.locator('.phase3-direct-surface .lattice-production-table').waitFor({ state: 'attached', timeout: 10_000 });
    await page.waitForFunction(() => [...document.querySelectorAll('iframe')].every((frame) => frame.contentDocument?.querySelector('.lattice-production-table') && frame.contentWindow?.__latticePhase3), undefined, { timeout: 10_000 });

    const embeddedFrames = page.frames().filter((frame) => frame.url().includes(`${fixturePath}?embed=`));
    assert.equal(embeddedFrames.length, 2);
    const contexts = [page, ...embeddedFrames];
    await Promise.all(contexts.map((context) => context.waitForFunction(() => document.querySelector('[data-placement-id="phase3-auto-loading"]')?.dataset.mediaState === 'loading', undefined, { timeout: 10_000 })));
    const loadingSamples = await Promise.all(contexts.map(sampleRenderer));
    for (const result of loadingSamples) {
      const loading = result.placements.find(({ id }) => id === 'phase3-auto-loading');
      assert.equal(loading.mediaState, 'loading');
      assert.equal(loading.status, 'Loading artwork');
      assertRectangle(loading.footprint, expectedFootprints['phase3-auto-loading'], 'loading placement footprint');
      assert.equal(result.placements.find(({ id }) => id === 'phase3-unsupported').mediaState, 'unsupported');
      assert.equal(result.fingerprint, result.currentFingerprint);
      assert.deepEqual(result.storageOps, []);
    }

    releaseLoadingMedia();
    await Promise.all(contexts.map((context) => context.waitForFunction((readyIds) => readyIds.every((id) => document.querySelector(`[data-placement-id="${id}"]`)?.dataset.mediaState === 'ready')
      && document.querySelector('[data-placement-id="phase3-failed"]')?.dataset.mediaState === 'failed'
      && document.querySelector('[data-placement-id="phase3-unsupported"]')?.dataset.mediaState === 'unsupported', readyPlacementIds, { timeout: 10_000 })));
    await settlePlaywrightAnimationFrames(page);

    const samples = await Promise.all(contexts.map(sampleRenderer));
    assert.ok(samples.every(({ fingerprint }) => fingerprint === samples[0].fingerprint), 'every viewport received the exact same public lattice value');
    for (const result of samples) assertCompletedSample(result);

    const transparencyPixels = await page.evaluate(async (url) => {
      const response = await fetch(url);
      const objectUrl = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 9;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const alphaAt = (x, y) => context.getImageData(x, y, 1, 1).data[3];
      const pixels = { cornerAlpha: alphaAt(0, 0), centerAlpha: alphaAt(8, 4) };
      URL.revokeObjectURL(objectUrl);
      return pixels;
    }, 'https://published-images.invalid/phase-3-transparent.svg');
    assert.deepEqual(transparencyPixels, { cornerAlpha: 0, centerAlpha: 184 }, 'synthetic transparent media must retain a transparent corner and visible center');

    const beforeCell = samples[0].cell;
    await page.evaluate(() => {
      const surface = document.querySelector('.phase3-direct-surface');
      surface.style.width = '700px';
      surface.style.height = '500px';
    });
    await page.waitForFunction((previous) => Number.parseFloat(getComputedStyle(document.querySelector('.phase3-direct-surface .lattice-production-table')).getPropertyValue('--lattice-production-cell-size')) !== previous, beforeCell, { timeout: 5_000 });
    await settlePlaywrightAnimationFrames(page);
    const resized = await sampleRenderer(page);
    assert.notEqual(resized.cell, beforeCell);
    assertCompletedSample(resized);
    assert.equal(resized.fingerprint, samples[0].fingerprint);
    assert.deepEqual(resized.storageOps, []);
  });
});

async function runInteractiveVisualReview() {
  const visualResources = {};
  const visualProblems = [];
  const visualUrl = `http://127.0.0.1:${interactivePort}${fixturePath}`;
  const visualRuntimeDir = runtimeDir;
  let visualCleanup = createBrowserTestCleanup({ runtimePath: visualRuntimeDir, workspaceRoot: root, diagnostic });
  const visibleChromium = {
    launchServer: (options) => chromium.launchServer({ ...options, headless: false }),
    connect: (...arguments_) => chromium.connect(...arguments_),
  };
  try {
    const browserPath = await findBrowser();
    baseUrl = `http://127.0.0.1:${interactivePort}`;
    loadingMediaGate = Promise.resolve();
    releaseLoadingMedia = () => {};
    visualResources.vite = await createViteServer({
      root,
      logLevel: 'error',
      server: { host: '127.0.0.1', port: interactivePort, strictPort: true },
    });
    await visualResources.vite.listen();
    await waitForViteReadiness(visualUrl, new AbortController().signal);
    const routeController = createPhase3RouteController(baseUrl, visualProblems);
    await launchPlaywrightEdge({
      edgePath: browserPath,
      runtimePath: visualRuntimeDir,
      workspaceRoot: root,
      loopbackOrigin: baseUrl,
      routeController,
      resources: visualResources,
      browserType: visibleChromium,
      diagnostic,
      onBrowserProblem: (problem) => visualProblems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => {
        visualCleanup = createBrowserTestCleanup({ rootPid, processTree, runtimePath: visualRuntimeDir, workspaceRoot: root, diagnostic });
      },
    });
    await visualResources.page.setViewportSize({ width: 1280, height: 900 });
    const response = await visualResources.page.goto(visualUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    if (!response?.ok()) throw new Error(`Phase 3 visual fixture returned HTTP ${response?.status() ?? 'unknown'}`);
    await visualResources.page.locator('.phase3-direct-surface .lattice-production-table').waitFor({ state: 'attached', timeout: 10_000 });
    console.log(`Phase 3 visual review ready: ${visualUrl}`);
    console.log('Press Ctrl+C in this terminal to stop the visual review and clean up its browser and Vite server.');
    await new Promise((resolveStop) => {
      process.once('SIGINT', resolveStop);
      process.once('SIGTERM', resolveStop);
    });
  } finally {
    await visualCleanup(visualResources);
  }
  if (visualProblems.length) throw new Error(`Unexpected visual-review browser diagnostics:\n${visualProblems.join('\n')}`);
}

if (interactiveMode) await runInteractiveVisualReview();
