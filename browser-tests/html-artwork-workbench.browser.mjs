import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/html-artwork-workbench';
const presentation = page => page.evaluate(() => workbenchPerf.record().workbenches[0].content.workbench.miniApps[0]);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 2, label + ': ' + actual + ' ≈ ' + expected);
async function zoom(page, target) {
  for (let i = 0; i < 24; i++) {
    const current = parseFloat(await page.locator('.navigator-zoom output').textContent()) / 100;
    if (Math.abs(current - target) < .006) return;
    await page.locator('main.system-workflow').dispatchEvent('wheel', {
      deltaY: Math.max(-100, Math.min(100, -Math.log(target / current) / .003)),
      ctrlKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true,
    });
    await page.waitForTimeout(75);
  }
  throw new Error('Camera did not reach the requested zoom');
}

test('HTML artwork uses authored canvas geometry through zoom, pan, edits, narrow viewports, switching and reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'workbench-perf.invalid') {
        if (url.pathname === '/panel.html') return route.fulfill({ contentType: 'text/html',
          body: '<!doctype html><body style="margin:0;background:#273c43;color:white"><button>Artwork control</button></body>' });
        return route.fulfill({ path: url.pathname === '/__perf-layered.svg' ? 'browser-tests/fixtures/keeper-layered.svg'
          : path.join('public', url.pathname), headers: { 'access-control-allow-origin': '*' } });
      }
      return url.origin === origin ? route.continue() : route.abort();
    });
    await page.goto(origin + '/browser-tests/filled-workbench-performance-fixture.html?size=filled&count=2&animated=0');
    const selector = page.getByRole('combobox', { name: 'Active Workbench', exact: true });
    await selector.waitFor();
    const closeTools = page.getByRole('button', { name: 'Close Text tools', exact: true });
    if (await closeTools.isVisible()) await closeTools.click();
    const artwork = page.locator('[data-workbench-view-id="miniapp:perf-0"]');
    await artwork.waitFor({ state: 'attached' });
    const initial = await presentation(page);
    const start = await artwork.boundingBox();
    near(start.x, 480, 'initial left'); near(start.y, 2450, 'initial top');
    assert.equal(await artwork.locator('iframe').count(), 0, 'offscreen artwork is not executing');
    await zoom(page, .3);
    await artwork.locator('iframe').waitFor();
    const scaled = await artwork.boundingBox();
    // The UI displays rounded percent; use the actual shared camera scale.
    const scale = await artwork.evaluate(node => parseFloat(getComputedStyle(node).getPropertyValue('--workbench-pan-scale')));
    near(scaled.x, initial.window.left * scale, 'zoomed left');
    near(scaled.y, initial.window.top * scale, 'zoomed top');
    near(scaled.width, initial.window.width * scale, 'zoomed width');
    near(scaled.height, initial.window.height * scale, 'zoomed height');
    const embedded = page.frames().find(frame => frame.url().includes('panel.html'));
    assert.deepEqual(await embedded.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      { width: 400, height: 300 }, 'camera zoom does not resize or reflow the embedded document');
    near((await artwork.locator('iframe').boundingBox()).width, scaled.width, 'HTML pixels share the canvas scale');
    const pixels = await artwork.locator('iframe').boundingBox();
    near(pixels.x, scaled.x, 'artwork starts at the authored left edge');
    near(pixels.y, scaled.y, 'hidden controls do not inset the artwork');
    near(pixels.height, scaled.height, 'artwork fills the authored height');
    await page.locator('main.system-workflow').dispatchEvent('wheel', {
      deltaY: 100, deltaX: 0, clientX: 0, clientY: 0, bubbles: true, cancelable: true,
    });
    await page.waitForTimeout(350);
    assert.ok((await artwork.boundingBox()).y < scaled.y - 50, 'HTML follows canvas panning');
    assert.deepEqual(await presentation(page), initial, 'camera never becomes authored geometry');
    const beforeMove = await artwork.boundingBox();
    await artwork.locator('header').focus();
    await page.keyboard.press('Alt+ArrowRight');
    await page.waitForFunction(left => document.querySelector('[data-workbench-view-id="miniapp:perf-0"]').getBoundingClientRect().x > left + 1.5, beforeMove.x);
    const moved = await artwork.boundingBox();
    near(moved.x, beforeMove.x + 8, 'movement follows the shared eight-screen-pixel camera gesture');
    const resize = artwork.getByRole('separator', { name: 'Resize Artwork window', exact: true });
    await resize.focus(); await page.keyboard.press('Alt+ArrowRight');
    await page.waitForFunction(width => document.querySelector('[data-workbench-view-id="miniapp:perf-0"]').getBoundingClientRect().width > width + 1.5, moved.width);
    near((await artwork.boundingBox()).width, moved.width + 8 * scale, 'keyboard resize uses canvas units');
    let edited = { ...initial, window: { ...initial.window, left: initial.window.left + 8 / scale, width: initial.window.width + 8 } };
    await mkdir(output, { recursive: true });
    for (const width of [1440, 700, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(300);
      const bounds = await artwork.boundingBox();
      near(bounds.width, edited.window.width * scale, 'viewport does not shrink authored width');
      await page.screenshot({ path: path.join(output, 'html-artwork-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await selector.selectOption('workbench:perf-1');
    const saved = await presentation(page);
    near(saved.window.left, edited.window.left, 'switch saves movement in canvas units');
    assert.equal(saved.window.top, edited.window.top);
    assert.equal(saved.window.width, edited.window.width);
    assert.equal(saved.window.height, edited.window.height);
    edited = saved;
    assert.equal(await page.locator('.html-artwork-frame').count(), 0);
    await selector.selectOption('workbench:main'); await artwork.waitFor({ state: 'attached' });
    assert.deepEqual(await presentation(page), edited);
    await page.reload(); await selector.waitFor(); await artwork.waitFor({ state: 'attached' });
    assert.deepEqual(await presentation(page), edited, 'reload keeps authored geometry');
    near((await artwork.boundingBox()).y, edited.window.top, 'reopened at full canvas coordinates');
    assert.equal(await artwork.locator('iframe').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
