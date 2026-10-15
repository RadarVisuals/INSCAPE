import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const screenshots = process.env.INSCAPE_SCREENSHOT_DIR || 'output/reception-image-lift';
const browserPath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#25384a"/><rect x="3" y="3" width="634" height="314" fill="none" stroke="#f3a850" stroke-width="6"/><circle cx="160" cy="160" r="90" fill="none" stroke="white" stroke-width="4"/></svg>';

async function mount(page, { bitmap = false, rotated = false, delayed = false } = {}) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const media = bitmap ? 'https://reception.invalid/artwork.png' : 'https://reception.invalid/artwork.svg';
  await page.route('https://reception.invalid/**', async route => {
    if (delayed) await gate;
    if (bitmap) await route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' });
    else await route.fulfill({ contentType: 'image/svg+xml', body: svg });
  });
  await page.route(origin + '/__reception_lift__', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(origin + '/__reception_lift__');
  await page.evaluate(async ({ media, rotated }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, client = (await import('/@id/react-dom/client'));
    const { default: Overview } = await import('/src/profileDocument/components/ProfileOverview.jsx');
    const { createEmptySystemWorkflowDraft } = await import('/src/systemWorkflow/domain/systemWorkflowDraft.js');
    const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
    const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    await import('/src/index.css');
    const address = `0x${'1'.repeat(40)}`, contract = `0x${'3'.repeat(40)}`, id = `42:${contract}:0x01`;
    const asset = { id, chainId: 42, contractAddress: contract, tokenId: '0x01', standard: 'LSP8', name: 'Lift study',
      description: 'Artwork metadata remains still while the image travels. '.repeat(20), imageUrl: media, originalImageUrl: media,
      imageWidth: 640, imageHeight: 320, creators: [], attributes: [] };
    const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
    draft.identityPresentation.alias = 'Lift review';
    draft.identityPresentation.bio = { mode: 'inscape', customText: 'A fixed stage for artwork inspection.' };
    const side = { id: 'side:first', asset: createProfileDocumentV9AssetResolver([asset])(id), crop: { x: .2, y: .2, zoom: 2 },
      ...(rotated ? { receptionCrop: { x: .65, y: .4, zoom: 1.7 } } : {}),
      transform: { quarterTurns: rotated ? 1 : 0, mirrorX: rotated, mirrorY: false } };
    draft.imageModules = [{ id: 'image:study', name: 'Solo image', visibility: 'PUBLIC', width: 640, height: 360,
      sides: [side, { ...structuredClone(side), id: 'side:second', transform: { quarterTurns: rotated ? 0 : 1, mirrorX: false, mirrorY: true } }] }];
    const document = buildProfileDocumentV9({ profileAddress: address, profileIdentity: { name: 'Lift review' }, assetRecords: [asset], systemWorkflowDraft: draft });
    window.__liftDocument = document; window.__liftSaved = JSON.stringify(document);
    window.__liftRoot = (client.createRoot || client.default.createRoot)(window.document.getElementById('root'));
    window.__liftRoot.render(React.createElement(Overview, { document }));
  }, { media, rotated });
  await page.getByRole('link', { name: 'Open Solo image' }).waitFor();
  return { release, media };
}

const sample = page => page.evaluate(() => {
  const layer = document.querySelector('.bento-stage__expansion');
  const rect = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
  const source = document.querySelector('[data-image-source]');
  const foreign = source.querySelector('foreignObject');
  const artwork = foreign ? (() => { const m = foreign.getScreenCTM(); return [m.a, m.b, m.c, m.d, m.e, m.f]; })()
    : rect(document.querySelector('.system-workflow__lift-artwork'));
  return { progress: Number(layer.style.getPropertyValue('--inspection-lift-progress')),
    stage: rect(document.querySelector('[data-bento-stage]')), layer: rect(layer),
    toolbar: rect(layer.querySelector('[role="toolbar"]')), details: rect(layer.querySelector('aside')), artwork };
});
const near = (actual, expected, message, tolerance = .8) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < tolerance, `${message}: ${actual} vs ${expected}`));

for (const width of [1280, 390]) for (const bitmap of [false, true]) {
  test(`reception Image uses canvas Lift with fixed chrome: ${width}px ${bitmap ? 'bitmap' : 'SVG'}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserPath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1050 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mount(page, { bitmap, rotated: width === 390 });
      const card = page.getByRole('link', { name: 'Open Solo image' });
      await card.scrollIntoViewIfNeeded();
      if (bitmap) await card.locator('[data-media-state="ready"]').waitFor();
      else { await card.locator('iframe').waitFor(); await card.locator('.artwork-svg-status').waitFor({ state: 'detached' }); }
      await page.locator('[data-active-grid-id]').first().waitFor(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100);
      const originalFrame = bitmap ? null : await card.locator('iframe').elementHandle();
      await mkdir(screenshots, { recursive: true });
      await card.screenshot({ path: `${screenshots}/${width}-${bitmap ? 'bitmap' : 'svg'}-source.png` });
      const time = new Date(); await page.clock.install({ time }); await page.clock.pauseAt(time);
      await card.evaluate(node => node.click());
      // Media preparation messages/decodes finish with the animation clock held.
      await page.waitForTimeout(200);
      await page.locator('.system-workflow__lift-artwork').waitFor();
      const first = await sample(page), opened = [];
      for (const milliseconds of [80, 80, 160, 160]) {
        await page.clock.runFor(milliseconds); opened.push(await sample(page));
        await page.screenshot({ path: `${screenshots}/${width}-${bitmap ? 'bitmap' : 'svg'}-open-${opened.length}.png` });
      }
      const final = opened.at(-1);
      assert.equal(final.progress, 1);
      assert.ok(opened[0].progress > 0 && opened[1].progress < 1, 'Opening animates instead of appearing at full size');
      const expected = await page.evaluate(async () => {
        const { latticeProductionFocusOpeningProgress: ease, LATTICE_PRODUCTION_FOCUS_OPENING_MS: duration } = await import('/src/lattice/rendering/latticeProductionFocusArtworkMotion.js');
        return [80,160,320,480].map(t => ease(Math.min(1,t/duration)));
      });
      opened.forEach((value,index) => {
        assert.ok(Math.abs(value.progress - expected[index]) < .025, 'Same 460 ms clock and easing as canvas');
        near(value.toolbar, first.toolbar, 'Toolbar stays fixed'); near(value.details, first.details, 'Metadata stays fixed');
        near(value.stage, first.stage, 'Stage stays fixed'); near(value.layer, first.layer, 'Viewer stays fixed');
        near(value.artwork, first.artwork.map((n,i) => n + (final.artwork[i]-n)*value.progress), 'Artwork follows shared interpolation');
      });
      await page.getByRole('button', { name: 'Return to card', exact: true }).evaluate(node => node.click());
      for (const milliseconds of [80,80,160]) {
        await page.clock.runFor(milliseconds);
        const value = await sample(page);
        near(value.toolbar, first.toolbar, 'Closing toolbar stays fixed'); near(value.details, first.details, 'Closing metadata stays fixed');
        near(value.artwork, first.artwork.map((n,i) => n+(final.artwork[i]-n)*value.progress), 'Return follows the artwork path');
        await page.screenshot({ path: `${screenshots}/${width}-${bitmap ? 'bitmap' : 'svg'}-close-${Math.round(value.progress*100)}.png` });
      }
      await page.clock.runFor(180); await page.waitForTimeout(25); await page.clock.runFor(32);
      assert.equal(await page.locator('.bento-stage__expansion').count(), 0);
      assert.equal(await card.evaluate(node => document.activeElement === node), true);
      if (originalFrame) assert.equal(await card.locator('iframe').evaluate((node, original) => node === original, originalFrame), true, 'SVG document is retained');
      assert.equal(await page.evaluate(() => JSON.stringify(window.__liftDocument) === window.__liftSaved), true);
      // Focus styling may differ, so compare artwork geometry and runtime above;
      // retain screenshots for the source/return visual check.
      await page.screenshot({ path: `${screenshots}/${width}-${bitmap ? 'bitmap' : 'svg'}-returned.png` });
      await card.evaluate(node => node.click()); await page.waitForTimeout(100); await page.clock.runFor(96);
      const interrupted = (await sample(page)).progress;
      await page.keyboard.press('Escape'); await page.clock.runFor(16);
      assert.ok((await sample(page)).progress <= interrupted + .01, 'Interrupted opening does not jump to full size');
      await page.clock.runFor(500);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await card.evaluate(node => node.click()); await page.waitForTimeout(100); await page.clock.runFor(32);
      assert.equal((await sample(page)).progress, 1);
      await page.getByRole('button', { name: 'Next side', exact: true }).evaluate(node => node.click());
      await page.waitForTimeout(100); await page.clock.runFor(32);
      assert.equal(await page.locator('.profile-work-viewer__counter').textContent(), '2 / 2');
      await page.getByRole('button', { name: 'Artwork details', exact: true }).evaluate(node => node.click());
      await page.setViewportSize({ width: width + 80, height: 1050 }); await page.waitForTimeout(100); await page.clock.runFor(32);
      const fitted = await page.evaluate(() => {
        const rect = n => { const r = n.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; };
        return { target: rect(document.querySelector('[data-fitted-artwork]')),
          image: rect(document.querySelector('[data-image-source] foreignObject') || document.querySelector('.system-workflow__lift-artwork')) };
      });
      near(fitted.image, fitted.target, 'Artwork follows its media slot after details/viewport resize');
      await page.keyboard.press('Escape'); await page.clock.runFor(32);
      assert.equal(await page.locator('.bento-stage__expansion').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('loading artwork can be closed before Lift starts', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
    const { release } = await mount(page, { delayed: true });
    const card = page.getByRole('link', { name: 'Open Solo image' });
    await card.click(); await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' }); release();
    await card.locator('iframe').waitFor(); await card.locator('.artwork-svg-status').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 0, 'Late load cannot reopen a closed inspection');
  } finally { await browser.close(); }
});

test('a slow source starts the full opening motion when ready', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
    const { release } = await mount(page, { delayed: true });
    const card = page.getByRole('link', { name: 'Open Solo image' });
    await card.click(); await page.waitForTimeout(600);
    assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 0);
    const time = new Date(); await page.clock.install({ time }); await page.clock.pauseAt(time);
    release(); const artwork = page.locator('[data-image-source]'); await artwork.locator('iframe').waitFor(); await artwork.locator('.artwork-svg-status').waitFor({ state: 'detached' });
    await page.locator('.system-workflow__lift-artwork').waitFor(); await page.waitForTimeout(100);
    assert.equal((await sample(page)).progress, 0, 'Loading time cannot consume the opening animation');
    await page.clock.runFor(160);
    assert.ok((await sample(page)).progress > .3 && (await sample(page)).progress < .7);
    await page.evaluate(() => window.__liftRoot.unmount());
    await page.clock.runFor(500);
    assert.equal(await page.locator('.system-workflow__lift-artwork, .artwork-svg-document').count(), 0, 'Disposal removes retained artwork and motion');
  } finally { await browser.close(); }
});


