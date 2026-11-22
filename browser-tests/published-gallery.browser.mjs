import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { measureGalleryScroll } from './measureGalleryScroll.mjs';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/published-gallery';
const address = '0x' + '1'.repeat(40);
test('Profile and Gallery keep header controls on the same row', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=published&collection=1`);
    const header = page.locator('.visitor-header');
    const tab = name => header.getByRole('button', { name, exact: true });
    const positions = () => header.locator('.workspace-brand, .visitor-tabs, .visitor-tools').evaluateAll(nodes =>
      nodes.map(node => node.getBoundingClientRect().top));
    await tab('Gallery').waitFor();
    for (const width of [1600, 1251, 1250, 940, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const before = await positions();
      await tab('Gallery').click();
      const toolbar = header.getByRole('group', { name: 'Gallery controls' });
      await toolbar.waitFor();
      assert.deepEqual(await positions(), before, `Header positions at ${width}px`);
      const box = await toolbar.boundingBox();
      const frame = await header.boundingBox();
      assert.ok(box.y >= frame.y && box.y + box.height <= frame.y + frame.height + 1);
      await tab('Profile').click();
      await toolbar.waitFor({ state: 'detached' });
      assert.deepEqual(await positions(), before);
    }
  } finally { await browser.close(); }
});
test('open Profile shares its published Gallery selection, camera and layout and preserves the Bento', { timeout: 75000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=published&collection=1`);
    const button = name => page.getByRole('button', { name, exact: true });
    await page.getByRole('heading', { name: 'Nomad', exact: true }).waitFor();
    await page.locator('main.visitor-profile-card').getByText('Human underneath', { exact: true }).waitFor();
    const profile = page.locator('main.visitor-profile-card');
    assert.ok(await profile.isVisible());
    const checkPortrait = async () => {
      const portrait = page.locator('.visitor-portrait');
      const size = await portrait.locator('img').boundingBox();
      assert.ok(size && size.width > 0 && Math.abs(size.width - size.height) < 1, 'The portrait is square');
      assert.ok(await portrait.evaluate(node => [node, node.querySelector('img')].every(el =>
        getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).opacity === '1')));
    };
    await checkPortrait();
    const rim = await profile.evaluate(root => {
      const body = root.querySelector('.visitor-profile-body'), card = body.getBoundingClientRect();
      const image = body.querySelector('.visitor-portrait img').getBoundingClientRect();
      const inside = parseFloat(getComputedStyle(body, '::before').left) + 1;
      return [image.left-card.left, image.top-card.top, card.bottom-image.bottom]
        .every(inset => Math.abs(inset-inside) < 1);
    });
    assert.ok(rim, 'The portrait meets the inner stroke on all three exterior edges');
    assert.equal(await button('Profile index').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const background = { clip: { x: 20, y: 125, width: 140, height: 70 } };
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const still = await page.screenshot(background);
    await page.waitForTimeout(250);
    assert.deepEqual(await page.screenshot(background), still, 'Reduced motion holds the grain and lighting still');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await profile.getByText('Underneath', { exact: true }).waitFor();
    await button('Open Bento').click();
    await page.getByRole('dialog', { name: 'View Bento' }).locator('.reception-canvas, .reception-document-canvas').first().waitFor();
    await page.getByRole('dialog', { name: 'View Bento' }).press('Tab');
    await button('Close canvas').click();
    await page.getByRole('dialog', { name: 'View Bento' }).waitFor({ state: 'detached' });
    const theme = page.getByRole('switch', { name: 'Dark mode' });
    const dark = await theme.isChecked();
    await theme.press('Space');
    await page.waitForFunction(expected => document.querySelector('[role="switch"][aria-label="Dark mode"]').getAttribute('aria-checked') === String(expected), !dark);
    await button('Gallery').click();
    await page.getByRole('radio', { name: 'List view' }).check();
    const workDetails = page.getByRole('complementary', { name: 'Work details' });
    await button('Open Vision').click();
    const description = workDetails.getByText('A study of the figure in shadow.');
    await description.waitFor();
    const descriptionLabel = await workDetails.getByText('Description', { exact: true }).boundingBox();
    const dimensionsLabel = await workDetails.getByText('Dimensions', { exact: true }).boundingBox();
    assert.ok(descriptionLabel.y + descriptionLabel.height < dimensionsLabel.y);
    await button('Open Anatomy').click();
    assert.equal(await workDetails.getByText('Description', { exact: true }).count(), 0);
    const artwork = page.getByRole('group', { name: 'Anatomy canvas' });
    await artwork.waitFor();
    const details = page.getByRole('complementary', { name: 'Work details' });
    await details.getByRole('heading', { name: 'Anatomy', exact: true }).waitFor();
    const [indexBox, canvasBox, detailsBox] = await Promise.all([
      page.getByRole('navigation', { name: 'Canvases', exact: true }).boundingBox(), artwork.boundingBox(), details.boundingBox(),
    ]);
    assert.ok(indexBox.x + indexBox.width <= canvasBox.x && canvasBox.x + canvasBox.width <= detailsBox.x,
      'The public list keeps its index, artwork and matching details in three columns');
    const layoutSwitch = page.getByRole('radio', { name: 'Grid view' });
    const switchBox = await layoutSwitch.boundingBox();
    assert.equal(await layoutSwitch.innerText(), '');
    const toolbar = page.getByRole('group', { name: 'Gallery controls' });
    const toolbarBox = await toolbar.boundingBox();
    assert.ok(Math.abs(toolbarBox.x + toolbarBox.width / 2 - 800) <= 1);
    assert.ok(switchBox.y + switchBox.height <= canvasBox.y);
    assert.ok(await toolbar.getByRole('button', { name: 'Wrap around' }).isDisabled());
    const switchCenter = { x: switchBox.x + switchBox.width / 2, y: switchBox.y + switchBox.height / 2 };
    await page.mouse.click(switchCenter.x, switchCenter.y);
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.deepEqual(await layoutSwitch.boundingBox(), switchBox);
    await page.mouse.click(switchCenter.x, switchCenter.y);
    assert.ok(await layoutSwitch.isChecked(), 'Choosing the active grid keeps it selected');
    await page.getByRole('radio', { name: 'List view' }).check();
    await artwork.waitFor();
    assert.deepEqual(await layoutSwitch.boundingBox(), switchBox);
    const controls = page.locator('.composition-explorer-controls');
    const picker = await controls.getByRole('navigation', { name: 'Camera points' }).boundingBox();
    assert.ok(picker.y >= canvasBox.y + canvasBox.height && Math.abs(picker.x + picker.width / 2 - canvasBox.x - canvasBox.width / 2) <= 1);
    assert.ok(await controls.locator('button, summary').evaluateAll(items => items.every(item => item.getAttribute('aria-label') && (item.title === 'Fit artwork' ? /^\d+%$/.test(item.innerText.trim()) : !item.innerText.trim()))),
      'Only Fit artwork shows text and every footer action has an accessible name');
    for (const name of ['Zoom out', 'Zoom in', 'Complete canvas', 'Expand canvas']) {
      const icon = controls.getByRole('button', { name, exact: true }).locator('svg');
      const box = await icon.boundingBox();
      assert.equal(box?.width, Number(await icon.getAttribute('width')), `${name} renders at its intended width`);
    }
    const fit = controls.getByTitle('Fit artwork');
    const camera = () => artwork.evaluate(node => [node.dataset.cameraScale, node.dataset.cameraX, node.dataset.cameraY]);
    const fittedCamera = await camera();
    for (const activation of ['click', 'Enter', 'Space']) {
      await button('Zoom in').click();
      await artwork.press('ArrowRight');
      assert.notDeepEqual(await camera(), fittedCamera);
      if (activation === 'click') await fit.click();
      else {
        await button('Zoom out').focus();
        await page.keyboard.press('Tab');
        assert.ok(await fit.evaluate(node => node === document.activeElement));
        await page.keyboard.press(activation);
      }
      await page.waitForFunction(expected => {
        const camera = document.querySelector('.composition-explorer-viewport').dataset;
        return [camera.cameraScale, camera.cameraX, camera.cameraY].every((value, i) => value === expected[i]);
      }, fittedCamera);
    }
    await button('Zoom in').click();
    await page.waitForFunction(expected => Math.abs(Number(document.querySelector('.composition-explorer-viewport').dataset.cameraScale) - expected) < 1e-8, Math.min(4, Number(fittedCamera[0]) * 1.25));
    const zoom = await fit.textContent();
    await button('Profile').click();
    await page.getByRole('heading', { name: 'Nomad' }).waitFor();
    await checkPortrait();
    assert.ok(await profile.isVisible());
    await button('Gallery').click();
    await page.getByRole('group', { name: 'Anatomy canvas' }).waitFor();
    assert.equal(await fit.textContent(), zoom);
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await page.locator('.workbench-overview-gallery').waitFor();
    await button('Profile').click();
    await button('Gallery').click();
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.equal(await button('Open Private experiment').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('stepped Gallery zoom accumulates around the pointer and reverses from the visible scale', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&reception=published`);
    await page.getByRole('radio', { name: 'List view' }).check();
    const frame = page.locator('.composition-explorer-viewport[data-camera-scale]');
    const results = await frame.evaluate(async el => {
      const scale = () => Number(el.dataset.cameraScale);
      const box = el.getBoundingClientRect(), x = 123, y = 97;
      const wheel = deltaY => el.dispatchEvent(new WheelEvent('wheel', {
        deltaY, ctrlKey: true, clientX: box.left + x, clientY: box.top + y, cancelable: true
      }));
      const worldX = () => (x - Number(el.dataset.cameraX)) / scale();
      const initial = scale(), anchor = worldX();
      wheel(-100); wheel(-100);
      const immediate = scale();
      await new Promise(resolve => setTimeout(resolve, 240));
      const final = scale(), drift = Math.abs(worldX() - anchor);
      wheel(-100); wheel(100);
      await new Promise(resolve => setTimeout(resolve, 240));
      return { initial, immediate, final, drift, reversed: scale() };
    });
    assert.equal(results.immediate, results.initial);
    assert.ok(Math.abs(results.final - results.initial * Math.exp(.4)) < .00001);
    assert.ok(results.drift < 1);
    assert.ok(Math.abs(results.reversed - results.final * Math.exp(-.2)) < .00001);
  } finally { await browser.close(); }
});
test('tile inspection returns by Escape or backdrop while direct List browsing stays open', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&reception=published`);
    const layout = name => page.getByRole('radio', { name });
    const frame = page.locator('.composition-explorer-viewport');
    await layout('Grid view').check();
    for (const method of ['Escape', 'background']) {
      const tile = page.locator('.workbench-overview-card-open:visible').first();
      await tile.click();
      await frame.waitFor();
      await frame.click();
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      assert.ok(await layout('List view').isChecked());
      if (method === 'Escape') await page.keyboard.press('Escape');
      else await page.locator('.workbench-overview').click({ position: { x: 3, y: 3 } });
      await page.locator('.workbench-overview-gallery').waitFor();
      assert.ok(await layout('Grid view').isChecked());
    }
    await layout('List view').check();
    await frame.waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.workbench-overview').click({ position: { x: 3, y: 3 } });
    assert.ok(await layout('List view').isChecked());
  } finally { await browser.close(); }
});
test('Gallery remembers independent rails without moving the zoomed canvas', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&reception=published`);
    const layout = name => page.getByRole('radio', { name });
    const button = name => page.getByRole('button', { name, exact: true });
    await layout('List view').check();
    const frame = page.locator('.composition-explorer-viewport');
    const geometry = () => frame.evaluate(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return [x, y, width, height, node.dataset.cameraX, node.dataset.cameraY, node.dataset.cameraScale];
    });
    await button('Zoom in').click();
    const before = await geometry();
    await button('Hide info').locator('.lucide-chevron-left').waitFor();
    await button('Hide index').locator('.lucide-chevron-right').waitFor();
    await button('Hide info').focus();
    await button('Hide info').press('Enter');
    assert.ok(await button('Show info').evaluate(node => node === document.activeElement));
    assert.ok(await page.locator('.visitor-work-details').isHidden());
    assert.deepEqual(await geometry(), before);
    await layout('Grid view').check();
    assert.equal(await page.locator('.gallery-rail-toggle').count(), 0);
    await layout('List view').check();
    assert.ok(await button('Show info').isVisible());
    assert.ok(await button('Hide index').isVisible());
    await button('Hide index').click();
    await page.reload();
    await layout('List view').check();
    await button('Show index').locator('.lucide-chevron-left').waitFor();
    await button('Show info').locator('.lucide-chevron-right').waitFor();
    assert.ok(await page.locator('.composition-index-sidebar').isHidden());
    await button('Show info').click();
    assert.ok(await page.locator('.visitor-work-details').isVisible());
    assert.ok(await button('Show index').isVisible());
  } finally { await browser.close(); }
});
test('List frame grows outward, keeps both rails and caps height above the camera controls', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 700 }, reducedMotion: 'reduce' });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&reception=published`);
    await page.getByRole('radio', { name: 'List view' }).check();
    await page.getByRole('button', { name: 'Gallery options' }).click();
    const frame = page.locator('.composition-explorer-viewport'), slider = page.getByLabel('Viewport size');
    for (const width of [1920, 940]) {
      await page.setViewportSize({ width, height: 700 });
      await slider.fill('0');
      const small = await frame.boundingBox();
      const index = page.locator('.composition-index-sidebar'), info = page.locator('.visitor-work-details');
      const left = await index.boundingBox(), right = await info.boundingBox();
      assert.ok(Math.abs(small.width / small.height - 16 / 9) < .01);
      assert.ok(Math.abs(left.y - small.y) < 1 && Math.abs(right.y - small.y) < 1,
        'Both rails start at the artwork frame');
      const stage = await page.locator('.composition-explorer-stage').boundingBox();
      const body = await page.locator('.composition-index-body').boundingBox();
      assert.ok(Math.abs(stage.y + stage.height / 2 - body.y - body.height / 2) < 1,
        'The frame and controls are centered together');
      await slider.fill('80');
      const large = await frame.boundingBox();
      await slider.fill('100');
      const max = await frame.boundingBox(), footer = await page.locator('.composition-explorer-controls').boundingBox();
      assert.ok((await index.boundingBox()).x < left.x && (await info.boundingBox()).x > right.x);
      assert.ok(large.width < max.width && footer.y >= max.y + max.height - 1 && footer.y + footer.height <= 700);
      assert.ok(Math.abs(700 - footer.y - footer.height - 12) < 1, 'Maximum fills the window down to the bottom gutter');
      if (width === 1920) assert.equal(large.height, max.height);
      else assert.ok(large.height < max.height, 'A taller window uses the remaining height as the slider approaches maximum');
      assert.ok(await frame.evaluate(node => {
        const host = node.closest('.workbench-overview');
        return host.scrollHeight <= host.clientHeight && host.scrollWidth <= host.clientWidth;
      }));
    }
    await slider.press('Escape');
    await page.getByRole('button', { name: 'Open Anatomy', exact: true }).click();
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.ok(await page.locator('[data-card-id="workbench:anatomy"]').evaluateAll(cards => cards.some(card => {
      const box = card.getBoundingClientRect(), view = card.closest('.workbench-overview-gallery').getBoundingClientRect();
      return box.left >= view.left - 1 && box.right <= view.right + 1 && box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
    })));
  } finally { await browser.close(); }
});
test('Quick view returns to the clicked wrap copy and keeps the grid position', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&large-gallery=1&landscape-gallery=1&reception=published`);
    const switcher = page.getByRole('radiogroup', { name: 'Gallery layout' });
    assert.ok(await switcher.getByRole('radio', { name: 'List view' }).isChecked());
    assert.equal(await switcher.getByRole('radio').count(), 2);
    const layout = page.getByRole('radio', { name: 'Grid view' }), quick = page.getByRole('button', { name: 'Quick view' });
    await layout.check();
    assert.ok(await layout.isChecked());
    assert.equal(await quick.getAttribute('aria-pressed'), 'false');
    await quick.click();
    const gallery = page.locator('.workbench-overview-gallery');
    let inspected;
    for (const motion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: motion });
      await gallery.evaluate(host => {
        const cycle = host.querySelector('[data-gallery-cycle="0"]');
        host.scrollLeft = cycle.offsetWidth * 2 - host.clientWidth * .58;
      });
      await page.waitForFunction(() => !!document.querySelector('[data-gallery-cycle="1"]'));
      const target = await gallery.evaluate(host => {
        const bounds = host.getBoundingClientRect();
        const tile = [...host.querySelectorAll('[data-gallery-cycle]:not([data-gallery-cycle="0"]) [data-card-id]')].find(node => {
          const box = node.getBoundingClientRect();
          return box.left > bounds.left && box.right <= bounds.right && box.bottom <= bounds.bottom;
        });
        const box = tile.getBoundingClientRect();
        return { x: box.x, y: box.y, scroll: host.scrollLeft, cycle: tile.parentElement.dataset.galleryCycle, id: tile.dataset.cardId, name: tile.querySelector('.workbench-overview-card-title').textContent };
      });
      inspected = target;
      await page.mouse.click(target.x + 10, target.y + 10);
      const viewer = page.getByRole('dialog', { name: 'View ' + target.name });
      await viewer.waitFor();
      if (motion === 'reduce') {
        const dialog = page.getByRole('dialog'), frame = dialog.locator('.canvas-presentation-surface[data-ready]:not([data-moving])');
        const box = await frame.boundingBox();
        const next = dialog.getByRole('button', { name: /^Next artwork:/ });
        const previous = dialog.getByRole('button', { name: /^Previous artwork:/ });
        const side = await previous.boundingBox();
        assert.ok(side.height < box.height && side.x + side.width < box.x);
        assert.match(await dialog.evaluate(node => getComputedStyle(node, '::backdrop').backdropFilter), /blur/);
        const incomingCanvas = await next.evaluateHandle(button => button.closest('.quick-view-neighbor').querySelector('.workbench-overview-canvas'));
        await next.click();
        assert.notEqual(await dialog.getAttribute('aria-label'), 'View ' + target.name);
        assert.ok(await incomingCanvas.evaluate(canvas => canvas === document.querySelector('dialog .canvas-presentation-surface .workbench-overview-canvas')),
          'The painted neighboring canvas survives promotion to the center');
        await incomingCanvas.dispose();
        const current = await frame.boundingBox();
        const ratio = await dialog.evaluate(node => Number(node.style.getPropertyValue('--canvas-ratio')));
        assert.ok(Math.abs(current.width / current.height - ratio) < .005);
        assert.ok(Math.abs(box.width / box.height - ratio) > .5, 'Portrait and landscape retain distinct frame ratios');
        assert.ok(side.x < 0 && side.x + side.width <= 48);
        assert.equal(await dialog.evaluate(node => getComputedStyle(node).clipPath), 'none');
        const x = current.x + current.width / 2, y = current.y + current.height / 2;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y, { steps: 6 });
        const outgoing = await frame.boundingBox(), incoming = await previous.boundingBox();
        assert.ok(outgoing.width < current.width && outgoing.x > current.x && incoming.width > 0);
        await page.mouse.up();
        await viewer.waitFor();
        await viewer.press('ArrowRight');
        assert.notEqual(await dialog.getAttribute('aria-label'), 'View ' + target.name);
        await dialog.press('Escape');
      } else await viewer.press('Escape');
      if (motion === 'no-preference') {
        const frame = await page.waitForFunction(() => {
          const animated = document.querySelector('dialog[data-closing] [data-moving]')?.getAnimations()[0];
          return animated?.effect.getKeyframes().at(-1);
        });
        const end = await frame.jsonValue();
        assert.ok(Math.abs(parseFloat(end.left) - target.x) < 1 && Math.abs(parseFloat(end.top) - target.y) < 1);
      }
      await viewer.waitFor({ state: 'detached' });
      assert.equal(await gallery.evaluate(host => host.scrollLeft), target.scroll);
      assert.ok(await layout.isChecked());
    }
    await quick.click();
    await page.mouse.click(inspected.x + 10, inspected.y + 10);
    await page.getByRole('group', { name: inspected.name + ' canvas' }).waitFor();
    await layout.check();
    const copy = gallery.locator(`[data-gallery-cycle="${inspected.cycle}"] [data-card-id="${inspected.id}"]`);
    const after = await copy.boundingBox();
    assert.ok(Math.abs(inspected.x - after.x) < 1 && Math.abs(inspected.y - after.y) < 1);
    await page.getByRole('radio', { name: 'List view' }).check();
    await page.getByRole('group', { name: inspected.name + ' canvas' }).waitFor();
    await layout.check();
    await copy.waitFor();
    assert.deepEqual(await copy.boundingBox(), after, 'The toolbar round trip returns to its departure tile');
  } finally { await browser.close(); }
});
test('the first List to Grid flight lands while later script requests are held', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  let release;
  const held = new Promise(resolve => { release = resolve; });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await page.addInitScript(address => sessionStorage.setItem('inscape.gallery.view.' + address,
      JSON.stringify({ layout: 'list', selectedId: 'workbench:anatomy' })), address);
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&reception=published&owner=1`);
    await page.locator('.composition-explorer-viewport .workbench-overview-canvas').waitFor();
    await page.route('**/*', async route => {
      if (['script', 'stylesheet'].includes(route.request().resourceType())) await held;
      await route.continue();
    });
    // Exercise a first-mount adjustment after the tile's initial measurement.
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        const tile = document.querySelector('[data-card-id][data-layout-flight-target]');
        if (!tile) return;
        observer.disconnect();
        tile.closest('.workbench-overview-grid-host').style.marginTop = '48px';
      });
      observer.observe(document.querySelector('.workbench-overview'), { subtree: true, attributes: true, attributeFilter: ['data-layout-flight-target'] });
    });
    await page.getByRole('radio', { name: 'Grid view' }).check();
    const target = page.locator('.workbench-overview-card[data-layout-flight-target]');
    await target.waitFor({ state: 'attached', timeout: 4000 });
    const id = await target.getAttribute('data-card-id');
    assert.equal(id, 'workbench:anatomy');
    await page.waitForFunction(() => document.querySelector('.gallery-layout-flight .owner-canvas-journey')?.getAnimations().length);
    const landing = await page.locator('.gallery-layout-flight .owner-canvas-journey').evaluate(node => {
      const motion = node.getAnimations()[0];
      const end = motion.effect.getKeyframes().at(-1);
      const reveal = document.querySelector('.workbench-overview-grid-host').getAnimations()[0];
      return { frame: [end.left, end.top, end.width, end.height].map(parseFloat),
        synchronized: reveal && reveal.startTime === motion.startTime };
    });
    assert.equal(landing.synchronized, true, 'Tiles reveal on the same timeline as the moving work');
    await page.locator('.gallery-layout-flight').waitFor({ state: 'hidden' });
    assert.ok(await page.locator(`[data-card-id="${id}"] .workbench-overview-canvas`).first().isVisible());
    const box = await page.locator(`[data-card-id="${id}"]`).first().boundingBox();
    assert.ok([box.x, box.y, box.width, box.height].every((value, i) => Math.abs(value - landing.frame[i]) < 1),
      'The first flight ends at the settled tile');
  } finally { release(); await browser.close(); }
});
test('a short wrapped gallery centres its rows and paints the full backdrop during a mobile layout switch', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&reception=published&theme=light`);
    const grid = page.getByRole('radio', { name: 'Grid view' }), list = page.getByRole('radio', { name: 'List view' });
    await list.check();
    await page.locator('.composition-explorer-viewport').waitFor();
    await page.locator('.gallery-layout-flight').waitFor({ state: 'hidden' });
    await grid.check();
    await list.check();
    await page.waitForTimeout(150);
    assert.ok(await list.isChecked());
    assert.equal(await page.locator('.workbench-overview').getAttribute('data-layout'), 'list');
    await grid.check();
    const cycle = page.locator('[data-gallery-cycle="0"]');
    await cycle.waitFor();
    await page.locator('.gallery-layout-flight').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-gallery-cycle]').count(), 1);
    const margins = await cycle.evaluate(node => {
      const frame = node.getBoundingClientRect();
      const cards = [...node.querySelectorAll('[data-card-id]')].map(card => card.getBoundingClientRect());
      return [Math.min(...cards.map(box => box.top)) - frame.top, frame.bottom - Math.max(...cards.map(box => box.bottom))];
    });
    assert.ok(Math.abs(margins[0] - margins[1]) < 2, 'Empty tracks leave equal room above and below the works');
    await list.check();
    await page.waitForFunction(() => {
      const animations = document.querySelector('.gallery-layout-flight .owner-canvas-journey')?.getAnimations({ subtree: true });
      if (!animations?.length) return false;
      for (const animation of animations) { animation.pause(); animation.currentTime = 120; }
      return true;
    });
    const png = await page.screenshot();
    const opaque = await page.evaluate(async encoded => {
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const frame = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const context = new OffscreenCanvas(frame.width, frame.height).getContext('2d');
      context.drawImage(frame, 0, 0);
      const { data } = context.getImageData(0, 0, frame.width, frame.height);
      frame.close();
      for (let alpha = 3; alpha < data.length; alpha += 4) if (data[alpha] !== 255) return false;
      return true;
    }, png.toString('base64'));
    assert.ok(opaque, 'The moving artwork leaves the visible background fully painted');
  } finally { await browser.close(); }
});
async function enterGallery(page) {
  await page.getByRole('radio', { name: 'Grid view' }).check();
  assert.ok(await page.getByRole('radio', { name: 'Grid view' }).isChecked());
  await page.locator('.workbench-overview-gallery').waitFor();
}
test('published wrap keeps every visible SVG preview painted through wheel and touch transitions', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: touch, deviceScaleFactor: 2 });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=1&collection=1&large-gallery=1&canvas=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await enterGallery(page);
      await page.waitForTimeout(700);
      const frames = await measureGalleryScroll(page, { touch });
      await mkdir(output, { recursive: true });
      await writeFile(`${output}/wrap-${touch ? 'touch' : 'wheel'}-frames.json`, JSON.stringify(frames));
      assert.deepEqual(frames.filter(frame => frame.missing.length), [], 'No blank artwork at any sampled animation frame');
      const cycle = await page.locator('[data-gallery-cycle="0"]').boundingBox();
      for (const direction of [1, -1]) assert.ok(frames.some((frame, i) => i && frame.direction === direction &&
        (frame.scroll - frames[i - 1].scroll) * direction < -cycle.width / 4), `Input crosses a wrap in direction ${direction}`);
      await page.screenshot({ path: `${output}/wrap-${touch ? 'touch' : 'wheel'}-390.png` });
      await page.close();
    }
  } finally { await browser.close(); }
});
for (const width of [390, 1440]) test(`published gallery, wrap, shared viewer, metadata and return at ${width}`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 390 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=1&collection=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('button', { name: 'Gallery', exact: true }).click();
    await enterGallery(page);
    const before = await page.evaluate(() => ({ publication: JSON.stringify(window.__overviewPublication), local: JSON.stringify(window.__galleryStore.getBackupSnapshot()), storage: JSON.stringify({ ...localStorage }) }));
    assert.equal(await page.getByRole('button', { name: 'Open Private experiment', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^(Edit|Crop|New Workbench)/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Open Vision', exact: true }).count(), 1, 'Only one accessible collection');
    assert.equal(await page.locator('[data-gallery-cycle]').count(), 1, 'A fitting collection appears once');
    await page.locator('.workbench-overview-gallery').evaluate(node => { node.scrollLeft += 1200; });
    const tile = page.getByRole('button', { name: 'Open Anatomy', exact: true });
    await tile.scrollIntoViewIfNeeded();
    if (width === 390) { await tile.tap(); await page.getByRole('article').filter({ has: tile }).getByRole('button', { name: 'View', exact: true }).tap(); }
    else await tile.click();
    await page.getByRole('group', { name: 'Anatomy canvas' }).waitFor();
    await page.getByRole('complementary', { name: 'Work details' }).getByRole('heading', { name: 'Anatomy' }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/canvas-${width}.png` });
    await page.getByRole('radio', { name: 'Grid view' }).check();
    await page.locator('.workbench-overview-gallery').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.workbench-overview-card .navigator-object image').length > 0);
    await page.waitForTimeout(750);
    await page.screenshot({ path: `${output}/gallery-${width}.png` });
    assert.ok(await page.locator('.workbench-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Nomad', exact: true }).waitFor();
    await page.goBack();
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.deepEqual(await page.evaluate(() => ({ publication: JSON.stringify(window.__overviewPublication), local: JSON.stringify(window.__galleryStore.getBackupSnapshot()), storage: JSON.stringify({ ...localStorage }) })), before);
    assert.deepEqual(errors, []);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterGallery(page);
    assert.ok(await page.locator('.visitor-publication').evaluate(node => getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)'));
  } finally { await browser.close(); }
});
test('publication review defaults to the current canvas and names every explicitly selected addition', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?publish=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const first = page.getByRole('checkbox', { name: /Vision/ });
    await first.waitFor(); assert.equal(await first.isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: /Anatomy/ }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: /Private experiment/ }).isChecked(), false);
    assert.equal(await page.getByRole('checkbox', { name: /Profile details/ }).isChecked(), true);
    await page.getByRole('checkbox', { name: /Anatomy/ }).check();
    await page.getByRole('button', { name: 'Prepare publication', exact: true }).click();
    await page.getByRole('button', { name: 'Make presentation public', exact: true }).waitFor();
    await page.getByRole('checkbox', { name: /Anatomy/ }).uncheck();
    await page.getByRole('button', { name: 'Prepare publication', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Select all changed compositions', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: /Private experiment/ }).isChecked(), true);
  } finally { await browser.close(); }
});

test('invalid publication replacement requires current consent and invalidates prepared snapshots when withdrawn or rechecked', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?publish=1&invalid-publication=1`, { waitUntil: 'domcontentloaded' });
    const consent = page.getByRole('checkbox', { name: 'Replace the invalid publication with my selected local content', exact: true });
    const prepare = page.getByRole('button', { name: 'Prepare publication', exact: true });
    await consent.waitFor();
    assert.equal(await consent.isChecked(), false);
    assert.equal(await prepare.isDisabled(), true);
    assert.equal(await page.getByRole('checkbox', { name: /Profile details/ }).isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: /Profile details/ }).isDisabled(), true);
    assert.equal(await page.getByRole('checkbox', { name: /Private experiment/ }).isChecked(), false);
    await consent.check();
    await prepare.click();
    await page.getByRole('button', { name: 'Make presentation public', exact: true }).waitFor();
    await consent.uncheck();
    assert.equal(await prepare.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Make presentation public', exact: true }).count(), 0);
    await consent.check();
    await page.getByRole('button', { name: 'Recheck publication fixture', exact: true }).click();
    assert.equal(await consent.isChecked(), false);
    assert.equal(await prepare.isDisabled(), true);
    await consent.check();
    await page.getByRole('button', { name: 'Network failure fixture', exact: true }).click();
    assert.equal(await consent.count(), 0);
    assert.equal(await prepare.isDisabled(), true);
  } finally { await browser.close(); }
});

test('returning to the List inspector clips the artwork above the controls', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&canvas=1&collection=1&reception=published&landscape-gallery=1&theme=light`);
    await page.getByRole('radio', { name: 'List view' }).check();
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    await page.getByRole('button', { name: 'Expand canvas' }).click();
    await page.getByRole('button', { name: 'Return to index' }).click();

    const footer = await page.locator('.composition-explorer-controls').boundingBox();
    const x = Math.round(footer.x + footer.width / 2), y = Math.ceil(footer.y + footer.height + 24);
    // A clipped screenshot repaints the clipped region and masks the compositor bug.
    // Sample the same background patch in two full viewport captures instead.
    const sampleBelowFooter = async () => {
      const png = await page.screenshot();
      return page.evaluate(async ({ url, x, y }) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, x, y, 16, 16, 0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
      }, { url: `data:image/png;base64,${png.toString('base64')}`, x, y });
    };
    const visible = await sampleBelowFooter();
    await page.addStyleTag({ content: '.composition-explorer-viewport { visibility: hidden; }' });
    const background = await sampleBelowFooter();
    assert.ok(visible.every((value, i) => Math.abs(value - background[i]) < 8),
      `Artwork changed the background below its controls: ${visible} vs ${background}`);
  } finally { await browser.close(); }
});
