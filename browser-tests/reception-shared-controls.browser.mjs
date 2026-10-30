import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5173';
const output = '.browser-test-runtime/reception-shared';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const draft = page => page.evaluate(() => window.receptionFixture.root.getSnapshot());
async function setup(width = 1440, height = 1000) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/assets/'))
      return route.fulfill({ response: await route.fetch({ url: origin + url.pathname.split('/public')[1] }) });
    return route.abort();
  });
  await page.goto(origin + '/browser-tests/reception-editor-fixture.html?sample&session=' + crypto.randomUUID());
  await page.getByRole('main', { name: 'Reception editor' }).waitFor();
  await mkdir(output, { recursive: true });
  return { browser, page, errors };
}
test('Library actual pointer edge resize reaches the outer tool above its content', async () => {
  const { browser, page } = await setup(1920, 1080);
  try {
    await page.locator('[data-region-id="region:right"]').press('Enter');
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Library', exact: true });
    const before = await panel.boundingBox();
    for (const edge of await panel.locator('.workbench-tool-panel-resize').all()) {
      const box = await edge.boundingBox();
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-edge'), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      assert.equal(hit, await edge.getAttribute('data-edge'), 'Every visible edge and corner receives pointer input');
    }
    const edge = panel.locator('.workbench-tool-panel-resize[data-edge="e"]');
    const box = await edge.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-edge'), { x, y });
    assert.equal(hit, 'e', 'Library content must not cover the actual resize hit target');
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 100, y, { steps: 8 }); await page.mouse.up();
    assert.ok((await panel.boundingBox()).width >= before.width + 99, 'real mouse drag resizes Library');
    const corner = await panel.locator('[data-edge="se"]').boundingBox(), resized = await panel.boundingBox();
    await page.mouse.move(corner.x + 7, corner.y + 7); await page.mouse.down(); await page.mouse.move(corner.x + 47, corner.y + 47, { steps: 8 }); await page.mouse.up();
    const enlarged = await panel.boundingBox();
    assert.ok(enlarged.width >= resized.width + 39 && enlarged.height >= resized.height + 39, 'corner drag changes both dimensions');
  } finally { await browser.close(); }
});

test('Library and content tools work beside the modal with drop targeting and window activation intact', async () => {
  const { browser, page, errors } = await setup(2560, 1440);
  try {
    const modal = await page.locator('.reception-window').boundingBox();
    const moveOutside = async title => {
      const panel = page.getByRole('region', { name: title, exact: true });
      const grip = await page.getByRole('button', { name: `Move ${title} panel`, exact: true }).boundingBox();
      await page.mouse.move(grip.x + 70, grip.y + 15); await page.mouse.down(); await page.mouse.move(90, 40, { steps: 8 }); await page.mouse.up();
      const box = await panel.boundingBox(); assert.ok(box.x + box.width < modal.x && box.y < modal.y, title + ' is outside both modal edges');
    };
    for (const [trigger, title, image] of [['Cell color', 'Color', true], ['Artwork information', 'Artwork information', true], ['Edit text', 'Text', false]]) {
      await page.locator(image ? '[data-region-id="region:right"]' : '[data-region-id]').first().press('Enter');
      await page.getByRole('button', { name: trigger, exact: true }).click(); await moveOutside(title);
      await page.getByRole('button', { name: `Close ${title}`, exact: true }).click();
    }
    await page.locator('[data-region-id="region:right"]').press('Enter');
    await page.getByRole('button', { name: 'Replace image', exact: true }).click(); await moveOutside('Library');
    const library = page.getByRole('region', { name: 'Library', exact: true });
    const first = library.locator('.lattice-browser-asset').first(); await first.locator('img').first().waitFor();
    const source = await first.boundingBox(), target = await page.locator('[data-region-id="region:right"]').boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
    await page.locator('.system-workflow__placement-preview').waitFor(); await page.mouse.up();
    const crop = page.getByRole('region', { name: 'Image framing', exact: true }); await crop.waitFor();
    await moveOutside('Image framing');
    await page.getByRole('button', { name: 'Move Image framing panel', exact: true }).press('ArrowRight');
    // Activate exposed Library content while crop overlaps it.
    const exposed = await library.locator('.lattice-browser-asset').first().boundingBox();
    await library.locator('.lattice-browser-asset').first().click({ position: { x: exposed.width - 15, y: exposed.height / 2 } });
    assert.ok(Number(await library.evaluate(node => getComputedStyle(node).zIndex)) > Number(await crop.evaluate(node => getComputedStyle(node).zIndex)));
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await library.locator('.lattice-browser-asset img').evaluateAll(images => Promise.all(images.slice(0, 2).map(image => image.decode())));
    const grip = await page.getByRole('button', { name: 'Move Settings panel', exact: true }).boundingBox();
    await page.mouse.move(grip.x + 70, grip.y + 15); await page.mouse.down(); await page.mouse.move(2274, 31, { steps: 8 }); await page.mouse.up();
    await page.screenshot({ path: `${output}/tools-outside-2560.png` });
    await page.setViewportSize({ width: 1920, height: 1080 }); await settle(page);
    await page.screenshot({ path: `${output}/tools-outside-1920.png` });
    assert.equal(await page.locator('.reception-crop-target').count(), 0, 'opening another tool closes crop interaction');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Reception tools move beyond the grid modal and stay usable after reopening', async () => {
  const { browser, page, errors } = await setup(2560, 1440);
  try {
    const original = await draft(page), modal = await page.locator('.reception-window').boundingBox();
    for (const [trigger, title] of [['Settings', 'Settings'], ['Edit name and logo', 'Header'], ['Backup and recovery', 'Backup and recovery']]) {
      await page.getByRole('button', { name: trigger, exact: true }).click();
      const panel = page.getByRole('region', { name: title, exact: true });
      const grip = page.getByRole('button', { name: `Move ${title} panel`, exact: true });
      const from = await grip.boundingBox();
      await page.mouse.move(from.x + 70, from.y + 15); await page.mouse.down(); await page.mouse.move(90, 40, { steps: 8 }); await page.mouse.up();
      const moved = await panel.boundingBox();
      assert.ok(moved.x + moved.width < modal.x, `${title} can sit entirely beside the modal`);
      const hit = await grip.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + 30, r.y + 15)); });
      assert.ok(hit, `${title} is not clipped outside the modal`);
      await page.getByRole('button', { name: `Close ${title}`, exact: true }).click();
      await page.getByRole('button', { name: trigger, exact: true }).click();
      assert.deepEqual(await panel.boundingBox(), moved);
      await page.getByRole('button', { name: `Close ${title}`, exact: true }).click();
    }
    assert.deepEqual(await draft(page), original, 'tool windows do not author grid data');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 390, 320]) test(`shared tool movement, resizing, bounds and private reopening at ${width}`, async () => {
  const { browser, page, errors } = await setup(width);
  try {
    const before = await draft(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Settings', exact: true });
    const grip = page.getByRole('button', { name: 'Move Settings panel', exact: true });
    const first = await panel.boundingBox();
    assert.ok(first.y >= (await page.locator('.reception-window-header').boundingBox()).y + (await page.locator('.reception-window-header').boundingBox()).height, 'tools initially leave the header controls reachable');
    await grip.press('ArrowDown'); await grip.press('ArrowLeft');
    const moved = await panel.boundingBox(); assert.equal(moved.y, first.y + 8);
    await page.getByRole('button', { name: 'Resize Settings panel', exact: true }).press('ArrowUp');
    const resized = await panel.boundingBox(); assert.equal(resized.height, moved.height - 8);
    // A cancelled pointer movement restores exactly the preceding preference.
    const g = await grip.boundingBox(); await page.mouse.move(g.x + 30, g.y + 16); await page.mouse.down();
    await page.mouse.move(g.x + 30, g.y + 80); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await panel.boundingBox(), resized);
    assert.deepEqual(await draft(page), before, 'Window movement is neither authored content nor content history');
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.deepEqual(await panel.boundingBox(), resized);
    await page.waitForTimeout(160); await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.deepEqual(await panel.boundingBox(), resized);
    await page.setViewportSize({ width: 320, height: 580 }); await settle(page);
    const bounds = await page.locator('[data-reception-editor]').boundingBox(), limited = await panel.boundingBox();
    assert.ok(limited.x >= bounds.x && limited.y >= bounds.y && limited.x + limited.width <= bounds.x + bounds.width + 1 && limited.y + limited.height <= bounds.y + bounds.height + 1);
    await page.screenshot({ path: `${output}/bounded-tools-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const action of ['place', 'cancel', 'under sidebar']) test(`Reception Library shared drag targets the cell under release: ${action}`, async () => {
  const cancel = action === 'cancel';
  const { browser, page, errors } = await setup();
  try {
    await page.locator('[data-region-id="region:right"]').click({ position: { x: 100, y: 300 } });
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    const library = page.getByRole('region', { name: 'Choose Reception image' });
    const lib = await library.boundingBox(), work = await page.locator('.reception-editor-workspace').boundingBox();
    assert.ok(lib.width < work.width * .6 && lib.height < work.height, 'Library leaves the grid visible');
    assert.equal(await page.locator('.reception-editor-main').getAttribute('inert'), null, 'Library is modeless');
    if (action === 'place') {
      await page.waitForFunction(() => {
        const cards = [...document.querySelectorAll('.lattice-browser-asset')];
        return cards.length && cards.every(card => [...card.querySelectorAll('img')].some(img => img.complete && img.naturalWidth));
      });
      await library.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode()))); await settle(page);
      assert.ok(await library.getByRole('button', { name: 'Use selected image' }).evaluate(n => parseFloat(getComputedStyle(n).fontSize) < 14));
      await page.screenshot({ path: `${output}/library-browse.png` });
    }
    const before = await draft(page);
    const card = library.locator('.lattice-browser-asset').first();
    await card.locator('img').first().waitFor();
    await card.click(); await settle(page);
    assert.deepEqual(await draft(page), before, 'Click selects, without placing');
    const source = await card.boundingBox();
    const target = await page.locator('[data-region-id]').first().boundingBox();
    const targetX = action === 'under sidebar' ? target.x + 20 : target.x + target.width / 2;
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 3, source.y + source.height / 2); await settle(page);
    assert.equal(await library.getAttribute('data-placing'), null, 'Sub-threshold movement stays browsing');
    await page.mouse.move(targetX, target.y + target.height / 2, { steps: 12 });
    await page.waitForTimeout(200); await page.mouse.move(targetX + 2, target.y + target.height / 2); await settle(page);
    assert.equal(await library.getAttribute('data-placing'), 'true');
    assert.match(await page.locator('.system-workflow__placement-preview').innerText(), /Cell 1/);
    await page.screenshot({ path: `${output}/library-drop-${action.replaceAll(' ', '-')}.png` });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up(); await settle(page);
    if (cancel) {
      assert.deepEqual(await draft(page), before); assert.equal(await library.getAttribute('data-placing'), null);
      await page.keyboard.press('Escape'); await settle(page); // Existing Library behavior clears its selection first.
      assert.equal(await library.locator('.lattice-browser-asset[data-selected]').count(), 0);
      await page.keyboard.press('Escape'); await library.waitFor({ state: 'detached' }); await settle(page);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.regionId), 'region:right');
    }
    else {
      await library.waitFor({ state: 'visible' });
      await page.waitForFunction(() => window.receptionFixture.root.getSnapshot().reception.regions[0].content?.startsWith('image:'));
      const after = await draft(page);
      assert.notEqual(after.reception.regions[0].content, before.reception.regions[0].content);
      assert.equal(after.reception.regions.at(-1).content, before.reception.regions.at(-1).content);
      assert.equal(after.reception.texts.some(text => text.id === before.reception.regions[0].content), false, 'Replacement does not accumulate hidden Saved content');
      await page.getByRole('button', { name: 'Undo Reception', exact: true }).click();
      assert.deepEqual((await draft(page)).reception, before.reception);
      await library.waitFor({ state: 'visible' });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1920, 390]) test(`Library stays movable, resizable and independently saved at ${width}`, async () => {
  const { browser, page, errors } = await setup(width, width === 1920 ? 1080 : 1000);
  try {
    await page.locator('[data-region-id="region:right"]').click({ position: { x: 100, y: 180 } });
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Library', exact: true });
    const before = await draft(page), original = await panel.boundingBox();
    await page.getByRole('button', { name: 'Move Library panel', exact: true }).press('ArrowDown');
    await page.getByRole('button', { name: 'Resize Library panel', exact: true }).press('ArrowUp');
    const resized = await panel.boundingBox();
    assert.equal(resized.y, original.y + 8); assert.equal(resized.height, original.height - 8);
    const grip = await page.getByRole('button', { name: 'Move Library panel', exact: true }).boundingBox();
    await page.mouse.move(grip.x + 30, grip.y + 16); await page.mouse.down();
    await page.mouse.move(grip.x + 30, grip.y + 60); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await panel.boundingBox(), resized, 'Escape cancels window movement');
    assert.deepEqual(await draft(page), before, 'Window frame is private editor state');
    await page.getByRole('button', { name: 'Close Library', exact: true }).click();
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    assert.deepEqual(await panel.boundingBox(), resized);
    await page.waitForTimeout(160); await page.reload();
    await page.locator('[data-region-id="region:right"]').click({ position: { x: 100, y: 180 } });
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    assert.deepEqual(await panel.boundingBox(), resized, 'The same profile reopens its saved Library frame');
    const bounds = await page.locator('[data-reception-editor]').boundingBox();
    assert.ok(resized.x >= bounds.x && resized.y >= bounds.y && resized.x + resized.width <= bounds.x + bounds.width + 1 && resized.y + resized.height <= bounds.y + bounds.height + 1);
    await page.waitForFunction(() => {
      const bounds = document.querySelector('.reception-library .lattice-browser-results')?.getBoundingClientRect();
      const images = [...document.querySelectorAll('.reception-library .lattice-browser-asset img')].filter(image => {
        const rect = image.getBoundingClientRect(); return bounds && rect.top < bounds.bottom && rect.bottom > bounds.top;
      });
      return images.length && images.every(image => image.complete && image.naturalWidth > 0);
    });
    await panel.locator('.lattice-browser-asset img').evaluateAll(images => Promise.all(images.slice(0, 2).map(image => image.decode())));
    await settle(page);
    if (width === 390) assert.equal(await panel.locator('.lattice-browser-sidebar__create > span').first().isVisible(), false, 'Narrow Library does not clip category labels');
    await page.screenshot({ path: `${output}/floating-library-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Reception Library remains open for repeated drops and cell selection', async () => {
  const { browser, page, errors } = await setup(1920);
  try {
    await page.locator('[data-region-id="region:right"]').click({ position: { x: 100, y: 300 } });
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    const library = page.getByRole('region', { name: 'Choose Reception image' });
    const before = await draft(page), firstId = before.reception.regions[0].id;
    for (const [index, targetId] of [firstId, 'region:right'].entries()) {
      const card = library.locator('.lattice-browser-asset').nth(index);
      await card.scrollIntoViewIfNeeded(); await card.locator('img').first().waitFor();
      const source = await card.boundingBox(), target = await page.locator(`[data-region-id="${targetId}"]`).boundingBox();
      const previous = (await draft(page)).reception.regions.find(region => region.id === targetId).content;
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
      await settle(page); await page.mouse.move(target.x + target.width / 2 + 2, target.y + target.height / 2);
      await page.locator('.system-workflow__placement-preview').waitFor(); await page.mouse.up();
      await page.waitForFunction(({ targetId, previous }) => window.receptionFixture.root.getSnapshot().reception.regions.find(region => region.id === targetId).content !== previous, { targetId, previous });
      await library.waitFor({ state: 'visible' });
      assert.equal(await page.locator(`[data-region-id="${targetId}"] .reception-crop-target`).count(), 1, 'Every placement opens crop in its receiving cell');
      await page.getByRole('region', { name: 'Image framing', exact: true }).getByRole('button', { name: 'Finish crop', exact: true }).click();
    }
    const placed = await draft(page);
    assert.notEqual(placed.reception.regions.find(region => region.id === firstId).content, before.reception.regions[0].content);
    assert.notEqual(placed.reception.regions.find(region => region.id === 'region:right').content, before.reception.regions.find(region => region.id === 'region:right').content);
    await page.mouse.click(1900, 20);
    assert.equal(await page.locator('[data-region-id][data-selected]').count(), 0);
    const card = library.locator('.lattice-browser-asset').first();
    await card.scrollIntoViewIfNeeded(); await card.click();
    assert.equal(await library.getByRole('button', { name: 'Use selected image' }).isEnabled(), false, 'No implicit target after deselecting a cell');
    await card.dblclick(); await settle(page);
    assert.deepEqual(await draft(page), placed, 'Double-click with no selected cell must not replace the first cell');
    await page.locator('[data-region-id="region:right"]').click({ position: { x: 100, y: 300 } });
    await library.waitFor({ state: 'visible' });
    assert.equal(await library.getByRole('button', { name: 'Use selected image' }).isEnabled(), true);
    await page.screenshot({ path: `${output}/library-repeated-drop.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const outcome of ['accept', 'close', 'draft change']) test(`Reception receiver retains or rejects delayed image after ${outcome}`, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const pending = [];
    await page.route('https://reception.test/delayed.webp', route => { pending.push(route); });
    await page.goto(origin + '/browser-tests/reception-editor-fixture.html?session=' + crypto.randomUUID());
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const Library = (await import('/src/reception/ReceptionLibrary.jsx')).default;
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { createReception } = await import('/src/profileDocument/domain/receptionPresentation.js');
      const { splitReception } = await import('/src/reception/receptionLayout.js');
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const disk = new Map();
      const root = createSystemWorkflowDraftStore({ profileAddress: '0x' + '2'.repeat(40), storage: { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value) } });
      const value = createReception(), first = value.regions[0].id;
      root.commitCompletedOperation({ ...root.getSnapshot(), reception: splitReception(value, first, 'x', 'region:second') }, { expectedGeneration: root.getGeneration() });
      const store = root.acquireReceptionScope();
      const source = OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0];
      const asset = { ...source, src: 'https://reception.test/delayed.webp', imageUrl: 'https://reception.test/delayed.webp', originalImageUrl: 'https://reception.test/delayed.webp',
        thumbnailUrl: source.src, previewSrc: source.src, width: undefined, height: undefined, imageWidth: undefined, imageHeight: undefined };
      const library = { libraryData: { status: 'ready', assets: [asset], categories: [], ownerContext: 'delay' } };
      document.getElementById('root').style.display = 'none';
      const node = document.createElement('div'); document.body.append(node);
      function Host() {
        const current = React.useSyncExternalStore(store.subscribe, store.getSnapshot), host = React.useRef(null), [open, setOpen] = React.useState(true);
        window.delayFixture = { store, close: () => setOpen(false) };
        return React.createElement('main', { className: 'reception-page system-workflow__token-scope', 'data-menu-surface': 'carbon' },
          React.createElement('div', { ref: host, style: { position: 'relative', width: 1100, height: 700 } },
            ...current.reception.regions.map((r,i) => React.createElement('section', { key: r.id, 'data-region-id': r.id, style: { position: 'absolute', left: i*550, top: 0, width: 550, height: 700 } }, r.id)),
            open && React.createElement(Library, { store, value: current.reception, expected: current.reception, regionId: first, boundsRef: host, library,
              menuSurface: 'carbon', onClose: () => setOpen(false), onPlaced: id => { window.delayFixture.placed = id; setOpen(false); } })));
      }
      createRoot(node).render(React.createElement(Host));
    });
    const library = page.getByRole('region', { name: 'Choose Reception image' });
    const card = library.locator('.lattice-browser-asset').first(); await card.waitFor();
    const box = await card.boundingBox(); await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
    await page.mouse.move(900,350,{ steps: 6 }); await settle(page); await page.mouse.move(902,350); await settle(page);
    assert.match(await page.locator('.system-workflow__placement-preview').innerText(), /Cell 2/);
    await page.mouse.up(); await settle(page);
    assert.ok(pending.length, 'The full media decode is pending after release');
    assert.equal(await page.evaluate(() => delayFixture.store.getSnapshot().reception.imageModules.length), 0);
    if (outcome === 'close') await page.evaluate(() => delayFixture.close());
    if (outcome === 'draft change') await page.evaluate(() => { const s = delayFixture.store, d = s.getSnapshot(); s.commitCompletedOperation({ ...d, reception: { ...d.reception, radius: 33 } }, { expectedGeneration: s.getGeneration() }); });
    for (const route of pending) await route.fulfill({ path: 'public/assets/actors/abyssal_eye/full.webp', contentType: 'image/webp' });
    await page.waitForTimeout(150); await settle(page);
    if (outcome === 'accept') {
      await library.waitFor({ state: 'detached' });
      const value = await page.evaluate(() => delayFixture.store.getSnapshot().reception);
      assert.equal(value.regions[0].content, null); assert.match(value.regions[1].content, /^image:/);
      assert.equal(value.imageModules[0].sides[0].asset.media.width, 2000);
    } else assert.equal(await page.evaluate(() => delayFixture.store.getSnapshot().reception.imageModules.length), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
