import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5197';
const output = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || '.browser-test-runtime';
const hit = node => {
  const r = node.getBoundingClientRect();
  return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
};

for (const width of [1440, 700, 390]) test(`Companion tools reserve live camera controls through dock and viewport changes (${width}px)`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const tools = page.locator('.text-tools-window');
    const controls = page.getByRole('group', { name: 'Workbench zoom', exact: true });
    const draft = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const clearControls = async () => {
      await page.waitForFunction(() => {
        const tool = document.querySelector('.text-tools-window').getBoundingClientRect();
        const camera = document.querySelector('.workbench-view-controls').getBoundingClientRect();
        return tool.top >= 8 && tool.bottom <= camera.top - 7 && tool.left >= 8 && tool.right <= innerWidth - 8;
      });
      for (const button of await controls.getByRole('button').all()) assert.equal(await button.evaluate(hit), true, `camera control remains reachable: ${await button.getAttribute('aria-label') || await button.innerText()}`);
      assert.equal(await tools.getByRole('button', { name: 'Close Text tools' }).evaluate(hit), true);
    };
    await clearControls();
    assert.equal(await page.getByRole('button', { name: 'Read', exact: true }).evaluate(hit), true, 'opening Text tools leaves its module action strip reachable');
    const header = tools.getByLabel('Move Text tools window', { exact: true });
    await header.focus();
    for (let step = 0; step < 20; step++) await page.keyboard.press('Shift+ArrowDown');
    await clearControls();
    const withDock = (await controls.boundingBox()).y;
    const toggleDock = async label => {
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'TOOLS', exact: true }).click();
      await page.getByRole('menuitem', { name: label, exact: true }).click();
      await clearControls();
    };
    await toggleDock('HIDE DOCK');
    assert.ok((await controls.boundingBox()).y > withDock + 30, 'hiding the dock frees its screen space');
    await page.setViewportSize({ width, height: 620 });
    await clearControls();
    assert.ok(await tools.locator('.text-controls-body').evaluate(node => node.clientHeight >= 32 && node.scrollHeight > node.clientHeight), 'long tools retain a usable body scroller');
    await toggleDock('SHOW DOCK');
    assert.equal(await tools.locator('.text-tools-footer').evaluate(hit), true, 'the footer remains visible above the camera controls');
    const short = await tools.boundingBox();
    await page.setViewportSize({ width, height: 1000 });
    await clearControls();
    await page.waitForFunction(height => document.querySelector('.text-tools-window').getBoundingClientRect().height > height + 100, short.height);
    await header.focus(); await page.keyboard.press('ArrowUp');
    await clearControls();
    await page.setViewportSize({ width, height: 620 });
    await clearControls();
    assert.ok(await tools.locator('.text-controls-body').evaluate(node => node.clientHeight >= 32), 'viewport shrink leaves at least one control row visible');
    assert.equal(await tools.locator('.text-tools-footer').evaluate(hit), true, 'the footer stays reachable after viewport recovery');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, `companion-tool-viewport-${width}.png`) });
    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await tools.waitFor({ state: 'detached' });
    for (const button of await controls.getByRole('button').all()) assert.equal(await button.evaluate(hit), true);
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), draft, 'tool fitting never changes authored content or module poses');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
