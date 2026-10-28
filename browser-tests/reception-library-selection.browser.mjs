import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5173';
const output = '.browser-test-runtime/reception-library-selection';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const currentImage = page => page.evaluate(() => {
  const reception = receptionFixture.root.getSnapshot().reception;
  return reception.imageModules.find(image => image.id === reception.regions.find(region => region.id === 'region:right').content);
});

test('Reception Use selected image preserves the same expanded image as drag', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/assets/'))
        return route.fulfill({ response: await route.fetch({ url: origin + url.pathname.split('/public')[1] }) });
      return route.abort();
    });
    await page.goto(`${origin}/browser-tests/reception-editor-fixture.html?sample&image-choices&session=${crypto.randomUUID()}`);
    await page.locator('[data-region-id="region:right"]').press('Enter');
    await page.getByRole('button', { name: 'Replace image', exact: true }).click();
    const library = page.getByRole('region', { name: 'Choose Reception image', exact: true });
    await library.getByRole('button', { name: 'Show 2 images of ABYSSAL STUDY', exact: true }).click();
    const choice = library.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true });
    await choice.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[aria-label="Image 2 of ABYSSAL STUDY"]')?.getAttribute('aria-disabled') === 'false');
    const chosenUrl = await choice.locator('img').getAttribute('src');
    const from = await choice.boundingBox(), target = await page.locator('[data-region-id="region:right"]').boundingBox();
    const previous = (await currentImage(page)).id;
    await page.mouse.move(from.x + from.width / 2, from.y + 30); await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await settle(page); await page.mouse.move(target.x + target.width / 2 + 2, target.y + target.height / 2);
    await page.locator('.system-workflow__placement-preview').waitFor(); await page.mouse.up();
    await page.waitForFunction(previous => receptionFixture.root.getSnapshot().reception.imageModules.some(image => image.id !== previous && image.sides[0].asset.media.url.includes('skull_reaper')), previous);
    const dragged = await currentImage(page);
    assert.equal(dragged.sides[0].asset.media.url, chosenUrl, 'Drag baseline retains the selected variant');
    await page.getByRole('region', { name: 'Image framing', exact: true }).getByRole('button', { name: 'Finish crop', exact: true }).click();
    await choice.click();
    const cover = library.locator('.system-workflow__library-item > .lattice-browser-asset').first();
    assert.equal(await choice.getAttribute('aria-pressed'), 'true');
    assert.equal(await cover.getAttribute('aria-pressed'), 'false', 'Selection identifies the chosen image rather than every image of the same NFT');
    await library.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await page.waitForFunction(previous => !receptionFixture.root.getSnapshot().reception.imageModules.some(image => image.id === previous), dragged.id);
    const clicked = await currentImage(page);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/selected-variant.png` });
    assert.equal(clicked.sides[0].asset.media.url, chosenUrl, 'Click selection must preserve the exact image variant shown in the Library');
    assert.equal(clicked.sides[0].asset.stableAssetId, dragged.sides[0].asset.stableAssetId, 'Source NFT identity stays unchanged');
    await page.getByRole('region', { name: 'Image framing', exact: true }).getByRole('button', { name: 'Finish crop', exact: true }).click();
    await cover.click();
    assert.equal(await cover.getAttribute('aria-pressed'), 'true');
    assert.equal(await choice.getAttribute('aria-pressed'), 'false');
    await library.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await page.waitForFunction(previous => !receptionFixture.root.getSnapshot().reception.imageModules.some(image => image.id === previous), clicked.id);
    const reset = await currentImage(page);
    assert.match(reset.sides[0].asset.media.url, /abyssal_eye\/full\.webp$/, 'Explicitly selecting the cover clears the former image variant');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
