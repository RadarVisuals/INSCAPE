import { editorCommand } from './fixtures/editor-menu.mjs';
import { setTextBackground } from './fixtures/shared-tools.mjs';
import { openTextToolSection } from './fixtures/text-tool-sections.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5191';
async function mountTransfer(page) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route(`${origin}/__text_transfer__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__text_transfer__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const profile = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
    const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: localStorage });
    const { addTextModule } = await import('/src/text/textSession.js'); addTextModule(store, profile);
    window.draftKey = systemWorkflowDraftKey(profile);
    window.readDraft = () => JSON.parse(localStorage.getItem(window.draftKey));
    const { acquireProfileEditor } = await import('/src/systemWorkflow/profileEditorLease.js');
    window.textTransferEditorLease = acquireProfileEditor(profile);
    if (await window.textTransferEditorLease.ready !== 'editing') throw Error('Text transfer fixture could not acquire its editor');
    await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress: profile, reviewStorage: localStorage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
      reviewCategories: [], reviewActivity: [], reviewProfile: { name: 'Text transfer' } }));
  });
}
for (const width of [1600, 390]) for (const scale of [1, .5]) test(`Default Text controls respect canvas clipping at ${width}px and ${scale * 100}%`, { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const evidence = `${process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime'}/text-controls-${width}-${scale}`;
  await mkdir(evidence, { recursive: true });
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'reduce' });
  try {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTransfer(page);
    const text = page.locator('.text-window'), grip = text.getByLabel('Move Text window', { exact: true });
    await text.waitFor(); await page.evaluate(() => document.fonts.ready);
    const collapse = page.locator('.editor-menu-brand[aria-expanded="true"]');
    if (await collapse.count()) await collapse.click();
    for (const name of ['Close Workbench Layers', 'Close Inspector']) {
      const close = page.getByRole('button', { name, exact: true });
      if (await close.count()) { await close.focus(); await close.press('Enter'); }
    }
    const saved = await page.evaluate(() => window.readDraft());
    await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill(String(scale * 100));
    await grip.focus();
    if (width === 390) {
      // Move only the camera to expose the default module beside narrow tools.
      const rect = await grip.boundingBox(), from = { x: 384, y: 828 };
      await page.locator('main.system-workflow').focus(); await page.mouse.move(from.x, from.y);
      await page.keyboard.down('Space'); await page.mouse.down();
      await page.mouse.move(from.x + 72 - rect.x, from.y + 250 - rect.y, { steps: 8 });
      await page.mouse.up(); await page.keyboard.up('Space'); await grip.focus();
    }
    const geometry = await text.evaluate(node => {
      const host = node.closest('.workbench-canvas-content'), header = node.querySelector('header');
      return { frame: node.getBoundingClientRect().toJSON(), controls: header.getBoundingClientRect().toJSON(), clipTop: parseFloat(getComputedStyle(host).getPropertyValue('--canvas-top')) };
    });
    assert.ok(geometry.controls.top >= Math.max(0, geometry.clipTop), 'controls clear the visible top boundary');
    await text.getByRole('button', { name: 'Read', exact: true }).click();
    await text.getByRole('button', { name: 'Write', exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.readDraft()), saved, 'camera and control placement never rewrite authored geometry or content');
    await page.screenshot({ path: `${evidence}/reachable.png` });
    if (width === 1600 && scale === .5) {
      await editorCommand(page, 'Canvas', 'Canvas size');
      await page.getByRole('button', { name: 'Show outside canvas', exact: true }).click();
      await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
      await grip.focus();
      assert.equal(await grip.getAttribute('data-controls-below'), null, 'outside-canvas recovery restores the viewport-owned controls boundary');
      await text.getByRole('button', { name: 'Write', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.readDraft()), saved, 'outside-canvas recovery stays temporary');
    }
    assert.deepEqual(errors, []);
    await writeFile(`${evidence}/geometry.json`, JSON.stringify(geometry, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${evidence}/failure.png` }); throw error;
  } finally { await browser.close(); }
});
