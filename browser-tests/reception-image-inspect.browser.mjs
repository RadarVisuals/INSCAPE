import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = '.browser-test-runtime/reception-image-inspect';

test('introductory images stay passive, preserving authored crop, transforms and draft', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    for (const [kind, rotated, width] of [['transparent', false, 1280], ['opaque', true, 900], ['raster', false, 1280], ['webp', false, 1280], ['embedded', false, 1280]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const raster = ['raster', 'webp'].includes(kind);
      const png = await page.evaluate(kind => {
        const canvas = document.createElement('canvas'); canvas.width = 3000; canvas.height = 2000;
        const ctx = canvas.getContext('2d'); ctx.scale(3000 / 900, 2000 / 600); ctx.fillStyle = '#001828'; ctx.fillRect(0, 0, 900, 600);
        ctx.fillStyle = '#ce7742'; ctx.fillRect(500, 100, 150, 500); return canvas.toDataURL(kind === 'webp' ? 'image/webp' : 'image/png');
      }, kind);
      let rasterBytes = Buffer.from(png.split(',')[1], 'base64');
      if (kind === 'webp') {
        // The browser encoder adds an ICC profile, which deliberately bypasses
        // preview resampling. Use a plain synthetic still WebP for this case.
        const chunks = [rasterBytes.subarray(0, 12)];
        for (let offset = 12; offset < rasterBytes.length;) {
          const end = offset + 8 + rasterBytes.readUInt32LE(offset + 4);
          const chunk = Buffer.from(rasterBytes.subarray(offset, end + (end % 2)));
          const type = chunk.toString('ascii', 0, 4);
          if (type === 'VP8X') chunk[8] &= ~0x20;
          if (type !== 'ICCP') chunks.push(chunk);
          offset = end + (end % 2);
        }
        rasterBytes = Buffer.concat(chunks); rasterBytes.writeUInt32LE(rasterBytes.length - 8, 4);
      }
      await page.context().route('https://reception.test/single.*', route => raster
        ? route.fulfill({ contentType: kind === 'webp' ? 'image/webp' : 'image/png', body: rasterBytes })
        : route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">${kind === 'embedded' ? '<image width="900" height="600" href="' + png + '"/>' : ''}${kind === 'opaque' ? '<rect width="900" height="600" fill="#001828"/>' : ''}<rect x="500" y="100" width="150" height="500" fill="#ce7742"/></svg>` }));
      await page.goto(`${origin}/browser-tests/reception-inspect-fixture.html?single=${kind}&preview=1${rotated ? '&rotated=1' : ''}${kind === 'raster' ? '&cover=1' : ''}`);
      const layer = page.locator('[data-layer-id="image:nomad"]');
      await layer.waitFor();
      if (raster) await layer.locator('[data-media-state="ready"]').waitFor();
      else {
        await layer.locator('iframe').waitFor();
        await layer.locator('.artwork-svg-status').waitFor({ state: 'detached' });
      }
      if (kind === 'webp') await page.waitForFunction(() => document.querySelector('[data-layer-id="image:nomad"] svg > image')?.href.baseVal.startsWith('blob:'));
      if (kind === 'raster') {
        for (const viewport of [1280, 900, 390, 320, 1280]) {
          await page.setViewportSize({ width: viewport, height: 900 });
          await page.waitForFunction(() => {
            const imageNode = document.querySelector('[data-layer-id="image:nomad"] svg > image');
            if (Math.abs(imageNode.ownerSVGElement.viewBox.baseVal.width - imageNode.closest('.reception-image').clientWidth) > 1) return false;
            const cell = document.querySelector('[data-cell-id="shape:mixed"]').getBoundingClientRect();
            const image = document.querySelector('[data-layer-id="image:nomad"] svg > image').getBoundingClientRect();
            return image.left <= cell.left + 1 && image.top <= cell.top + 1 && image.right >= cell.right - 1 && image.bottom >= cell.bottom - 1;
          });
        }
      }
      // Resizing updates the host before ResizeObserver projects the canvas.
      // Compare clicks against the settled target width, not a previous viewport.
      await page.waitForFunction(() => {
        const host = document.querySelector('.reception-document-viewport'), canvas = host.querySelector('.reception-document-canvas');
        return Math.abs(canvas.getBoundingClientRect().width - Math.min(window.inspectionFixture.value.workbench.area.width, host.clientWidth)) < 1;
      });
      const draft = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value));
      const before = await layer.boundingBox();
      const beforeProjection = await layer.locator(raster ? 'svg > image' : '.artwork-svg-html-media').getAttribute(raster ? 'transform' : 'style');
      assert.equal(await page.getByRole('button', { name: /^Inspect / }).count(), 0);
      await layer.click();
      assert.equal(await page.getByRole('dialog').count(), 0, 'artwork clicks do not open an enlargement');
      await page.screenshot({ path: `${output}/${kind}-${width}.png` });
      assert.deepEqual(await layer.boundingBox(), before);
      assert.equal(await layer.locator(raster ? 'svg > image' : '.artwork-svg-html-media').getAttribute(raster ? 'transform' : 'style'), beforeProjection,
        'closing restores the authored crop and transform');
      assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), draft);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

for (const width of [1280, 900]) test(`stacked text clips complete columns, opens a readable article and preserves its authored direction at ${width}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.goto(`${origin}/browser-tests/reception-inspect-fixture.html?stacked=1`);
    const layer = page.locator('[data-layer-id="text:long"]'), more = page.getByRole('button', { name: 'Read full text', exact: true });
    await more.waitFor();
    await page.waitForFunction(() => {
      const node = document.querySelector('[data-layer-id="text:long"]'), box = node.querySelector('.reception-text-preview'), article = node.querySelector('article');
      return article.getBoundingClientRect().height <= box.clientHeight + 1;
    });
    const before = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value));
    const metrics = await layer.evaluate(node => {
      const excerpt = node.querySelector('.reception-text-excerpt'), article = node.querySelector('article'), box = node.querySelector('.reception-text-preview');
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT), rects = [];
      while (walker.nextNode()) { const range = document.createRange(); range.selectNodeContents(walker.currentNode); rects.push(...range.getClientRects()); }
      const right = excerpt.getBoundingClientRect().right;
      return { direction: getComputedStyle(article).writingMode, widthOverflow: article.getBoundingClientRect().width > box.clientWidth,
        // Font range boxes can overlap adjacent columns; the cut must match a complete column end.
        complete: rects.some(r => Math.abs(r.right - right) <= 1),
        cut: excerpt.getBoundingClientRect().width <= box.clientWidth, height: box.clientHeight,
        fade: getComputedStyle(excerpt).maskImage };
    });
    assert.equal(metrics.direction, 'vertical-lr'); assert.equal(metrics.widthOverflow, true);
    assert.equal(metrics.complete, true); assert.equal(metrics.cut, true); assert.match(metrics.fade, /to right/);
    await more.click(); await page.getByRole('dialog', { name: 'Full text' }).waitFor();
    assert.equal(await page.locator('.reception-text-reader article').evaluate(node => getComputedStyle(node).writingMode), 'horizontal-tb');
    assert.equal(await layer.locator('article').evaluate(node => getComputedStyle(node).writingMode), 'vertical-lr');
    assert.equal(await layer.locator('article').textContent(), 'I feel out of place here. I cannot remember being anywhere else. '.repeat(100));
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/stacked-reading-${width}.png` });
    await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Full text' }).waitFor({ state: 'detached' });
    await more.waitFor(); assert.equal(await more.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), before);
    const shortened = await page.evaluate(() => { const next = structuredClone(window.inspectionFixture.value); next.texts[0].article.content.content[0].content[0].text = 'Short'; window.inspectionFixture.replace(next); return JSON.stringify(next); });
    await more.waitFor({ state: 'detached' });
    assert.equal(await layer.locator('article').evaluate(node => getComputedStyle(node).writingMode), 'vertical-lr');
    assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), shortened);
  } finally { await browser.close(); }
});

test('document replacement dismisses the reader without changing preview styles or blocking the next reading', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.goto(`${origin}/browser-tests/reception-inspect-fixture.html`);
    const layer = page.locator('[data-layer-id="text:long"]');
    const trigger = page.getByRole('button', { name: 'Read full text', exact: true });
    await trigger.waitFor();
    const original = await layer.getAttribute('style'), value = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value));
    await trigger.click();
    await page.getByRole('dialog', { name: 'Full text' }).waitFor();
    await page.evaluate(() => window.inspectionFixture.replace(structuredClone(window.inspectionFixture.value)));
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await layer.getAttribute('style'), original);
    await trigger.click();
    await page.setViewportSize({ width: 900, height: 800 });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), value);
  } finally { await browser.close(); }
});

for (const density of [1, 1.25, 2]) test(`height-only resizing keeps Reception edges on physical pixels at DPR ${density}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: density });
    await page.route('https://raw.githubusercontent.com/**', route => route.abort());
    await page.goto(`${origin}/browser-tests/reception-inspect-fixture.html?preview=1`);
    await page.locator('[data-cell-id="shape:mixed"]').waitFor();
    const value = await page.evaluate(() => JSON.stringify(window.inspectionFixture.value));
    for (const height of [901, 903, 700, 900]) {
      await page.setViewportSize({ width: 1280, height });
      await page.waitForFunction(dpr => {
        const r = document.querySelector('[data-cell-id="shape:mixed"]').getBoundingClientRect();
        return Math.abs(r.top * dpr - Math.round(r.top * dpr)) <= dpr / 64 + .001;
      }, density);
      const geometry = await page.locator('[data-cell-id="shape:mixed"]').evaluate(node => {
        const a = node.getBoundingClientRect(), b = document.querySelector('[data-cell-id="shape:short"]').getBoundingClientRect();
        return { bottom: a.bottom, top: b.top };
      });
      assert.ok(Math.abs(geometry.bottom - geometry.top) <= 1 / 64, 'adjacent zero-gap cells keep their shared edge');
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.inspectionFixture.value)), value);
  } finally { await browser.close(); }
});
