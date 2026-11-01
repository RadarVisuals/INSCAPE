import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Image geometry-only history reaches a memoized module without replacing artwork or focus', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__image_history__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_history__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/image-fit-fixture.jsx')).mount();
    });
    const image = page.locator('[data-image-module="image:one"] .image-module__canvas');
    await image.waitFor(); await image.focus(); await settle(page);
    const node = await image.elementHandle();
    const initial = await page.evaluate(() => imageFitFixture.frame('image:one'));
    await page.evaluate(() => {
      const store = imageFitFixture.store, record = store.getSnapshot().imageModules[0];
      const draft = store.getDraft();
      draft.workbench.imageModules[0].position.left += 120;
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Layout did not save');
      if (store.getSnapshot().imageModules[0] !== record) throw Error('Fixture must retain the unchanged Image record');
    });
    await page.waitForFunction(left => imageFitFixture.frame('image:one').left === left, initial.left + 120);
    await page.evaluate(() => { if (!imageFitFixture.store.undo()) throw Error('Undo failed'); });
    await page.waitForFunction(left => imageFitFixture.frame('image:one').left === left, initial.left);
    await page.evaluate(() => { if (!imageFitFixture.store.redo()) throw Error('Redo failed'); });
    await page.waitForFunction(left => imageFitFixture.frame('image:one').left === left, initial.left + 120);
    assert.equal(await image.evaluate((element, previous) => element === previous, node), true);
    assert.equal(await image.evaluate(element => element === document.activeElement), true);
  } finally { await browser.close(); }
});

test('Image tools duplicate the viewed cropped side and all other sides, recover from failed save, and respect Visitor access', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    await mkdir(process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime', { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
    await page.route(`${origin}/__image_duplicate__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_duplicate__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/image-fit-fixture.jsx')).mount();
    });
    const tools = page.locator('[data-context-tools], [data-context-action-bars]');
    await tools.getByRole('button', { name: 'Duplicate', exact: true }).waitFor();
    await page.evaluate(async () => {
      const { buildProfileDocumentV9Asset } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const store = imageFitFixture.store, draft = store.getDraft();
      const source = draft.imageModules[0];
      const side = { ...source.sides[0], asset: buildProfileDocumentV9Asset(assets[0], assets[0].id), crop: null };
      draft.imageModules = [{ ...source, name: 'Cropped creature', width: 1032, height: 264,
        sides: [side, { ...structuredClone(side), id: 'side:cropped', crop: { x: .4, y: .65, zoom: 1.4 }, transform: { quarterTurns: 2, mirrorX: true, mirrorY: false } }] }];
      draft.workbench.imageModules = [{ id: source.id, open: true, position: { left: 24, top: 130 } }];
      store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
    });
    await settle(page);
    const original = page.locator('[data-image-module="image:one"]');
    await original.locator('.image-module__canvas').focus();
    await original.getByRole('button', { name: 'Next Image side' }).click();
    await page.waitForFunction(() => document.querySelector('[data-image-module="image:one"] .image-module__canvas').dataset.sideId === 'side:cropped');
    const before = await page.evaluate(() => imageFitFixture.store.getDraft());
    await page.evaluate(() => { imageFitFixture.failSave = true; });
    await tools.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await tools.getByRole('alert').waitFor();
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), before);
    assert.equal(await page.locator('[data-image-module]').count(), 1);
    await page.evaluate(() => { imageFitFixture.failSave = false; });
    await tools.getByRole('button', { name: 'Duplicate', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => imageFitFixture.store.getDraft().imageModules.length === 2);
    const after = await page.evaluate(() => imageFitFixture.store.getDraft());
    const copyRecord = after.imageModules[1], copy = page.locator(`[data-image-module="${copyRecord.id}"]`);
    await settle(page);
    assert.deepEqual(after.imageModules[0], before.imageModules[0]);
    assert.deepEqual(copyRecord.sides.map(({ id, ...side }) => side), before.imageModules[0].sides.map(({ id, ...side }) => side));
    assert.equal(copyRecord.width, 1032); assert.equal(copyRecord.height, 264);
    assert.equal(await copy.locator('.image-module__canvas').getAttribute('data-side-id'), copyRecord.sides[1].id);
    assert.equal(await copy.locator('.image-module__canvas').evaluate(node => node === document.activeElement), true);
    const copyActions = tools.locator('[data-context-action-target]');
    await copyActions.waitFor();
    assert.equal(await copyActions.getAttribute('data-context-action-target'), copyRecord.id, 'tools follow the viewed side of the selected copy');
    const geometry = module => module.locator('.image-module__artwork').evaluate(node => ({
      viewBox: node.getAttribute('viewBox'), image: node.querySelector('image')?.outerHTML,
      transform: [...node.querySelectorAll('[transform]')].map(element => element.getAttribute('transform')),
    }));
    assert.deepEqual(await geometry(copy), await geometry(original), 'same crop projects exactly the same artwork');
    await page.screenshot({ path: `${process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime'}/image-duplicate-wide.png` });
    await tools.getByRole('button', { name: 'Fit inside', exact: true }).click();
    const edited = await page.evaluate(() => imageFitFixture.store.getDraft());
    assert.equal(edited.imageModules[1].sides[1].crop, null);
    assert.deepEqual(edited.imageModules[0], before.imageModules[0]);
    await page.evaluate(() => { imageFitFixture.store.undo(); imageFitFixture.store.undo(); });
    await settle(page); assert.equal(await page.locator('[data-image-module]').count(), 1);
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), before);
    await page.evaluate(() => imageFitFixture.store.redo()); await settle(page);
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), after);
    await page.setViewportSize({ width: 390, height: 900 }); await copy.locator('.image-module__canvas').focus(); await settle(page);
    const button = await tools.getByRole('button', { name: 'Duplicate', exact: true }).boundingBox();
    assert.ok(button.x >= 0 && button.x + button.width <= 390 && button.width >= 28);
    await page.screenshot({ path: `${process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime'}/image-duplicate-narrow.png` });
    await page.evaluate(() => imageFitFixture.owner(false)); await settle(page);
    assert.equal(await page.getByRole('button', { name: 'Duplicate', exact: true }).count(), 0);
    assert.equal(await page.locator('[data-image-module]').count(), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
