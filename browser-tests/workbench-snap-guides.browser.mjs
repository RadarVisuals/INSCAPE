import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b, message) => assert.ok(Math.abs(a - b) <= 1, `${message}: ${a} vs ${b}`);

for (const width of [1440, 760]) test(`snap guides and release behavior at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__snap_guides__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__snap_guides__`);
    await page.evaluate(async width => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/workbench-snap-guides-fixture.jsx')).mount(width);
    }, width);
    const board = page.locator('[data-display-instance="moving"] article');
    const target = page.locator('[data-display-instance="target"] article');
    await board.waitFor(); await settle(page);
    const guide = page.locator('.workbench-snap-guides');
    const beginDrag = async node => {
      const b = await node.boundingBox();
      const point = { x: b.x + 30, y: b.y + 5 };
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      return { b, point };
    };
    const moveTo = async (start, x, y) => {
      await page.mouse.move(start.point.x + x - start.b.x, start.point.y + y - start.b.y);
      await settle(page);
    };
    let t = await target.boundingBox();
    let start = await beginDrag(board);
    await moveTo(start, t.x - start.b.width - 7, t.y + 35);
    near((await board.boundingBox()).x + start.b.width, t.x, 'edge captures inside 10px');
    assert.equal(await guide.locator('[data-snap-axis="x"] text').textContent(), 'Flush');
    await moveTo(start, t.x - start.b.width - 17, t.y + 35);
    near((await board.boundingBox()).x + start.b.width, t.x, 'edge remains held at 17px');
    await moveTo(start, t.x - start.b.width - 20, t.y + 35);
    near((await board.boundingBox()).x + start.b.width, t.x - 20, 'edge releases beyond 18px');
    assert.equal(await guide.count(), 0);
    await moveTo(start, t.x - start.b.width - 7, t.y + 35);
    await page.keyboard.down('Alt'); await settle(page);
    assert.equal(await guide.count(), 0, 'Alt hides feedback immediately');
    await moveTo(start, t.x - start.b.width - 5, t.y + 35);
    near((await board.boundingBox()).x + start.b.width, t.x - 5, 'Alt bypasses snapping');
    await page.keyboard.up('Alt');
    await moveTo(start, t.x - start.b.width - 6, t.y + 35);
    assert.equal(await guide.count(), 1, 'releasing Alt lets the same gesture snap again');
    await page.mouse.up(); await settle(page); assert.equal(await guide.count(), 0);

    // Vertical spacing also fits the narrower viewport.
    await page.evaluate(() => snapFixture.setPreferences({ moduleGap: 104 })); await settle(page);
    start = await beginDrag(board);
    await moveTo(start, t.x - 40, t.y + t.height + 104 + 7);
    near((await board.boundingBox()).y, t.y + t.height + 104, 'requested gap applied');
    assert.equal(await guide.locator('[data-snap-axis="y"] text').textContent(), '104 px');
    await page.screenshot({ path: `.browser-test-runtime/snap-gap-${width}.png` });
    await page.evaluate(() => snapFixture.setTarget(false)); await settle(page);
    assert.equal(await guide.count(), 0, 'closing the target clears guides');
    await page.mouse.up();

    await page.evaluate(() => snapFixture.setPreferences({ edgeSnap: false, shortcutSnap: true })); await settle(page);
    start = await beginDrag(board);
    await moveTo(start, 101, 355);
    let b = await board.boundingBox(); near(b.x, 96, 'grid x'); near(b.y, 360, 'grid y');
    assert.equal(await guide.locator('[data-snap-kind="grid"]').count(), 2);
    await page.screenshot({ path: `.browser-test-runtime/snap-grid-${width}.png` });
    await page.mouse.up(); await settle(page); assert.equal(await guide.count(), 0);

    // The visible 24px grid remains the reference at half Workbench zoom.
    for (let i = 0; i < 5; i++) { await board.dispatchEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true }); await settle(page); }
    start = await beginDrag(board);
    await moveTo(start, 101, 221);
    b = await board.boundingBox(); near(b.x, 96, 'zoomed grid x'); near(b.y, 216, 'zoomed grid y');
    assert.equal(await guide.locator('[data-snap-kind="grid"]').count(), 2);
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await settle(page);
    assert.equal(await guide.count(), 0, 'blur clears guides'); await page.mouse.up();
    await page.locator('main').focus(); await page.keyboard.press('Control+0'); await settle(page);

    const text = page.locator('[data-workbench-view-id="text"]');
    start = await beginDrag(text); await moveTo(start, 103, 653);
    near((await text.boundingBox()).x, 96, 'Text uses same visible grid');
    assert.equal(await guide.locator('[data-snap-kind="grid"]').count(), 2);
    await page.mouse.up(); await settle(page);
    const grip = await board.getByRole('button', { name: 'Resize Display Module from se', exact: true }).boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
    await page.mouse.move(grip.x + 60, grip.y + 30); await settle(page);
    const resized = await board.boundingBox();
    near((resized.x + resized.width) / 24, Math.round((resized.x + resized.width) / 24), 'resize reaches grid line');
    assert.ok(await guide.locator('[data-snap-kind="grid"]').count() >= 1);
    await page.mouse.up(); await settle(page);

    const shortcut = page.locator('[data-display-instance="moving"] .system-workflow__desktop-shortcut');
    start = await beginDrag(shortcut); await moveTo(start, 305, 53);
    near((await shortcut.boundingBox()).x, 312, 'shortcut shares grid snapping');
    assert.equal(await guide.locator('[data-snap-kind="grid"]').count(), 2);
    await page.mouse.up(); await settle(page);
    assert.equal(await guide.count(), 0, 'shortcut release clears its guides');

    await page.evaluate(() => snapFixture.setSettings(true));
    const gap = page.getByRole('spinbutton', { name: 'Space between modules', exact: true });
    await gap.fill('0');
    await page.getByRole('img', { name: '0 pixel spacing between modules' }).waitFor();
    await gap.fill('104');
    await page.getByRole('img', { name: '104 pixel spacing between modules' }).waitFor();
    assert.ok((await page.locator('.workbench-gap-preview').boundingBox()).height >= 60, 'spacing preview is larger than an interface icon');
    if (width === 760) await page.setViewportSize({ width: 390, height: 844 });
    await gap.scrollIntoViewIfNeeded(); await page.screenshot({ path: `.browser-test-runtime/snap-settings-${width}.png` });
    assert.equal(await page.locator('[aria-label="Settings"]').evaluate(el => el.scrollWidth > el.clientWidth), false, 'settings do not overflow horizontally');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
