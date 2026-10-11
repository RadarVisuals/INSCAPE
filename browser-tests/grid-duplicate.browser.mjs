import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_GRID_ROOT || 'http://127.0.0.1:5178';
test('Grid menu duplicates a filled scene independently, supports undo and reload, and fits narrow panels', { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(15000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__grid_duplicate__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    const mount = () => page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createArticle } = await import('/src/text/domain/article.js');
      const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const profile = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
      window.__gridDraftKey = systemWorkflowDraftKey(profile);
      if (!localStorage.getItem(window.__gridDraftKey)) {
        const draft = JSON.parse(fixture.createOwnerSystemWorkflowReviewStorage().getItem(window.__gridDraftKey));
        const grid = draft.grids[0];
        grid.groups = [{ id: 'group:art', placementIds: grid.placements.map(p => p.id) }];
        const article = createArticle('Scene notes');
        article.content.content = [{ type: 'paragraph', content: [{ type: 'text', text: 'An independent composition.' }] }];
        grid.placements.push({ id: 'placement:notes', kind: 'text', text: { article }, column: 2, row: 2, columnSpan: 10, rowSpan: 4,
          layer: 2, navigationOrder: 2, visibility: 'PUBLIC', locked: false, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } });
        draft.workbench = createDefaultWorkbenchPresentation(); draft.workbench.display.open = true;
        draft.workbench.display.window = { left: 80, top: 40, width: 1100, height: 618.75 };
        localStorage.setItem(window.__gridDraftKey, JSON.stringify(draft));
      }
      await import('/src/index.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      await import('/src/lattice/rendering/latticeMenuSurface.css');
      const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
      createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress: profile,
        reviewStorage: localStorage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
        reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Grid copy review' } }));
    });
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem(window.__gridDraftKey)));
    const panel = page.locator('.system-workflow__grid-switcher');
    const selectedTitle = () => panel.locator('.system-workflow__grid-row[aria-current="page"] strong').innerText();
    await page.goto(`${origin}/__grid_duplicate__`); await mount();
    await page.getByRole('button', { name: 'Grids', exact: true }).click();
    await panel.getByRole('button', { name: 'Duplicate HOME', exact: true }).waitFor();
    assert.equal(await panel.getByRole('button', { name: /Duplicate/ }).count(), 1, 'World Cover cannot be duplicated');
    const before = await read(), source = before.grids[0];
    await panel.getByRole('button', { name: 'Duplicate HOME', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__gridDraftKey)).grids.length === 3);
    const duplicated = await read(), copy = duplicated.grids[1];
    assert.equal(await selectedTitle(), 'HOME copy');
    assert.equal(copy.visibility, 'PRIVATE'); assert.notEqual(copy.id, source.id);
    assert.deepEqual(duplicated.grids[0], source);
    const withoutId = ({ id, ...value }) => value;
    assert.deepEqual(copy.placements.map(withoutId), source.placements.map(withoutId));
    assert.ok(copy.placements.every(p => !source.placements.some(original => original.id === p.id)));
    assert.notEqual(copy.groups[0].id, source.groups[0].id);
    assert.deepEqual(copy.groups[0].placementIds, copy.placements.slice(0, 2).map(p => p.id));
    await page.screenshot({ path: '.browser-test-runtime/grid-duplicate-wide.png' });
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__gridDraftKey)).grids.length === 2);
    assert.deepEqual((await read()).grids, before.grids);
    assert.equal(await selectedTitle(), 'HOME');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__gridDraftKey)).grids.length === 3);
    assert.deepEqual((await read()).grids, duplicated.grids);
    // Existing row actions still work after adding the fourth action.
    await panel.getByRole('button', { name: 'Rename HOME copy', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Rename HOME copy', exact: true }).fill('Study variant');
    await panel.getByRole('button', { name: 'Confirm rename', exact: true }).click();
    assert.equal((await read()).grids[0].title, 'HOME');
    assert.equal((await read()).grids[1].title, 'Study variant');
    await page.reload(); await mount();
    await page.getByRole('button', { name: 'Grids', exact: true }).click();
    assert.equal((await read()).grids[1].title, 'Study variant');
    await page.setViewportSize({ width: 390, height: 844 });
    const duplicate = panel.getByRole('button', { name: 'Duplicate Study variant', exact: true });
    await duplicate.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__gridDraftKey)).grids.length === 4);
    assert.equal(await selectedTitle(), 'Study variant copy');
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    for (const button of await panel.locator('.system-workflow__grid-actions button').all()) {
      const box = await button.boundingBox();
      assert.ok(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1, 'all actions fit inside the panel');
    }
    assert.equal(await duplicate.evaluate(node => node === document.activeElement), true, 'keyboard focus remains on the initiating action');
    await page.screenshot({ path: '.browser-test-runtime/grid-duplicate-narrow.png' });
    assert.deepEqual(errors, []);
  } finally { await page?.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
});
