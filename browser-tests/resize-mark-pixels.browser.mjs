import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5180';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/resize-mark-pixels';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const density of [1, 1.25, 1.5, 2]) test(`Image, Shape and Text marks stay pixel-aligned at density ${density}`, { timeout: 120000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__resize_mark_pixels__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__resize_mark_pixels__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/workbench-resize-handles-fixture.jsx')).mount();
    });
    await page.locator('.image-module__window').waitFor();
    const measurements = [];
    for (const kind of ['Image', 'Shape', 'Text']) for (const scale of [.55, .9, 1, 2]) {
      await page.evaluate(([kind, scale]) => resizeFixture.show(kind, scale, { width: 193, height: 289 }), [kind, scale]);
      await settle(page);
      const window = page.locator('[data-workbench-view-id="sample"]');
      const before = await window.boundingBox();
      const marks = await window.locator('[role="separator"]').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect(), css = getComputedStyle(node, '::after');
        return { edge: node.className, rect: rect.toJSON(), left: parseFloat(css.left), top: parseFloat(css.top),
          width: parseFloat(css.width), height: parseFloat(css.height), border: css.border, shadow: css.boxShadow };
      }));
      for (const mark of marks) {
        for (const value of [mark.rect.x + mark.left, mark.rect.y + mark.top]) {
          const physical = value * density;
          assert.ok(Math.abs(physical - Math.round(physical)) < .04, `${kind} ${scale} ${mark.edge}: physical edge ${physical}`);
        }
        assert.ok(Math.abs(mark.rect.width - 28) < .04 && Math.abs(mark.rect.height - 28) < .04, 'forgiving hit area retains its screen size');
        assert.equal(mark.width, 8); assert.equal(mark.height, 8);
      }
      assert.equal(marks.length, 8, 'corners and midpoints are present');
      const corner = window.locator('.is-se');
      // A one-world-pixel edit can paint to the same physical edge when zoomed
      // out. Use the existing coarse keyboard step to observe a visible change.
      await corner.focus(); await page.keyboard.press('Shift+ArrowRight'); await settle(page);
      assert.ok((await window.boundingBox()).width > before.width, 'keyboard resize still reaches the painted handle');
      measurements.push({ kind, scale, density, before, marks });
      if (kind === 'Image' && scale === .9) await page.screenshot({ path: join(output, `image-90-dpr-${density}.png`) });
    }
    await writeFile(join(output, `marks-dpr-${density}.json`), JSON.stringify(measurements, null, 2));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
