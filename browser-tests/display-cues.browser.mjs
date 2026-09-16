import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
const sameControl = (a, b) => {
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[key] - b[key]) < 1, `${key}: ${a[key]} vs ${b[key]}`);
};

for (const width of [1440, 390]) test(`Display cue and metadata bubble stay independent at ${width}px`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      return route.fulfill({ contentType: route.request().resourceType() === 'image' ? 'image/svg+xml' : 'application/json',
        body: route.request().resourceType() === 'image'
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#602bc3" d="M800 0 1600 900H0Z"/></svg>' : '{"data":{}}' });
    });
    await page.route('**/browser-tests/published-visitor-fixture.jsx', async route => {
      const response = await route.fetch();
      const source = await response.text();
      await route.fulfill({ response, body: source.replace('public fixture description`',
        'public fixture description. ' + 'A long artwork description with enough detail to need expansion. '.repeat(35) + '`')
        .replace(/attributes:\s*\[\]/, 'attributes: [{ key: "Name", value: "Resident Zero" }, { key: "Identifier", value: "#0010" }]') });
    });
    await page.goto(`${origin}/browser-tests/fixture.html`);
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    const cue = board.getByRole('button', { name: 'Inspect Alpha Artwork 1', exact: true });
    await cue.focus(); await page.keyboard.press('Enter');
    const bubble = page.getByRole('region', { name: 'Artwork metadata bubble' });
    await bubble.waitFor();
    assert.equal(await page.getByRole('complementary', { name: 'Display Module instruments' }).count(), 0);
    assert.match(await bubble.innerText(), /Alpha Artwork 1 public fixture description/);
    const more = bubble.getByRole('button', { name: '… more', exact: true });
    await more.click();
    assert.equal(await bubble.getByRole('button', { name: 'Less', exact: true }).getAttribute('aria-expanded'), 'true');
    const scrollBody = bubble.locator('.display-metadata__body');
    assert.ok(await scrollBody.evaluate(node => node.scrollHeight > node.clientHeight));
    const expandedBox = await bubble.boundingBox();
    const tabsBox = await bubble.getByRole('tablist').boundingBox();
    assert.ok(tabsBox.height >= 30, 'top icon tabs retain their intended control height');
    assert.ok(tabsBox.y + tabsBox.height <= expandedBox.y + expandedBox.height + 1);
    await bubble.getByRole('button', { name: 'Less', exact: true }).click();
    await bubble.getByRole('tab', { name: 'Attributes', exact: true }).click();
    assert.match(await bubble.getByRole('tabpanel', { name: 'Attributes', exact: true }).innerText(), /Resident Zero/);
    const attributes = await bubble.locator('.display-metadata__facts').first().evaluate(node => ({
      font: getComputedStyle(node).fontFamily,
      left: getComputedStyle(node.querySelector('dt')).textAlign,
      right: getComputedStyle(node.querySelector('dd')).textAlign,
    }));
    assert.match(attributes.font, /Inscape Sora/);
    assert.equal(attributes.left, 'left'); assert.equal(attributes.right, 'right');
    await bubble.getByRole('tab', { name: 'Attributes', exact: true }).hover();
    const tabPaint = await bubble.getByRole('tab', { name: 'Attributes', exact: true }).evaluate(node => ({
      background: getComputedStyle(node).backgroundColor, shadow: getComputedStyle(node).boxShadow,
    }));
    assert.equal(tabPaint.background, 'rgba(0, 0, 0, 0)'); assert.equal(tabPaint.shadow, 'none');
    await page.keyboard.press('ArrowRight');
    assert.equal(await bubble.getByRole('tab', { name: 'Details', exact: true }).getAttribute('aria-selected'), 'true');
    assert.match(await bubble.locator('.display-metadata__facts--details').evaluate(node => getComputedStyle(node).fontFamily), /Inscape Sora/);
    await bubble.getByRole('tab', { name: 'Info', exact: true }).click();
    assert.equal(await board.getAttribute('data-inspecting'), 'true');
    const stage = await board.locator('.system-workflow__stage-viewport').boundingBox();
    const box = await bubble.boundingBox();
    assert.ok(box.x >= stage.x && box.x + box.width <= stage.x + stage.width + 1);
    assert.ok(box.y >= stage.y && box.y + box.height <= stage.y + stage.height + 1);
    await bubble.hover(); await page.mouse.wheel(0, 350);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await board.locator('.system-workflow__stage-viewport').boundingBox(), stage);
    const close = await bubble.getByRole('button', { name: 'Hide artwork metadata', exact: true }).boundingBox();
    assert.ok(close.y >= box.y && close.y + close.height <= box.y + box.height);
    await scrollBody.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `.browser-test-runtime/display-cue-${width}.png` });
    assert.equal(await board.locator('.display-inspection-cue').count(), 1, 'open card owns the only active cue');
    assert.equal(await bubble.locator('.display-inspection-cue').count(), 1, 'minus is inside the card');
    const previousSurfaces = await page.locator('[data-menu-surface]').evaluateAll(nodes => nodes.map(node => node.dataset.menuSurface));
    const colors = [];
    for (const surface of ['carbon', 'paper']) {
      await page.locator('[data-menu-surface]').evaluateAll((nodes, value) => nodes.forEach(node => { node.dataset.menuSurface = value; }), surface);
      const material = await bubble.evaluate(node => {
        const style = getComputedStyle(node);
        return { ink: style.color, tint: style.backgroundColor, blur: style.backdropFilter };
      });
      colors.push(material);
      assert.match(material.blur, /blur/);
      await page.screenshot({ path: `.browser-test-runtime/display-glass-${surface}-${width}.png` });
    }
    assert.notEqual(colors[0].ink, colors[1].ink, 'text follows the selected theme');
    assert.notEqual(colors[0].tint, colors[1].tint, 'glass tint follows the selected theme');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-reduced-transparency', value: 'reduce' },
    ] });
    assert.equal(await bubble.evaluate(node => getComputedStyle(node).backdropFilter), 'none');
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await cdp.detach();
    await page.locator('[data-menu-surface]').evaluateAll((nodes, values) => nodes.forEach((node, index) => { node.dataset.menuSurface = values[index]; }), previousSurfaces);
    await page.keyboard.press('Escape'); await bubble.waitFor({ state: 'detached' });
    assert.equal(await board.getAttribute('data-inspecting'), 'true');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Show artwork metadata');
    const collapsed = await board.getByRole('button', { name: 'Show artwork metadata', exact: true }).boundingBox();
    await page.keyboard.press('Enter'); await bubble.waitFor();
    sameControl(await bubble.getByRole('button', { name: 'Hide artwork metadata', exact: true }).boundingBox(), collapsed);
    await bubble.getByRole('button', { name: 'Hide artwork metadata', exact: true }).click();
    await bubble.waitFor({ state: 'detached' });
    assert.equal(await board.getAttribute('data-inspecting'), 'true');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Inspect Alpha Artwork 1');
    await page.getByRole('button', { name: 'Metadata', exact: true }).click();
    const bay = page.getByRole('complementary', { name: 'Display Module instruments' });
    await bay.waitFor();
    await bay.getByRole('button', { name: 'Detach instrument bay', exact: true }).click();
    const detached = page.locator('.system-workflow__instrument-window');
    const before = await detached.boundingBox();
    await cue.focus(); await page.keyboard.press('Enter'); await bubble.waitFor();
    assert.deepEqual(await detached.boundingBox(), before);
    await board.getByRole('button', { name: 'Hide artwork metadata', exact: true }).click();
    await bubble.waitFor({ state: 'detached' });
    assert.deepEqual(await detached.boundingBox(), before);
    assert.equal(await board.getAttribute('data-inspecting'), 'true');
    await board.locator('.system-workflow__inspection-hit-surface').click({ position: { x: 80, y: 80 } });
    await page.waitForFunction(() => !document.querySelector('[data-inspecting]'));
    assert.deepEqual(await page.evaluate(() => window.__visitorStorageOps.filter(item => ['setItem', 'removeItem', 'clear'].includes(item.method))), []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('owner can move and reset a cue without moving artwork or opening inspection', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    const cue = board.getByRole('button', { name: 'Inspect MOUNTAIN SIGNAL II', exact: true });
    await cue.focus();
    await page.evaluate(() => { window.__cueWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__cueWrites += 1; }); });
    const source = board.locator('.system-workflow__placement').first();
    const artwork = await source.boundingBox();
    const before = await cue.boundingBox();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(x => document.querySelector('[aria-label="Inspect MOUNTAIN SIGNAL II"]').getBoundingClientRect().x < x, before.x);
    assert.deepEqual(await source.boundingBox(), artwork);
    const moved = await cue.boundingBox();
    await page.mouse.move(moved.x + 15, moved.y + 15); await page.mouse.down();
    await page.mouse.move(moved.x - 20, moved.y + 35, { steps: 5 }); await page.mouse.up();
    assert.equal(await board.getAttribute('data-inspecting'), null);
    await cue.focus(); await page.keyboard.press('Home');
    await page.waitForFunction(x => Math.abs(document.querySelector('[aria-label="Inspect MOUNTAIN SIGNAL II"]').getBoundingClientRect().x - x) < 1, before.x);
    await page.keyboard.press('Enter');
    const bubble = page.getByRole('region', { name: 'Artwork metadata bubble' }); await bubble.waitFor();
    const enlargedCue = board.getByRole('button', { name: 'Hide artwork metadata', exact: true });
    const liftCueBefore = await enlargedCue.boundingBox();
    const liftArtworkBefore = await board.locator('.system-workflow__lift-artwork').boundingBox();
    await enlargedCue.focus(); await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(x => document.querySelector('[aria-label="Hide artwork metadata"]').getBoundingClientRect().x < x, liftCueBefore.x);
    const liftCueMoved = await enlargedCue.boundingBox();
    await page.mouse.move(liftCueMoved.x + 15, liftCueMoved.y + 15); await page.mouse.down();
    await page.mouse.move(liftCueMoved.x - 25, liftCueMoved.y + 40, { steps: 5 }); await page.mouse.up();
    assert.equal(await bubble.count(), 1, 'dragging does not toggle metadata');
    assert.deepEqual(await board.locator('.system-workflow__lift-artwork').boundingBox(), liftArtworkBefore);
    const retainedLiftCue = await enlargedCue.boundingBox();
    await bubble.getByRole('button', { name: 'Metadata cue settings' }).click();
    assert.equal(await bubble.getByRole('tabpanel').count(), 0, 'settings replaces the content');
    assert.equal(await bubble.getByRole('region', { name: 'Creators' }).count(), 0);
    await bubble.getByLabel('Metadata opening direction').selectOption('left');
    assert.equal(await board.getAttribute('data-inspecting'), 'true');
    await page.screenshot({ path: '.browser-test-runtime/display-cue-owner.png' });
    await bubble.getByRole('button', { name: 'Metadata cue settings' }).click();
    assert.equal(await bubble.getByRole('tabpanel', { name: 'Info', exact: true }).count(), 1);
    await bubble.getByRole('button', { name: 'Metadata cue settings' }).click();
    await bubble.getByRole('tab', { name: 'Details', exact: true }).click();
    assert.equal(await bubble.getByRole('region', { name: 'Cue settings' }).count(), 0, 'content icon exits settings');
    await bubble.getByRole('tab', { name: 'Info', exact: true }).click();
    const surfaces = await page.locator('[data-menu-surface]').evaluateAll(nodes => nodes.map(node => node.dataset.menuSurface));
    for (const surface of ['carbon', 'paper']) {
      await page.locator('[data-menu-surface]').evaluateAll((nodes, value) => nodes.forEach(node => { node.dataset.menuSurface = value; }), surface);
      await page.screenshot({ path: `.browser-test-runtime/display-glass-artwork-${surface}.png` });
    }
    await page.locator('[data-menu-surface]').evaluateAll((nodes, values) => nodes.forEach((node, index) => { node.dataset.menuSurface = values[index]; }), surfaces);
    assert.equal(await page.evaluate(() => window.__cueWrites), 0);
    await bubble.getByRole('button', { name: 'Hide artwork metadata', exact: true }).click();
    await bubble.waitFor({ state: 'detached' });
    assert.equal(await board.getAttribute('data-inspecting'), 'true');
    await board.getByRole('button', { name: 'Show artwork metadata', exact: true }).click(); await bubble.waitFor();
    assert.deepEqual(await enlargedCue.boundingBox(), retainedLiftCue);
    await page.keyboard.press('Escape'); await bubble.waitFor({ state: 'detached' });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-inspecting]'));
    assert.deepEqual(await cue.boundingBox(), before, 'Lift cue adjustment leaves thumbnail cue unchanged');
    await cue.focus(); await page.keyboard.press('Enter'); await bubble.waitFor();
    assert.deepEqual(await enlargedCue.boundingBox(), retainedLiftCue, 'Lift cue retains its separate position on reopen');
    await page.keyboard.press('Escape'); await bubble.waitFor({ state: 'detached' });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-inspecting]'));
    const bay = page.getByRole('complementary', { name: 'Display Module instruments' });
    await bay.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true }).click();
    await bay.getByRole('button', { name: 'In place', exact: true }).click();
    const writesAfterModeChange = await page.evaluate(() => window.__cueWrites);
    const inPlaceCueBefore = await cue.boundingBox();
    await cue.focus(); await page.keyboard.press('Enter'); await bubble.waitFor();
    assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 0);
    sameControl(await enlargedCue.boundingBox(), inPlaceCueBefore);
    const header = bubble.locator('.display-metadata__controls');
    const headerBox = await header.boundingBox();
    const beforeHeaderDrag = await enlargedCue.boundingBox();
    await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + 3); await page.mouse.down();
    await page.mouse.move(headerBox.x + headerBox.width / 2 - 20, headerBox.y + 33, { steps: 5 }); await page.mouse.up();
    const afterHeaderDrag = await enlargedCue.boundingBox();
    assert.ok(Math.abs(afterHeaderDrag.x - beforeHeaderDrag.x) > 5 || Math.abs(afterHeaderDrag.y - beforeHeaderDrag.y) > 5, 'empty header moves the cue');
    assert.deepEqual(await source.boundingBox(), artwork, 'header drag leaves artwork unchanged');
    assert.equal(await bubble.count(), 1);
    await enlargedCue.focus();
    for (let step = 0; step < 12; step += 1) await page.keyboard.press('Shift+ArrowDown');
    assert.equal(await bubble.locator('.display-metadata').getAttribute('data-upward'), 'true');
    const upwardControl = await enlargedCue.boundingBox();
    await enlargedCue.click(); await bubble.waitFor({ state: 'detached' });
    const reopen = board.getByRole('button', { name: 'Show artwork metadata', exact: true });
    sameControl(await reopen.boundingBox(), upwardControl);
    await reopen.click(); await bubble.waitFor();
    sameControl(await enlargedCue.boundingBox(), upwardControl);
    assert.equal(await page.evaluate(() => window.__cueWrites), writesAfterModeChange);
    await page.keyboard.press('Escape'); await bubble.waitFor({ state: 'detached' });
    assert.equal(await board.getAttribute('data-inspecting'), 'true');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-inspecting]'));
  } finally { await browser.close(); }
});
