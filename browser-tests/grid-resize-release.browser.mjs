import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const output = path.resolve(process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/grid-resize-release');
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('production Grid resize commits on release without a render loop', { timeout: 180000 }, async () => {
  // Development React alone did not catch the deployed error #185. Exercise
  // the real owner runtime with production React as well as real pointerup.
  const outDir = path.join(output, 'build');
  process.env.NODE_ENV = 'production';
  await build({ configFile: false, publicDir: false, logLevel: 'error', plugins: [react()],
    define: { __INSCAPE_RELEASE_COMMIT__: JSON.stringify('development') },
    build: { outDir, emptyOutDir: false, rollupOptions: { input: 'browser-tests/grid-resize-release-fixture.html' } } });
  await fs.cp('public/assets/fonts', path.join(outDir, 'assets/fonts'), { recursive: true });
  const server = await preview({ configFile: false, build: { outDir }, preview: { host: '127.0.0.1', port: 0, open: false } });
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const errors = [], evidence = []; let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.stack));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/grid-resize-release-fixture.html`);
    const grid = page.locator('.shape-window'); await grid.waitFor();
    await page.evaluate(() => document.fonts.ready);
    const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
    if (await collapse.count()) await collapse.click();
    await grid.locator('header').focus(); await page.keyboard.press('Shift+Enter'); await settle(page);
    const before = await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window);
    const b = await page.locator('.workbench-selection').boundingBox();
    await page.mouse.move(b.x + b.width, b.y + b.height); await page.mouse.down();
    await page.mouse.move(b.x + b.width + 48, b.y + b.height + 24, { steps: 5 }); await settle(page);
    assert.deepEqual(await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window), before, 'drag preview is not saved');
    assert.deepEqual(errors, [], 'drag itself does not crash');
    await page.mouse.up(); await settle(page);
    const after = await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window);
    evidence.push({ before, after, errors });
    assert.deepEqual(errors, [], 'release must not crash');
    await grid.waitFor();
    assert.equal(after.width, before.width + 48); assert.equal(after.height, before.height + 24);
    for (const [dx, dy] of [[-1, -1], [0, 0], [1, 0], [-3, 0], [0, -3]]) {
      const box = await page.locator('.workbench-selection').boundingBox();
      await page.mouse.move(box.x + box.width, box.y + box.height); await page.mouse.down();
      await page.mouse.move(box.x + box.width + dx, box.y + box.height + dy, { steps: 2 }); await page.mouse.up(); await settle(page);
      evidence.push({ dx, dy, after: await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window) });
      assert.deepEqual(errors, [], `small release ${dx}/${dy}`); await grid.waitFor();
    }
    for (const edge of ['se', 'nw', 'ne', 'sw']) for (let repeat = 0; repeat < 3; repeat++) {
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Escape');
      await grid.locator('header').focus();
      await page.keyboard.press('Shift+Enter');
      await settle(page);
      const box = await page.locator('.workbench-selection').boundingBox();
      const x = edge.includes('w') ? box.x : box.x + box.width, y = edge.includes('n') ? box.y : box.y + box.height;
      const dx = 24, dy = edge.includes('n') ? 0 : 24;
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), { x, y });
      assert.equal(hit, `Scale selected modules from ${edge}`, 'the real resize grip receives the pointer');
      const prior = await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window);
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 4 });
      await page.mouse.up(); await settle(page);
      const saved = await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window);
      evidence.push({ edge, repeat, hit, prior, after: saved });
      assert.equal(saved.width, prior.width + (edge.includes('w') ? -dx : dx));
      assert.equal(saved.height, prior.height + (edge.includes('n') ? -dy : dy));
      assert.deepEqual(errors, [], `release ${edge}/${repeat}`); await grid.waitFor();
    }
    for (const deltaY of [120, 120, 120, 120, -120, -120, -120]) {
      const bounds = await grid.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.keyboard.down('Control'); await page.mouse.wheel(0, deltaY); await page.keyboard.up('Control');
      await page.waitForTimeout(250);
      for (const edge of ['nw', 'se']) {
        const box = await page.locator('.workbench-selection').boundingBox();
        const x = edge === 'nw' ? box.x : box.x + box.width, y = edge === 'nw' ? box.y : box.y + box.height;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 29, y + 17, { steps: 5 });
        await page.mouse.up(); await settle(page);
        evidence.push({ deltaY, edge, after: await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window) });
        assert.deepEqual(errors, [], `zoomed release ${deltaY}/${edge}`); await grid.waitFor();
      }
    }
    const final = await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window);
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); await settle(page);
    assert.notDeepEqual(await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window), final);
    await page.keyboard.press('Control+Shift+z'); await settle(page);
    assert.deepEqual(await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window), final);
    await page.screenshot({ path: path.join(output, 'grid-release.png') });
    await page.reload(); await grid.waitFor();
    assert.deepEqual(await page.evaluate(() => gridResizeSaved().workbench.shapes[0].window), final);
    assert.deepEqual(errors, [], 'undo, redo and reload remain usable');
  } finally {
    if (page) await page.screenshot({ path: path.join(output, 'last-state.png') }).catch(() => {});
    await fs.writeFile(path.join(output, 'release-evidence.json'), JSON.stringify({ errors, evidence }, null, 2));
    await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
  }
});
