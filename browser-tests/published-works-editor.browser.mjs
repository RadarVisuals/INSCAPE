import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { interceptPublicationBoundary } from './fixtures/publication-boundary.mjs';
import { publishedCompositionEntries } from '../src/profileDocument/domain/publishedCanvases.js';
import { editorCommand } from './fixtures/editor-menu.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';

const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/published-works-editor';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const url = origin + '/browser-tests/profile-overview-fixture.html?view=0x' + '1'.repeat(40) + '&reception=published&canvas=1&collection=1';

test('open a published Gallery work missing from Studio beside an existing private draft', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(url + '&owner=1&publishedOnly=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    assert.equal(await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:anatomy')), null);
    await page.getByRole('button', { name: 'Studio', exact: true }).click();
    await page.locator('.editor-menu-bar[data-document="workbench:main"]').waitFor();
    await page.getByRole('button', { name: 'Back to Gallery' }).click();
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    const original = await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:private'));
    await page.getByRole('button', { name: 'Edit Anatomy in Studio' }).click();
    const editor = page.locator('.editor-menu-bar[data-document="workbench:anatomy"]');
    await editor.waitFor();
    await page.reload();
    await editor.waitFor();
    assert.deepEqual(await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:private')), original);
    assert.equal(await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:anatomy').name), 'Anatomy');
    const button = name => page.getByRole('button', { name, exact: true });
    await button('Back to Gallery').click();
    const editWork = button('Edit Anatomy in Studio');
    await editWork.waitFor();
    const gallery = page.locator('.workbench-overview');
    assert.equal(await gallery.evaluate(node => node.scrollHeight - node.clientHeight), 0);
    await page.setViewportSize({ width: 940, height: 680 });
    await page.locator('.composition-explorer-sources summary').press('Enter');
    await page.getByLabel('Artwork source', { exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Artwork source', { exact: true }).press('Tab');
    const detailsRail = page.getByRole('complementary', { name: 'Work details' });
    assert.ok(await detailsRail.evaluate(node => {
      const focus = document.activeElement.getBoundingClientRect(), bounds = node.getBoundingClientRect();
      return node.contains(document.activeElement) && focus.top >= bounds.top && focus.bottom <= bounds.bottom + 1;
    }));
    assert.equal(await gallery.evaluate(node => node.scrollHeight - node.clientHeight), 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await button('Wrap around').click();
    await button('Gallery options').click();
    await page.getByRole('slider', { name: 'Tile size' }).press('End');
    await button('Gallery options').click();
    await button('Open Vision').hover({ position: { x: 10, y: 10 } });
    await button('Edit Vision').click();
    await page.locator('.editor-menu-bar[data-document="workbench:main"]').waitFor();
    await button('Back to Gallery').click();
    await page.locator('.workbench-overview-gallery').waitFor();
    await button('Gallery options').click();
    assert.equal(await button('Wrap around').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.getByRole('slider', { name: 'Tile size' }).inputValue(), '3');
    await page.getByRole('radio', { name: 'List view' }).check();
    await button('Edit Vision in Studio').waitFor();
  } finally { await browser.close(); }
});

test('published Gallery and Studio move the same canvas from the list, tile and enlarged view', { timeout: 75000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto(url + '&owner=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    const flight = async (direction, id) => {
      const handle = await page.waitForFunction(({ direction, id }) => {
        const node = document.querySelector('.owner-canvas-journey');
        if (node?.dataset.direction !== direction || node.dataset.canvasId !== id) return;
        const move = node.getAnimations().find(animation => animation.effect.getTiming().duration === 650);
        const frames = move?.effect.getKeyframes();
        return frames && { from: frames[0], to: frames[frames.length - 1], copies: document.querySelectorAll('.owner-canvas-journey').length };
      }, { direction, id });
      const { from, to, copies } = await handle.jsonValue();
      assert.equal(copies, 1);
      assert.notDeepEqual([from.left, from.top, from.width, from.height], [to.left, to.top, to.width, to.height]);
      await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      return { from, to };
    };
    await button('Open Anatomy').click();
    await button('Zoom in').click();
    const viewport = page.locator('.composition-explorer-viewport');
    const originalScale = await viewport.getAttribute('data-camera-scale');
    await button('Edit Anatomy in Studio').click();
    const enter = await flight('editor', 'workbench:anatomy');
    await button('Back to Gallery').click();
    const back = await flight('overview', 'workbench:anatomy');
    assert.equal(enter.from.width, back.to.width);
    assert.ok(await button('Edit Anatomy in Studio').evaluate(node => node === document.activeElement));
    assert.equal(await viewport.getAttribute('data-camera-scale'), originalScale);
    await page.getByRole('radio', { name: 'Grid view' }).check();
    const copies = page.locator('[data-card-id="workbench:main"]');
    await copies.first().waitFor({ state: 'attached' });
    const copyIndex = await copies.evaluateAll(cards => cards.findLastIndex(card => {
      const box = card.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth;
    }));
    assert.ok(copyIndex >= 0);
    const copy = copies.nth(copyIndex);
    const cycle = await copy.evaluate(card => card.closest('[data-gallery-cycle]').dataset.galleryCycle);
    await copy.hover();
    await copy.locator('button[aria-label="Edit Vision"]').click();
    await flight('editor', 'workbench:main');
    await page.goBack();
    const landing = page.locator('[data-studio-return-tile]');
    await landing.waitFor({ state: 'attached' });
    assert.equal(await landing.evaluate(card => card.closest('[data-gallery-cycle]').dataset.galleryCycle), cycle);
    assert.equal(await copies.evaluateAll(cards => cards.filter(card => getComputedStyle(card).opacity === '0').length), 1);
    await flight('overview', 'workbench:main');
    assert.equal(await landing.count(), 0);
    await button('Quick view').click();
    await button('Open Anatomy').click();
    const expanded = page.getByRole('dialog', { name: 'View Anatomy' });
    await expanded.press('Tab');
    await expanded.getByRole('button', { name: 'Edit canvas' }).click();
    await flight('editor', 'workbench:anatomy');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await button('Back to Gallery').click();
    await button('Open Anatomy').waitFor();
    assert.equal(await page.locator('.owner-canvas-journey').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('one artwork surface holds the Gallery crop across a cold Studio route mount', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  let release;
  const chunk = new Promise(resolve => { release = resolve; });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
    const pending = page.waitForRequest(request => /OwnerSystemWorkflowRuntime[^/]*\.(js|jsx)(\?|$)/.test(request.url()));
    await page.route('**/*', async route => {
      const asset = new URL(route.request().url());
      if (asset.origin !== origin) return route.abort();
      if (/OwnerSystemWorkflowRuntime[^/]*\.(js|jsx)$/.test(asset.pathname)) await chunk;
      await route.continue();
    });
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto(url + '&owner=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await button('Open Anatomy').click();
    await button('Zoom in').click();
    const published = page.locator('.composition-explorer-viewport .workbench-overview-canvas');
    const box = await published.boundingBox();
    await button('Edit Anatomy in Studio').click();
    await pending;
    const stage = page.locator('.owner-canvas-journey[data-direction="editor"]');
    await stage.waitFor({ timeout: 2000 });
    // Exercise a cold load longer than the former transition watchdog.
    await page.waitForTimeout(4000);
    const hold = await stage.elementHandle();
    const before = await stage.locator('.workbench-overview-canvas').boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - box[key]) < 1);
    release();
    await page.waitForFunction(el => el.isConnected && el.getAnimations().length > 0, hold);
    await stage.waitFor({ state: 'detached' });
    await button('Back to Gallery').click();
    await button('Edit Anatomy in Studio').waitFor();
    await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
    const returned = await published.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(returned[key] - box[key]) < 1);
  } finally { release(); await browser.close(); }
});

test('first Gallery visit to Studio holds the artwork until the editor camera has fitted the canvas', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1.25 });
    page.setDefaultTimeout(6000);
    // Hold the first editor layout notification to reproduce a cold start independently of machine speed.
    await page.addInitScript(() => {
      const NativeObserver = window.ResizeObserver, pending = new Set();
      let released = false;
      window.releaseEditorLayout = () => { released = true; for (const notify of pending) notify(); pending.clear(); };
      window.ResizeObserver = class extends NativeObserver {
        constructor(notify) {
          super((entries, observer) => {
            if (!released && entries.some(entry => entry.target.matches('.system-workflow[data-editor-menu]'))) {
              pending.add(() => notify(entries, observer));
            } else notify(entries, observer);
          });
        }
      };
    });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const button = name => page.getByRole('button', { name, exact: true });
    const flying = page.locator('.owner-canvas-journey[data-direction="editor"]');
    await page.goto(url + '&owner=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await button('Open Anatomy').click();
    const published = await page.locator('.composition-explorer-viewport .workbench-overview-canvas').boundingBox();
    await button('Edit Anatomy in Studio').click();
    await flying.waitFor();
    const held = await flying.evaluate(async node => {
      for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
      const box = node.querySelector('.workbench-overview-canvas').getBoundingClientRect();
      return { moving: node.getAnimations().length > 0, x: box.x, y: box.y };
    });
    assert.equal(held.moving, false, 'The default camera must never become the flight destination');
    assert.ok(Math.abs(held.x - published.x) < 1 && Math.abs(held.y - published.y) < 1);
    await page.evaluate(() => window.releaseEditorLayout());
    const landing = await page.waitForFunction(() => {
      const node = document.querySelector('.owner-canvas-journey');
      const key = node?.getAnimations().map(a => a.effect.getKeyframes().at(-1)).find(k => k.left);
      return key && ['left', 'top', 'width', 'height'].map(k => parseFloat(key[k]));
    });
    const expected = await landing.jsonValue();
    await flying.waitFor({ state: 'detached' });
    const actual = await page.locator('.system-workflow .workbench-canvas-content:not([data-suspended])').evaluate(node => {
      const style = getComputedStyle(node), host = node.closest('.system-workflow').getBoundingClientRect();
      return ['left', 'top', 'width', 'height'].map((k, i) => parseFloat(style.getPropertyValue('--canvas-' + k)) + (i === 0 ? host.x : i === 1 ? host.y : 0));
    });
    actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1, 'The editor must paint at the landing frame'));
    await button('Back to Gallery').click();
    await button('Edit Anatomy in Studio').waitFor();
  } finally { await browser.close(); }
});

test('Gallery blends a published portrait into a resized, rearranged Studio draft in both directions', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(8000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const button = name => page.getByRole('button', { name, exact: true });
    const draft = () => page.evaluate(() => window.__galleryStore.readWorkbench('workbench:anatomy').draft);
    const assertPublished = async () => {
      await page.locator('.composition-explorer-viewport .workbench-overview-canvas[data-world-width="800"]').waitFor();
      assert.equal(await page.getByText('Unpublished studio revision', { exact: true }).count(), 0);
    };
    await page.goto(url + '&owner=1&revised=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await button('Open Anatomy').click();
    await assertPublished();
    const revision = await draft();
    assert.deepEqual(revision.workbench.imageModules[0].position, { left: 720, top: 160 });
    await button('Edit Anatomy in Studio').click();
    // Sample the composited frame halfway through the dissolve, independent of machine frame rate.
    const sample = await page.waitForFunction(() => {
      const node = document.querySelector('.owner-canvas-journey[data-direction="editor"]');
      const layer = document.querySelector('.workbench-canvas-content:not([data-suspended])');
      if (!node?.getAnimations().length || !layer?.getAnimations().length) return;
      const animations = [...node.getAnimations({ subtree: true }), ...layer.getAnimations()];
      animations.forEach(animation => { animation.pause(); animation.currentTime = 570; });
      const rect = node.getBoundingClientRect();
      const result = { opacity: Number(getComputedStyle(node).opacity), live: getComputedStyle(layer).visibility,
        liveOpacity: Number(getComputedStyle(layer).opacity), aspect: rect.width / rect.height,
        publishedWidth: node.querySelector('.workbench-overview-canvas').dataset.worldWidth };
      animations.forEach(animation => animation.play());
      return result;
    });
    const frame = await sample.jsonValue();
    assert.ok(frame.opacity > 0 && frame.opacity < 1);
    assert.equal(frame.live, 'visible');
    assert.equal(frame.liveOpacity, 1);
    assert.ok(Math.abs(frame.aspect - 1200 / 800) < 0.01);
    assert.equal(frame.publishedWidth, '800');
    await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
    // Observe the browser's outgoing Studio snapshot while the published canvas is on screen.
    const dissolve = page.waitForFunction(() => document.getAnimations().some(a => a.animationName === 'studio-draft-dissolve'));
    await Promise.all([dissolve, button('Back to Gallery').click()]);
    await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
    await assertPublished();
    await page.reload();
    await button('Open Anatomy').click();
    await assertPublished();
    const saved = await draft();
    assert.deepEqual(saved.workbench.area, revision.workbench.area);
    assert.deepEqual(saved.imageModules, revision.imageModules);
    assert.deepEqual(saved.workbench.imageModules, revision.workbench.imageModules);
    await page.goto(url + '&revised=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await button('Open Anatomy').click();
    await assertPublished();
    assert.equal(await button('Edit Anatomy in Studio').count(), 0);
  } finally { await browser.close(); }
});

test('Gallery handoff blends exposed draft pixels continuously without dimming unchanged artwork', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    for (const [width, revised, theme] of [[1440, true, 'dark'], [960, true, 'dark'], [1440, true, 'light'],
      [1440, false, 'dark'], [960, false, 'dark']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
      page.setDefaultTimeout(8000);
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(url + `&owner=1&theme=${theme}${revised ? '&revised=1' : ''}`);
      await page.getByRole('radio', { name: 'Grid view' }).check();
      await page.getByRole('button', { name: 'Open Anatomy', exact: true }).click();
      await page.getByRole('button', { name: 'Edit Anatomy in Studio', exact: true }).click();
      await page.waitForFunction(() => {
        const stage = document.querySelector('.owner-canvas-journey[data-direction="editor"]');
        const layer = document.querySelector('.workbench-canvas-content:not([data-suspended])');
        if (!stage?.getAnimations().length || !layer?.getAnimations().length) return false;
        [...stage.getAnimations({ subtree: true }), ...layer.getAnimations()].forEach(a => a.pause());
        return true;
      });
      await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
      const samples = [];
      for (const time of [493, 494, 533, 572, 611, 649]) {
        const points = await page.evaluate(({ time, revised }) => {
          const stage = document.querySelector('.owner-canvas-journey');
          const layer = document.querySelector('.workbench-canvas-content:not([data-suspended])');
          [...stage.getAnimations({ subtree: true }), ...layer.getAnimations()].forEach(a => { a.currentTime = time; });
          const box = stage.getBoundingClientRect();
          // The moved portrait extends beyond the old portrait's opaque pixels.
          // Also sample unchanged artwork and the empty canvas beside it.
          return [[revised ? .77 : .55, .70], [.05, .50]].map(([x, y]) => ({
            x: Math.round(box.x + x * box.width), y: Math.round(box.y + y * box.height),
          }));
        }, { time, revised });
        const png = await page.screenshot({ path: `${output}/handoff-${width}-${revised ? 'revised' : 'same'}-${theme}-${time}.png` });
        const pixels = await page.evaluate(async ({ data, points }) => {
          const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
          return points.map(({ x, y }) => {
            const values = ctx.getImageData(x - 1, y - 1, 3, 3).data;
            return [0, 1, 2].map(channel => {
              let sum = 0; for (let i = channel; i < values.length; i += 4) sum += values[i];
              return sum / 9;
            });
          });
        }, { data: png.toString('base64'), points });
        samples.push(pixels);
      }
      const delta = (a, b) => Math.max(...a.map((value, channel) => Math.abs(value - b[channel])));
      assert.ok(delta(samples[0][0], samples[1][0]) < 4, `${width}/${theme}: no visible cut at the draft handoff`);
      if (revised) assert.ok(delta(samples[1][0], samples.at(-1)[0]) > 20, 'The probe must cover actual changed artwork');
      for (let i = 2; i < samples.length - 1; i++) {
        const progress = ([493, 494, 533, 572, 611, 649][i] - 494) / (649 - 494);
        for (const point of [0, 1]) {
          const expected = samples[1][point].map((value, c) => value + progress * (samples.at(-1)[point][c] - value));
          assert.ok(delta(samples[i][point], expected) < 5, `${width}/${theme}: pixels follow the dissolve without a dark dip`);
        }
      }
      if (!revised) assert.ok(delta(samples[1][0], samples.at(-1)[0]) < 5, 'Identical artwork stays equally bright');
      await page.evaluate(() => document.getAnimations().forEach(a => a.play()));
      await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      await page.close();
    }
  } finally { await browser.close(); }
});

test('reversing a Gallery flight or requesting reduced motion retires the moving surface', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 850 }, reducedMotion: 'no-preference' });
    page.setDefaultTimeout(5000);
    await page.addInitScript(() => Object.defineProperty(document, 'startViewTransition', { value: undefined }));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const button = name => page.getByRole('button', { name, exact: true });
    const flying = page.locator('.owner-canvas-journey');
    await page.goto(url + '&owner=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await button('Open Anatomy').hover({ position: { x: 10, y: 10 } });
    await button('Edit Anatomy').click();
    await page.waitForFunction(() => document.querySelector('.owner-canvas-journey[data-direction="editor"]')?.getAnimations().length);
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('.owner-canvas-journey[data-direction="overview"]')?.getAnimations().length);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await flying.waitFor({ state: 'detached' });
    await page.goForward();
    await page.locator('.editor-menu-bar[data-document="workbench:anatomy"]').waitFor();
    assert.equal(await flying.count(), 0);
    await button('Back to Gallery').click();
    await button('Open Anatomy').waitFor();
    assert.equal(await flying.count(), 0);
    assert.equal(await page.locator('[data-canvas-journey-target]').count(), 0);
  } finally { await browser.close(); }
});

test('Gallery shows only published work to its owner and Studio preserves draft manager navigation', { timeout: 75000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(url);
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    const index = page.getByRole('navigation', { name: 'Canvases', exact: true });
    const editButtons = page.getByRole('button', { name: /^Edit .+ in Studio$/ });
    const editWork = page.getByRole('complementary', { name: 'Work details' }).getByRole('button', { name: 'Edit Anatomy in Studio' });
    assert.equal(await editButtons.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Gallery actions', exact: true }).count(), 0);
    assert.equal(await index.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
    await page.goto(url + '&owner=1');
    await page.getByRole('radio', { name: 'List view' }).check();
    await page.getByRole('complementary', { name: 'Work details' }).getByRole('button', { name: 'Edit Vision in Studio' }).waitFor();
    assert.equal(await index.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    await page.getByRole('button', { name: 'Edit Anatomy in Studio', exact: true }).click();
    await page.locator('.editor-menu-bar[data-document="workbench:anatomy"]').waitFor();
    await page.getByRole('button', { name: 'Back to Gallery' }).click();
    await index.getByRole('button', { name: 'Open Vision' }).waitFor();
    await page.goto(url.replace('&reception=published', '') + '&owner=1');
    await index.getByRole('button', { name: 'Open Vision' }).waitFor();
    assert.equal(await editButtons.count(), 1);
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    await editWork.waitFor();
    assert.equal(await editButtons.count(), 1);
    assert.equal(await index.getByRole('button', { name: 'Open Anatomy' }).getAttribute('aria-current'), 'page');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const camera = () => page.locator('.composition-explorer-viewport').evaluate(el =>
      [el.dataset.canvasId, el.dataset.cameraScale, el.dataset.cameraX, el.dataset.cameraY]);
    const original = await camera();
    await index.getByRole('button', { name: 'Open Private experiment' }).waitFor();
    const editor = page.locator('.editor-menu-bar[data-document]:visible');
    const back = page.getByRole('button', { name: 'Back to Gallery', exact: true });
    for (const motion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: motion });
      await editWork.click();
      await editor.waitFor();
      assert.equal(await page.locator('.editor-menu-bar[data-document]').getAttribute('data-document'), 'workbench:anatomy');
      assert.equal(new URL(page.url()).searchParams.get('work'), 'workbench:anatomy');
      if (motion === 'no-preference') {
        await page.waitForFunction(() => document.querySelector('.owner-canvas-journey[data-direction="editor"]')?.getAnimations().some(a => a.effect.getTiming().duration === 650));
      }
      await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      await editorCommand(page, 'Inscape', 'Manage compositions');
      if (motion === 'no-preference') {
        await page.waitForFunction(() => document.querySelector('.owner-canvas-journey[data-direction="overview"]')?.getAnimations().some(a => a.effect.getTiming().duration === 650));
      }
      await editWork.waitFor();
      await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      assert.deepEqual(await camera(), original);
      assert.ok(await editWork.evaluate(el => el === document.activeElement));
      assert.equal(new URL(page.url()).searchParams.get('canvas'), '1');
    }
    await page.goto(url + '&owner=1&editor=canvas&work=workbench:missing');
    await page.getByText('This work has no editable canvas in this workspace.').waitFor();
    assert.equal(await editor.count(), 0);
    await back.click();
    await index.getByRole('button', { name: 'Open Anatomy' }).waitFor();
    assert.equal(await index.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('rename and reorder a private Studio draft from its index row', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(6000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(url + '&owner=1');
    const button = name => page.getByRole('button', { name, exact: true });
    const rows = page.getByRole('navigation', { name: 'Canvases', exact: true });
    await button('Gallery actions').click();
    await button('Manage works').click();
    await button('Actions for Private experiment').click();
    await button('Rename').click();
    const input = rows.getByRole('textbox', { name: 'Composition name' });
    await input.fill('Private study');
    await input.press('Enter');
    await button('Actions for Private study').click();
    await button('Move up').click();
    assert.deepEqual(await rows.locator('[data-work-id]').evaluateAll(items => items.map(node => node.dataset.workId)),
      ['workbench:main', 'workbench:private', 'workbench:anatomy']);
    assert.equal(await button('Open Vision').getAttribute('aria-current'), 'page');
    await page.reload();
    await button('Open Private study').dblclick();
    await input.fill('Discard this name');
    await input.press('Escape');
    await button('Open Private study').waitFor();
    assert.equal(await rows.locator('[data-work-id]').nth(1).getAttribute('data-work-id'), 'workbench:private');
    await page.goto(url + '&owner=1');
    await button('Open Vision').waitFor();
    assert.equal(await button('Actions for Vision').count(), 0);
    assert.equal(await button('Open Private study').count(), 0);
  } finally { await browser.close(); }
});

test('create from Profile → Gallery, compose, and reopen the saved local work across list, grid and reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const button = name => page.getByRole('button', { name, exact: true });
    const name = 'First composition';
    const text = 'The shape of a new world.';
    await page.goto(url.replace('&canvas=1', '') + '&owner=1');
    await page.getByRole('heading', { name: 'Nomad', exact: true }).waitFor();
    await button('Gallery').click();
    await button('Gallery actions').click();
    await button('New composition').click();
    await page.getByLabel('Composition name', { exact: true }).fill(name);
    await button('Create composition').click();
    await button('Text tool').click();
    const id = await page.locator('.editor-menu-bar[data-document]').getAttribute('data-document');
    assert.equal(new URL(page.url()).searchParams.get('work'), id);
    await page.mouse.click(750, 240);
    const textbox = page.getByRole('textbox', { name: 'Article text', exact: true });
    await page.locator('.text-window').waitFor();
    if (!await textbox.isVisible()) {
      await page.locator('.text-window').click({ position: { x: 80, y: 90 } });
      const tools = await openSharedTool(page, 'Text');
      const edit = tools.getByRole('button', { name: 'Edit text', exact: true });
      if (await edit.count()) await edit.click();
    }
    await textbox.fill(text);
    await editorCommand(page, 'Inscape', 'Manage compositions');
    const index = page.getByRole('navigation', { name: 'Canvases', exact: true });
    const selected = index.getByRole('button', { name: `Open ${name}`, exact: true });
    await selected.waitFor();
    assert.equal(await selected.getAttribute('aria-current'), 'page');
    await page.getByRole('switch', { name: 'Grid view' }).check();
    await button(`Open ${name}`).hover({ position: { x: 10, y: 10 } });
    await button(`Edit ${name}`).click();
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    await page.goBack();
    await button(`Open ${name}`).waitFor();
    await page.goForward();
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      window.allowFixtureSave = () => { Storage.prototype.setItem = setItem; };
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('profile-overview-fixture:inscape.system-workflow-draft.')) throw new DOMException('Full', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });
    await page.goBack();
    await page.getByText('The document could not be saved. Retry its save first.', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('work'), id, 'Failed browser Back restores the editor URL');
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    await page.evaluate(() => window.allowFixtureSave());
    await editorCommand(page, 'Inscape', 'Manage compositions');
    await button(`Open ${name}`).waitFor();
    await page.getByRole('switch', { name: 'Grid view' }).uncheck();
    await selected.waitFor();
    await page.reload();
    await index.getByRole('button', { name: `Open ${name}` }).click();
    await button(`Edit ${name} in Studio`).click();
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    assert.equal(await page.locator('.editor-menu-bar[data-document]').getAttribute('data-document'), id);
    await page.goto(url);
    await page.getByRole('radio', { name: 'List view' }).check();
    await index.getByRole('button', { name: 'Open Vision' }).waitFor();
    assert.equal(await selected.count(), 0, 'The saved draft is still private to the owner');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Studio saves privately, publishes to Gallery, and returns to that composition after editing', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const network = await interceptPublicationBoundary(page, origin);
    const button = name => page.getByRole('button', { name, exact: true });
    const name = 'Evening study';
    await page.goto(url + '&owner=1');
    await page.getByRole('radio', { name: 'List view' }).check();
    await button('Gallery actions').click();
    await button('New composition').click();
    await page.getByLabel('Composition name').fill(name);
    await button('Create composition').click();
    const editor = page.locator('.editor-menu-bar:visible');
    const local = editor.getByRole('status', { name: 'Saved locally' });
    await local.getByText('Studio only').waitFor();
    const id = await editor.getAttribute('data-document');
    await button('Text tool').click();
    await page.mouse.click(720, 240);
    await page.locator('.text-window').waitFor();
    const textbox = page.getByRole('textbox', { name: 'Article text', exact: true });
    if (!await textbox.isVisible()) {
      await page.locator('.text-window').click({ position: { x: 80, y: 90 } });
      const tools = await openSharedTool(page, 'Text');
      const edit = tools.getByRole('button', { name: 'Edit text', exact: true });
      if (await edit.count()) await edit.click();
    }
    await textbox.fill('Light over the fields.');
    await editorCommand(page, 'Studio', 'Rename composition');
    await button('Cancel').click();
    await page.reload();
    await local.getByText('Studio only').waitFor();
    assert.equal(await editor.getAttribute('data-document'), id);
    await button('Publish').click();
    const candidate = page.getByRole('checkbox', { name: new RegExp(name) });
    await candidate.waitFor();
    assert.ok(await candidate.isChecked(), await page.locator('.owner-lattice-publication-rack__summary').locator('..').innerText());
    assert.ok(await button('Prepare publication').isEnabled(), await page.locator('.owner-lattice-publication-rack__summary').locator('..').innerText());
    await button('Prepare publication').click();
    await button('Make presentation public').click();
    await button('Publish to profile').waitFor();
    assert.equal(network.writes, 0);
    await local.getByText('Studio only').waitFor();
    await button('Publish to profile').click();
    await button('Dismiss publication confirmation').click();
    await local.getByText('In Gallery', { exact: true }).waitFor();
    assert.equal(network.writes, 1);
    await button('Back to Gallery').click();
    const selected = button('Edit ' + name + ' in Studio');
    await selected.waitFor();
    await selected.click();
    await editorCommand(page, 'Studio', 'Rename composition');
    await page.getByLabel('Composition name').fill(name + ' II');
    await button('Save name').click();
    await local.getByText('In Gallery', { exact: true }).waitFor();
    await button('Back to Gallery').click();
    await selected.waitFor();
    await page.reload();
    await selected.click();
    await editor.getByText(name + ' II', { exact: true }).waitFor();
    await editorCommand(page, 'Canvas', 'Delete local composition…');
    const removal = page.getByRole('alertdialog', { name: 'Delete local composition' });
    await removal.getByText(/Published versions stay online/).waitFor();
    await removal.getByRole('button', { name: 'Delete local composition' }).click();
    await removal.waitFor({ state: 'detached' });
    await button('Back to Gallery').click();
    await button('Open ' + name).waitFor();
    await page.reload();
    await button('Open ' + name).waitFor();
    assert.equal(await page.evaluate(id => window.__galleryStore.readWorkbench(id), id), null);
    assert.equal(network.writes, 1);
  } finally { await browser.close(); }
});

test('the public header and Studio share one anchor and keep account actions scoped to the signed-in reader', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    for (const width of [1440, 1280, 760, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(8000);
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const button = name => page.getByRole('button', { name, exact: true });
      const expectAvatar = file => page.waitForFunction(file => {
        const image = document.querySelector('.visitor-account-avatar img');
        return image?.complete && image.naturalWidth && new URL(image.currentSrc).pathname === '/assets/PFP/' + file;
      }, file);
      const metrics = header => header.evaluate(node => {
        const rect = node.getBoundingClientRect(), anchor = node.querySelector('.workspace-wordmark').getBoundingClientRect();
        const css = getComputedStyle(node);
        return { x: anchor.x, y: anchor.y, width: anchor.width, height: rect.height, top: rect.top,
          left: css.paddingLeft, right: css.paddingRight, border: css.borderBottomWidth, background: css.backgroundColor };
      });
      await page.goto(url);
      await page.getByRole('link', { name: 'Inscape home' }).waitFor();
      assert.equal(await button('Studio').count(), 0);
      const tabs = page.getByRole('navigation', { name: 'Profile navigation' });
      assert.deepEqual(await tabs.getByRole('button').allTextContents(), ['Profile', 'Gallery', 'Writing']);
      await page.goto(url + '&viewer=1');
      await expectAvatar('PFP.webp');
      await button('Reader account').click();
      const account = page.locator('.visitor-tools .strip-drawer:popover-open');
      assert.equal(await account.getByText('Reader', { exact: true }).count(), 1);
      for (const name of ['Copy address', 'QR code', 'Settings', 'Disconnect']) assert.ok(await account.getByRole('button', { name, exact: true }).isVisible());
      await account.getByRole('button', { name: 'QR code' }).click();
      await account.getByRole('img', { name: /QR code/ }).waitFor();
      await account.getByRole('button', { name: 'Back', exact: true }).click();
      assert.ok((await account.getByRole('link', { name: 'Universal Profile' }).getAttribute('href')).toLowerCase().includes('2'.repeat(40)));
      await page.keyboard.press('Escape');
      assert.equal(await button('Studio').count(), 0);
      const header = page.locator('.visitor-header');
      assert.equal(await header.getByRole('link', { name: 'Discover', exact: true }).count(), 0);
      await page.goto(url + '&owner=1');
      await expectAvatar('PFP.png');
      assert.equal(await header.locator('.visitor-breadcrumb').count(), 0);
      const publicBox = await metrics(header);
      if (width >= 1280) {
        assert.ok(await tabs.evaluate(node => node.scrollWidth <= node.clientWidth),
          'All desktop navigation labels fit beside the Gallery toolbar');
      }
      const studioLabel = header.getByRole('button', { name: 'Studio', exact: true });
      const publicLabel = await studioLabel.boundingBox();
      if (width <= 390) {
        const tabBox = await tabs.boundingBox(), controls = await header.locator('.visitor-tools').boundingBox();
        assert.ok(tabBox.x + tabBox.width <= controls.x, 'The tab scroller ends before the Studio controls');
        const activeTabVisible = () => tabs.evaluate(list => {
          const active = list.querySelector('[aria-current="page"]').getBoundingClientRect(), clip = list.getBoundingClientRect();
          return active.left >= clip.left - 1 && active.right <= clip.right + 1;
        });
        assert.ok(await activeTabVisible(), 'Gallery is visible on direct entry');
        const writing = new URL(url);
        writing.searchParams.delete('canvas'); writing.searchParams.delete('reception');
        writing.searchParams.set('tab', 'writing'); writing.searchParams.set('owner', '1');
        await page.goto(writing.href);
        await page.getByRole('heading', { name: 'Writing', exact: true }).waitFor();
        assert.ok(await activeTabVisible(), 'Writing is visible on direct entry');
        await tabs.getByRole('button', { name: 'Writing', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: 'Writing', exact: true }).waitFor();
        await tabs.getByRole('button', { name: 'Gallery', exact: true }).click();
        await tabs.getByRole('button', { name: 'Gallery', exact: true }).waitFor();
      }
      assert.equal(publicBox.height, width > 1250 ? 48 : 92); assert.equal(publicBox.top, 0); assert.equal(publicBox.x, 16);
      assert.equal(publicBox.left, '16px'); assert.equal(publicBox.right, '16px');
      assert.equal(publicBox.border, '0px'); assert.equal(publicBox.background, 'rgba(0, 0, 0, 0)');
      await button('Inscape menu').click();
      const menu = page.getByRole('menu', { name: 'Inscape menu', exact: true });
      assert.deepEqual(await menu.getByRole('menuitemcheckbox').locator('span').allTextContents(),
        ['Profile', 'Gallery', 'Writing', 'Studio']);
      assert.equal(await menu.getByRole('menuitemcheckbox', { name: 'Gallery' }).getAttribute('aria-checked'), 'true');
      assert.equal(await menu.getByRole('menuitem', { name: 'Canvas' }).count(), 0);
      assert.equal(await menu.getByRole('menuitem', { name: 'Backup' }).count(), 0);
      await page.screenshot({ path: output + '/gallery-menu-' + width + '.png' });
      await menu.getByRole('menuitemcheckbox', { name: 'Studio' }).click();
      const studio = page.locator('.editor-menu-bar[data-document]:visible');
      await studio.waitFor(); await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      const editorBox = await metrics(studio);
      const activeLabel = await studio.locator('.studio-header-label[aria-current="page"]').boundingBox();
      for (const key of ['x', 'width', 'height']) {
        assert.ok(Math.abs(activeLabel[key] - publicLabel[key]) <= 1, `Studio keeps its ${key} at ${width}px (Gallery ${publicLabel[key]}, Studio ${activeLabel[key]})`);
      }
      assert.equal(editorBox.height, 48);
      for (const key of ['x', 'width', 'top', 'left', 'right']) {
        assert.equal(editorBox[key], publicBox[key], `Shared header anchor ${key} at ${width}px`);
      }
      const studioButton = studio.getByRole('button', { name: 'Studio', exact: true });
      await studioButton.press('ArrowDown');
      const studioMenu = page.getByRole('menu', { name: 'Studio', exact: true });
      await studioMenu.getByRole('menuitem', { name: 'New composition', exact: true }).click();
      const newWork = page.getByRole('dialog', { name: 'New composition', exact: true });
      await newWork.getByRole('button', { name: 'Cancel' }).click();
      assert.ok(await studioButton.evaluate(node => node === document.activeElement));
      await studioButton.click();
      await studioMenu.getByRole('menuitem', { name: 'Rename composition' }).click();
      await page.getByRole('dialog', { name: 'Rename composition' }).press('Escape');
      assert.equal(editorBox.border, '1px'); assert.notEqual(editorBox.background, publicBox.background);
      assert.equal(await studio.locator('.visitor-account-avatar, .visitor-tabs').count(), 0);
      await button('Inscape menu').click();
      assert.equal(await menu.getByRole('menuitemcheckbox', { name: 'Studio' }).getAttribute('aria-checked'), 'true');
      for (const label of ['Search commands...', 'Canvas', 'Edit', 'View', 'Tools', 'Backup']) {
        assert.equal(await menu.getByRole('menuitem', { name: label, exact: true }).count(), 1);
      }
      await page.screenshot({ path: output + '/studio-menu-' + width + '.png' });
      await page.keyboard.press('Escape');
      await button('Back to Gallery').click();
      await expectAvatar('PFP.png');
      await page.close();
    }
  } finally { await browser.close(); }
});

test('unpublished Gallery and Writing remain navigable with creation available to the owner', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const tabs = page.getByRole('navigation', { name: 'Profile navigation' });
    const create = page.getByRole('button', { name: 'New composition', exact: true });
    for (const session of ['', '&viewer=1', '&owner=1']) {
      await page.goto(url + '&unpublished=1' + session);
      await page.getByRole('heading', { name: 'Gallery', exact: true }).waitFor();
      await page.getByText('No compositions in Gallery yet.').waitFor();
      assert.deepEqual(await tabs.getByRole('button').allTextContents(), ['Profile', 'Gallery', 'Writing']);
      assert.equal(await create.count(), session === '&owner=1' ? 1 : 0);
      assert.equal(await page.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
      await tabs.getByRole('button', { name: 'Writing' }).click();
      await page.getByRole('heading', { name: 'Writing' }).waitFor();
      await page.getByText('No published writing yet.').waitFor();
      assert.equal(await tabs.getByRole('button', { name: 'Writing' }).getAttribute('aria-current'), 'page');
    }
    await tabs.getByRole('button', { name: 'Gallery' }).click();
    await create.click();
    await page.getByRole('button', { name: 'Create composition' }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [title, flag, width, linked] of [
  ['Vision', 'last-gallery', 1440, false], ['Mixed study', 'mixed', 390, true],
]) test('remove ' + title + ' from the published Gallery and keep its Studio draft', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const touch = width === 390;
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, reducedMotion: 'reduce' });
    const errors = [];
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    const network = await interceptPublicationBoundary(page, origin);
    const gallery = url + '&' + flag + '=1';
    const openWork = page.getByRole('button', { name: 'Open ' + title, exact: true });
    const actions = page.getByRole('button', { name: 'Gallery actions', exact: true });
    const remove = page.getByRole('button', { name: 'Remove from Gallery (1)', exact: true });
    const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
    const draft = () => page.evaluate(() => window.__galleryStore.getBackupSnapshot());
    const names = document => publishedCompositionEntries(document, 'profile').map(entry => entry.name);
    for (const reader of ['', '&viewer=1']) {
      await page.goto(gallery + reader);
      await page.getByRole('radio', { name: 'Grid view' }).check();
      await openWork.waitFor();
      assert.equal(await actions.count(), 0);
    }
    await page.goto(gallery + '&owner=1');
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await openWork.waitFor();
    const snapshot = await draft();
    const previous = await page.evaluate(() => window.__overviewPublication);
    const showRemove = async () => {
      await actions.click();
      await page.getByRole('button', { name: 'Select works…', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Select ' + title, exact: true }).check();
      await remove.click();
      await sheet.waitFor();
      const review = await sheet.innerText();
      assert.ok(review.includes(title));
      assert.match(review, /local Studio (draft|composition)/i);
      assert.match(review, linked ? /stays? on Profile|still appear on Profile/i : /leaves? the current publication/i);
    };
    await showRemove();
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    assert.ok(await remove.evaluate(node => node === document.activeElement), 'Cancel returns focus to the batch action');
    assert.equal(network.uploads, 0); assert.equal(network.writes, 0);
    assert.deepEqual(await draft(), snapshot);

    await remove.click();
    const prepare = sheet.getByRole('button', { name: 'Prepare publication', exact: true });
    await prepare.waitFor();
    assert.ok(await prepare.isEnabled(), await sheet.innerText());
    await prepare.click();
    await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).waitFor();
    assert.equal(network.uploads, 0); assert.equal(network.writes, 0);
    await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).click();
    const submit = sheet.getByRole('button', { name: 'Publish to profile', exact: true });
    await submit.waitFor();
    assert.equal(network.uploads, 1); assert.equal(network.writes, 0);
    const next = JSON.parse(network.bytes);
    assert.deepEqual(publishedCompositionEntries(next, 'gallery'), []);
    assert.deepEqual(names(next), names(previous));
    assert.equal(names(next).includes(title), linked);
    await submit.click();
    const receipt = page.getByLabel('Publication complete');
    await receipt.getByText('Removed from Gallery', { exact: true }).waitFor();
    assert.ok((await receipt.getByRole('status').innerText()).includes(title));
    await receipt.getByRole('button', { name: 'Dismiss publication confirmation' }).click();
    await page.getByText('No compositions in Gallery yet.', { exact: true }).waitFor();
    assert.equal(network.writes, 1);
    await page.reload();
    await page.getByText('No compositions in Gallery yet.', { exact: true }).waitFor();
    assert.deepEqual(await draft(), snapshot);
    await page.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Nomad', exact: true }).waitFor();
    assert.equal(await openWork.count(), linked ? 1 : 0);
    assert.equal(await actions.count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a changed verified Gallery stops removal before the wallet write', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const network = await interceptPublicationBoundary(page, origin);
    await page.goto(url + '&owner=1&bulk=1&changed-publication=1');
    await page.getByRole('button', { name: 'Gallery actions', exact: true }).click();
    await page.getByRole('button', { name: 'Select works…', exact: true }).click();
    await page.getByRole('button', { name: 'Select all', exact: true }).click();
    await page.getByRole('button', { name: 'Remove from Gallery (3)', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
    await page.evaluate(() => {
      window.__pausePublicationVerification = () => new Promise(resolve => { window.__finishPublicationVerification = resolve; });
    });
    for (const label of ['Prepare publication', 'Make presentation public', 'Publish to profile']) {
      await sheet.getByRole('button', { name: label, exact: true }).click();
    }
    await page.waitForFunction(() => typeof window.__finishPublicationVerification === 'function');
    const cancel = sheet.getByRole('button', { name: 'Cancel', exact: true });
    assert.equal(await cancel.isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await sheet.isVisible(), true);
    assert.equal(network.writes, 0);
    await page.evaluate(() => window.__finishPublicationVerification());
    await sheet.getByText(/Gallery has changed/i).waitFor();
    assert.equal(network.writes, 0);
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    const selection = page.getByRole('group', { name: 'Gallery selection', exact: true });
    await selection.getByRole('button', { name: 'Remove from Gallery (3)' }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Select Vision', exact: true }).isChecked(), true);
    await selection.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Open Vision', exact: true }).waitFor();
  } finally { await browser.close(); }
});

for (const [width, removeEverything] of [[1440, false], [390, true]]) {
  test('batch removal in the published Gallery at ' + width + 'px uses one publication', { timeout: 50000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 390, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const network = await interceptPublicationBoundary(page, origin);
      await page.goto(url + '&bulk=1&owner=1');
      const button = name => page.getByRole('button', { name, exact: true });
      const checkbox = name => page.getByRole('checkbox', { name: 'Select ' + name, exact: true });
      const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
      const snapshot = () => page.evaluate(() => window.__galleryStore.getBackupSnapshot());
      await button('Gallery actions').waitFor();
      await page.getByRole('radio', { name: removeEverything ? 'Grid view' : 'List view' }).check();
      await page.locator(removeEverything ? '.workbench-overview-gallery' : '.composition-index').waitFor();
      const before = await snapshot();
      const original = await page.evaluate(() => window.__overviewPublication);

      await button('Gallery actions').click();
      await button('Select works…').click();
      assert.equal(await page.getByRole('checkbox').count(), 3);
      assert.equal(await checkbox('Private experiment').count(), 0);
      assert.equal(await checkbox('Profile link').count(), 0);
      assert.equal(await button('Remove from Gallery (0)').isDisabled(), true);
      await checkbox('Bento').check();
      await page.getByRole('radio', { name: !removeEverything ? 'Grid view' : 'List view' }).check();
      assert.ok(await checkbox('Bento').isChecked());
      await page.getByRole('radio', { name: removeEverything ? 'Grid view' : 'List view' }).check();
      assert.ok(await checkbox('Bento').isChecked());
      await button('Cancel').click();
      await button('Gallery actions').waitFor();
      assert.equal(network.writes, 0);
      assert.deepEqual(await snapshot(), before);

      await button('Gallery actions').click();
      await button('Select works…').click();
      await button('Select all').click();
      for (const name of ['Vision', 'Anatomy', 'Bento']) assert.equal(await checkbox(name).isChecked(), true);
      await button('Deselect all').click();
      assert.equal(await button('Remove from Gallery (0)').isDisabled(), true);
      await button('Select all').click();
      if (!removeEverything) await checkbox('Anatomy').uncheck();
      const selected = removeEverything ? ['Vision', 'Anatomy', 'Bento'] : ['Vision', 'Bento'];
      const remove = button('Remove from Gallery (' + selected.length + ')');
      await remove.click();
      const impacts = sheet.getByRole('list', { name: 'Selected works' });
      await impacts.waitFor();
      assert.equal(await impacts.getByRole('listitem').count(), selected.length);
      for (const name of selected) {
        const item = impacts.getByRole('listitem').filter({ hasText: name });
        assert.match(await item.innerText(), name === 'Bento' ? /stays on Profile/i : /leaves the current publication/i);
      }
      await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
      await remove.waitFor();
      await page.waitForFunction(() => document.activeElement?.textContent.includes('Remove from Gallery'));
      for (const name of selected) assert.equal(await checkbox(name).isChecked(), true);
      assert.equal(network.uploads, 0); assert.equal(network.writes, 0);
      await remove.click();
      await sheet.getByRole('button', { name: 'Prepare publication', exact: true }).click();
      await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).click();
      const publish = sheet.getByRole('button', { name: 'Publish to profile', exact: true });
      await publish.waitFor();
      assert.equal(network.uploads, 1); assert.equal(network.writes, 0);
      const next = JSON.parse(network.bytes);
      assert.deepEqual(publishedCompositionEntries(next, 'gallery').map(item => item.name), removeEverything ? [] : ['Anatomy']);
      const retained = document => publishedCompositionEntries(document, 'profile').map(entry => {
        const { destinations, ...content } = entry; return content;
      });
      assert.deepEqual(retained(next), retained(original), 'profile placements retain their published artwork');
      await publish.click();
      const receipt = page.getByLabel('Publication complete');
      await receipt.getByText('Removed from Gallery', { exact: true }).waitFor();
      const status = receipt.getByRole('status');
      assert.ok((await status.innerText()).includes(String(selected.length)));
      assert.deepEqual((await status.getByRole('listitem').allTextContents()).sort(), selected.slice().sort());
      assert.equal(new URL(await receipt.getByRole('link', { name: 'View Gallery' }).getAttribute('href'), origin).searchParams.get('tab'), 'gallery');
      assert.match(await receipt.getByRole('link', { name: 'View transaction' }).getAttribute('href'), /\/tx\/0xa{64}$/u);
      await receipt.getByRole('button', { name: 'Dismiss publication confirmation' }).click();
      await page.reload();
      if (removeEverything) await page.getByText('No compositions in Gallery yet.', { exact: true }).waitFor();
      else await button('Open Anatomy').waitFor();
      assert.equal(await button('Open Vision').count(), 0);
      assert.equal(await button('Open Bento').count(), 0);
      await page.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button', { name: 'Profile' }).click();
      await button('Open Bento').waitFor(); await button('Open Profile link').waitFor();
      assert.deepEqual(await snapshot(), before);
      assert.equal(network.writes, 1); assert.equal(network.uploads, 1);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('a rejected bulk upload includes the server error code and upload phase in copied support details', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const network = await interceptPublicationBoundary(page, origin);
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async value => { window.__copiedPublicationReport = value; } },
    }));
    const providerDetail = 'Synthetic upstream message with a private identifier';
    await page.route('**/api/profile-publications', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({ status: 429, headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin },
        body: JSON.stringify({ error: { code: 'UPLOAD_PROFILE_QUOTA', message: providerDetail } }) });
    });
    await page.goto(url + '&bulk=1&owner=1');
    for (const label of ['Gallery actions', 'Select works…', 'Select all', 'Remove from Gallery (3)']) await page.getByRole('button', { name: label, exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
    await sheet.getByRole('button', { name: 'Prepare publication', exact: true }).click();
    await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).click();
    await sheet.getByText('Help with this error', { exact: true }).click();
    await sheet.getByRole('button', { name: 'COPY DETAILS', exact: true }).click();
    const report = await page.evaluate(() => window.__copiedPublicationReport);
    assert.match(report, /code:\s*UPLOAD_PROFILE_QUOTA/i);
    assert.match(report, /phase:\s*IPFS_UPLOAD/i);
    assert.ok(!report.includes(providerDetail));
    assert.equal(network.writes, 0);
    assert.equal(await page.getByLabel('Publication complete').count(), 0);
  } finally { await browser.close(); }
});

test('Studio Preview opens a single image from Gallery and on direct editor entry', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const button = name => page.getByRole('button', { name, exact: true });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const { handler } = await import('../netlify/functions/artwork-document.mjs');
    await page.route(origin + '/.netlify/functions/artwork-document', async route => {
      const response = await handler();
      await route.fulfill({ status: response.statusCode, headers: response.headers, body: response.body });
    });
    await page.goto(url + '&owner=1');
    await page.getByRole('radio', { name: 'List view' }).check();
    await button('Edit Vision in Studio').click();
    const play = button('Preview');
    await play.waitFor();
    for (const direct of [false, true]) {
      if (direct) await page.reload();
      const saved = await page.evaluate(() => window.__galleryStore.getBackupSnapshot());
      const editorUrl = page.url();
      await play.click();
      const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
      const artwork = preview.locator('[data-navigator-object="image:study"]');
      await artwork.locator('svg image').waitFor();
      assert.equal(await preview.locator('[data-navigator-object]').count(), 1);
      const pixels = (await artwork.screenshot()).toString('base64');
      assert.ok(await page.evaluate(async png => {
        const image = new Image(); image.src = 'data:image/png;base64,' + png;
        await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const raster = ctx.getImageData(0, 0, image.width, image.height).data;
        return raster.some((channel, i) => i % 4 === 0 && channel === 211 && raster[i + 1] === 208 && raster[i + 2] === 200);
      }, pixels), 'the published portrait colour is painted in Preview');
      assert.equal(await page.locator('.visitor-grid-world').count(), 0);
      assert.equal(await preview.getByRole('navigation').count(), 0);
      assert.equal(await preview.getByRole('button', { name: /page appearance|responsive layout|studio preview controls/i }).count(), 0);
      assert.equal(await preview.getByRole('slider').count(), 0);
      await preview.getByRole('button', { name: 'Back to editing' }).click();
      await preview.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Preview');
      assert.equal(page.url(), editorUrl);
      assert.deepEqual(await page.evaluate(() => window.__galleryStore.getBackupSnapshot()), saved);
    }
  } finally { await browser.close(); }
});

test('visited profile strip opens below its fixed header and QR fills the drawer', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(url + '&viewer=1&theme=light');
    const trigger = page.getByRole('button', { name: 'Profile of Nomad' });
    const surface = node => {
      const css = getComputedStyle(node);
      return [css.backgroundColor, css.borderTopColor, css.boxShadow, css.borderRadius];
    };
    const faces = [];
    for (const mode of ['dark', 'light']) {
      await page.getByRole('switch', { name: 'Dark mode' }).setChecked(mode === 'dark');
      await page.getByRole('button', {name:'Inscape menu', exact:true}).click();
      const menuSurface = await page.getByRole('menu', {name:'Inscape menu',exact:true}).evaluate(surface);
      await page.keyboard.press('Escape');
      await trigger.click();
      const drawerSurface = await page.locator('.strip-drawer:popover-open').evaluate(surface);
      assert.deepEqual(drawerSurface, menuSurface);
      faces.push(drawerSurface[0]);
      await page.keyboard.press('Escape');
    }
    assert.notEqual(faces[0], faces[1]);
    await trigger.click();
    const panel = page.getByRole('region', { name: 'Nomad profile details' });
    const box = await trigger.boundingBox();
    assert.ok(box.width < 150); assert.equal(box.height, 35);
    assert.equal((await panel.boundingBox()).width, 242);
    assert.equal(await panel.locator('code').innerText(), '0x1111\u20261111');
    assert.equal(await panel.locator('.strip-tags,.strip-bio').count(), 0);
    await page.waitForFunction(() => {
      const panel = document.querySelector('.strip-drawer:popover-open'), button = document.querySelector('.strip-trigger');
      return panel && panel.getBoundingClientRect().top >= button.getBoundingClientRect().bottom;
    });
    await panel.getByRole('button', { name: 'Copy address' }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '0x' + '1'.repeat(40));
    await panel.getByRole('button', { name: 'QR code' }).click();
    await panel.getByRole('img', { name: /QR code/ }).waitFor();
    assert.equal(await panel.getByRole('button', { name: 'Copy address' }).count(), 0);
    await panel.getByRole('button', { name: 'Back', exact: true }).click();
    await panel.getByRole('button', { name: 'Tip LYX' }).click();
    await panel.getByRole('button', { name: 'Review in wallet' }).waitFor();
    await page.keyboard.press('Escape');
    await panel.waitFor({state:'hidden'});
    await page.goto(url);
    await trigger.click();
    assert.equal(await panel.getByRole('button', { name: 'Tip LYX' }).count(), 0);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } },
    }));
    await panel.getByRole('button', { name: 'Copy address' }).click();
    const full = panel.getByRole('textbox', { name: 'Full UP address' });
    assert.equal(await full.inputValue(), '0x' + '1'.repeat(40));
    assert.ok(await full.evaluate(input => input === document.activeElement && input.selectionStart === 0 && input.selectionEnd === input.value.length));
    await panel.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.dataset.view === 'address');
    await page.goto(url + '&owner=1');
    await page.getByRole('button', { name: 'Nomad account' }).click();
    assert.equal(await trigger.count(), 0);
    assert.equal(await panel.getByRole('button', { name: 'Tip LYX' }).count(), 0);
    await panel.getByRole('button', { name: 'My profile' }).waitFor();
  } finally { await browser.close(); }
});
