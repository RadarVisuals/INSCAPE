import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const camera = host => host.evaluate(node => ({ scale: Number(node.dataset.workbenchCameraScale || 1),
  x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0) }));

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`Late Text registration preserves pan projection and cancellation (${visitor ? 'Visitor' : 'Owner'}, ${width}px)`, { timeout: 120000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    let releaseText;
    const textReady = new Promise(resolve => { releaseText = resolve; });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (/flushSync was called|Maximum update depth|unmounted component/.test(message.text())) errors.push(message.text()); });
      // Gate the actual lazy module, without replacing its renderer or contents.
      await page.route('**/src/text/TextWorkbench.jsx*', async route => {
        await textReady;
        await route.fulfill({ response: await route.fetch() });
      });
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 3, textModes: true, displayWidth: 600 });
      const explore = page.getByRole('button', { name: 'Explore Workbench', exact: true });
      await explore.waitFor();
      const existingImage = page.locator('[data-workbench-view-id="image:motion-0"]');
      await existingImage.waitFor({ state: 'attached' });
      await page.evaluate(() => document.fonts.ready);
      const host = page.locator('main.system-workflow').first();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      await host.dispatchEvent('wheel', { deltaX: 5000, deltaY: 5000, bubbles: true, cancelable: true });
      await settle(page);
      await explore.click();
      const start = await camera(host), x = Math.min(200, width - 160), y = 350;
      const imageAtStart = await existingImage.boundingBox();
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 30, y + 20); await settle(page);
      assert.equal(await page.locator('[data-workbench-view-id="text:fit"]').count(), 0);
      assert.ok(await page.locator('[data-workbench-camera-projected]').count() > 0);
      releaseText();
      for (const id of ['text:fit', 'text:overflow', 'text:pages']) {
        await page.locator(`[data-workbench-view-id="${id}"]`).waitFor({ state: 'attached' });
      }
      await page.evaluate(() => document.fonts.ready); await settle(page);
      // The first post-registration sample may rebase once. Measure only the
      // following samples, separately from legitimate asynchronous mounting.
      await page.mouse.move(x + 40, y + 30); await settle(page);
      // Owner Text loads a second lazy editor runtime inside each window.
      // Measure continuation work once initialization has settled, without
      // moving the pointer or including that work in the sample baseline.
      if (!visitor) await page.waitForFunction(ids => ids.every(id => {
        const node = document.querySelector(`[data-workbench-view-id="${id}"] [role="textbox"][aria-label="Article text"]`);
        return node?.editor?.isInitialized && node.editor.isEditorContentInitialized;
      }), ['text:fit', 'text:overflow', 'text:pages']);
      await page.evaluate(async () => {
        await document.fonts.ready;
        let previous = window.__motionCommits, stable = 0;
        for (let frames = 1; frames <= 120; frames++) {
          await new Promise(requestAnimationFrame);
          const current = window.__motionCommits;
          stable = current === previous ? stable + 1 : 0;
          previous = current;
          if (stable === 4) return;
        }
        throw new Error('Module initialization did not settle within 120 animation frames');
      });
      const commits = await page.evaluate(() => window.__motionCommits);
      const paintedBefore = await page.locator('[data-workbench-view-id="text:fit"]').boundingBox();
      for (let step = 1; step <= 10; step++) await page.mouse.move(x + 40 + step * 8, y + 30 + step * 4);
      await settle(page);
      const addedCommits = await page.evaluate(() => window.__motionCommits) - commits;
      assert.equal(addedCommits, 0, 'subsequent pointer samples use projection after lazy registration');
      assert.deepEqual(await camera(host), { ...start, x: start.x + 120, y: start.y + 70 });
      const imageAfterRebase = await existingImage.boundingBox();
      assert.ok(Math.abs(imageAfterRebase.x - imageAtStart.x - 120) < 1, 'existing Image does not jump when the projection is renewed');
      assert.ok(Math.abs(imageAfterRebase.y - imageAtStart.y - 70) < 1);
      const paintedAfter = await page.locator('[data-workbench-view-id="text:fit"]').boundingBox();
      assert.ok(Math.abs(paintedAfter.x - paintedBefore.x - 80) < 1, 'new Text follows the same horizontal camera delta');
      assert.ok(Math.abs(paintedAfter.y - paintedBefore.y - 40) < 1, 'new Text follows the same vertical camera delta');
      for (const node of await page.locator('[data-workbench-view-id]').all()) {
        assert.notEqual(await node.getAttribute('data-workbench-camera-projected'), null, 'all live modules belong to the renewed projection');
      }
      await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
      assert.deepEqual(await camera(host), start, 'Escape retains the original gesture origin across rebase');
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
      assert.equal(await host.getAttribute('data-workbench-panning'), null);
      // A subsequent release still settles normally without changing the draft.
      // Newly mounted Text may open its screen-space tools at the left edge.
      const releaseX = width - 20;
      assert.equal(await host.evaluate((node, point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        return hit === node || Boolean(hit?.matches('.system-workflow__workbench, .system-workflow__display-instance'));
      },
        { x: releaseX, y }), true, 'the next drag begins on exposed Workbench background');
      await page.mouse.move(releaseX, y); await page.mouse.down();
      await page.mouse.move(releaseX - 80, y + 50, { steps: 8 }); await page.mouse.up(); await settle(page);
      assert.deepEqual(await camera(host), { ...start, x: start.x - 80, y: start.y + 50 });
      assert.equal(await page.locator('[data-workbench-camera-projected]').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
      assert.deepEqual(errors, []);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: join(output, `late-module-pan-${visitor ? 'visitor' : 'owner'}-${width}.png`) });
    } finally { releaseText(); await browser.close(); }
  });
}
