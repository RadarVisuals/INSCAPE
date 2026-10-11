import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let maskFails = false;
  await page.route('https://mobile-assets.example/__canvas-*', route => {
    const mask = route.request().url().includes('mask');
    if (mask && maskFails) return route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Unavailable' });
    return route.fulfill({ contentType: 'image/svg+xml', headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">${mask
        ? '<rect x="270" y="480" width="540" height="960" fill="white"/>'
        : '<rect width="1080" height="1920" fill="#00ff00"/>'}</svg>` });
  });
  await page.route(`${origin}/__canvas__`, route => route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' }));
  await page.goto(`${origin}/__canvas__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    await import('/src/index.css');
    const Presentation = (await import('/src/mobile/MobilePresentation.jsx')).default;
    const { createMobilePresentation } = await import('/src/mobile/domain/mobilePresentation.js');
    const content = createMobilePresentation();
    content.front.color = '#0000ff';
    content.front.artwork = { name: 'Canvas test', media: { url: 'https://mobile-assets.example/__canvas-art.svg' } };
    content.front.mask = { media: { url: 'https://mobile-assets.example/__canvas-mask.svg' } };
    content.front.border = { width: 9, color: '#ff0000' };
    const root = createRoot(document.getElementById('root'));
    window.review = { content, root, render: () => root.render(React.createElement('div', { style: { height: '100dvh' } },
      React.createElement(Presentation, { content: structuredClone(content), identity: { name: 'A longer profile name' } }))) };
    review.render();
  });
  for (const [width, height] of [[360, 640], [360, 720], [390, 844], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await page.locator('.mobile-front-art').waitFor();
    await page.waitForFunction(() => document.querySelector('.mobile-front-art')?.complete);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.mobile-design-canvas').getBoundingClientRect();
      const name = document.querySelector('.mobile-front-name').getBoundingClientRect();
      return name.x >= canvas.x && name.right <= canvas.right;
    });
    const canvas = await page.locator('.mobile-design-canvas').boundingBox();
    assert.ok(Math.abs(canvas.width / canvas.height - 9 / 16) < .001);
    assert.ok(Math.abs(canvas.y + canvas.height - height) < .1, 'Composition ends at the viewport bottom, without a background strip');
    assert.ok(canvas.x >= -.1 && canvas.y >= -.1 && canvas.x + canvas.width <= width + .1 && canvas.y + canvas.height <= height + .1);
    const name = await page.locator('.mobile-front-name').boundingBox();
    assert.ok(name.x >= canvas.x && name.x + name.width <= canvas.x + canvas.width, JSON.stringify({ canvas, name, style: await page.locator('.mobile-front-name').getAttribute('style') }));
    const screenshot = await page.screenshot({ path: `.browser-test-runtime/mobile-canvas-${width}.png` });
    const pixels = await page.evaluate(async ({ data, box }) => {
      const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      return [.1, .247, .5].map(x => [...ctx.getImageData(Math.round(box.x + box.width * x), Math.round(box.y + box.height * .5), 1, 1).data]);
    }, { data: screenshot.toString('base64'), box: canvas });
    assert.deepEqual(pixels[0], [0, 0, 255, 255], 'Outside the mask shows the full-screen background');
    assert.deepEqual(pixels[1], [255, 0, 0, 255], 'Border follows the mask edge');
    assert.deepEqual(pixels[2], [0, 255, 0, 255], 'Artwork remains aligned inside the mask');
  }
  await page.evaluate(async () => {
    const { upgradeMobilePresentation } = await import('/src/mobile/domain/mobilePresentation.js');
    Object.assign(review.content, upgradeMobilePresentation(review.content));
    review.content.front.transforms.mask.quarterTurns = 1; review.render();
  });
  await page.waitForFunction(() => document.querySelector('.mobile-art-mask')?.style.maskImage.includes('data:image/png'));
  const rotatedBox = await page.locator('.mobile-design-canvas').boundingBox();
  const rotatedScreenshot = await page.screenshot({ path: '.browser-test-runtime/mobile-mask-rotated.png' });
  const rotatedPixel = await page.evaluate(async ({ data, box }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(Math.round(box.x + box.width * .1), Math.round(box.y + box.height * .5), 1, 1).data];
  }, { data: rotatedScreenshot.toString('base64'), box: rotatedBox });
  assert.deepEqual(rotatedPixel, [0, 255, 0, 255], 'Rotating the mask exposes the correct new region without moving the artwork');
  maskFails = true;
  await page.evaluate(() => { review.content.front.mask.media.url += '?retry-test'; review.render(); });
  await page.getByText('Mask unavailable.').waitFor();
  assert.equal(await page.locator('.mobile-front-art').count(), 0, 'A failed mask never exposes unmasked artwork');
  maskFails = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.locator('.mobile-front-art').waitFor();
  const frontColour = await page.locator('.mobile-front-name').evaluate(node => getComputedStyle(node).color);
  await page.getByRole('button', { name: 'Toggle colour theme' }).click();
  assert.equal(await page.locator('.mobile-front-name').evaluate(node => getComputedStyle(node).color), frontColour, 'Light UI does not make text disappear on an authored dark front');
  await page.getByRole('button', { name: 'Turn card to profile' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement === document.querySelector('.mobile-back h2'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Turn card to profile');
  assert.deepEqual(errors, []);
  console.log('PASS fixed canvas, alpha mask and border pixels across phone/desktop sizes, failed-mask recovery and keyboard flip focus');
} finally { await browser.close(); }
