import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/navigator';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const camera = page => page.locator('main.system-workflow').evaluate(n => ({ x: +n.dataset.workbenchCameraX, y: +n.dataset.workbenchCameraY, scale: +n.dataset.workbenchCameraScale }));
const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440, 900], [390, 900], [320, 568], [844, 390]]) test(`Navigator shares the live camera and fits with Keeper (${theme} ${width}x${height})`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1100, reducedMotion: 'reduce' });
    page.setDefaultTimeout(9000); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
      return route.abort();
    });
    await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&theme=${theme}`);
    const nav = page.locator('.workbench-navigator'), keeper = page.locator('.keeper-dock-window'), map = page.getByRole('button', { name: 'Navigate Workbench', exact: true });
    await map.waitFor(); await page.locator('[data-navigator-object^="image:"] image').waitFor(); await settle(page);
    assert.equal(await nav.locator('[data-navigator-object^="shape:"]').count(), 1);
    assert.match(await nav.locator('[data-navigator-object^="text:"]').innerText(), /Navigator study/);
    assert.equal(await nav.locator('iframe, [contenteditable="true"], [data-navigator-object^="keeper:"]').count(), 0);
    const n = await nav.boundingBox(), k = await keeper.boundingBox(), rail = await page.getByRole('group', { name: 'Workbench zoom', exact: true }).boundingBox();
    assert.ok(n.x + n.width <= k.x - 10 && k.x + k.width <= width - 8, JSON.stringify({ n, k }));
    assert.ok(n.y + n.height <= rail.y - 7 && k.y + k.height <= rail.y - 7);
    assert.equal(await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).evaluate(hit), true);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/initial-${theme}-${width}.png` });
    const before = await page.evaluate(() => window.readToolChromeDraft());
    await page.getByRole('slider', { name: 'Workbench zoom', exact: true }).fill('150'); await settle(page);
    assert.equal((await camera(page)).scale, 1.5); assert.deepEqual(await keeper.boundingBox(), k);
    await map.scrollIntoViewIfNeeded(); await settle(page);
    const start = await camera(page), m = await map.boundingBox();
    assert.equal(await map.evaluate(node => {
      const r = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(r.x + r.width * .7, r.y + r.height * .7));
    }), true, 'Navigator map remains exposed inside its scrollable window');
    await page.mouse.click(m.x + m.width * .7, m.y + m.height * .7); await settle(page);
    assert.notDeepEqual(await camera(page), start); assert.equal((await camera(page)).scale, 1.5);
    assert.equal(await map.evaluate(n => getComputedStyle(n).outlineStyle), 'none');
    const frame = await nav.locator('.navigator-map-view').boundingBox(), centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    const grabbed = await camera(page);
    await page.mouse.move(centre.x, centre.y); await page.mouse.down(); await settle(page);
    assert.deepEqual(await camera(page), grabbed, 'grabbing the frame does not jump');
    await page.mouse.move(centre.x + 14, centre.y - 9, { steps: 4 });
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    assert.deepEqual(await camera(page), grabbed, 'Escape restores the camera');
    if (width === 1440) for (const cancellation of ['capture', 'focus', 'window']) {
      await map.evaluate(n => n.addEventListener('pointerdown', e => { n.dataset.testPointer = String(e.pointerId); }, { once: true }));
      await page.mouse.move(centre.x, centre.y); await page.mouse.down();
      await page.mouse.move(centre.x + 12, centre.y + 8);
      if (cancellation === 'capture') await map.evaluate(n => n.releasePointerCapture(Number(n.dataset.testPointer)));
      else if (cancellation === 'focus') await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).focus();
      else await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await page.mouse.up(); await settle(page);
      assert.deepEqual(await camera(page), grabbed, `${cancellation} loss cancels navigation`);
    }

    await map.focus(); await map.press('ArrowLeft'); await settle(page);
    assert.ok((await camera(page)).x > grabbed.x);
    await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click(); await settle(page);
    assert.deepEqual(await camera(page), { x: 0, y: 0, scale: 1 });
    const slider = page.getByRole('slider', { name: 'Workbench zoom', exact: true });
    for (const percent of [25, 200]) { await slider.fill(String(percent)); await settle(page); assert.equal((await camera(page)).scale, percent / 100); }
    await map.focus(); await map.press('Control+0'); await settle(page);
    assert.equal((await camera(page)).scale, 1, 'the existing zoom shortcut remains available from Navigator');
    await page.getByRole('button', { name: 'Reset Workbench view', exact: true }).click();

    assert.deepEqual(await page.evaluate(() => window.readToolChromeDraft()), before, 'navigation leaves saved content/history alone');
    if (width === 1440) {
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await page.getByRole('button', { name: 'EXIT', exact: true }).waitFor(); await settle(page);
      assert.equal(await page.locator('main.system-workflow[inert]').count(), 1);
      assert.equal(await page.locator('main.system-workflow[inert] .workbench-navigator').count(), 0, 'hidden owner preview unmounts its Navigator');
      await page.getByRole('button', { name: 'EXIT', exact: true }).click(); await map.waitFor();
    }

    await page.getByRole('button', { name: 'Keeper settings', exact: true }).click(); await settle(page);
    const settings = await page.locator('.keeper-settings-window').boundingBox();
    const withSettings = await nav.boundingBox(), keeperWithSettings = await keeper.boundingBox();
    assert.ok(settings.y + settings.height <= withSettings.y || settings.x + settings.width <= withSettings.x || settings.x >= keeperWithSettings.x + keeperWithSettings.width, JSON.stringify({ settings, n: withSettings, k: keeperWithSettings }));
    if (width === 320) { const field = page.getByRole('textbox', { name: 'Keeper name' }); await field.click(); assert.equal(await field.evaluate(hit), true, 'Keeper fields remain usable at phone height'); }
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    if (width === 1440) {
      const move = page.getByLabel('Move Navigator window', { exact: true }); await move.focus(); await move.press('Shift+ArrowLeft');
      const moved = await nav.boundingBox();
      await page.getByRole('button', { name: 'New', exact: true }).click(); await page.getByLabel('New Workbench name').fill('Navigator second');
      await page.getByRole('button', { name: 'Create Workbench', exact: true }).click(); await map.waitFor(); await settle(page);
      assert.equal((await nav.boundingBox()).x, moved.x); assert.equal(await nav.locator('[data-navigator-object^="image:"]').count(), 0);
      await page.reload(); await map.waitFor(); await settle(page);
      assert.equal((await nav.boundingBox()).x, n.x, 'reload starts a fresh screen layout');
    }
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/${theme}-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('miniatures follow edits, visibility, ordering and Image sides without changing selection', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => { const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
      return route.abort(); });
    await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=navigator&theme=mist`);
    const nav = page.locator('.workbench-navigator'); await nav.waitFor();
    const shape = nav.locator('[data-navigator-object^="shape:"]'), image = nav.locator('[data-navigator-object^="image:"]');
    await page.getByRole('button', { name: 'Select Shape 1', exact: true }).click();
    await page.getByRole('tab', { name: 'Color', exact: true }).click();
    const colour = page.getByRole('textbox', { name: 'Color colour', exact: true }); await colour.fill('#228866'); await colour.press('Tab'); await settle(page);
    assert.equal(await shape.locator('.navigator-object-content > div').evaluate(n => n.style.backgroundColor), 'rgb(34, 136, 102)');
    await page.getByRole('tab', { name: 'Transform', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Transform Width', exact: true }).fill('300'); await page.getByRole('spinbutton', { name: 'Transform Width', exact: true }).press('Enter'); await settle(page);
    assert.equal(await shape.evaluate(n => parseFloat(n.style.width)), 300);
    const left = await shape.evaluate(n => parseFloat(n.style.left));
    await page.getByLabel('Move Shape window', { exact: true }).press('ArrowRight'); await settle(page);
    assert.notEqual(await shape.evaluate(n => parseFloat(n.style.left)), left, 'moving the module updates its miniature');
    await page.getByRole('tab', { name: 'Layers', exact: true }).click();
    await page.getByRole('button', { name: 'Hide Shape 1 in editor', exact: true }).click(); await settle(page); assert.equal(await shape.count(), 0);
    await page.getByRole('button', { name: 'Show Shape 1 in editor', exact: true }).click(); await settle(page); assert.equal(await shape.count(), 1);
    await page.getByRole('button', { name: 'Bring layers to front', exact: true }).press('Enter'); await settle(page);
    assert.match(await nav.locator('[data-navigator-object]').last().getAttribute('data-navigator-object'), /^shape:/);
    const chosen = await page.getByRole('button', { name: 'Select Shape 1', exact: true }).getAttribute('aria-pressed');
    await page.getByRole('button', { name: 'Navigate Workbench', exact: true }).press('ArrowDown'); await settle(page);
    assert.equal(await page.getByRole('button', { name: 'Select Shape 1', exact: true }).getAttribute('aria-pressed'), chosen);
    const first = await image.locator('image').getAttribute('href');
    await page.getByRole('button', { name: 'Next Image side', exact: true }).press('Enter'); await settle(page);
    assert.notEqual(await image.locator('image').getAttribute('href'), first);
    await page.getByRole('button', { name: 'Select Image', exact: true }).click();
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    const uncroppedWidth = await image.locator('image').getAttribute('width');
    await page.getByRole('slider', { name: 'Crop zoom', exact: true }).fill('2'); await settle(page);
    assert.notEqual(await image.locator('image').getAttribute('width'), uncroppedWidth, 'live crop follows the module-owned preview');
    await page.getByRole('button', { name: 'Done', exact: true }).click(); await settle(page);
    assert.notEqual(await image.locator('image').getAttribute('width'), uncroppedWidth, 'committed crop stays visible');
    await page.getByLabel('Article title', { exact: true }).fill('Changed miniature title'); await settle(page);
    assert.match(await nav.locator('[data-navigator-object^="text:"]').innerText(), /Changed miniature title/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a filled composition keeps miniature media mounted during live camera travel', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => { const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'workbench-perf.invalid') {
        if (url.pathname.startsWith('/__perf-')) return route.fulfill({ path: 'browser-tests/fixtures/keeper-layered.svg', contentType: 'image/svg+xml' });
        if (url.pathname === '/panel.html') return route.fulfill({ contentType: 'text/html', body: '<p>Static artwork</p>' });
        return route.fulfill({ path: 'public' + url.pathname });
      }
      return route.abort(); });
    await page.goto(`${origin}/browser-tests/filled-workbench-performance-fixture.html?size=filled&animated=0`);
    const map = page.getByRole('button', { name: 'Navigate Workbench', exact: true }); await map.waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-navigator-object^="image:"]').length === 16);
    await page.evaluate(() => document.fonts.ready); await settle(page);
    assert.equal(await page.locator('[data-navigator-object^="text:"]').count(), 12);
    assert.equal(await page.locator('[data-navigator-object^="shape:"]').count(), 24);
    await page.evaluate(() => {
      const scene = document.querySelector('.navigator-scene');
      window.navigatorCheck = { children: 0, times: [], running: true };
      window.navigatorCheck.observer = new MutationObserver(records => { window.navigatorCheck.children += records.filter(r => r.type === 'childList').length; });
      window.navigatorCheck.observer.observe(scene, { childList: true, subtree: true });
      let previous; const tick = time => { if (previous) window.navigatorCheck.times.push(time - previous); previous = time; if (window.navigatorCheck.running) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    });
    const box = await map.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .8, box.y + box.height * .8, { steps: 60 }); await page.mouse.up(); await settle(page);
    const measurement = await page.evaluate(() => { const state = window.navigatorCheck; state.running = false; state.observer.disconnect(); return { replacements: state.children, frames: state.times }; });
    assert.equal(measurement.replacements, 0, 'camera movement never rebuilds the media tree');
    const sorted = [...measurement.frames].sort((a, b) => a - b); measurement.p95 = sorted[Math.floor(sorted.length * .95)];
    await mkdir(output, { recursive: true });
    await writeFile(`${output}/filled-performance.json`, JSON.stringify(measurement, null, 2));
    await page.screenshot({ path: `${output}/filled.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
