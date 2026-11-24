import { sharedToolPanel } from './fixtures/shared-tools.mjs';
import { editorCommand } from './fixtures/editor-menu.mjs';
import { openTextToolSection } from './fixtures/text-tool-sections.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5297';

test('module edges, appearance, keyboard controls and public rendering', async () => {
  const screenshots = await mkdtemp(join(tmpdir(), 'inscape-module-surfaces-'));
  console.log(`Screenshots: ${screenshots}`);
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__module_surfaces__`, r => r.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__module_surfaces__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { addTextModule } = await import('/src/text/textSession.js');
      const { createDefaultWorkbenchPresentation, createTextPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
      addTextModule(store, profileAddress);
      const draft = store.getDraft(), text = draft.texts[0];
      text.visibility = 'PUBLIC'; text.article.title = 'A mouthful of almost';
      text.article.appearance.background = '#000000';
      text.article.content.content = [{ type: 'paragraph', content: [{ type: 'text', text: 'I lift my head. A rope of spit pulls the dirt up with me before it snaps. My throat dumps something thick between my hands.' }] }];
      draft.workbench = createDefaultWorkbenchPresentation();
      draft.workbench.texts = [{ ...createTextPresentation(text.id, 0), window: { left: 90, top: 130, width: 300, height: 400 } }];
      store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
      window.readSurfaceDraft = () => createSystemWorkflowDraftStore({ profileAddress, storage: localStorage }).getDraft();
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
      createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: localStorage,
        reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewProfile: { name: 'Module composition' } }));
    });
    const text = page.locator('aside.text-window');
    const tools = sharedToolPanel(page);
    await openTextToolSection(tools, 'Background & edges');
    await tools.getByLabel('Module corners', { exact: true }).selectOption('custom');
    await tools.getByLabel('Top left corner radius', { exact: true }).fill('12');
    await tools.getByLabel('Bottom left corner radius', { exact: true }).fill('12');
    await tools.getByLabel('Grain strength', { exact: true }).fill('0.25');
    assert.deepEqual(await page.evaluate(() => window.readSurfaceDraft().texts[0].article.appearance.edges), { corners: [12, 0, 0, 12], shadow: false, grain: .25 });
    await page.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
    await tools.waitFor({ state: 'detached' });
    assert.deepEqual(await text.evaluate(el => [getComputedStyle(el).borderRadius,
      getComputedStyle(el.querySelector('.module-surface-grain')).opacity]), ['12px 0px 0px 12px', '0.075']);
    await editorCommand(page, 'Canvas', 'Preview');
    await page.locator('.visitor-grid-world').getByText('A mouthful of almost', { exact: true }).first().waitFor();
    await page.screenshot({ path: join(screenshots, 'preview-wide.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(screenshots, 'preview-narrow.png') });
    await page.getByRole('button', { name: 'RETURN', exact: true }).click();
    await page.getByRole('button', { name: 'Text tools', exact: true }).focus(); await page.keyboard.press('Enter');
    await openTextToolSection(tools, 'Background & edges');
    await tools.getByLabel('Bottom left corner radius', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(screenshots, 'tools-narrow.png') });
    const tb = await tools.boundingBox(); assert.ok(tb.x >= 0 && tb.x + tb.width <= 390, 'tools fit narrow viewport');
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).focus(); await page.keyboard.press('Enter');
    await editorCommand(page, 'Edit', 'Settings');
    await page.getByLabel('Space between modules', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByLabel('Space between modules', { exact: true }).fill('0');
    const gapHit = await page.getByLabel('Space between modules', { exact: true }).evaluate(el => { const r = el.getBoundingClientRect(); return el === document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); });
    assert.equal(gapHit, true, 'Settings remain above Text on narrow screens');
    await page.screenshot({ path: join(screenshots, 'settings-narrow.png') });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
