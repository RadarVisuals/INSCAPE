import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/static-reception';
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
    await page.getByRole('button', { name: 'Split side by side', exact: true }).click();
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
    await page.getByText('Layout & branding', { exact: true }).click();
    const radius = page.getByRole('spinbutton', { name: 'Radius (px)', exact: true });
    for (const r of [0, 160, 20]) {
      await radius.fill(String(r)); await radius.press('Enter');
      assert.equal((await layout(page)).radius, r);
      await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
      await page.screenshot({ path: output + '/editor-390-radius-' + r + '.png' });
    }
    const gutter = page.getByRole('spinbutton', { name: 'Gutter (px)', exact: true });
    await gutter.fill('0'); await gutter.press('Enter'); assert.equal((await layout(page)).gutter, 0);
    await page.getByRole('button', { name: 'Mobile layout', exact: true }).click();
    await page.getByRole('button', { name: 'Later', exact: true }).click();
    assert.equal((await layout(page)).mobile[1].id, (await layout(page)).regions[0].id);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.ok(await page.locator('.reception-page').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
    await page.screenshot({ path: output + '/editor-390-mobile-preview.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('paired mobile regions keep both content areas below the navigation cutout', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(390, '?sample');
  try {
    await page.getByRole('button', { name: 'Mobile layout', exact: true }).click();
    await page.getByLabel('Mobile width', { exact: true }).selectOption('1');
    const regions = page.locator('.reception-region');
    await regions.nth(1).click({ position: { x: 80, y: 120 } });
    await page.getByLabel('Mobile width', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
    const nav = await page.locator('.reception-navigation').boundingBox();
    for (const index of [0, 1]) {
      const content = await regions.nth(index).locator('.reception-region-content').boundingBox();
      assert.ok(content.y >= nav.y + nav.height, 'Content must remain below the real navigation footprint');
    }
    await page.screenshot({ path: output + '/mobile-paired-navigation.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('image silhouette follows long navigation, zero/max corners and transparent SVG without media bleed', { timeout: 60000 }, async () => {
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
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid contour fixture');
    });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByText('Layout & branding', { exact: true }).click();
    for (const r of [0, 160, 20]) {
      const control = page.getByRole('spinbutton', { name: 'Radius (px)', exact: true });
      await control.fill(String(r)); await control.press('Enter');
      for (const theme of ['carbon', 'mist']) {
        const toggle = page.getByRole('button', { name: theme === 'carbon' ? 'Use dark appearance' : 'Use light appearance' });
        if (await toggle.count()) await toggle.click();
        await page.locator('.reception-canvas').scrollIntoViewIfNeeded();
        await page.screenshot({ path: output + '/transparent-contour-' + r + '-' + theme + '.png' });
        const hit = await page.locator('.reception-canvas').evaluate(n => {
          const b = n.getBoundingClientRect(); return !!document.elementFromPoint(b.left + 3, b.top + 3)?.closest('[data-region-id]');
        });
        assert.equal(hit, false);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('keyboard move and merge commands preserve both records and require an explicit filled-cell choice', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.getByRole('button', { name: 'New Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('First retained article');
    await page.getByRole('button', { name: 'Split side by side', exact: true }).click();
    await page.getByRole('button', { name: 'New Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('Second retained article');
    const before = await layout(page);
    await page.getByText('Move / swap or merge', { exact: true }).click();
    const swap = page.getByRole('button', { name: 'Move / swap with region 1', exact: true });
    await swap.focus(); await swap.press('Enter');
    assert.equal((await layout(page)).regions[0].content, before.regions[1].content);
    const merge = page.getByRole('button', { name: 'Merge region 1', exact: true });
    await merge.click(); await page.getByRole('button', { name: 'Cancel merge', exact: true }).click();
    assert.equal((await layout(page)).regions.length, 2);
    await merge.click();
    await page.getByRole('group', { name: 'Choose merged content' }).getByRole('button', { name: /region 2$/ }).click();
    const merged = await layout(page);
    assert.equal(merged.regions.length, 1); assert.equal(merged.texts.length, 2);
    assert.equal(merged.regions[0].content, before.regions[0].content);
    await page.getByRole('button', { name: 'Undo Reception', exact: true }).click();
    assert.equal((await layout(page)).regions.length, 2);
    assert.equal((await layout(page)).texts.length, 2);
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
    await page.getByRole('button', { name: 'Split side by side', exact: true }).click();
    assert.equal((await layout(page)).regions.length, 2);
    await page.getByRole('button', { name: 'Image from Library', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Choose Reception image' });
    await picker.waitFor();
    await picker.locator('.lattice-browser-asset').first().click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await picker.waitFor({ state: 'hidden' });
    assert.equal((await layout(page)).imageModules.length, 1);
    await page.getByRole('region', { name: 'Region 1 · Empty', exact: true }).click({ position: { x: 90, y: 180 } });
    await page.getByRole('button', { name: 'New Text', exact: true }).click();
    const body = page.getByRole('textbox', { name: 'Article text', exact: true });
    await body.waitFor(); await body.fill('A living introduction.');
    await page.waitForFunction(() => JSON.stringify(window.receptionFixture.root.getDraft().reception.texts).includes('A living introduction.'));
    await page.evaluate(() => window.receptionFixture.fail(true));
    await body.press('End'); await body.pressSequentially(' Saved after retry.');
    await page.getByRole('button', { name: 'Retry saving Text', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.getByRole('main', { name: 'Reception editor' }).count(), 1);
    await page.evaluate(() => window.receptionFixture.fail(false));
    await page.getByRole('button', { name: 'Retry saving Text', exact: true }).click();
    await page.waitForFunction(() => JSON.stringify(window.receptionFixture.root.getDraft().reception.texts).includes('Saved after retry.'));
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.equal(await body.count(), 0);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
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
    await page.getByRole('button', { name: 'Later', exact: true }).click();
    assert.notEqual((await layout(page)).mobile[0].id, resized.mobile[0].id);
    await page.getByRole('button', { name: 'Mobile layout', exact: true }).click();
    await page.getByRole('button', { name: 'Remove content', exact: true }).click();
    assert.equal((await layout(page)).texts.length, 1);
    await page.getByLabel('Reuse retained content', { exact: true }).selectOption((await layout(page)).texts[0].id);
    await page.getByLabel('Include Text in publication', { exact: true }).uncheck();
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
      assert.notEqual(await page.locator('.reception-paint').evaluate(n => getComputedStyle(n).clipPath), 'none');
      assert.equal(await page.getByRole('slider').count(), 0);
      assert.equal(await page.locator('[contenteditable="true"]').count(), 0);
      if (width <= 640) {
        await page.getByRole('button', { name: 'Explore', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: output + '/public-' + width + '-' + theme + '-bottom.png' });
        await page.locator('.reception-navigation').scrollIntoViewIfNeeded();
      }
    }
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
