import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5197';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('Image body distinguishes inspection, movement, cancellation, flip, crop and Workbench selection', { timeout: 60000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://image.fit.test/source.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.route(`${origin}/__image_interaction__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_interaction__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/image-fit-fixture.jsx')).mount();
    });
    const windows = page.locator('.image-module__window'), first = windows.first(); await first.waitFor();
    await page.evaluate(() => {
      const api = imageFitFixture, draft = api.store.getDraft();
      draft.imageModules = draft.imageModules.slice(0, 2).map(image => ({ ...image, id: `${image.id}-gesture`, width: 320, height: 240,
        sides: [image.sides[0], { ...image.sides[0], id: `${image.sides[0].id}-second`, transform: { quarterTurns: 0, mirrorX: true, mirrorY: false } }],
      }));
      draft.workbench.imageModules = draft.workbench.imageModules.slice(0, 2).map((image, i) => ({ ...image, id: `${image.id}-gesture`, position: { left: 80 + i * 400, top: 160 } }));
      if (!api.store.commitCompletedOperation(draft, { expectedGeneration: api.store.getGeneration() })) throw Error('Interaction fixture failed to save');
    }); await settle(page);
    const canvas = first.locator('.image-module__canvas'), next = first.getByRole('button', { name: 'Next Image side' });
    const dialog = page.getByRole('dialog', { name: 'Inspect Image' });
    const rectangle = () => first.evaluate(node => node.getBoundingClientRect().toJSON());
    const initial = await rectangle(), draft = await page.evaluate(() => imageFitFixture.store.getDraft());
    assert.ok(initial.x >= 0 && initial.right <= 1440 && initial.y >= 0 && initial.bottom <= 1000, JSON.stringify(initial));
    await page.screenshot({ path: `${output}/image-interaction-initial.png` });
    // Pointer jitter stays a selection click, without camera travel or inspection.
    await page.mouse.move(initial.x + 70, initial.y + 90); await page.mouse.down();
    assert.equal(await first.evaluate(node => node === document.activeElement), true, 'first pointer activation focuses the same Image window');
    assert.equal(await first.getAttribute('data-active'), 'true', 'first pointer activation still selects the Image');
    await page.mouse.move(initial.x + 72, initial.y + 91); await page.mouse.up();
    assert.equal(await dialog.count(), 0, 'ordinary click selects without inspecting');
    assert.equal(await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).isDisabled(), true, 'ordinary click adds no camera history');
    await settle(page);
    assert.deepEqual(await rectangle(), initial);
    await canvas.focus(); await page.keyboard.press('i'); await dialog.waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });

    for (const ending of ['Escape', 'pointercancel', 'blur', 'commit']) {
      await windows.nth(1).locator('.image-module__canvas').focus();
      assert.equal(await first.getAttribute('data-active'), null, 'keyboard focus activates the other Image');
      const before = await rectangle();
      await page.keyboard.down('Alt');
      await page.mouse.move(before.x + 70, before.y + 90); await page.mouse.down();
      assert.equal(await first.evaluate(node => node === document.activeElement), true, 'pointer retargets focus before movement');
      assert.equal(await first.getAttribute('data-active'), 'true');
      assert.equal(await windows.nth(1).getAttribute('data-active'), null, 'activation does not stay with the preceding Image');
      await page.mouse.move(before.x + 130, before.y + 130, { steps: 6 }); await settle(page);
      assert.equal((await rectangle()).x, before.x + 60, 'artwork follows the pointer');
      if (ending === 'Escape') await page.keyboard.press('Escape');
      if (ending === 'pointercancel') await canvas.dispatchEvent('pointercancel', { pointerId: 1, bubbles: true });
      if (ending === 'blur') await page.evaluate(() => dispatchEvent(new Event('blur')));
      await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
      assert.equal(await dialog.count(), 0, `${ending} does not inspect on release`);
      const after = await rectangle();
      if (ending === 'commit') { assert.equal(after.x, before.x + 60); assert.equal(after.y, before.y + 40); }
      else assert.deepEqual(after, before, `${ending} restores the entire preview`);
      assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), draft, 'movement preserves authored size, crop and source');
    }
    // Flip remains a separate action, with no visible count or accidental movement.
    const moved = await rectangle(), firstSide = await canvas.getAttribute('data-side-id');
    await canvas.hover();
    assert.equal((await next.innerText()).trim(), '');
    await next.click(); await settle(page);
    assert.notEqual(await canvas.getAttribute('data-side-id'), firstSide);
    assert.deepEqual(await rectangle(), moved); assert.equal(await dialog.count(), 0);
    await next.focus(); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await canvas.getAttribute('data-side-id'), firstSide, 'keyboard flipping wraps');
    await page.screenshot({ path: `${output}/image-interaction-wide.png` });
    // Crop owns its drag; closing it restores the ordinary body interaction.
    const dock = page.locator('[data-context-tools], [data-context-action-bars]');
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('slider', { name: 'Crop zoom' }).fill('2');
    const projection = () => canvas.locator('image').getAttribute('transform'), beforeCrop = await projection();
    await page.mouse.move(moved.x + 70, moved.y + 90); await page.mouse.down();
    await page.mouse.move(moved.x + 130, moved.y + 130, { steps: 6 }); await page.mouse.up(); await settle(page);
    assert.notEqual(await projection(), beforeCrop); assert.deepEqual(await rectangle(), moved);
    await dock.getByRole('button', { name: 'Cancel', exact: true }).click();
    const resize = first.getByRole('separator', { name: 'Resize Image top', exact: true }), resizeBox = await resize.boundingBox();
    await page.keyboard.down('Shift'); await page.keyboard.down('Alt');
    await page.mouse.move(resizeBox.x + 14, resizeBox.y + 14); await page.mouse.down();
    await page.mouse.move(resizeBox.x + 14, resizeBox.y - 10, { steps: 4 }); await page.mouse.up();
    await page.keyboard.up('Alt'); await page.keyboard.up('Shift'); await settle(page);
    assert.equal((await rectangle()).height, moved.height + 24, 'Shift on a resize target still resizes instead of selecting');
    assert.equal(await page.locator('.workbench-selection').count(), 0);
    await page.evaluate(() => imageFitFixture.store.undo()); await settle(page);
    assert.deepEqual(await rectangle(), moved);
    // Both pointer and keyboard selection act on the artwork without opening it.
    // Ordinary activation already selected this Image. The first Shift-click
    // removes it; the next adds it to an explicit selection.
    await canvas.click({ modifiers: ['Shift'] }); await settle(page);
    assert.equal(await page.locator('.workbench-selection').count(), 0, 'Shift removes the ordinary selection');
    assert.equal(await page.getByRole('spinbutton', { name: 'Transform Width', exact: true }).count(), 0, 'Transform has no selected artwork');
    await canvas.click({ modifiers: ['Shift'] }); await settle(page);
    assert.equal(await dialog.count(), 0);
    await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
    await windows.nth(1).locator('.image-module__canvas').focus(); await page.keyboard.press('Shift+Enter');
    await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0);
    const selectedImage = await rectangle();
    await page.keyboard.down('Shift'); await page.mouse.click(selectedImage.x + 70, selectedImage.y + 90); await page.keyboard.up('Shift');
    await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0, 'deselecting through the selection overlay does not inspect');
    await page.keyboard.press('Escape');
    await page.mouse.click(10, 700); await settle(page);
    await canvas.click({ modifiers: ['Shift'] }); await settle(page);
    assert.equal(await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).count(), 1, 'isolated fixture also selects Image from empty background');
    await page.keyboard.press('Escape'); await settle(page);

    // Visitor uses identical click/drag/flip behavior and never writes the draft.
    await page.evaluate(() => imageFitFixture.owner(false)); await settle(page);
    const visitorStart = await rectangle();
    await page.mouse.move(visitorStart.x + 60, visitorStart.y + 70); await page.mouse.down();
    await page.mouse.move(visitorStart.x + 90, visitorStart.y + 100, { steps: 5 }); await page.mouse.up(); await settle(page);
    assert.equal((await rectangle()).x, visitorStart.x + 30); assert.equal(await dialog.count(), 0);
    await canvas.focus(); await page.keyboard.press('i'); await dialog.waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => imageFitFixture.store.getDraft()), draft);
    await page.evaluate(() => imageFitFixture.camera(1, { x: -100, y: 0 }));
    await page.setViewportSize({ width: 390, height: 844 }); await canvas.hover();
    await page.screenshot({ path: `${output}/image-interaction-narrow.png` });
    const closeRect = await first.locator('.image-module__close').boundingBox();
    assert.ok(closeRect.x >= 0 && closeRect.x + closeRect.width <= 390, 'close remains reachable');
    await page.mouse.click(10, 700); await settle(page);
    assert.equal(await next.evaluate(node => getComputedStyle(node).opacity), '0', 'resting artwork has no flip tag');
    await page.screenshot({ path: `${output}/image-interaction-rest.png` });
    // Minimum-size artwork retains a real drag/inspection target. Hover controls
    // sit outside both it and the resize targets, and stay reachable on narrow screens.
    await page.evaluate(() => {
      // This minimal fixture has no Runtime background-activation handler.
      // Clear the old contextual target before the isolated hit-target check.
      imageFitFixture.select(null);
      imageFitFixture.owner(true);
      const store = imageFitFixture.store, draft = store.getDraft();
      draft.imageModules[0] = { ...draft.imageModules[0], width: 32, height: 32 };
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Minimum-size fixture failed to save');
    }); await settle(page);
    // The owner dock reappears above the tiny Image's controls. Park it via UI.
    const resizeDock = page.locator('.workbench-tool-dock .workbench-tool-panel-resize[data-edge="se"]');
    await resizeDock.focus(); for (let i = 0; i < 10; i++) await resizeDock.press('Shift+ArrowUp');
    const moveDock = page.getByRole('button', { name: 'Move Transform, Color and Info panel', exact: true });
    await moveDock.focus(); for (let i = 0; i < 20; i++) await moveDock.press('Shift+ArrowDown');
    await settle(page);
    assert.equal(await first.locator('.image-module__close').count(), 0, 'owner artwork has no Visitor close control');
    assert.ok(await first.getByRole('separator').count() > 0, 'owner retains minimum-size resize targets');
    for (const owner of [true, false]) {
      if (!owner) { await page.evaluate(() => imageFitFixture.owner(false)); await settle(page); }
      await canvas.hover();
      assert.ok(await canvas.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === node; }), 'minimum canvas centre remains grabbable');
      // Close belongs to Visitor; both modes retain a real flip target.
      for (const control of owner ? [next] : [next, first.locator('.image-module__close')]) {
        assert.ok(await control.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.x + 14, r.y + 14)?.closest('button') === node; }), 'minimum canvas controls have distinct hit targets');
      }
      await next.click(); await settle(page); assert.equal(await dialog.count(), 0);
      await page.screenshot({ path: `${output}/image-interaction-minimum-${owner ? 'owner' : 'visitor'}.png` });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const visitor of [false, true]) for (const width of [1440, 390]) test(`Runtime Image Shift selection starts empty and preserves group candidates (${visitor ? 'Visitor' : 'owner'}, ${width}px)`, { timeout: 60000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountGridMotionFixture(page, { origin, visitor, count: 1, displayWidth: 320, seamReview: 'single' });
    await page.evaluate(async ({ visitor, width }) => {
      const draft = JSON.parse(localStorage.getItem(window.__motionKey)), original = draft.imageModules[0];
      const { createArticle } = await import('/src/text/domain/article.js');
      const { createTextPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
      draft.displays = []; draft.grids[0].placements = []; draft.workbench.display.open = false;
      draft.imageModules = [0, 1].map(index => ({ ...original, id: `image:selection-${index}`, width: 200, height: 160 }));
      draft.workbench.imageModules = draft.imageModules.map((image, index) => ({ id: image.id, open: true, position: { left: width === 390 ? 80 : 320 + index * 300, top: width === 390 ? 180 + index * 240 : 180 } }));
      draft.texts = [{ id: 'text:candidate', article: createArticle('Candidate text'), visibility: 'PUBLIC' }];
      draft.workbench.texts = [{ ...createTextPresentation('text:candidate'), open: true, window: { left: 900, top: 180, width: 180, height: 120 } }];
      draft.shapes = [{ id: 'shape:candidate', name: 'Candidate shape', color: '#758278', opacity: 1, visibility: 'PUBLIC' }];
      draft.workbench.shapes = [{ id: 'shape:candidate', open: true, window: { left: 900, top: 400, width: 160, height: 120 } }];
      draft.artworkLayers = ['image:selection-0', 'image:selection-1', 'text:candidate', 'shape:candidate'];
      localStorage.setItem(window.__motionKey, JSON.stringify(draft));
      if (visitor) {
        const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
        Object.assign(window.__motionDocument, buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: `0x${'1'.repeat(40)}`, assetRecords: [] }));
      }
      window.__motionRemount();
    }, { visitor, width });
    const first = page.locator('[data-image-module="image:selection-0"] .image-module__canvas');
    const second = page.locator('[data-image-module="image:selection-1"] .image-module__canvas');
    const group = count => page.getByRole('group', { name: `${count} selected Workbench modules`, exact: true });
    await first.waitFor(); await settle(page);
    const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    const frames = await page.locator('.image-module__window').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    await page.evaluate(() => {
      window.__imageSelectionTrace = [];
      const record = phase => event => window.__imageSelectionTrace.push({ phase, type: event.type, shift: event.shiftKey, target: event.target.className, focus: document.activeElement?.className });
      document.addEventListener('pointerdown', record('document capture'), true);
      document.addEventListener('focusin', record('document capture'), true);
      const host = document.querySelector('main.system-workflow');
      host.addEventListener('pointerdown', record('native host capture'), true);
      host.addEventListener('focusin', record('native host bubble'));
    });
    await page.mouse.click(4, 4); await settle(page);
    await page.evaluate(() => { window.__imageSelectionTrace = []; });
    await first.click({ modifiers: ['Shift'] }); await settle(page);
    const proof = await page.evaluate(() => ({ trace: window.__imageSelectionTrace, group: document.querySelector('.workbench-selection')?.getAttribute('aria-label') || null }));
    proof.savedContentUnchanged = await page.evaluate(saved => localStorage.getItem(window.__motionKey) === saved, saved);
    await writeFile(`${output}/image-shift-empty-${visitor ? 'visitor' : 'owner'}-${width}.json`, JSON.stringify(proof, null, 2));
    assert.equal(await group(1).count(), 1, 'Shift-click from empty background creates an explicit Image selection');
    assert.ok(await group(1).isVisible());
    assert.equal(proof.savedContentUnchanged, true);
    // The explicit selection overlay owns this real pointer hit.
    await page.keyboard.down('Shift'); await page.mouse.click(frames[0].x + 70, frames[0].y + 90); await page.keyboard.up('Shift'); await settle(page);
    assert.equal(await page.locator('.workbench-selection').count(), 0, 'a second Shift-click removes it');
    await first.click({ modifiers: ['Shift'] }); await settle(page);
    await group(1).waitFor();
    await second.focus(); await settle(page); await page.keyboard.press('Shift+Enter'); await group(2).waitFor();
    const firstRect = frames[0];
    await page.keyboard.down('Shift'); await page.mouse.click(firstRect.x + 70, firstRect.y + 90); await page.keyboard.up('Shift'); await group(1).waitFor();
    if (!visitor && width === 1440) for (const id of ['text:candidate', 'shape:candidate']) {
      const candidate = page.locator(`[data-workbench-view-id="${id}"][data-workbench-selectable], [data-workbench-view-id="${id}"] [data-workbench-selectable]`).first();
      await candidate.focus(); await settle(page);
      await group(1).waitFor();
      await page.keyboard.press('Shift+Enter'); await group(2).waitFor();
      await page.keyboard.press('Shift+Enter'); await group(1).waitFor();
    }
    await page.keyboard.press('Escape'); await settle(page);
    await first.click(); await settle(page);
    assert.equal(await first.evaluate(node => node.closest('.image-module__window') === document.activeElement), true, 'ordinary pointer activation retains Image window focus');
    await first.focus(); await settle(page); await page.keyboard.press('Shift+Enter'); await group(1).waitFor();
    assert.equal(await page.locator('.image-lift').count(), 0, 'selection never opens Inspect');
    assert.equal(await page.getByRole('button', { name: 'Back to previous Workbench view', exact: true }).isDisabled(), true, 'selection never adds camera history');
    assert.deepEqual(await page.locator('.image-module__window').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON())), frames);
    assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'pointer and keyboard selection never save authored content');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
