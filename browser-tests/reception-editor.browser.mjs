import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/static-reception';

test('one bottom toolbar keeps every narrow-image action reachable and follows selection', { timeout: 60000 }, async () => {
  for (const width of [1920, 390, 320]) {
    const { browser, page, errors } = await setup(width, '?sample');
    try {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
      await page.evaluate(() => {
        const { root } = window.receptionFixture, draft = root.getDraft(), r = draft.reception;
        const image = r.regions.find(cell => cell.content === r.imageModules[0].id);
        const text = r.regions.find(cell => cell.content === r.texts[0].id);
        r.regions = [{ ...image, x: 0, y: 0, width: 1000, height: 10000 }, { ...text, x: 1000, y: 0, width: 9000, height: 10000 }];
        r.mobile = r.regions.map(cell => ({ id: cell.id, columns: 1, height: 900 }));
        if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid narrow image fixture');
      });
      const photo = page.locator('[data-image]');
      await photo.press('Enter'); await page.evaluate(() => document.fonts.ready);
      const toolbar = page.getByRole('toolbar', { name: 'Cell 1 tools', exact: true });
      const bounds = await toolbar.boundingBox();
      assert.ok((await photo.boundingBox()).width < 190);
      assert.equal(await toolbar.evaluate(node => Boolean(node.closest('[data-region-id]'))), false);
      assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 1);
      assert.ok(Math.abs(bounds.y + bounds.height - (width === 1920 ? 1080 : 844) + 16) < 1);
      assert.equal(await toolbar.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      assert.equal(await toolbar.getByRole('button', { name: 'Move cell', exact: true }).count(), 0);
      const handle = await photo.getByRole('button', { name: 'Move cell', exact: true }).boundingBox(), cell = await photo.boundingBox();
      assert.ok(handle.x >= cell.x && handle.x < cell.x + 16 && handle.y >= cell.y && handle.y < cell.y + 16, 'Only the move handle stays at the cell top left');
      for (const button of await toolbar.getByRole('button').all()) await button.click({ trial: true });
      await photo.click({ position: { x: 70, y: 60 } });
      await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/narrow-image-toolbar-' + width + '.png' });
      await toolbar.getByRole('button', { name: 'Crop image', exact: true }).click();
      assert.equal(await photo.getAttribute('data-selected'), 'true');
      await toolbar.getByRole('button', { name: 'Finish crop', exact: true }).click();
      await page.locator('.reception-window-main').evaluate(node => { node.scrollTop = 200; });
      assert.deepEqual(await toolbar.boundingBox(), bounds, 'Scrolling content leaves the toolbar fixed');
      await page.locator('[data-text]').press('Enter');
      assert.equal(await page.getByRole('toolbar').count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Crop image', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Edit text', exact: true }).click();
      await page.getByRole('region', { name: 'Text', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      assert.equal(await page.locator('.reception-editor-toolbar').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});
test('real Workbench entry saves its layout, releases capabilities and returns to Workbench or Canvases', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/browser-tests/workbench-storage-fixture.html?seed=1&shell=1');
    await page.locator('.text-window').waitFor();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('main', { name: 'Reception editor' }).waitFor();
    const before = await page.evaluate(() => window.savedDraft().workbenches);
    await addCell(page, 'Beside');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.text-window').waitFor();
    assert.deepEqual(await page.evaluate(() => window.savedDraft().workbenches), before);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('main', { name: 'Reception editor' }).waitFor();
    assert.equal(await page.locator('[data-region-id]').count(), 2);
    await page.getByRole('button', { name: 'Canvases', exact: true }).click();
    await page.locator('.workbench-overview').waitFor();
    assert.equal(await page.locator('[data-reception-editor]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('narrow layout commands and corner extremes remain usable', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(390, '?sample');
  try {
    await openSettings(page, 'Grid');
    const radius = page.getByRole('slider', { name: 'Corners', exact: true });
    for (const r of [0, 160]) {
      await radius.press(r ? 'End' : 'Home');
      assert.equal((await layout(page)).radius, r);
      await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
      await page.screenshot({ path: output + '/editor-390-radius-' + r + '.png' });
    }
    const gutter = page.getByRole('slider', { name: 'Gaps', exact: true });
    await gutter.press('Home'); assert.equal((await layout(page)).gutter, 0);
    await closePanel(page, 'Settings');
    await page.locator('[data-region-id]').first().press('Enter');
    await openSettings(page, 'Text');
    await closePanel(page, 'Settings');
    await page.getByRole('button', { name: 'Move cell', exact: true }).press('ArrowDown');
    assert.equal((await layout(page)).mobile[1].id, (await layout(page)).regions[0].id);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.ok(await page.locator('.reception-page').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({ path: output + '/editor-390-mobile-preview.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('paired mobile regions keep both content areas below the window navigation', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(390, '?sample');
  try {
    await page.locator('[data-region-id]').first().press('Enter');
    await openSettings(page, 'Grid');
    await page.getByRole('button', { name: 'Half row', exact: true }).click();
    await closePanel(page, 'Settings');
    const regions = page.locator('.reception-region');
    await regions.nth(1).click({ position: { x: 80, y: 120 } });
    await openSettings(page, 'Grid');
    await page.getByRole('button', { name: 'Half row', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
    await page.locator('.reception-window-main').evaluate(node => { node.scrollTop = 0; });
    const nav = await page.locator('.reception-navigation').boundingBox();
    for (const index of [0, 1]) {
      const content = await regions.nth(index).locator('.reception-region-content').boundingBox();
      assert.ok(content.y >= nav.y + nav.height, 'Content must remain below the real navigation footprint');
    }
    await page.screenshot({ path: output + '/mobile-paired-navigation.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('image regions retain their own zero/max corners below long navigation with transparent SVG', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(800, '?sample');
  try {
    await page.route('https://reception.test/transparent.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><path fill="#327ba8" fill-opacity=".5" d="M0 0H600V600H0Z"/><circle cx="300" cy="300" r="180" fill="#d08040"/></svg>' }));
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(), value = draft.reception;
      const image = value.imageModules[0]; image.sides[0].asset.media = { ...image.sides[0].asset.media, url: 'https://reception.test/transparent.svg', width: 600, height: 600 };
      const first = value.regions[0];
      value.regions = [{ ...first, x: 0, y: 0, width: 10000, height: 10000, padding: 0, content: image.id, surface: '#45534b' }];
      value.mobile = [{ id: first.id, height: 600, columns: 2 }];
      value.branding.name = 'Long authored studio name with many characters';
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid rounded-region fixture');
    });
    await openSettings(page, 'Grid');
    for (const r of [0, 160]) {
      const control = page.getByRole('slider', { name: 'Corners', exact: true });
      await control.press(r ? 'End' : 'Home');
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      for (const theme of ['carbon', 'mist']) {
        const toggle = page.getByRole('button', { name: theme === 'carbon' ? 'Use dark appearance' : 'Use light appearance' });
        if (await toggle.count()) await toggle.click();
        await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
        await page.screenshot({ path: output + '/transparent-region-' + r + '-' + theme + '.png' });
        const hit = await page.locator('.reception-canvas').evaluate(n => {
          const b = n.getBoundingClientRect(); return !!document.elementFromPoint(b.left + 3, b.top + 3)?.closest('[data-region-id]');
        });
        assert.equal(hit, r === 0);
      }
      await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
      await openSettings(page, 'Grid');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('keyboard cell movement carries the full cell and deletion restores through undo', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    assert.equal(await page.locator('[data-selected]').count(), 0);
    assert.equal(await page.locator('.reception-selection').count(), 0);
    await page.getByRole('button', { name: 'New Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('First article');
    await addCell(page, 'Beside');
    await page.locator('[data-selected]').getByRole('button', { name: 'New Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('Second article');
    await openSettings(page, 'Text');
    await page.getByRole('slider', { name: 'Content spacing', exact: true }).fill('32');
    await page.getByRole('slider', { name: 'Content spacing', exact: true }).press('Tab');
    await closePanel(page, 'Settings');
    const before = await layout(page);
    await page.getByRole('button', { name: 'Move cell', exact: true }).press('ArrowLeft');
    const moved = await layout(page);
    assert.equal(moved.regions[0].id, before.regions[1].id);
    assert.equal(moved.regions[0].content, before.regions[1].content);
    assert.equal(moved.regions[0].padding, 32);
    await page.getByRole('button', { name: 'Delete cell', exact: true }).click();
    assert.equal((await layout(page)).regions.length, 1);
    assert.equal((await layout(page)).texts.length, 1);
    await page.getByRole('button', { name: 'Undo Reception', exact: true }).click();
    assert.deepEqual(await layout(page), moved);
    assert.equal(await page.getByRole('button', { name: /Cell options|Join with neighbor|Saved content|Move or swap content/ }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
const layout = page => page.evaluate(() => window.receptionFixture.root.getDraft().reception);
const stamp = page => page.evaluate(() => window.receptionFixture.root.getGeneration());
async function setup(width = 1440, search = '') {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
  await page.goto(origin + '/browser-tests/reception-editor-fixture.html' + search);
  try { await page.getByRole('region', { name: 'Reception layout', exact: true }).waitFor({ timeout: 12000 }); }
  catch (error) { await browser.close(); throw new Error(errors.join('\n') || error.message); }
  return { browser, page, errors };
}
test('Reception authoring uses shared Library and Text, atomic gestures, history, failure recovery and public preview', { timeout: 120000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const canvasBefore = await page.evaluate(() => { const { reception, ...draft } = window.receptionFixture.root.getDraft(); return draft; });
    assert.equal(await page.locator('.system-workflow__workbench, .workbench-world').count(), 0);
    await addCell(page, 'Beside');
    assert.equal((await layout(page)).regions.length, 2);
    await page.locator('[data-selected]').getByRole('button', { name: 'Image from Library', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Choose Reception image' });
    await picker.waitFor();
    await picker.locator('.lattice-browser-asset').first().click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    assert.equal(await picker.isVisible(), true);
    await page.getByRole('button', { name: 'Close Library', exact: true }).click();
    await closePanel(page, 'Image framing');
    assert.equal((await layout(page)).imageModules.length, 1);
    await page.getByRole('region', { name: 'Region 1 · Empty', exact: true }).click({ position: { x: 90, y: 180 } });
    await page.getByRole('button', { name: 'New Text', exact: true }).click();
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    await body.waitFor(); await body.fill('A living introduction.');
    await page.waitForFunction(() => JSON.stringify(window.receptionFixture.root.getDraft().reception.texts).includes('A living introduction.'));
    await page.evaluate(() => window.receptionFixture.fail(true));
    await body.press('End'); await body.pressSequentially(' Saved after retry.');
    await page.getByRole('button', { name: 'Edit text', exact: true }).click();
    await page.getByRole('button', { name: 'Retry saving Text', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.getByRole('main', { name: 'Reception editor' }).count(), 1);
    await page.evaluate(() => window.receptionFixture.fail(false));
    await page.getByRole('button', { name: 'Retry saving Text', exact: true }).click();
    await page.waitForFunction(() => JSON.stringify(window.receptionFixture.root.getDraft().reception.texts).includes('Saved after retry.'));
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.equal(await body.count(), 0);
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    const beforeDrag = await stamp(page), divider = page.getByRole('slider', { name: 'Resize divider 1' });
    const bounds = await divider.boundingBox(), x = bounds.x + bounds.width / 2, y = bounds.y + 250;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y, { steps: 6 });
    assert.equal(await stamp(page), beforeDrag);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await stamp(page), beforeDrag);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y, { steps: 6 }); await page.mouse.up();
    assert.equal(await stamp(page), beforeDrag + 1);
    const resized = await layout(page);
    await page.getByRole('button', { name: 'Undo Reception', exact: true }).click();
    assert.notEqual((await layout(page)).regions[0].width, resized.regions[0].width);
    await page.getByRole('button', { name: 'Redo Reception', exact: true }).click();
    assert.deepEqual(await layout(page), resized);
    await page.getByRole('button', { name: 'Mobile layout', exact: true }).click();
    await openSettings(page, 'Text');
    await closePanel(page, 'Settings');
    await page.getByRole('button', { name: 'Move cell', exact: true }).press('ArrowDown');
    assert.notEqual((await layout(page)).mobile[0].id, resized.mobile[0].id);
    await page.getByRole('button', { name: 'Mobile layout', exact: true }).click();
    await page.getByRole('button', { name: 'Delete cell', exact: true }).click();
    assert.equal((await layout(page)).texts.length, 0);
    await page.getByRole('button', { name: 'Undo Reception', exact: true }).click();
    await page.locator('[data-region-id]').filter({ hasText: 'A living introduction.' }).click({ position: { x: 8, y: 8 } });
    await openSettings(page, 'Grid');
    await page.getByLabel('Include in publication', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.equal(await page.getByText('A living introduction. Saved after retry.', { exact: true }).count(), 0);
    assert.deepEqual(await page.evaluate(() => { const { reception, ...draft } = window.receptionFixture.root.getDraft(); return draft; }), canvasBefore);
    await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/editor-preview.png', fullPage: true });
    const saved = await layout(page); await page.reload();
    await page.getByRole('main', { name: 'Reception editor' }).waitFor();
    assert.deepEqual(await layout(page), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const width of [2560, 1440, 800, 640, 390, 320]) test('public static Reception silhouette and content at ' + width, { timeout: 45000 }, async () => {
  const { browser, page, errors } = await setup(width, '?sample&public');
  try {
    await page.getByText('Drawn to the unusual.', { exact: true }).waitFor();
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    for (const theme of ['carbon', 'mist']) {
      if (theme === 'mist') await page.getByRole('button', { name: 'Use light appearance' }).click();
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: output + '/public-' + width + '-' + theme + '.png', fullPage: true });
      assert.ok(await page.locator('.reception-page').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
      assert.equal(await page.locator('.reception-cell-actions, .reception-selection').count(), 0);
      assert.equal(await page.getByRole('slider').count(), 0);
      assert.equal(await page.locator('[contenteditable="true"]').count(), 0);
      if (width <= 640) {
        await page.locator('[data-region-id]').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: output + '/public-' + width + '-' + theme + '-bottom.png' });
        await page.locator('.reception-navigation').scrollIntoViewIfNeeded();
      }
    }
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
async function addCell(page, direction) {
  await page.getByRole('button', { name: 'Add cell', exact: true }).click();
  await page.getByRole('button', { name: direction, exact: true }).click();
}
async function openSettings(page, tab) {
  if (!await page.getByRole('button', { name: 'Close Settings', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: tab, exact: true }).click();
}
async function closePanel(page, title) {
  await page.getByRole('button', { name: 'Close ' + title, exact: true }).click();
}

test('editor frame is bounded, tools are local, and preview matches public geometry', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(1280, '?sample');
  try {
    await page.setViewportSize({ width: 1280, height: 720 });
    const frame = await page.locator('.reception-editor-window').boundingBox();
    assert.ok(frame.x > 12 && frame.width < 1280 && frame.height < 1000);
    assert.ok(await page.locator('.reception-editor').evaluate(n => n.scrollHeight <= n.clientHeight + 1));
    assert.equal(await page.locator('.reception-tool-panel').count(), 0);
    await openSettings(page, 'Grid');
    assert.equal(await page.getByRole('spinbutton', { name: /width|height|pixels|position/i }).count(), 0, 'No canvas dimension fields');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = await page.locator('.reception-canvas').boundingBox();
    assert.equal(await page.locator('.reception-cell-actions, .reception-divider, .reception-tool-panel').count(), 0);
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.deepEqual(await page.locator('.reception-canvas').boundingBox(), preview);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Library fits the narrow editor and places into the selected cell', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(320);
  try {
    await page.getByRole('button', { name: 'Image from Library', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Choose Reception image', exact: true });
    const bounds = await picker.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
    const close = await page.getByRole('button', { name: 'Close Library', exact: true }).boundingBox();
    assert.ok(close.x >= bounds.x && close.x + close.width <= bounds.x + bounds.width);
    await picker.locator('.lattice-browser-asset').first().click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    assert.equal(await picker.isVisible(), true);
    await closePanel(page, 'Image framing');
    await page.getByRole('button', { name: 'Close Library', exact: true }).click();
    const saved = await layout(page);
    assert.equal(saved.regions[0].content, saved.imageModules[0].id);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('mobile starts readable with reachable tools and the reused Text controls omit container settings', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(390, '?sample');
  try {
    assert.equal(await page.locator('.reception-canvas[data-mobile]').count(), 1);
    const header = await page.locator('.reception-editor-header').boundingBox();
    assert.ok(header.height >= 44 && header.y >= 0 && header.y + header.height < 844);
    await page.locator('[data-region-id]').first().press('Enter');
    await page.getByRole('button', { name: 'Edit text', exact: true }).click();
    await page.getByRole('tab', { name: 'Article settings', exact: true }).click();
    assert.equal(await page.getByText('Text box layout', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Background & edges', { exact: true }).count(), 0);
    const close = await page.getByRole('button', { name: 'Close Text', exact: true }).boundingBox();
    assert.ok(close.width >= 44 && close.height >= 44 && close.y < 1000);
    assert.ok(await page.locator('.reception-editor-window').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + '/mobile-cell-tools.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`Reception zooms out with free margins through Done and reload at ${width}px`, { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(width, '?sample');
  try {
    const workbenches = await page.evaluate(() => window.receptionFixture.root.getDraft().workbenches);
    await page.getByRole('region', { name: 'Region 4 · image', exact: true }).click();
    await page.getByRole('button', { name: 'Crop image', exact: true }).click();
    const zoom = page.getByRole('slider', { name: 'Image zoom', exact: true });
    await zoom.press('Home');
    assert.equal((await layout(page)).imageModules[0].sides[0].crop.zoom, .1);
    const before = await stamp(page);
    await zoom.fill('0.25');
    assert.equal(await stamp(page), before, 'slider preview has not saved');
    await zoom.press('Tab');
    assert.equal(await stamp(page), before + 1);
    const saved = await layout(page);
    const checkImage = async () => {
      const image = page.locator('.reception-image svg.image-module__artwork image');
      await image.waitFor();
      const geometry = await image.evaluate(n => {
        const box = n.getBBox(), mask = n.ownerSVGElement.viewBox.baseVal;
        return { x: box.x, y: box.y, width: box.width, height: box.height, maskWidth: mask.width, maskHeight: mask.height };
      });
      const media = saved.imageModules[0].sides[0].asset.media;
      const scale = Math.max(geometry.maskWidth / media.width, geometry.maskHeight / media.height) * .25;
      assert.ok(Math.abs(geometry.width - media.width * scale) < .1);
      assert.ok(Math.abs(geometry.height - media.height * scale) < .1);
      assert.ok(geometry.x > 0 && geometry.y > 0, 'the full image has free margins on both axes');
      assert.ok(Math.abs(geometry.x * 2 + geometry.width - geometry.maskWidth) < .1);
      assert.ok(Math.abs(geometry.y * 2 + geometry.height - geometry.maskHeight) < .1);
    };
    await checkImage();
    await page.getByLabel('Image framing', { exact: true }).getByRole('button', { name: 'Finish crop', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.reception-page:not([data-reception-editor])').waitFor();
    await checkImage();
    await page.locator('.reception-image').scrollIntoViewIfNeeded();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/zoom-out-${width}.png` });
    await page.reload();
    await page.getByRole('main', { name: 'Reception editor' }).waitFor();
    assert.deepEqual(await layout(page), saved);
    await checkImage();
    assert.deepEqual(await page.evaluate(() => window.receptionFixture.root.getDraft().workbenches), workbenches);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Reception SVG zoom below fill keeps its native viewport and centered margins', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(1440, '?sample');
  try {
    await page.route('https://reception.test/framing.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="gold"/><circle cx="300" cy="200" r="160" fill="teal"/></svg>' }));
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(), side = draft.reception.imageModules[0].sides[0];
      side.asset.media = { ...side.asset.media, url: 'https://reception.test/framing.svg', width: 600, height: 400 };
      side.crop = { x: .5, y: .5, zoom: .25 };
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid SVG crop');
    });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const native = page.locator('.reception-image foreignObject');
    await native.waitFor();
    const geometry = await native.evaluate(n => {
      const mask = n.ownerSVGElement.viewBox.baseVal, matrix = n.transform.baseVal.consolidate().matrix;
      return { width: n.width.baseVal.value, height: n.height.baseVal.value, x: matrix.e, y: matrix.f,
        scaleX: matrix.a, scaleY: matrix.d, maskWidth: mask.width, maskHeight: mask.height };
    });
    assert.equal(geometry.width, 600); assert.equal(geometry.height, 400);
    assert.equal(geometry.scaleX, geometry.scaleY, 'no stretching');
    const scale = Math.max(geometry.maskWidth / 600, geometry.maskHeight / 400) * .25;
    assert.ok(Math.abs(geometry.scaleX - scale) < .001);
    assert.ok(geometry.x > 0 && geometry.y > 0);
    assert.ok(Math.abs(geometry.x * 2 + 600 * scale - geometry.maskWidth) < .1);
    assert.ok(Math.abs(geometry.y * 2 + 400 * scale - geometry.maskHeight) < .1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('crop dragging commits once, cancels on Escape, and survives reload', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(1440, '?sample');
  try {
    await page.getByRole('region', { name: 'Region 4 · image', exact: true }).click();
    await page.getByRole('button', { name: 'Crop image', exact: true }).click();
    await page.getByRole('slider', { name: 'Image zoom', exact: true }).press('End');
    const target = await page.getByRole('group', { name: 'Reframe image', exact: true }).boundingBox();
    const point = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    let before = await stamp(page);
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 40, point.y + 50);
    assert.equal(await stamp(page), before);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await stamp(page), before);
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 40, point.y + 50); await page.mouse.up();
    assert.equal(await stamp(page), before + 1);
    const saved = await layout(page); await page.reload();
    await page.getByRole('main', { name: 'Reception editor' }).waitFor();
    assert.deepEqual(await layout(page), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('raster and prepared SVG retain an artwork name while Retry remains an accessible button', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(1280, '?sample&public');
  try {
    const artwork = page.getByRole('img', { name: 'SKULL REAPER', exact: true });
    await artwork.locator('[data-media-state="ready"]').waitFor();
    assert.match(await artwork.ariaSnapshot(), /img "SKULL REAPER"/);
    assert.equal(await artwork.getAttribute('aria-description'), 'System Workflow parity review fixture');
    await page.goto(origin + '/browser-tests/reception-editor-fixture.html?sample');
    await page.getByRole('main', { name: 'Reception editor' }).waitFor();
    await page.route('https://reception.test/named.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><circle cx="300" cy="300" r="200" fill="gold"/></svg>' }));
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(), side = draft.reception.imageModules[0].sides[0];
      side.asset.media = { ...side.asset.media, url: 'https://reception.test/named.svg', width: 600, height: 600 };
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid SVG sample');
    });
    await artwork.locator('[data-svg-artwork-host]').waitFor();
    assert.match(await artwork.ariaSnapshot(), /img "SKULL REAPER"/);
    await page.route('https://reception.test/missing.webp', route => route.abort());
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft();
      draft.reception.imageModules[0].sides[0].asset.media.url = 'https://reception.test/missing.webp';
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid recovery sample');
    });
    const retry = page.getByRole('button', { name: 'Retry artwork', exact: true });
    await retry.waitFor();
    assert.equal(await artwork.getByRole('button').count(), 0, 'Recovery must stay outside the semantic image');
    await retry.focus();
    assert.ok(await retry.evaluate(el => el === document.activeElement));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('pointer cell reorder previews without saving, cancels, then commits once with settings and reload intact', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(1440, '?sample');
  try {
    await page.locator('[data-region-id]').first().press('Enter');
    const before = await layout(page), version = await stamp(page);
    await page.getByRole('button', { name: 'Move cell', exact: true }).click({ trial: true });
    const handle = await page.getByRole('button', { name: 'Move cell', exact: true }).boundingBox();
    const target = await page.locator('[data-region-id]').last().boundingBox();
    const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 8 });
    assert.equal(await stamp(page), version);
    assert.equal(await page.locator('[data-dragging]').count(), 1);
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await layout(page), before);
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
    assert.equal(await stamp(page), version + 1);
    const saved = await layout(page), moved = saved.regions.find(cell => cell.id === before.regions[0].id);
    assert.equal(moved.content, before.regions[0].content);
    assert.equal(moved.padding, before.regions[0].padding);
    assert.equal(moved.surface, before.regions[0].surface);
    assert.notEqual(moved.x, before.regions[0].x);
    await page.reload(); await page.locator('.reception-canvas').waitFor();
    assert.deepEqual(await layout(page), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('touch cell reorder keeps desktop geometry, cancels on pointer cancellation and saves the mobile order', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(390, '?sample');
  try {
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft();
      draft.reception.mobile = draft.reception.mobile.map(cell => ({ ...cell, columns: 1, height: 240 }));
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid touch fixture');
    });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-region-id]').last().press('Enter');
    const before = await layout(page), version = await stamp(page), session = await page.context().newCDPSession(page);
    assert.equal(await page.getByRole('button', { name: 'Move cell', exact: true }).evaluate(node => getComputedStyle(node).touchAction), 'none');
    await page.getByRole('button', { name: 'Move cell', exact: true }).click({ trial: true });
    const handle = await page.getByRole('button', { name: 'Move cell', exact: true }).boundingBox();
    const target = await page.locator('[data-region-id]').nth(1).boundingBox();
    const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const drag = async () => {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8 }] });
    };
    await drag();
    assert.equal(await stamp(page), version);
    assert.equal(await page.locator('[data-dragging]').count(), 1);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.deepEqual(await layout(page), before);
    await page.getByRole('button', { name: 'Move cell', exact: true }).click({ trial: true });
    await drag(); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(expected => window.receptionFixture.root.getGeneration() === expected, version + 1);
    const after = await layout(page);
    assert.equal(await stamp(page), version + 1);
    assert.equal(after.mobile[1].id, before.mobile[3].id);
    assert.deepEqual(after.regions, before.regions);
    await session.detach();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


for (const width of [1920, 390]) test(`new Text fills its inset width and wraps through edit, preview and reload at ${width}px`, { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(width);
  try {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
    await addCell(page, 'Beside');
    // An empty image-style cell can inherit edge-to-edge spacing, including a
    // grid default of zero. New writing starts with its own readable inset.
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft();
      draft.reception.padding = 0;
      draft.reception.regions[1].padding = 0;
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid Text inset fixture');
    });
    await page.locator('[data-selected]').getByRole('button', { name: 'New Text', exact: true }).click();
    const title = page.getByRole('textbox', { name: 'Article title', exact: true });
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    await body.waitFor(); await page.evaluate(() => document.fonts.ready);
    const geometry = () => page.locator('[data-text]').evaluate(cell => {
      const region = cell.getBoundingClientRect(), content = cell.querySelector('.reception-region-content').getBoundingClientRect();
      const heading = cell.querySelector('.text-document-title'), body = cell.querySelector('.text-editor-content, article.text-document > .text-document-body');
      const title = heading.getBoundingClientRect(), text = body.getBoundingClientRect();
      return { cellWidth: region.width, inset: content.left - region.left, contentWidth: content.width,
        titleWidth: title.width, bodyWidth: text.width, titleHeight: title.height, titleLine: parseFloat(getComputedStyle(heading).lineHeight),
        titleOverflow: heading.scrollWidth - heading.clientWidth, bodyOverflow: body.scrollWidth - body.clientWidth };
    });
    const assertWidth = async inset => {
      const box = await geometry();
      assert.ok(Math.abs(box.inset - inset) < 1);
      assert.ok(Math.abs(box.contentWidth - (box.cellWidth - inset * 2)) < 1);
      assert.ok(Math.abs(box.titleWidth - box.contentWidth) < 1);
      assert.ok(Math.abs(box.bodyWidth - box.contentWidth) < 1);
      assert.ok(box.titleOverflow <= 1); assert.ok(box.bodyOverflow <= 1);
      return box;
    };
    await assertWidth(24);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/new-text-empty-${width}.png` });
    await openSettings(page, 'Text');
    const spacing = page.getByRole('slider', { name: 'Content spacing', exact: true });
    const applyAll = page.getByRole('checkbox', { name: 'Apply to all', exact: true });
    assert.equal(await spacing.inputValue(), '24');
    assert.equal(await applyAll.isChecked(), false);
    await spacing.fill('0'); await spacing.press('Tab'); await assertWidth(0);
    await spacing.fill('24'); await spacing.press('Tab'); await assertWidth(24);
    await page.screenshot({ path: `${output}/new-text-spacing-${width}.png` });
    await closePanel(page, 'Settings');
    await openSettings(page, 'Grid');
    assert.equal(await page.getByRole('slider', { name: 'Default content spacing', exact: true }).count(), 0);
    await closePanel(page, 'Settings');
    const heading = 'A long title that stays inside its own column and wraps naturally as the composition becomes narrower';
    await title.fill(heading);
    await body.fill('A place to write with enough room for your words. ' + 'continuousartworkreference'.repeat(7));
    await openSettings(page, 'Text');
    await page.getByRole('slider', { name: 'Content spacing', exact: true }).fill('32');
    await page.getByRole('slider', { name: 'Content spacing', exact: true }).press('Tab');
    await closePanel(page, 'Settings');
    const authored = await assertWidth(32);
    if (width === 390) assert.ok(authored.titleHeight > authored.titleLine * 2, 'The narrow title wraps over multiple lines');
    await page.locator('.reception-window-main').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${output}/new-text-filled-${width}.png` });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = await assertWidth(32);
    assert.ok(Math.abs(preview.titleHeight - authored.titleHeight) < 1, 'Reader and editor keep the same title wrapping');
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    const saved = await layout(page);
    await page.reload(); await page.locator('[data-text]').waitFor();
    await assertWidth(32);
    assert.deepEqual(await layout(page), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('Content spacing scopes a preview and one undoable commit to selected or all Text, preserving images', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(1920, '?sample');
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const ids = await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(), reception = draft.reception;
      const extra = structuredClone(reception.texts[0]); extra.id = 'text:spacing-second'; extra.article.title = 'Second writing cell';
      reception.texts.push(extra); reception.regions[0].padding = 24;
      reception.regions[1].content = extra.id; reception.regions[1].padding = 48;
      const image = reception.regions.find(cell => cell.content?.startsWith('image:'));
      image.padding = 0;
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid mixed spacing fixture');
      return { first: reception.regions[0].id, second: reception.regions[1].id, image: image.id };
    });
    const cell = id => page.locator(`[data-region-id="${id}"]`);
    const before = await layout(page), imageBefore = before.imageModules, imageCellBefore = before.regions.find(item => item.id === ids.image);
    const padding = async () => (await layout(page)).regions.filter(item => [ids.first, ids.second].includes(item.id)).map(item => item.padding);
    const visual = async () => page.locator('[data-text]').evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).paddingLeft)));
    const unchangedImage = async () => {
      const value = await layout(page);
      assert.deepEqual(value.imageModules, imageBefore);
      assert.deepEqual(value.regions.find(item => item.id === ids.image), imageCellBefore);
      assert.equal(await cell(ids.image).evaluate(node => getComputedStyle(node).paddingLeft), '0px');
    };
    await cell(ids.first).press('Enter');
    await page.getByRole('textbox', { name: 'Article text', exact: true }).waitFor();
    await openSettings(page, 'Text');
    const slider = page.getByRole('slider', { name: 'Content spacing', exact: true });
    const all = page.getByRole('checkbox', { name: 'Apply to all', exact: true });
    assert.equal(await all.isChecked(), false);
    await slider.fill('40'); await slider.press('Tab');
    assert.deepEqual(await padding(), [40, 48]); await unchangedImage();
    let version = await stamp(page);
    await all.check();
    assert.equal(await stamp(page), version + 1);
    assert.deepEqual(await padding(), [40, 40]); await unchangedImage();
    version = await stamp(page);
    const box = await slider.boundingBox(), y = box.y + box.height / 2;
    const drag = async () => { await page.mouse.move(box.x + box.width * .32, y); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, y, { steps: 6 }); };
    await drag();
    assert.equal(await stamp(page), version);
    const preview = await visual(); assert.equal(preview[0], preview[1]); assert.ok(preview[0] > 40);
    assert.deepEqual(await padding(), [40, 40]); await unchangedImage();
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await stamp(page), version); assert.deepEqual(await visual(), [40, 40]);
    await drag(); await page.mouse.up();
    assert.equal(await stamp(page), version + 1);
    const committed = await padding(); assert.equal(committed[0], committed[1]); assert.ok(committed[0] > 40);
    await unchangedImage();
    await page.getByRole('button', { name: 'Undo Reception', exact: true }).click();
    assert.deepEqual(await padding(), [40, 40]);
    await page.getByRole('button', { name: 'Redo Reception', exact: true }).click();
    assert.deepEqual(await padding(), committed);
    await all.uncheck();
    await slider.fill('32'); await slider.press('Tab');
    assert.deepEqual(await padding(), [32, committed[1]]);
    await all.check(); assert.deepEqual(await padding(), [32, 32]);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/all-text-spacing-1920.png` });
    await closePanel(page, 'Settings');
    await openSettings(page, 'Text');
    assert.equal(await all.isChecked(), false, 'Reopening starts with selected Text only');
    await all.check(); await closePanel(page, 'Settings');
    await cell(ids.second).press('Enter');
    await openSettings(page, 'Text');
    assert.equal(await all.isChecked(), false, 'Selecting another Text does not carry the batch scope');
    await closePanel(page, 'Settings');
    await cell(ids.image).press('Enter');
    await openSettings(page, 'Text');
    assert.equal(await slider.isDisabled(), true); assert.equal(await all.isDisabled(), true);
    await closePanel(page, 'Settings');
    await page.getByRole('button', { name: 'Cell color', exact: true }).click();
    const color = page.getByRole('region', { name: 'Color', exact: true });
    assert.equal(await color.locator('.ds-studio-colour-wheel').count(), 1);
    assert.equal(await color.getByRole('slider', { name: 'Content spacing', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Crop image', exact: true }).isVisible(), true);
    await closePanel(page, 'Color');
    await unchangedImage();
    const saved = await layout(page);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.deepEqual(await visual(), [32, 32]); await unchangedImage();
    await page.reload(); await page.locator('[data-text]').first().waitFor();
    assert.deepEqual(await layout(page), saved); assert.deepEqual(await visual(), [32, 32]);
    await unchangedImage(); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
