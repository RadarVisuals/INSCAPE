import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(`${origin}/__presentation__`, route => route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' }));
  await page.goto(`${origin}/__presentation__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    await import('/src/index.css');
    const Presentation = (await import('/src/mobile/MobilePresentation.jsx')).default;
    const { createMobilePresentation } = await import('/src/mobile/domain/mobilePresentation.js');
    const content = createMobilePresentation(); content.front.renderer = 'steyra';
    const root = createRoot(document.getElementById('root'));
    window.review = { content, root, React, Presentation, render: () => root.render(React.createElement('div', { style: { height: '100dvh' } }, React.createElement(Presentation, {
      content, identity: { name: 'VXCTXR' } }))) }; review.render();
  });
  await page.locator('[data-steyra-status="ready"]').waitFor();
  assert.equal(await page.locator('[data-steyra-eye]').count(), 6);
  for (const control of [page.locator('.mobile-front .mobile-wordmark'), page.getByRole('button', { name: 'Share profile' }), page.getByRole('button', { name: 'Toggle colour theme' })]) {
    await control.hover(); await page.waitForTimeout(900);
    const box = await control.boundingBox();
    const actual = await page.locator('.mobile-steyra').evaluate(e => ({ x: Number(e.style.getPropertyValue('--tilt-x')), y: Number(e.style.getPropertyValue('--tilt-y')) }));
    assert.ok(Math.abs(actual.x - ((box.x + box.width / 2) / 390 * 2 - 1)) < .01, 'horizontal tilt continues over controls');
    assert.ok(Math.abs(actual.y - ((box.y + box.height / 2) / 844 * 2 - 1)) < .01, 'vertical tilt continues over controls');
  }
  const clock = () => page.locator('.steyra-artwork').evaluate(e => e.getAnimations()[0].currentTime);
  const before = await clock();
  await page.getByRole('button', { name: 'Turn card to profile' }).click();
  await page.waitForTimeout(150); assert.ok(await clock() > before);
  await page.waitForTimeout(650);
  // Cursor movement on the reverse must reach the same tilt owner. Returning
  // through a rotating face must not reinterpret coordinates in its thin bounds.
  const tiltX = () => page.locator('.mobile-steyra').evaluate(e => Number(e.style.getPropertyValue('--tilt-x')));
  await page.mouse.move(60, 420); await page.waitForTimeout(900);
  assert.ok(Math.abs(await tiltX() - (60 / 390 * 2 - 1)) < .01, 'reverse tracks the current cursor');
  await page.mouse.click(60, 420);
  await page.waitForTimeout(250);
  await page.mouse.move(330, 420);
  await page.waitForTimeout(1000);
  assert.ok(Math.abs(await tiltX() - (330 / 390 * 2 - 1)) < .01, 'flip uses stationary bounds');
  const settled = await tiltX();
  await page.mouse.move(331, 420); await page.waitForTimeout(150);
  assert.ok(Math.abs(await tiltX() - settled) < .01, 'first movement after returning has no catch-up jump');
  await page.getByRole('button', { name: 'Turn card to profile' }).click();
  await page.waitForTimeout(800);
  const reverse = await clock(); await page.getByRole('button', { name: 'Turn card', exact: true }).click();
  await page.waitForTimeout(150); assert.ok(await clock() > reverse);
  await page.waitForTimeout(650);
  await page.screenshot({ path: '.browser-test-runtime/mobile-steyra-phone.png' });
  await page.getByRole('button', { name: 'Turn card to profile' }).click(); await page.waitForTimeout(750);
  await page.getByRole('button', { name: 'The world inside · Experiments' }).click();
  const composition = page.locator('.mobile-layer-composition'); await composition.waitFor();
  const box = await composition.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForTimeout(450); assert.equal(await page.locator('.mobile-layers-open').count(), 1);
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .6); await page.mouse.up();
  assert.equal(await page.locator('.mobile-layers-open').count(), 0);
  await page.getByRole('button', { name: 'Through the eye', exact: true }).click();
  await page.locator('.mobile-eye-inside').waitFor(); await page.screenshot({ path: '.browser-test-runtime/mobile-eye-phone.png' });
  await page.getByRole('button', { name: 'Back through the eye' }).click(); await page.locator('.mobile-eye-art').waitFor();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log('PASS optimized Steyra, continuous flip animation, hold/split, eye journey and return');
} finally { await browser.close(); }
