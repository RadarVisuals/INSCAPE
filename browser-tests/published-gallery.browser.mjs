import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { measureGalleryScroll } from './measureGalleryScroll.mjs';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/published-gallery';
const address = '0x' + '1'.repeat(40);
test('open Profile shares its published Works selection, camera and layout and preserves the Bento', { timeout: 75000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=published&collection=1`);
    const button = name => page.getByRole('button', { name, exact: true });
    await page.getByRole('heading', { name: 'Nomad', exact: true }).waitFor();
    await page.getByText('Human underneath', { exact: true }).waitFor();
    const profile = page.locator('main.visitor-spread');
    assert.equal(await profile.getAttribute('data-layout'), 'card');
    const checkPortrait = async () => {
      const portrait = page.locator('.visitor-portrait');
      const size = await portrait.locator('img').boundingBox();
      assert.ok(size && size.width > 0 && Math.abs(size.width - size.height) < 1, 'The portrait is square');
      assert.ok(await portrait.evaluate(node => [node, node.querySelector('img')].every(el =>
        getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).opacity === '1')));
    };
    await checkPortrait();
    const rim = await profile.evaluate(root => {
      const body = root.querySelector('.visitor-profile-body'), card = body.getBoundingClientRect();
      const image = body.querySelector('.visitor-portrait img').getBoundingClientRect();
      const inside = parseFloat(getComputedStyle(body, '::before').left) + 1;
      return [image.left-card.left, image.top-card.top, card.bottom-image.bottom]
        .every(inset => Math.abs(inset-inside) < 1);
    });
    assert.ok(rim, 'The portrait meets the inner stroke on all three exterior edges');
    await button('Profile index').click();
    await button('Open Spread').click();
    assert.equal(await profile.getAttribute('data-layout'), 'open');
    await checkPortrait();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const background = { clip: { x: 20, y: 125, width: 140, height: 70 } };
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const still = await page.screenshot(background);
    await page.waitForTimeout(250);
    assert.deepEqual(await page.screenshot(background), still, 'Reduced motion holds the grain and lighting still');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await button('Nomad profile actions').click();
    await page.getByText('Underneath', { exact: true }).waitFor();
    await button('View published Bento').click();
    await page.getByRole('region', { name: 'Reception layout' }).waitFor();
    await button('Back to profile').click();
    const theme = page.getByRole('switch', { name: 'Dark mode' });
    const previous = await theme.getAttribute('aria-checked');
    await theme.click();
    assert.notEqual(await theme.getAttribute('aria-checked'), previous);
    await button('Works').click();
    await button('Open Anatomy').click();
    const artwork = page.getByRole('group', { name: 'Anatomy canvas' });
    await artwork.waitFor();
    const details = page.getByRole('complementary', { name: 'Work details' });
    await details.getByRole('heading', { name: 'Anatomy', exact: true }).waitFor();
    const [indexBox, canvasBox, detailsBox] = await Promise.all([
      page.getByRole('navigation', { name: 'Canvases', exact: true }).boundingBox(), artwork.boundingBox(), details.boundingBox(),
    ]);
    assert.ok(indexBox.x + indexBox.width <= canvasBox.x && canvasBox.x + canvasBox.width <= detailsBox.x,
      'The public list keeps its index, artwork and matching details in three columns');
    const controls = page.locator('.composition-explorer-controls');
    const picker = await controls.getByRole('navigation', { name: 'Camera points' }).boundingBox();
    assert.ok(picker.y >= canvasBox.y + canvasBox.height && Math.abs(picker.x + picker.width / 2 - canvasBox.x - canvasBox.width / 2) <= 1);
    assert.ok(await controls.locator('button, summary').evaluateAll(items => items.every(item => !item.innerText.trim() && item.getAttribute('aria-label'))),
      'Every footer action is an icon with an accessible name');
    await button('Zoom in').click();
    const zoom = await page.getByLabel('Canvas zoom').textContent();
    await button('Profile').click();
    await page.getByRole('heading', { name: 'Nomad' }).waitFor();
    assert.equal(await profile.getAttribute('data-layout'), 'open');
    await button('Profile index').click();
    await button('Profile Card').click();
    assert.equal(await profile.getAttribute('data-layout'), 'card');
    await button('Works').click();
    await page.getByRole('group', { name: 'Anatomy canvas' }).waitFor();
    assert.equal(await page.getByLabel('Canvas zoom').textContent(), zoom);
    await button('Grid').click();
    await page.locator('.workbench-overview-gallery').waitFor();
    await button('Profile').click();
    await button('Works').click();
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.equal(await button('Open Private experiment').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
async function enterGallery(page, width) {
  if (width >= 900) {
    await page.locator('.composition-explorer-viewport').waitFor();
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
  }
  await page.locator('.workbench-overview-gallery').waitFor();
}
test('published wrap keeps every visible SVG preview painted through wheel and touch transitions', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: touch, deviceScaleFactor: 2 });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=1&collection=1&canvas=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('.workbench-overview-gallery').waitFor();
      await page.waitForTimeout(700);
      const frames = await measureGalleryScroll(page, { touch });
      await mkdir(output, { recursive: true });
      await writeFile(`${output}/wrap-${touch ? 'touch' : 'wheel'}-frames.json`, JSON.stringify(frames));
      assert.deepEqual(frames.filter(frame => frame.missing.length), [], 'No blank artwork at any sampled animation frame');
      for (const direction of [1, -1]) assert.ok(frames.some((frame, i) => i && frame.direction === direction &&
        (frame.scroll - frames[i - 1].scroll) * direction < -200), `Input crosses a wrap in direction ${direction}`);
      await page.screenshot({ path: `${output}/wrap-${touch ? 'touch' : 'wheel'}-390.png` });
      await page.close();
    }
  } finally { await browser.close(); }
});
for (const width of [390, 1440]) test(`published gallery, wrap, modal, metadata and return at ${width}`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 390 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=1&collection=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('button', { name: 'Enter Inscape', exact: true }).click();
    await page.locator('.workbench-overview-gallery').waitFor();
    const before = await page.evaluate(() => ({ publication: JSON.stringify(window.__overviewPublication), local: JSON.stringify(window.__galleryStore.getBackupSnapshot()), storage: JSON.stringify({ ...localStorage }) }));
    assert.equal(await page.getByRole('button', { name: 'Open Private experiment', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^(Edit|Crop|New Workbench)/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Open Vision', exact: true }).count(), 1, 'Only one accessible collection');
    assert.ok(await page.locator('[data-gallery-cycle]').count() > 1);
    await page.locator('.workbench-overview-gallery').evaluate(node => { node.scrollTop += 1200; });
    const tile = page.getByRole('button', { name: 'Open Anatomy', exact: true });
    await tile.scrollIntoViewIfNeeded();
    if (width === 390) { await tile.tap(); await page.getByRole('article').filter({ has: tile }).getByRole('button', { name: 'View', exact: true }).tap(); }
    else await tile.click();
    const modal = page.getByRole('dialog', { name: 'View Anatomy', exact: true });
    await modal.waitFor(); await page.waitForTimeout(700);
    await modal.press('Tab');
    assert.equal(await modal.getByRole('button', { name: 'Edit canvas', exact: true }).count(), 0);
    await modal.getByRole('button', { name: 'Canvas details', exact: true }).click();
    await modal.getByRole('heading', { name: 'Anatomy', exact: true }).waitFor();
    await page.waitForTimeout(750);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/canvas-${width}.png` });
    await modal.getByRole('button', { name: 'Close canvas', exact: true }).click();
    await modal.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Inscape menu', exact: true }).click();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.locator('.workbench-overview-list').waitFor();
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.locator('.workbench-overview-gallery').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.workbench-overview-card .navigator-object image').length > 0);
    await page.waitForTimeout(750);
    await page.screenshot({ path: `${output}/gallery-${width}.png` });
    assert.ok(await page.locator('.workbench-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.getByRole('button', { name: 'About', exact: true }).click();
    await page.getByRole('button', { name: 'Enter Inscape', exact: true }).waitFor();
    await page.goBack(); await page.locator('.workbench-overview-gallery').waitFor();
    assert.deepEqual(await page.evaluate(() => ({ publication: JSON.stringify(window.__overviewPublication), local: JSON.stringify(window.__galleryStore.getBackupSnapshot()), storage: JSON.stringify({ ...localStorage }) })), before);
    assert.deepEqual(errors, []);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.ok(await page.locator('.workbench-overview').evaluate(node => getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)'));
  } finally { await browser.close(); }
});
test('publication review defaults to the current canvas and names every explicitly selected addition', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?publish=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const first = page.getByRole('checkbox', { name: /Vision/ });
    await first.waitFor(); assert.equal(await first.isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: /Anatomy/ }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: /Private experiment/ }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: /Profile details/ }).isChecked(), true);
    await page.getByRole('checkbox', { name: /Anatomy/ }).check();
    await page.getByRole('button', { name: 'Prepare publication', exact: true }).click();
    await page.getByRole('button', { name: 'Make presentation public', exact: true }).waitFor();
    await page.getByRole('checkbox', { name: /Anatomy/ }).uncheck();
    await page.getByRole('button', { name: 'Prepare publication', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Select all changed canvases', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /Private experiment/ }).isChecked(), true);
  } finally { await browser.close(); }
});
