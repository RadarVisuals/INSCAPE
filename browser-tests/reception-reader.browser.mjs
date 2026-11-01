import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';

async function setup(width = 1440) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width, height: 1000 } }), errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
  await page.goto(origin + '/browser-tests/reception-editor-fixture.html?sample&public');
  await page.getByRole('region', { name: 'Reception layout', exact: true }).waitFor();
  return { browser, page, errors };
}

test('saved paired mobile cells remain below navigation and fit the viewport', async () => {
  const { browser, page, errors } = await setup(390);
  try {
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(), r = draft.reception;
      r.regions = r.regions.slice(0, 2).map((cell, index) => ({ ...cell, x: index * 5000, y: 0, width: 5000, height: 10000 }));
      r.mobile = r.regions.map(cell => ({ id: cell.id, columns: 1, height: 320 }));
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid paired sample');
    });
    await page.waitForFunction(() => document.querySelectorAll('.reception-region').length === 2);
    const nav = await page.locator('.reception-navigation').boundingBox(), cells = page.locator('.reception-region');
    for (const cell of await cells.all()) {
      const content = await cell.locator('.reception-region-content').boundingBox();
      assert.ok(content.y >= nav.y + nav.height);
    }
    const a = await cells.nth(0).boundingBox(), b = await cells.nth(1).boundingBox();
    assert.ok(Math.abs(a.y - b.y) < 1 && b.x > a.x, 'Half-row cells stay beside each other');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('saved zero/max rounded image cells clip transparent SVG beneath long navigation', async () => {
  const { browser, page, errors } = await setup(800);
  try {
    await page.route('https://reception.test/transparent.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><path fill="#327ba8" fill-opacity=".5" d="M0 0H600V600H0Z"/><circle cx="300" cy="300" r="180" fill="#d08040"/></svg>' }));
    for (const radius of [0, 160]) {
      await page.evaluate(radius => {
        const { root } = window.receptionFixture, draft = root.getDraft(), value = draft.reception, image = value.imageModules[0];
        image.sides[0].asset.media = { ...image.sides[0].asset.media, url: 'https://reception.test/transparent.svg', width: 600, height: 600 };
        value.regions = [{ ...value.regions[0], x: 0, y: 0, width: 10000, height: 10000, padding: 0, content: image.id, surface: '#45534b' }];
        value.mobile = [{ id: value.regions[0].id, height: 600, columns: 2 }];
        value.branding.name = 'Long authored studio name with many characters'; value.radius = radius;
        if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid rounded sample');
      }, radius);
      await page.waitForFunction(radius => document.querySelector('.reception-canvas')?.style.getPropertyValue('--reception-radius') === radius + 'px', radius);
      for (const theme of ['dark', 'light']) {
        await page.evaluate(async mode => (await import('/src/interfaceTheme.js')).interfaceTheme.setMode(mode), theme);
        const hit = await page.locator('.reception-canvas').evaluate(node => {
          const bounds = node.getBoundingClientRect(); return Boolean(document.elementFromPoint(bounds.left + 3, bounds.top + 3)?.closest('[data-region-id]'));
        });
        assert.equal(hit, radius === 0);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('saved SVG zoom below fill keeps its native viewport and centered margins', async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.route('https://reception.test/framing.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="gold"/><circle cx="300" cy="200" r="160" fill="teal"/></svg>' }));
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(), side = draft.reception.imageModules[0].sides[0];
      side.asset.media = { ...side.asset.media, url: 'https://reception.test/framing.svg', width: 600, height: 400 }; side.crop = { x: .5, y: .5, zoom: .25 };
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid SVG crop');
    });
    const native = page.locator('.reception-image foreignObject'); await native.waitFor();
    const geometry = await native.evaluate(node => {
      const mask = node.ownerSVGElement.viewBox.baseVal, matrix = node.transform.baseVal.consolidate().matrix;
      return { width: node.width.baseVal.value, height: node.height.baseVal.value, x: matrix.e, y: matrix.f,
        scaleX: matrix.a, scaleY: matrix.d, maskWidth: mask.width, maskHeight: mask.height };
    });
    assert.equal(geometry.width, 600); assert.equal(geometry.height, 400); assert.equal(geometry.scaleX, geometry.scaleY);
    const scale = Math.max(geometry.maskWidth / 600, geometry.maskHeight / 400) * .25;
    assert.ok(Math.abs(geometry.scaleX - scale) < .001 && geometry.x > 0 && geometry.y > 0);
    assert.ok(Math.abs(geometry.x * 2 + 600 * scale - geometry.maskWidth) < .1);
    assert.ok(Math.abs(geometry.y * 2 + 400 * scale - geometry.maskHeight) < .1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('saved raster and SVG expose artwork identity and keyboard-accessible recovery', async () => {
  const { browser, page, errors } = await setup(1280);
  try {
    const artwork = page.getByRole('img', { name: 'SKULL REAPER', exact: true });
    await artwork.locator('[data-media-state="ready"]').waitFor();
    assert.match(await artwork.ariaSnapshot(), /img "SKULL REAPER"/);
    assert.equal(await artwork.getAttribute('aria-description'), 'System Workflow parity review fixture');
    await page.route('https://reception.test/named.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><circle cx="300" cy="300" r="200" fill="gold"/></svg>' }));
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(), side = draft.reception.imageModules[0].sides[0];
      side.asset.media = { ...side.asset.media, url: 'https://reception.test/named.svg', width: 600, height: 600 };
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid named SVG');
    });
    await artwork.locator('[data-svg-artwork-host]').waitFor();
    assert.match(await artwork.ariaSnapshot(), /img "SKULL REAPER"/);
    await page.route('https://reception.test/missing.webp', route => route.abort());
    await page.evaluate(() => {
      const { root } = window.receptionFixture, draft = root.getDraft(); draft.reception.imageModules[0].sides[0].asset.media.url = 'https://reception.test/missing.webp';
      if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid recovery sample');
    });
    const retry = page.getByRole('button', { name: 'Retry artwork', exact: true }); await retry.waitFor();
    assert.equal(await artwork.getByRole('button').count(), 0); await retry.focus();
    assert.ok(await retry.evaluate(node => node === document.activeElement));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
