import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const [width, density, zoom, below] of [[1440, 1, 1, false], [1440, 1.25, .75, false], [390, 2, .5, false], [390, 1, 1, true]]) {
  test(`Text toolbar stays reachable across its gap at ${width}px / DPR ${density}${below ? ' below' : ''}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1100 }, deviceScaleFactor: density });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountTextToolsFixture(page, origin);
      await page.evaluate(async ({ width, below }) => {
        const draft = window.savedDraft(), entry = draft.workbench.texts[0];
        entry.window = { left: 24, top: below ? 24 : 160, width: width < 600 ? 340 : 360, height: 240 };
        entry.frames = [{ id: 'text-frame:hover', window: { ...entry.window, left: width < 600 ? 24 : 440, top: width < 600 ? 760 : 160 } }];
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
      }, { width, below });
      await mountTextToolsFixture(page, origin); await setWorkbenchZoom(page, zoom); await settle(page);
      const article = await page.evaluate(() => window.savedDraft().texts[0].article);
      await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
      await page.evaluate(() => document.activeElement?.blur());
      for (const index of [0, 1]) {
        const window = page.locator('.text-window').nth(index), bar = window.locator(':scope > header');
        await page.mouse.move(width - 4, 1050); await settle(page);
        assert.equal(await bar.evaluate(n => getComputedStyle(n).opacity), '0', 'toolbar hides away from the module');
        const frame = await window.boundingBox(), toolbar = await bar.boundingBox();
        const under = await bar.getAttribute('data-controls-below') !== null;
        const x = frame.x + 45;
        const start = under ? frame.y + frame.height - 3 : frame.y + 3;
        const end = under ? toolbar.y + 3 : toolbar.y + toolbar.height - 3;
        const direction = under ? 1 : -1;
        await page.mouse.move(x, start); await settle(page);
        for (let y = start; direction * (end - y) >= 0; y += direction * .5) {
          await page.mouse.move(x, y); await settle(page);
          assert.equal(await bar.evaluate(n => getComputedStyle(n).opacity), '1', `hover remains connected at y=${y}, frame ${index + 1}`);
        }
        const gap = under ? (frame.y + frame.height + toolbar.y) / 2 : (frame.y + toolbar.y + toolbar.height) / 2;
        await page.mouse.move(x, gap); await page.waitForTimeout(500);
        assert.equal(await bar.evaluate(n => getComputedStyle(n).opacity), '1', 'resting in the gap keeps the toolbar available');
        if (index === 1) await page.screenshot({ path: `.browser-test-runtime/text-toolbar-hover-${width}-${density}.png` });
        const grip = await window.locator('.text-window-grip').boundingBox();
        await page.mouse.move(grip.x + 12, grip.y + grip.height / 2);
        await page.keyboard.down('Alt'); await page.mouse.down();
        await page.mouse.move(grip.x + 44, grip.y + grip.height / 2 + 16, { steps: 8 });
        await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
        const moved = await window.boundingBox();
        assert.ok(moved.x > frame.x + 20 && moved.y > frame.y + 8, 'toolbar can drag immediately after hovering across the gap');
        await page.evaluate(() => document.activeElement?.blur());
      }
      assert.deepEqual(await page.evaluate(() => window.savedDraft().texts[0].article), article);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
