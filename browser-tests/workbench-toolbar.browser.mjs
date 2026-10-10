import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function mount(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/browser-tests/workbench-toolbar-fixture.html`);
  await page.getByRole('toolbar', { name: 'Creation tools' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return errors;
}
const within = (box, width, height, label) => assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + .5 && box.y + box.height <= height + .5,
  `${label} stays inside ${width}×${height}: ${JSON.stringify(box)}`);
const appearance = locator => locator.evaluate(node => {
  const s = getComputedStyle(node), mark = getComputedStyle(node, '::after');
  return { color: s.color, background: s.background, shadow: s.boxShadow, outline: s.outlineWidth, outlineStyle: s.outlineStyle,
    marker: mark.display, transition: s.transitionDuration };
});

for (const [width, height, touch] of [[1576, 1244, false], [1440, 900, false], [961, 900, false], [960, 900, false], [520, 800, false], [390, 844, true], [320, 568, true], [844, 390, true]]) {
  test(`Tactile toolbar and menus remain usable at ${width}×${height}${touch ? ' touch' : ''}`, { timeout: 60000 }, async () => {
    await mkdir(output, { recursive: true });
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
      const errors = await mount(page);
      const toolbar = page.getByRole('toolbar', { name: 'Creation tools' });
      const buttons = toolbar.getByRole('button');
      assert.equal(await buttons.count(), 9);
      const bar = await toolbar.boundingBox(); within(bar, width, height, 'toolbar');
      assert.equal(await toolbar.evaluate(node => getComputedStyle(node).fontFamily), '"Inter Variable", Arial, sans-serif');
      if (width > 520) {
        assert.ok(bar.width < 500, 'icon toolbar stays compact on wide and narrow screens');
        assert.equal(bar.height, touch ? 56 : 54, 'single-row height includes padding around full input targets');
      }
      for (const button of await buttons.all()) {
        const box = await button.boundingBox(); within(box, width, height, await button.getAttribute('aria-label'));
        assert.equal(box.width, touch ? 44 : 40, 'icon-only key retains its full input width');
        assert.ok(box.height >= (touch ? 44 : 40), 'full input height');
        assert.ok(box.x >= bar.x && box.x + box.width <= bar.x + bar.width + .5 && box.y >= bar.y && box.y + box.height <= bar.y + bar.height + .5, 'keys stay inside their shell');
      }
      const camera = await page.getByRole('group', { name: 'Workbench zoom' }).boundingBox();
      assert.ok(camera.y + camera.height <= bar.y - 7, 'measured clearance keeps camera controls above the bar');
      if (width <= 520) {
        const boxes = await buttons.evaluateAll(nodes => nodes.map(node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width }; }));
        assert.equal(new Set(boxes.slice(0, 5).map(b => b.y)).size, 1, 'creation row');
        assert.equal(new Set(boxes.slice(5).map(b => b.y)).size, 1, 'inspection and actions row');
        assert.ok(boxes[5].y > boxes[0].y);
        assert.ok(Math.abs((boxes[5].x + boxes[8].x + boxes[8].width) / 2 - width / 2) < 1, 'second row is centred');
      } else assert.equal(await buttons.evaluateAll(nodes => new Set(nodes.map(node => node.getBoundingClientRect().y)).size), 1, 'all nine icon controls share one row');
      await page.screenshot({ path: `${output}/toolbar-${width}.png` });
      if (width === 1576) await page.screenshot({ path: `${output}/reference-toolbar.png`, clip: { x: bar.x - 16, y: bar.y - 12, width: bar.width + 32, height: bar.height + 28 } });
      await page.getByRole('button', { name: 'Actions', exact: true }).click();
      const search = page.getByRole('textbox', { name: 'Search actions' });
      assert.equal(await search.evaluate(node => node === document.activeElement), true);
      const popup = page.getByRole('dialog', { name: 'Actions' });
      within(await popup.boundingBox(), width, height, 'popup');
      assert.ok((await popup.boundingBox()).y + (await popup.boundingBox()).height <= bar.y - 7);
      if (touch) assert.ok(Number.parseFloat(await search.evaluate(node => getComputedStyle(node).fontSize)) >= 16);
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('End');
      const finalCommand = page.locator('.workbench-toolbar__command:not(:disabled)').last();
      assert.equal(await finalCommand.evaluate(node => node === document.activeElement), true);
      const visible = await finalCommand.boundingBox(), scroll = await page.locator('.workbench-toolbar__commands').boundingBox();
      assert.ok(visible.y >= scroll.y && visible.y + visible.height <= scroll.y + scroll.height + 1, 'keyboard scroll exposes the whole command');
      await page.screenshot({ path: `${output}/toolbar-menu-${width}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button', { name: 'Actions', exact: true }).evaluate(node => node === document.activeElement), true, 'Escape restores trigger focus');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('Tactile states preserve selection, focus, creation and readable contrast', { timeout: 60000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = await mount(page);
    const hand = page.getByRole('button', { name: 'Hand tool', exact: true });
    const disabled = page.getByRole('button', { name: 'Artwork info', exact: true });
    const before = await hand.boundingBox(), resting = await appearance(hand), unavailable = await appearance(disabled);
    await hand.hover();
    assert.notEqual((await appearance(hand)).background, resting.background, 'available controls respond to hover');
    await page.mouse.down();
    assert.notEqual((await appearance(hand)).shadow, resting.shadow, 'physical press recesses the key');
    assert.deepEqual(await hand.boundingBox(), before, 'press never shifts the hit target');
    await page.mouse.up();
    assert.equal(await hand.getAttribute('aria-pressed'), 'true');
    await page.mouse.move(1, 1); await page.waitForTimeout(150);
    const selected = await appearance(hand);
    await hand.hover(); await page.waitForTimeout(150);
    assert.deepEqual(await appearance(hand), selected, 'hover preserves the selected material');
    assert.equal(selected.marker, 'none', 'active toolbar icons have no underline');
    assert.notEqual(selected.shadow, resting.shadow, 'recessed material identifies the active tool');
    await disabled.hover(); assert.deepEqual(await appearance(disabled), unavailable, 'disabled control never gains hover depth');
    // Escape and the creation shortcuts still use the real owner adapter.
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('t');
    await page.locator('.workbench-creation-hint').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Text tool', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Select tool', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search actions' }).fill('Horizontal');
    assert.equal(await page.locator('.workbench-toolbar__command').count(), 1, 'nested commands remain searchable');
    await page.keyboard.press('Escape');
    const action = page.getByRole('button', { name: 'Actions', exact: true });
    assert.equal((await appearance(action)).outline, '2px', 'keyboard focus remains visible after closing');
    // Measure text/accent contrast against the brightest material stop.
    const contrast = await page.locator('[data-workflow-material]').evaluate(node => {
      const s = getComputedStyle(node), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const surface = rgb(s.getPropertyValue('--tactile-surface').trim());
      const brightest = surface.map(value => value * .85 + 255 * .15);
      const luminance = values => values.map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      return ['--tactile-ink', '--tactile-muted', '--tactile-accent'].map(token => {
        const color = rgb(s.getPropertyValue(token).trim()), a = ctx.getImageData(0, 0, 1, 1).data[3] / 255;
        const opaque = color.map((value, i) => value * a + brightest[i] * (1 - a));
        return [token, (luminance(opaque) + .05) / (luminance(brightest) + .05)];
      });
    });
    for (const [token, ratio] of contrast) assert.ok(ratio >= 4.5, `${token}: ${ratio.toFixed(2)} contrast`);
    console.log('Material text contrast:', contrast.map(([token, ratio]) => `${token} ${ratio.toFixed(2)}:1`).join(', '));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal((await appearance(action)).transition, '0s');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.getByRole('button', { name: 'Select tool', exact: true }).focus();
    const highContrast = await appearance(page.getByRole('button', { name: 'Select tool', exact: true }));
    assert.equal(highContrast.marker, 'none'); assert.equal(highContrast.outline, '2px');
    assert.notEqual(highContrast.background, (await appearance(hand)).background, 'system highlight identifies selection without an underline');
    await page.screenshot({ path: `${output}/toolbar-forced-colors.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
