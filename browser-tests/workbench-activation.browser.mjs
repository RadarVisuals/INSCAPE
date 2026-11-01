import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('filled Workbench retargets tools and reserves camera/popup space through viewport changes without touching articles', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin, { textCount: 12, surfaces: true });
    await page.evaluate(async () => {
      const draft = window.savedDraft();
      for (const text of draft.texts) text.article.content.content = Array.from({ length: 16 }, (_, index) => ({
        type: 'paragraph', content: [{ type: 'text', text: `Paragraph ${index}. ` + 'The artwork and writing retain their own geometry. '.repeat(20) }],
      }));
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      draft.imageModules[0].sides = [{ id: 'side:activation', asset: buildProfileDocumentV9Asset(assets[0], assets[0].id), crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }];
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
    });
    await mountTextToolsFixture(page, origin); await page.waitForLoadState('networkidle');
    const saved = await page.evaluate(() => window.savedDraft());
    const body = page.getByRole('textbox', { name: 'Article text', exact: true }).first();
    const originalEditor = await body.elementHandle();
    const toolbar = page.locator('[data-workbench-toolbar]');
    const camera = page.locator('.workbench-view-controls');
    for (const width of [1440, 600, 390, 1200]) {
      await page.setViewportSize({ width, height: 1000 }); await settle(page);
      // Occupied panels remove the toolbar. Its next instance must be observed
      // as well, so changing tools after returning still reserves the right space.
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await toolbar.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
      await toolbar.waitFor(); await settle(page);
      for (const target of ['text', 'image', 'shape']) {
        if (target === 'text') await body.focus();
        else if (target === 'image') await page.locator('.image-module__canvas').first().focus();
        else await page.locator('.shape-window header').first().focus();
        await settle(page);
        const rail = await toolbar.boundingBox(), controls = await camera.boundingBox();
        assert.ok(rail.x >= 0 && rail.x + rail.width <= width + 1);
        assert.ok(controls.x >= 0 && controls.x + controls.width <= width + 1);
        assert.ok(controls.y + controls.height <= rail.y + 1 || controls.x >= rail.x + rail.width - 1,
          `${target} at ${width}px: camera must sit above or beside the complete action/creation rail`);
        if (target === 'image') {
          assert.equal(await page.getByRole('toolbar', { name: 'Selection tools', exact: true }).getByRole('button', { name: 'Rotate', exact: true }).isVisible(), true);
          await toolbar.getByRole('button', { name: 'Actions', exact: true }).click();
          const search = page.getByRole('textbox', { name: 'Search actions' });
          await search.waitFor();
          const popup = await page.locator('.workbench-toolbar__popup').boundingBox();
          assert.ok(popup.y >= 0 && popup.y + popup.height <= rail.y, 'Actions popup stays above the complete toolbar');
          await page.keyboard.press('Escape');
        }
        assert.equal(await body.evaluate((element, previous) => element === previous, originalEditor), true);
        assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved, 'activation/responsive layout never author article or module data');
      }
      const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `activation-${width}.png`) });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
