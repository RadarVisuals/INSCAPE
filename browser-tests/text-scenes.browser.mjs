import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
for (const sections of [false, true]) test(sections ? 'article sections link from Grid 2 and reading page 2, scroll and follow owner and Visitor Grids' : 'existing linked Text preserves separate passages and owner and Visitor navigation', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); }); page.setDefaultTimeout(15000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const path = new URL(route.request().url()).pathname.split('/public/')[1];
      await route.fulfill({ response: await route.fetch({ url: `${origin}/${path}` }) });
    });
    await page.route(`${origin}/__scene_review__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    const mount = async (visitor = false) => page.evaluate(async ({ visitor, sections }) => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { addTextModule } = await import('/src/text/textSession.js');
      const { createTextPresentation, createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const profile = `0x${'1'.repeat(40)}`;
      const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: localStorage });
      if (!store.getDraft().texts?.length) {
        addTextModule(store, profile); const draft = store.getDraft();
        const grid = draft.grids.find(g => g.visibility === 'PUBLIC');
        grid.placements = JSON.parse(fixture.createOwnerSystemWorkflowReviewStorage().getItem(systemWorkflowDraftKey(profile))).grids[0].placements;
        const second = structuredClone(grid); second.id = 'grid:second'; second.title = 'Silence'; draft.grids.push(second);
        second.placements.forEach(p => { p.id += '-second'; p.transform.mirrorX = true; });
        draft.appearance.surfaceId = 'carbon';
        draft.texts[0].visibility = 'PUBLIC';
        draft.texts[0].pagination = 'pages';
        draft.texts[0].sceneLink = { displayId: 'display:primary', gridId: grid.id, passages: [] };
        if (sections) {
          delete draft.texts[0].sceneLink;
          const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
          draft.texts[0].article.content.content = [paragraph('First section. '.repeat(160)), { type: 'pageBreak' }, paragraph('Second section already written. '.repeat(80))];
        }
        draft.texts[0].article.appearance.background = '#101111';
        draft.workbench = createDefaultWorkbenchPresentation();
        draft.workbench.display.open = true; draft.workbench.display.window = { left: 360, top: 40, width: 900, height: 506.25 };
        draft.workbench.texts = [{ ...createTextPresentation(draft.texts[0].id), open: true, window: { left: 20, top: 40, width: 300, height: 450 } }];
        localStorage.setItem(systemWorkflowDraftKey(profile), JSON.stringify(draft));
      }
      await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const draft = JSON.parse(localStorage.getItem(systemWorkflowDraftKey(profile)));
      window.__sceneDraftKey = systemWorkflowDraftKey(profile);
      const root = createRoot(document.getElementById('root'));
      if (visitor) {
        const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
        const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
        root.render(React.createElement(Visitor, { document: buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS }) }));
      } else {
        const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
        root.render(React.createElement(Runtime, { profileAddress: profile, reviewStorage: localStorage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Scene review' } }));
      }
    }, { visitor, sections });
    await page.goto(`${origin}/__scene_review__`); console.log('Scene review loaded'); await mount(); console.log('Scene review mounted');
    const text = page.locator('[data-workbench-module="text"]');
    const editor = text.getByRole('textbox', { name: 'Article text', exact: true });
    const navigateOwner = async direction => {
      const stage = page.locator('[data-system-workflow-artboard]'); const box = await stage.boundingBox();
      await page.mouse.click(box.x + box.width * .8, box.y + box.height * .4);
      await page.locator('main.system-workflow').focus();
      await page.keyboard.down('Space'); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .4); await page.mouse.down();
      await page.mouse.move(box.x + box.width * (direction === 'next' ? .1 : .9), box.y + box.height * .4, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Space');
    };
    if (sections) {
      await editor.waitFor();
      await navigateOwner('next');
      await text.getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
      await text.getByRole('button', { name: 'Next text page', exact: true }).click();
      assert.match(await text.locator('.text-page-navigation span').innerText(), /^2 \/ /);
      const original = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__sceneDraftKey)).texts[0].article);
      await text.getByRole('combobox', { name: 'Follow Display', exact: true }).selectOption('display:primary');
      await text.getByRole('button', { name: 'Link Text to Display', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('Second section already written'));
      assert.doesNotMatch(await text.locator('.text-scene-page article').innerText(), /First section/);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__sceneDraftKey)).texts[0]);
      assert.deepEqual(saved.article, original);
      assert.equal(saved.sceneLink.mode, 'sections'); assert.equal(saved.pagination, undefined);
      const scroll = text.locator('.text-scene-page:not(.text-scene-incoming) .text-module-scroll');
      assert.ok(await scroll.evaluate(n => n.scrollHeight > n.clientHeight + 100));
      await scroll.evaluate(n => { n.scrollTop = 200; });
      assert.ok(await scroll.evaluate(n => n.scrollTop > 100));
      await navigateOwner('previous');
      await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('First section'));
      assert.equal(await scroll.evaluate(n => n.scrollTop), 0);
      await page.screenshot({ path: '.browser-test-runtime/text-sections-owner.png' });
      await text.getByRole('button', { name: 'Write', exact: true }).focus(); await page.keyboard.press('Enter');
      assert.match(await editor.innerText(), /First section/); assert.match(await editor.innerText(), /Second section/);
      await navigateOwner('next');
      assert.match(await editor.innerText(), /First section/);
      await page.reload(); await mount(true);
      await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('First section'));
      await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('Second section'));
      await scroll.evaluate(n => { n.scrollTop = 180; });
      assert.ok(await scroll.evaluate(n => n.scrollTop > 100));
      await page.screenshot({ path: '.browser-test-runtime/text-sections-wide.png' });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const bounds = await page.locator('.visitor-grid-world__viewport').boundingBox();
      await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .6); await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .6, { steps: 5 });
      assert.match(await text.locator('.text-scene-incoming article').innerText(), /First section/);
      assert.doesNotMatch(await text.locator('.text-scene-incoming article').innerText(), /Second section/);
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('First section'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('Second section'));
      await page.setViewportSize({ width: 390, height: 844 });
      assert.match(await text.locator('.text-scene-page article').innerText(), /Second section/);
      await page.screenshot({ path: '.browser-test-runtime/text-sections-narrow.png' });
      assert.deepEqual(errors, []);
      return;
    }
    await editor.fill('Arrival. I lift my head.');
    await editor.blur(); await navigateOwner('next');
    await page.screenshot({ path: '.browser-test-runtime/text-scene-authoring.png' });
    await page.waitForFunction(() => document.querySelector('.text-controls-body')?.textContent.includes('Silence'));
    assert.equal((await editor.innerText()).trim(), '', 'new scene starts with an empty passage');
    const passage = 'There is a low pressure somewhere inside my head. Not a sound exactly. More like something running underneath one. ';
    await editor.fill(passage.repeat(20));
    await editor.press('Control+End');
    await text.getByRole('button', { name: 'Insert page break', exact: true }).click();
    await page.keyboard.type('I stop breathing for a moment.');
    await text.getByRole('button', { name: 'Read', exact: true }).click();
    const next = text.getByRole('button', { name: 'Next text page', exact: true }); await next.waitFor();
    const count = await text.locator('.text-page-navigation span').innerText(); assert.match(count, /^1 \/ [2-9][0-9]*$/);
    await next.click(); assert.match(await text.locator('.text-page-navigation span').innerText(), /^2 \/ /);
    const saved = await page.evaluate(() => localStorage.getItem(window.__sceneDraftKey));
    while (await next.isEnabled()) await next.click();
    assert.ok(await text.locator('.text-page-track article').innerText().then(value => value.includes('I stop breathing for a moment.')));
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__sceneDraftKey)), saved, 'page turns never save draft changes');
    await navigateOwner('previous');
    await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('Arrival.'));
    await page.reload(); await mount(true);
    await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('Arrival.'));
    await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('low pressure'));
    await text.getByRole('button', { name: 'Next text page', exact: true }).click();
    assert.match(await text.locator('.text-page-navigation span').innerText(), /^2 \/ /);
    const pageBounds = await text.locator('.text-page-viewport').evaluate(viewport => {
      const article = viewport.querySelector('article'), paragraph = article.querySelector('p'), bounds = viewport.getBoundingClientRect();
      return [...paragraph.getClientRects()].filter(r => r.right > bounds.left && r.left < bounds.right)
        .map(r => ({ left: r.left - bounds.left, right: bounds.right - r.right }));
    });
    assert.equal(pageBounds.length, 1, 'exactly one column is visible');
    assert.ok(pageBounds[0].left >= 23 && pageBounds[0].right >= 23, 'page two retains both side margins');
    await page.screenshot({ path: '.browser-test-runtime/text-scenes-wide.png' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const stage = page.locator('.visitor-grid-world__viewport'), stageBox = await stage.boundingBox();
    await page.mouse.move(stageBox.x + stageBox.width * .7, stageBox.y + stageBox.height * .6); await page.mouse.down();
    await page.mouse.move(stageBox.x + stageBox.width * .4, stageBox.y + stageBox.height * .6, { steps: 5 });
    const progress = await page.evaluate(() => {
      const scene = document.querySelector('.visitor-grid-world__grid-track'), text = document.querySelector('.text-scene-track');
      return [new DOMMatrix(getComputedStyle(scene).transform).m41 / scene.getBoundingClientRect().width,
        new DOMMatrix(getComputedStyle(text).transform).m41 / text.getBoundingClientRect().width];
    });
    assert.ok(progress[0] < -.1 && Math.abs(progress[0] - progress[1]) < .01, 'Text follows actual swipe progress');
    await page.mouse.up();
    await page.waitForTimeout(70);
    const settling = await page.evaluate(() => {
      const scene = document.querySelector('.visitor-grid-world__grid-track'), text = document.querySelector('.text-scene-track');
      return [new DOMMatrix(getComputedStyle(scene).transform).m41 / scene.getBoundingClientRect().width,
        new DOMMatrix(getComputedStyle(text).transform).m41 / text.getBoundingClientRect().width];
    });
    assert.ok(Math.abs(settling[0] - settling[1]) < .02, 'Text follows Display momentum after release');
    await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.text-scene-page article')?.textContent.includes('Arrival.'));
    await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
    await text.locator('.text-page-viewport').focus(); await page.keyboard.press('End');
    assert.equal(await text.getByRole('button', { name: 'Next text page', exact: true }).isDisabled(), true, 'End goes to the last text page');
    assert.ok(await text.locator('.text-scene-page article').innerText().then(value => value.includes('low pressure')), 'text keyboard navigation leaves the Grid unchanged');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    await page.locator('.system-workflow__presentation-board').dispatchEvent('contextmenu', { clientX: 700, clientY: 200 });
    await page.getByText('PLAY GRIDS', { exact: true }).click();
    await page.waitForTimeout(600);
    const playback = await page.evaluate(() => {
      const scene = document.querySelector('.visitor-grid-world__grid-track'), text = document.querySelector('.text-scene-track');
      return [new DOMMatrix(getComputedStyle(scene).transform).m41 / scene.getBoundingClientRect().width,
        new DOMMatrix(getComputedStyle(text).transform).m41 / text.getBoundingClientRect().width];
    });
    assert.ok(playback[0] < -.03 && playback[0] > -.08 && Math.abs(playback[0] - playback[1]) < .01, 'Text follows slower continuous playback');
    await page.getByRole('button', { name: 'Pause Grids', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
    const landingGrid = await stage.getAttribute('data-active-grid-id');
    await page.mouse.move(stageBox.x + stageBox.width * .7, stageBox.y + stageBox.height * .6); await page.mouse.down();
    await page.mouse.move(stageBox.x + stageBox.width * .6, stageBox.y + stageBox.height * .6, { steps: 5 });
    await page.waitForTimeout(160); await page.mouse.up(); await page.waitForTimeout(750);
    const landingOffsets = () => page.evaluate(() => {
      const scene = document.querySelector('.visitor-grid-world__grid-track'), text = document.querySelector('.text-scene-track');
      return [new DOMMatrix(getComputedStyle(scene).transform).m41 + Number(scene.dataset.railOrigin || 0) * scene.clientWidth,
        new DOMMatrix(getComputedStyle(text).transform).m41];
    });
    assert.ok((await landingOffsets()).every(offset => Math.abs(offset) < .05), 'Display and its existing Text follower land together at exact page origins');
    assert.equal(await stage.getAttribute('data-active-grid-id'), landingGrid, 'a short held release returns to the same Grid');
    await page.mouse.move(stageBox.x + stageBox.width * .8, stageBox.y + stageBox.height * .6); await page.mouse.down();
    await page.mouse.move(stageBox.x + stageBox.width * .15, stageBox.y + stageBox.height * .6, { steps: 5 });
    await page.waitForTimeout(160); await page.mouse.up(); await page.waitForTimeout(750);
    assert.notEqual(await stage.getAttribute('data-active-grid-id'), landingGrid, 'a long held release lands on the next Grid');
    assert.ok((await landingOffsets()).every(offset => Math.abs(offset) < .05), 'the incoming Text page becomes its own exact origin after landing');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.browser-test-runtime/text-scenes-narrow.png' });
    assert.equal(await text.locator('.text-page-viewport').evaluate(n => n.scrollHeight <= n.clientHeight + 1), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
