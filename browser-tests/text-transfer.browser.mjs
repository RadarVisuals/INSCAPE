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
for (const viewScale of [1, .5]) test(`Text tools, save recovery and drag into and out of Display at ${viewScale * 100}%`, { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const evidence = `${process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime'}/text-transfer-${viewScale}`;
  await mkdir(evidence, { recursive: true });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await mountTransfer(page);
    const text = page.locator('[data-workbench-module="text"]'), output = text.locator('.text-window'), tools = page.locator('.text-tools-window');
    await output.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    for (const name of ['Close Workbench Layers', 'Close Transform', 'Close Color', 'Close Image', 'Close Shape', 'Close FX', 'Close Info']) {
      const close = page.getByRole('button', { name, exact: true });
      if (await close.count()) { await close.focus(); await close.press('Enter'); }
    }
    assert.equal(await output.getByRole('textbox', { name: 'Article title', exact: true }).getAttribute('placeholder'), 'Title');
    await output.getByRole('textbox', { name: 'Article title', exact: true }).fill('Arrival');
    const body = output.getByRole('textbox', { name: 'Article text', exact: true });
    await body.fill('The landscape remembers.'); await page.keyboard.press('Control+A');

    await tools.getByRole('button', { name: 'Bold', exact: true }).click();
    assert.equal(await output.getByRole('toolbar').count(), 0);
    const writeBounds = await body.locator('p').boundingBox();
    await output.getByRole('button', { name: 'Read', exact: true }).click();
    const readBounds = await output.locator('article p').boundingBox();
    assert.ok(Math.abs(writeBounds.y - readBounds.y) < 1, 'Read does not move text');
    await output.getByRole('button', { name: 'Write', exact: true }).click();
    await openTextToolSection(page.locator('.text-tools-window'), 'Background & edges');
    await setTextBackground(page, 'colour');
    await tools.getByRole('checkbox', { name: 'Show border', exact: true }).check();
    assert.notEqual(await output.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    await openTextToolSection(page.locator('.text-tools-window'), 'Background & edges');
    await setTextBackground(page, 'none');
    await tools.getByRole('checkbox', { name: 'Show border', exact: true }).uncheck();
    // Simulate another writer updating unrelated saved data.
    await page.evaluate(() => { const draft = window.readDraft(); draft.identityPresentation.alias = 'Other tab'; localStorage.setItem(window.draftKey, JSON.stringify(draft)); });
    await body.fill('Unsaved but recoverable.');
    await tools.getByRole('button', { name: 'Retry local save', exact: true }).click();
    assert.equal(await tools.getByRole('alert').count(), 0);
    assert.equal(await page.evaluate(() => window.readDraft().identityPresentation.alias), 'Other tab');
    assert.equal(await page.evaluate(() => window.readDraft().texts[0].article.content.content[0].content[0].text), 'Unsaved but recoverable.');
    await body.fill('The landscape remembers.'); await page.keyboard.press('Control+A');

    if (!await body.locator('strong').count()) await tools.getByRole('button', { name: 'Bold', exact: true }).click();
    await tools.locator('.text-tools-content').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${evidence}/text-tools-wide.png` });
    await tools.getByRole('button', { name: 'Close Text tools' }).click();
    if (viewScale === .5) await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('50');
    const originalTextHeight = (await body.locator('p').boundingBox()).height;
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true }); if (await unlock.count()) await unlock.click();
    const canvas = page.locator('[data-system-workflow-artboard]').first(), bounds = await canvas.boundingBox();
    const handle = output.getByRole('button', { name: 'Drag Text into Display' }); await handle.focus(); await handle.hover();
    const from = await handle.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .55, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(300);
    assert.equal(await text.count(), 0, 'attached text no longer has an independent window');
    const editor = canvas.getByRole('textbox', { name: 'Article text', exact: true }); await editor.waitFor();
    assert.equal(await editor.locator('strong').innerText(), 'The landscape remembers.');
    assert.ok(Math.abs((await editor.locator('p').boundingBox()).height - originalTextHeight) < 1, 'attachment retains visible text size at the current Workbench scale');
    const externalTools = page.locator('.text-tools-window');
    assert.equal(await canvas.getByRole('toolbar').count(), 0);
    await canvas.getByRole('textbox', { name: 'Article title', exact: true }).fill('Attached text');
    await externalTools.getByRole('button', { name: 'Close Text tools' }).click();
    const attached = canvas.getByRole('button', { name: 'Select Attached text', exact: true });
    await attached.focus(); await page.keyboard.press('Enter');
    // Move the floating toolbox aside before reaching the artwork underneath.
    const toolGrip = externalTools.getByLabel('Move Text tools window', { exact: true });
    const toolRect = await toolGrip.boundingBox();
    await page.mouse.move(toolRect.x + 40, toolRect.y + 15); await page.mouse.down();
    await page.mouse.move(60, 70, { steps: 8 }); await page.mouse.up();
    const outHandle = canvas.getByRole('button', { name: 'Drag Text out of Display' });
    const start = await outHandle.boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
    await page.mouse.move(1580, 960, { steps: 8 }); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await text.count(), 0, 'Escape cancels detachment, including the following pointer release');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down();
    await page.mouse.move(1580, 960, { steps: 12 }); await page.mouse.up();
    await page.screenshot({ path: `${evidence}/text-detach-debug.png` });
    await text.waitFor({ state: 'attached' });
    assert.equal(await text.locator('.text-editor-content strong').innerText(), 'The landscape remembers.');
    assert.ok(Math.abs((await text.locator('.text-editor-content p').boundingBox()).height - originalTextHeight) < 1, 'detachment retains visible text size at the current Workbench scale');
    assert.equal(await page.evaluate(() => window.readDraft().grids.flatMap(grid => grid.placements).filter(item => item.kind === 'text').length), 0);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    const toolBounds = await tools.boundingBox();
    assert.ok(toolBounds.x >= 0 && toolBounds.x + toolBounds.width <= 391);
    await page.screenshot({ path: `${evidence}/text-tools-narrow.png` });
    assert.deepEqual(errors, []);
  } catch (error) {
    await page?.screenshot({ path: `${evidence}/failure.png` });
    throw error;
  } finally { await browser.close(); }
});

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
    const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
    if (await collapse.count()) await collapse.click();
    for (const name of ['Close Workbench Layers', 'Close Transform', 'Close Color', 'Close Image', 'Close Shape', 'Close FX', 'Close Info', 'Close Text tools']) {
      const close = page.getByRole('button', { name, exact: true });
      if (await close.count()) { await close.focus(); await close.press('Enter'); }
    }
    const minimize = page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true });
    await minimize.focus(); await minimize.press('Enter');
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
    const transfer = text.getByRole('button', { name: 'Drag Text into Display', exact: true });
    await transfer.hover();
    assert.equal(await transfer.evaluate(node => {
      const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), true, 'the native transfer target is exposed at the default authored position');
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
      await page.getByRole('button', { name: 'Canvas size', exact: true }).click();
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
