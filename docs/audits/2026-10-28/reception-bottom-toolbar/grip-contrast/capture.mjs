import { chromium } from 'playwright-core';
import { browserExecutable } from '../../../../../scripts/browserEnvironment.mjs';
import { mkdir } from 'node:fs/promises';
const origin = 'http://127.0.0.1:5197';
const output = 'docs/audits/2026-10-28/reception-bottom-toolbar/grip-contrast';
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const images = await page.evaluate(() => Object.fromEntries(Object.entries({ light: '#ffffff', dark: '#000000', mid: '#808080' }).map(([name, colour]) => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 600;
    const context = canvas.getContext('2d'); context.fillStyle = colour; context.fillRect(0, 0, 400, 600);
    return [name, canvas.toDataURL('image/png').split(',')[1]];
  })));
  await page.route('https://grip-contrast.test/**', route => {
    const name = new URL(route.request().url()).pathname.slice(1).replace('.png', '');
    return route.fulfill({ contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: Buffer.from(images[name], 'base64') });
  });
  await page.goto(origin + '/browser-tests/reception-editor-fixture.html?sample&session=grip-contrast-capture');
  for (const theme of ['carbon', 'mist']) {
    if (theme === 'mist') await page.getByRole('button', { name: 'Use light appearance', exact: true }).click();
    for (const backdrop of ['light', 'dark', 'mid']) {
      await page.evaluate(backdrop => {
        const { root } = window.receptionFixture, draft = root.getDraft();
        const side = draft.reception.imageModules[0].sides[0];
        side.asset.media = { ...side.asset.media, url: 'https://grip-contrast.test/' + backdrop + '.png', width: 400, height: 600 };
        side.crop = { x: .5, y: .5, zoom: 1 };
        if (!root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })) throw Error('Invalid contrast fixture');
      }, backdrop);
      const photo = page.locator('[data-image]');
      await photo.click({ position: { x: 80, y: 80 } });
      await photo.locator('svg[data-media-state="ready"]').waitFor();
      await photo.evaluate(node => node.blur());
      await page.mouse.move(100, 80);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const box = await photo.boundingBox();
      await page.screenshot({ path: `${output}/${theme}-${backdrop}.png`, clip: { x: box.x, y: box.y, width: 150, height: 110 } });
    }
  }
} finally { await browser.close(); }
