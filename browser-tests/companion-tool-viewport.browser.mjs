import { sharedToolPanel } from './fixtures/shared-tools.mjs';
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

for (const width of [1440, 700, 390]) test(`Companion tools reserve live camera controls through sidebar and viewport changes (${width}px)`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const tools = sharedToolPanel(page);
    const controls = page.getByRole('group', { name: 'Workbench zoom', exact: true });
    const draft = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const toggleSidebar = async label => {
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Shift+F10');
      await page.getByRole('menuitem', { name: label, exact: true }).click();
      await page.locator('.workbench-sidebar').waitFor({ state: label === 'HIDE SIDEBAR' ? 'detached' : 'visible' });
    };
    // The old bottom dock is now a sidebar over this fixture's Text action strip.
    await toggleSidebar('HIDE SIDEBAR');
    const clearControls = async () => {
      await page.waitForFunction(() => {
        const tool = document.querySelector('[data-tool-tab="Inspector"]').closest('.workbench-tool-panel').getBoundingClientRect();
        const camera = document.querySelector('[data-workbench-toolbar]').getBoundingClientRect();
        return tool.top >= 8 && tool.bottom <= camera.top - 7 && tool.left >= 8 && tool.right <= innerWidth - 8;
      });
      for (const button of await controls.getByRole('button').all()) assert.equal(await button.evaluate(hit), true, `camera control remains reachable: ${await button.getAttribute('aria-label') || await button.innerText()}`);
      assert.equal(await tools.getByRole('button', { name: 'Close Inspector' }).evaluate(hit), true, JSON.stringify(await tools.getByRole('button', { name: 'Close Inspector' }).evaluate(node => {
        const r = node.getBoundingClientRect(); return { close: r.toJSON(), hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 500) };
      })));
    };
    await clearControls();
    const read = page.getByRole('button', { name: 'Read', exact: true });
    assert.equal(await read.evaluate(hit), true, `opening Text tools leaves its module action strip reachable: ${JSON.stringify(await read.evaluate(node => {
      const r = node.getBoundingClientRect(); return { button: r.toJSON(), panel: document.querySelector('[data-tool-tab="Inspector"]').closest('.workbench-tool-panel').getBoundingClientRect().toJSON(), hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.outerHTML.slice(0, 300) };
    }))}`);
    // Keep the independent Navigator clear of the Text-tools close control
    // when the phone-height viewport later clamps both utility windows.
    if (width === 390) {
      const navigator = page.getByLabel('Move Navigator window', { exact: true });
      for (let step = 0; step < 40; step++) { await navigator.press('Shift+ArrowLeft'); await navigator.press('Shift+ArrowUp'); }
    }
    const header = tools.getByLabel('Move Inspector panel', { exact: true });
    await header.focus();
    for (let step = 0; step < 20; step++) await page.keyboard.press('Shift+ArrowDown');
    await clearControls();
    await toggleSidebar('SHOW SIDEBAR');
    await clearControls();
    const withSidebar = (await controls.boundingBox()).y;
    await toggleSidebar('HIDE SIDEBAR');
    await clearControls();
    assert.equal((await controls.boundingBox()).y, withSidebar, 'the sidebar does not reserve obsolete bottom-dock space');
    await page.setViewportSize({ width, height: 620 });
    await clearControls();
    assert.ok(await tools.locator('.workbench-inspector').evaluate(node => node.clientHeight >= 32 && node.scrollHeight > node.clientHeight), 'long tools retain a usable body scroller');
    await toggleSidebar('SHOW SIDEBAR');
    await clearControls();
    const publication = tools.getByRole('checkbox', { name: 'Include in Workbench publication', exact: true });
    await publication.scrollIntoViewIfNeeded();
    assert.equal(await publication.evaluate(hit), true, 'the final Text control remains reachable in the Inspector scroller');
    const short = await tools.boundingBox();
    await page.setViewportSize({ width, height: 1000 });
    await clearControls();
    assert.equal((await tools.boundingBox()).height, short.height, 'the resizable tool retains its fitted height');
    await header.focus(); await page.keyboard.press('ArrowUp');
    await clearControls();
    await page.setViewportSize({ width, height: 620 });
    await clearControls();
    assert.ok(await tools.locator('.workbench-inspector').evaluate(node => node.clientHeight >= 32), 'viewport shrink leaves at least one control row visible');
    await publication.scrollIntoViewIfNeeded();
    assert.equal(await publication.evaluate(hit), true, 'the final control stays reachable after viewport recovery');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, `companion-tool-viewport-${width}.png`) });
    await tools.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await tools.waitFor({ state: 'detached' });
    for (const button of await controls.getByRole('button').all()) assert.equal(await button.evaluate(hit), true);
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), draft, 'tool fitting never changes authored content or module poses');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
