import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { measureGalleryScroll } from './measureGalleryScroll.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/workbench-overview';

async function seedMirroredImages(page, transparentSvg = false) {
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
    const context = canvas.getContext('2d'); context.fillStyle = '#347ca8'; context.fillRect(0, 0, 96, 96);
    return canvas.toDataURL();
  });
  const url = `https://overview.test/mirrored.${transparentSvg ? 'svg' : 'png'}`;
  await page.route(url, route => route.fulfill(transparentSvg ? { contentType: 'image/svg+xml', body:
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><path fill="#347ca8" fill-opacity=".5" fill-rule="evenodd" d="M0 0H96V96H0ZM32 32V64H64V32Z"/></svg>'
  } : { contentType: 'image/png', body: Buffer.from(source.split(',')[1], 'base64') }));
  await page.evaluate(async url => {
    const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[2].id);
    asset.media = { ...asset.media, url, width: 96, height: 96 };
    const store = window.guardedStore(), draft = store.getDraft();
    draft.workbench.area = { left: 0, top: 0, width: 1200, height: 1200 };
    draft.texts = []; draft.workbench.texts = [];
    draft.imageModules = [0, 1, 2, 3].map(i => ({ id: `image:mirror${i}`, name: `Mirror ${i}`, width: 501, height: 501, visibility: 'PRIVATE',
      sides: [{ id: `side:mirror${i}`, asset, crop: { x: .5, y: .5, zoom: 1 }, transform: { quarterTurns: 0, mirrorX: i % 2 === 1, mirrorY: i >= 2 } }] }));
    draft.workbench.imageModules = draft.imageModules.map((item, i) => ({ id: item.id, open: true,
      position: { left: 80.25 + (i % 2) * 501, top: 80.25 + Math.floor(i / 2) * 501 } }));
    draft.artworkLayers = draft.imageModules.map(item => item.id);
    if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Mirrored fixture save failed');
  }, url);
  await page.reload();
  await page.locator('.image-module__canvas').first().waitFor();
  await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); }, url);
}

async function inspectImageJoin(page, preview, label, transparentSvg = false) {
  await preview.locator('[data-navigator-object]').nth(3).waitFor();
  const frames = await preview.locator('[data-navigator-object]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  await mkdir(output, { recursive: true });
  const screenshot = await page.screenshot({ path: path.join(output, `mirrored-${label}.png`) });
  const background = await preview.locator('.workbench-overview-canvas').evaluate(node => getComputedStyle(node).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number));
  const result = await page.evaluate(async ({ png, frames, background, transparentSvg }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const density = devicePixelRatio, [first, right, below] = frames;
    const pixels = [];
    // Sample both joins and their intersection, including fractional screen edges.
    for (const [x, y] of [[right.left, first.top + first.height / 2], [first.left + first.width / 2, below.top], [right.left, below.top]]) {
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        pixels.push([...context.getImageData(Math.floor(x * density) + dx, Math.floor(y * density) + dy, 1, 1).data]);
      }
    }
    const expected = [52, 124, 168].map((value, i) => transparentSvg ? Math.round((value + background[i]) / 2) : value);
    const hole = [...context.getImageData(Math.floor((first.left + first.width / 2) * density), Math.floor((first.top + first.height / 2) * density), 1, 1).data];
    return { frames, expected, background, hole, badPixels: pixels.filter(pixel => pixel.slice(0, 3).some((value, i) => Math.abs(value - expected[i]) > 1)) };
  }, { png: screenshot.toString('base64'), frames, background, transparentSvg });
  await writeFile(path.join(output, `mirrored-${label}.json`), JSON.stringify(result, null, 2));
  return result;
}

test('mirrored Image joins stay seamless in list, grid and canvas presentation', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    for (const transparentSvg of [false, true]) for (const [width, density] of [[1440, 1], [1439, 1.25], [390, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
      await open(page); await seedMirroredImages(page, transparentSvg);
      await page.getByRole('button', { name: 'Overview', exact: true }).click(); await settlePreview(page);
      const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
      for (const mode of ['list', 'grid', 'modal', 'expanded']) {
        if (mode === 'grid') await menuAction(page, 'Grid');
        if (mode === 'modal') await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).click({ position: { x: 20, y: 20 } });
        if (mode === 'expanded') { await revealPresentation(page); await page.getByRole('button', { name: 'Expand canvas' }).click(); }
        await page.mouse.move(0, 0); await settlePreview(page);
        const preview = mode === 'modal' || mode === 'expanded' ? page.locator('.canvas-presentation-stage .workbench-overview-preview')
          : page.locator('.workbench-overview-preview').first();
        const result = await inspectImageJoin(page, preview, `${transparentSvg ? 'svg' : 'png'}-${width}-${density}-${mode}`, transparentSvg);
        assert.equal(result.badPixels.length, 0, `${width}@${density} ${mode}: ${JSON.stringify(result)}`);
        if (transparentSvg) assert.deepEqual(result.hole.slice(0, 3), result.background, 'transparent SVG cutouts stay transparent');
      }
      assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved, 'browsing preserves exact authored positions, crop and mirroring');
      await page.close();
    }
  } finally { await browser.close(); }
});
async function open(page) {
  page.setDefaultTimeout(15000);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html?seed=1&shell=1`, { timeout: 45000, waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  await page.locator('.text-window').waitFor();
}
async function menu(page, show = true) {
  const trigger = page.getByRole('button', { name: 'Inscape menu', exact: true });
  if ((await trigger.getAttribute('aria-expanded') === 'true') !== show) await trigger.click();
}
async function menuAction(page, name, touch = false) {
  await menu(page);
  const button = page.getByRole('button', { name, exact: true });
  await button[touch ? 'tap' : 'click']();
  if (['List', 'Grid', 'Wrap around'].includes(name)) await menu(page, false);
}
async function revealCard(page, name, touch = false) {
  const button = page.getByRole('button', { name: 'Open ' + name, exact: true });
  await button.scrollIntoViewIfNeeded();
  if (touch) {
    if (!await button.locator('..').getAttribute('data-revealed')) await button.tap({ position: { x: 20, y: 20 } });
  } else await button.hover({ position: { x: 20, y: 20 } });
}

async function failWrites(page, fail) {
  await page.evaluate(fail => {
    window.normalSetItem ||= Storage.prototype.setItem;
    Storage.prototype.setItem = fail ? function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw new DOMException('Full', 'QuotaExceededError');
      return window.normalSetItem.call(this, key, value);
    } : window.normalSetItem;
  }, fail);
}

async function settlePreview(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // ResizeObserver and nearby-card IntersectionObserver paint on the next frames.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Capture settled glass and framing, including the non-reduced-motion touch case.
    await Promise.all([...document.querySelectorAll('.canvas-presentation-surface, .canvas-presentation-chrome')]
      .flatMap(node => node.getAnimations()).map(animation => animation.finished.catch(() => {})));
  });
  await page.waitForFunction(() => !document.querySelector('.canvas-presentation-surface[data-moving]'));
  await page.waitForFunction(() => {
    const gallery = document.querySelector('.workbench-overview-gallery');
    if (!gallery) return true;
    const viewport = gallery.getBoundingClientRect();
    return [...gallery.querySelectorAll('.workbench-overview-card')].every(card => {
      const box = card.getBoundingClientRect();
      if (box.bottom <= viewport.top || box.top >= viewport.bottom) return true;
      const canvas = card.querySelector('.workbench-overview-canvas');
      return canvas && canvas.style.transform !== 'scale(0)';
    });
  });
}

async function revealPresentation(page) {
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  if (!await dialog.getAttribute('data-chrome-visible')) await dialog.press('Tab');
  await dialog.getByRole('button', { name: 'Close canvas', exact: true }).waitFor();
}

async function seedGallery(page) {
  await page.evaluate(() => {
    const store = window.guardedStore(), original = store.getWorkbenchId(), draft = store.getDraft();
    const colors = ['#9faba3', '#c4b39c', '#9ca4c4', '#bc8e86', '#9babbd', '#c6b374', '#91b1a8', '#b1a1b9'];
    draft.workbench.area = { left: 0, top: 0, width: 900, height: 1100 };
    draft.workbench.texts[0].window = { left: 70, top: 720, width: 760, height: 300 };
    draft.shapes = [{ id: 'shape:gallery', name: 'Study', color: colors[0], opacity: 1, visibility: 'PRIVATE' }];
    draft.workbench.shapes = [{ id: 'shape:gallery', open: true, window: { left: 70, top: 70, width: 760, height: 580 } }];
    for (let i = 0; i < 8; i++) {
      if (i > 0 && !store.createWorkbench(`Study ${i + 1}`)) throw Error('Could not create gallery fixture');
      draft.shapes[0].color = colors[i];
      draft.texts[0].article.title = `Field study ${i + 1}`;
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Could not save gallery fixture');
    }
    if (!store.switchWorkbench(original)) throw Error('Could not restore initial fixture');
  });
  await page.reload();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
}

async function seedPresentation(page) {
  for (const number of ['01', '02']) await page.route(`**/mountain_${number}.webp`, route => route.fulfill({ path: `public/assets/stage/mountains/mountain_${number}.webp`, contentType: 'image/webp' }));
  await page.evaluate(async () => {
    const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createWorkbenchIndex } = await import('/src/systemWorkflow/domain/workbenchIndex.js');
    const { defaultTextAppearance } = await import('/src/text/domain/article.js');
    const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[2].id);
    asset.name = 'Mountain study'; asset.description = 'A quiet study of the horizon.'; asset.attributes = [{ key: 'Mood', value: 'Quiet', type: null }];
    const other = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[3].id);
    other.name = 'Second artwork'; other.attributes = [{ key: 'Material', value: 'Paper', type: null }];
    const store = window.guardedStore(), draft = store.getDraft();
    draft.workbench.area = { left: 0, top: 0, width: 5000, height: 5000 };
    draft.appearance.menuSurfaceId = 'carbon';
    draft.workbench.texts[0].window = { left: 300, top: 3500, width: 4200, height: 1100 };
    draft.texts[0].article.title = 'HORIZON / FIELD NOTES';
    draft.texts[0].article.appearance = { ...defaultTextAppearance(), fontSize: 100, titleFontSize: 160, padding: { top: 80, right: 80, bottom: 80, left: 80 } };
    draft.texts[0].article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Collected fragments of a landscape. Three placements, two independent works, one composition.' }] }] };
    draft.shapes = [{ id: 'shape:ground', name: 'Ground', color: '#a9b9b1', opacity: 1, visibility: 'PRIVATE' }];
    draft.workbench.shapes = [{ id: 'shape:ground', open: true, window: { left: 0, top: 0, width: 5000, height: 5000 } }];
    draft.imageModules = [asset, asset, other].map((asset, i) => ({ id: `image:study${i}`, name: asset.name, width: 1900, height: 1300, visibility: 'PRIVATE',
      sides: [{ id: `side:study${i}`, asset, crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }));
    draft.workbench.imageModules = draft.imageModules.map((item, i) => ({ id: item.id, open: true, position: { left: 350 + (i % 2) * 2300, top: 400 + Math.floor(i / 2) * 1500 } }));
    draft.artworkLayers = ['shape:ground', ...draft.imageModules.map(item => item.id), draft.texts[0].id];
    draft.workbenchIndex = { ...createWorkbenchIndex(), destinations: [
      { id: 'workbench-view:vision', name: 'Vision', view: { left: 300, top: 300, width: 4300, height: 1500 }, visibility: 'PUBLIC' },
      { id: 'workbench-view:detail', name: 'Detail 1', view: { left: 300, top: 1800, width: 2100, height: 1500 }, visibility: 'PRIVATE' },
    ] };
    if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Presentation fixture save failed');
  });
  await page.reload(); await page.getByRole('button', { name: 'Overview', exact: true }).click();
}

test('normal motion reverses a partial canvas lift without a jump and menu and details reveal smoothly', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page); await seedPresentation(page); await menuAction(page, 'Grid');
    const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    await page.locator('.workbench-overview-navigation').evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))); });
    const menuSample = await page.getByRole('button', { name: 'Inscape menu', exact: true }).evaluate(async trigger => {
      const host = trigger.closest('header'); trigger.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const animations = host.getAnimations({ subtree: true });
      animations.forEach(animation => { animation.pause(); animation.currentTime = 100; });
      const box = host.getBoundingClientRect();
      const sample = { width: box.width, height: box.height, count: animations.length };
      animations.forEach(animation => animation.finish()); return sample;
    });
    assert.ok(menuSample.count > 2 && menuSample.width > 156 && menuSample.width < 280, JSON.stringify(menuSample));
    assert.equal(await page.locator('.workbench-overview-menu').evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
    await menu(page, false);
    await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    const continuity = await dialog.evaluate(async node => {
      const host = node.querySelector('.canvas-presentation-surface'), canvas = host.querySelector('.workbench-overview-canvas');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const animations = node.getAnimations({ subtree: true });
      animations.forEach(animation => { animation.pause(); animation.currentTime = 170; });
      const bounds = element => { const b = element.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
      const before = [...bounds(host), ...bounds(canvas)];
      node.dispatchEvent(new Event('cancel', { cancelable: true }));
      await new Promise(resolve => requestAnimationFrame(resolve));
      const closing = node.getAnimations({ subtree: true });
      closing.forEach(animation => { animation.pause(); animation.currentTime = 0; });
      const after = [...bounds(host), ...bounds(canvas)];
      closing.forEach(animation => animation.play());
      return { before, after, count: closing.length };
    });
    assert.ok(continuity.count >= 3);
    assert.ok(continuity.before.every((value, index) => Math.abs(value - continuity.after[index]) < 1), JSON.stringify(continuity));
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).click();
    await settlePreview(page); await revealPresentation(page);
    const details = dialog.getByRole('button', { name: 'Canvas details', exact: true }); await details.hover();
    await dialog.getByRole('region', { name: 'Canvas details' }).waitFor();
    const reveal = await dialog.locator('[data-panel="Canvas details"] .canvas-presentation-popover').evaluate(node => ({
      transition: getComputedStyle(node).transitionDuration, open: node.getAttribute('aria-hidden'), animations: node.getAnimations().length,
    }));
    assert.equal(reveal.open, 'false'); assert.match(reveal.transition, /0\.7s/);
    await page.mouse.move(500, 150);
    await dialog.getByRole('region', { name: 'Canvas details' }).waitFor({ state: 'hidden' });
    await details.hover(); await dialog.getByRole('region', { name: 'Canvas details' }).waitFor();
    await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); });
    await mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, 'motion-details-open.png') });
    await dialog.getByRole('button', { name: 'Expand canvas' }).click(); await settlePreview(page);
    await dialog.getByRole('button', { name: 'Return to modal' }).click(); await settlePreview(page);
    for (const name of ['View Vision', 'View Detail 1', 'Complete canvas']) {
      await revealPresentation(page);
      const camera = await dialog.getByRole('button', { name, exact: true }).evaluate(async button => {
        const surface = button.closest('.canvas-presentation-surface'), canvas = surface.querySelector('.workbench-overview-canvas');
        const bounds = () => { const box = canvas.getBoundingClientRect(); return [box.left, box.top, box.width, box.height]; };
        const before = bounds(); button.click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const animations = surface.getAnimations({ subtree: true });
        animations.forEach(animation => { animation.pause(); animation.currentTime = 0; }); const start = bounds();
        animations.forEach(animation => { animation.currentTime = 200; }); const middle = bounds();
        animations.forEach(animation => { animation.currentTime = 700; }); const end = bounds();
        animations.forEach(animation => animation.finish());
        return { before, start, middle, end };
      });
      assert.ok(camera.before.every((value, index) => Math.abs(value - camera.start[index]) < 1), `${name}: ${JSON.stringify(camera)}`);
      assert.ok(camera.middle[2] > Math.min(camera.start[2], camera.end[2]) && camera.middle[2] < Math.max(camera.start[2], camera.end[2]), `${name}: camera zoom stays animated`);
      await settlePreview(page);
    }
    // Sample the complete return, not just continuity at its first frame. A
    // prematurely thumbnail-sized stage can preserve both endpoint rectangles
    // while clipping half the painting throughout the intermediate frames.
    await dialog.evaluate(async node => {
      node.dispatchEvent(new Event('cancel', { cancelable: true }));
      await new Promise(resolve => requestAnimationFrame(resolve));
      node.getAnimations({ subtree: true }).forEach(animation => animation.pause());
    });
    for (let time = 0; time < 700; time += 35) {
      const sample = await dialog.evaluate((node, time) => {
        node.getAnimations({ subtree: true }).forEach(animation => { animation.currentTime = time; });
        const surface = node.querySelector('.canvas-presentation-surface').getBoundingClientRect();
        const stage = node.querySelector('.canvas-presentation-stage').getBoundingClientRect();
        const chrome = [...node.querySelectorAll('.canvas-presentation-chrome')];
        return { time, gaps: [stage.left - surface.left, stage.top - surface.top, surface.right - stage.right, surface.bottom - stage.bottom],
          hidden: chrome.every(element => getComputedStyle(element).opacity === '0' && element.inert) };
      }, time);
      assert.ok(sample.gaps.every(gap => Math.abs(gap) < 1), JSON.stringify(sample));
      assert.equal(sample.hidden, true, JSON.stringify(sample));
    }
    await dialog.evaluate(node => node.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('card size changes actual bounds for one canvas, and touch arrangement works without scrolling the card', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await open(page); await seedPresentation(page); await menuAction(page, 'Grid');
    const card = page.locator('[data-gallery-cycle="0"] .workbench-overview-card').first();
    const sizes = [];
    await menu(page);
    for (const value of ['1', '2', '3']) {
      await page.getByRole('slider', { name: 'Card size' }).fill(value); await settlePreview(page);
      sizes.push(await card.boundingBox());
    }
    assert.ok(sizes[0].width < sizes[1].width && sizes[1].width < sizes[2].width, JSON.stringify(sizes));
    assert.ok(sizes[0].height < sizes[1].height && sizes[1].height < sizes[2].height, JSON.stringify(sizes));
    await page.setViewportSize({ width: 390, height: 420 });
    await page.getByRole('button', { name: 'New Workbench', exact: true }).scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.workbench-overview-menu').evaluate(node => getComputedStyle(node).scrollbarWidth), 'none');
    assert.ok(await page.locator('.workbench-overview-navigation').evaluate(node => {
      const box = node.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight && box.width <= innerWidth;
    }));
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await open(touch); await seedGallery(touch); await menuAction(touch, 'Grid', true); await menu(touch);
    await touch.getByRole('slider', { name: 'Card size' }).fill('1');
    await touch.getByRole('button', { name: 'Arrange canvases', exact: true }).tap();
    const handle = await touch.getByRole('button', { name: 'Drag Workbench 1 to reorder' }).boundingBox();
    const target = await touch.locator('[data-gallery-cycle="0"] .workbench-overview-card').nth(1).boundingBox();
    const cdp = await touch.context().newCDPSession(touch);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }] });
    await touch.locator('.workbench-overview-drag-label').waitFor();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }] });
    await touch.locator('[data-drop-target]').waitFor();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.waitForFunction(() => window.guardedStore().listWorkbenches()[0].name === 'Study 2');
    assert.deepEqual(await touch.evaluate(() => window.guardedStore().listWorkbenches().slice(0, 2).map(item => item.name)), ['Study 2', 'Workbench 1']);
    await touch.getByRole('button', { name: 'Move Workbench 1 earlier' }).tap();
    assert.equal(await touch.evaluate(() => window.guardedStore().listWorkbenches()[0].name), 'Workbench 1');
    await mkdir(output, { recursive: true }); await touch.screenshot({ path: path.join(output, 'gallery-arrange-touch.png') });
  } finally { await browser.close(); }
});

test('gallery drag order, keyboard moves and card size persist while failed order saves stay unchanged', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await open(page); await seedGallery(page); await menuAction(page, 'Grid');
    const gallery = page.getByRole('region', { name: 'Workbench gallery' });
    const before = await page.evaluate(() => ({ active: window.guardedStore().getWorkbenchId(), draft: window.guardedStore().getDraft() }));
    await menu(page);
    await page.getByRole('slider', { name: 'Card size' }).fill('1');
    assert.equal(await gallery.getAttribute('data-card-size'), '1');
    assert.equal(await gallery.locator('[data-gallery-cycle="0"]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 4);
    await page.getByRole('button', { name: 'Arrange canvases', exact: true }).click();
    assert.equal(await gallery.locator('[data-gallery-cycle]').count(), 1, 'arrangement uses the finite collection');
    const handle = page.getByRole('button', { name: 'Drag Workbench 1 to reorder' });
    const from = await handle.boundingBox(), target = await gallery.locator('[data-card-id]').nth(2).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => window.guardedStore().listWorkbenches()[0].name === 'Study 2');
    const names = () => page.evaluate(() => window.guardedStore().listWorkbenches().map(item => item.name));
    assert.deepEqual((await names()).slice(0, 3), ['Study 2', 'Study 3', 'Workbench 1']);
    await page.getByRole('button', { name: 'Move Workbench 1 earlier' }).click();
    assert.deepEqual((await names()).slice(0, 3), ['Study 2', 'Workbench 1', 'Study 3']);
    await failWrites(page, true); await page.getByRole('button', { name: 'Move Workbench 1 later' }).click();
    await page.getByRole('alert').waitFor();
    assert.deepEqual((await names()).slice(0, 3), ['Study 2', 'Workbench 1', 'Study 3']);
    await failWrites(page, false); await page.getByRole('button', { name: 'Move Workbench 1 later' }).click();
    assert.deepEqual((await names()).slice(0, 3), ['Study 2', 'Study 3', 'Workbench 1']);
    assert.deepEqual(await page.evaluate(() => ({ active: window.guardedStore().getWorkbenchId(), draft: window.guardedStore().getDraft() })), before);
    await mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, 'gallery-arrange-small.png') });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.reload(); await page.getByRole('button', { name: 'Overview', exact: true }).click(); await menuAction(page, 'Grid');
    assert.equal(await gallery.getAttribute('data-card-size'), '1');
    assert.deepEqual((await names()).slice(0, 3), ['Study 2', 'Study 3', 'Workbench 1']);
    await page.setViewportSize({ width: 390, height: 844 }); await menu(page); await page.getByRole('slider', { name: 'Card size' }).fill('3');
    await menu(page, false); await settlePreview(page);
    assert.equal(await gallery.locator('[data-gallery-cycle="0"]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 1);
    await page.screenshot({ path: path.join(output, 'gallery-large-narrow.png') });
  } finally { await browser.close(); }
});

test('gallery keeps artwork on hover, reveals bounded titles and actions, and combines navigation in one glass menu', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page); await seedPresentation(page);
    await page.evaluate(() => {
      const store = window.guardedStore(), draft = store.getDraft(), original = store.getWorkbenchId();
      store.updateWorkbenchDetails(original, { name: 'Horizon', introduction: 'Collected fragments of a landscape.' });
      for (const [name, color] of [['A long composition title with enough room for one more study', '#b8a078'], ['Quiet study', '#97a5bb']]) {
        if (!store.createWorkbench(name)) throw Error('Create reveal fixture failed');
        draft.shapes[0].color = color;
        if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Save reveal fixture failed');
      }
      store.switchWorkbench(original);
    });
    await page.reload(); await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await menuAction(page, 'Grid');
    const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const card = page.getByRole('button', { name: 'Open Horizon', exact: true }).locator('..');
    await page.mouse.move(1, 1); await settlePreview(page);
    assert.equal(await card.locator('.workbench-overview-card-reveal').evaluate(node => getComputedStyle(node).opacity), '0', 'no title or actions at rest');
    const canvas = await card.locator('.workbench-overview-canvas').evaluate(node => node.outerHTML);
    await revealCard(page, 'Horizon');
    assert.equal(await card.locator('.workbench-overview-card-reveal').evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await card.locator('.workbench-overview-canvas').evaluate(node => node.outerHTML), canvas, 'hover preserves the rendered composition');
    assert.equal(await card.locator('.workbench-overview-card-open').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)', 'generic hover cannot paint over the artwork');
    assert.equal(await card.locator('.workbench-overview-preview').evaluate(node => getComputedStyle(node).opacity), '1');
    assert.equal(await page.locator('.workbench-overview-detail, .workbench-overview-card-details').count(), 0);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'gallery-hover.png') });
    await card.getByRole('button', { name: 'Information for Horizon' }).click();
    assert.equal(await card.locator('.workbench-overview-card-information p').innerText(), 'Collected fragments of a landscape.');
    await page.mouse.move(1, 1);
    assert.equal(await card.locator('.workbench-overview-card-reveal').evaluate(node => getComputedStyle(node).opacity), '0');
    await menu(page);
    assert.equal(await page.getByRole('group', { name: 'Overview layout' }).count(), 1);
    assert.equal(await page.locator('.workbench-overview-navigation').evaluate(node => getComputedStyle(node).backdropFilter), 'blur(10px)');
    await page.screenshot({ path: path.join(output, 'gallery-menu.png') });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Inscape menu' }).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Inscape menu');
    await menu(page); await page.mouse.click(1, 1);
    assert.equal(await page.getByRole('region', { name: 'Inscape menu' }).count(), 0, 'outside press closes the menu');
    await page.keyboard.press('Tab');
    await page.getByRole('button', { name: 'Open Horizon', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Edit Horizon');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await revealCard(page, 'A long composition title with enough room for one more study');
      const title = page.locator('[data-gallery-cycle="0"] .workbench-overview-card-title').nth(1);
      assert.ok(await title.evaluate(node => node.clientHeight <= parseFloat(getComputedStyle(node).lineHeight) * 3 + 1));
      await menu(page); await settlePreview(page);
      await page.screenshot({ path: path.join(output, 'gallery-menu-' + width + '.png') });
      assert.ok(await page.locator('.workbench-overview-menu').evaluate(node => {
        const box = node.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 0;
      }));
      await menu(page, false);
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('canvas inspection fits 5K, reuses source metadata and saved views, and returns without saving or activating', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page); await seedPresentation(page);
    await menuAction(page, 'Grid');
    const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const gallery = page.getByRole('region', { name: 'Workbench gallery' });
    const scroll = await gallery.evaluate(node => node.scrollTop);
    await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'View Workbench 1' }); await dialog.waitFor();
    assert.equal(await page.locator('.text-window, .workbench-navigator, iframe').count(), 0);
    assert.equal(await dialog.evaluate(node => node === document.activeElement), true);
    assert.equal(await dialog.getAttribute('data-chrome-visible'), null, 'inspection opens with the artwork alone');
    await mkdir(output, { recursive: true }); await settlePreview(page);
    await page.screenshot({ path: path.join(output, 'canvas-clean-opening.png') });
    await page.getByRole('button', { name: 'Inscape menu', exact: true }).evaluate(node => node.focus());
    assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, 'background cannot take focus while modal is open');
    const stageBox = await dialog.locator('.canvas-presentation-stage').boundingBox();
    await page.mouse.move(stageBox.x + 40, stageBox.y + 80);
    await dialog.getByRole('button', { name: 'Canvas details', exact: true }).hover();
    await dialog.getByRole('region', { name: 'Canvas details', exact: true }).waitFor();
    await page.mouse.move(700, 100);
    await dialog.getByRole('region', { name: 'Canvas details', exact: true }).waitFor({ state: 'hidden' });
    await dialog.getByRole('button', { name: 'Artwork info', exact: true }).click();
    const source = dialog.getByRole('combobox', { name: 'Artwork source' });
    assert.equal(await source.locator('option').count(), 3, 'one source per artwork, not per placement');
    await source.selectOption({ label: 'Mountain study (2 placements)' });
    await dialog.getByText('Quiet', { exact: true }).waitFor();
    assert.equal(await dialog.locator('.canvas-presentation-highlight').count(), 2);
    await mkdir(output, { recursive: true }); await settlePreview(page);
    await page.screenshot({ path: path.join(output, 'canvas-artwork-info.png') });
    await source.selectOption({ label: 'Second artwork' });
    await dialog.getByText('Paper', { exact: true }).waitFor();
    assert.equal(await dialog.getByText('Quiet', { exact: true }).count(), 0, 'traits never merge across artworks');
    await page.keyboard.press('Escape');
    assert.equal(await source.count(), 0);
    assert.equal(await dialog.locator('.canvas-presentation-highlight').first().isVisible(), false, 'closing metadata clears visual highlighting');
    await dialog.getByRole('button', { name: 'View Detail 1', exact: true }).click();
    assert.equal(await dialog.getByRole('button', { name: 'View Detail 1', exact: true }).getAttribute('aria-pressed'), 'true');
    await dialog.getByRole('button', { name: 'Expand canvas', exact: true }).click();
    await dialog.getByRole('button', { name: 'Camera index', exact: true }).click();
    assert.equal(await dialog.getByRole('button', { name: 'View Detail 1', exact: true }).getAttribute('aria-pressed'), 'true');
    await mkdir(output, { recursive: true }); await settlePreview(page);
    await page.screenshot({ path: path.join(output, 'canvas-expanded-index.png') });
    await dialog.getByRole('button', { name: 'Return to modal', exact: true }).click();
    await dialog.getByRole('button', { name: 'Complete canvas', exact: true }).first().click();
    await dialog.getByRole('button', { name: 'Close index', exact: true }).click();
    assert.equal(await dialog.locator('.navigator-media-missing').count(), 0, 'representative artwork loads');
    for (const width of [1440, 800, 390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await settlePreview(page);
      assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      const fit = await dialog.locator('.workbench-overview-canvas').evaluate(node => {
        const box = node.getBoundingClientRect(), host = node.parentElement.getBoundingClientRect();
        return box.left >= host.left - 1 && box.right <= host.right + 1 && box.top >= host.top - 1 && box.bottom <= host.bottom + 1;
      });
      assert.ok(fit, `${width}: whole 5K canvas fits`);
      await page.screenshot({ path: path.join(output, `canvas-modal-${width}.png`) });
    }
    await dialog.getByRole('button', { name: 'Canvas details', exact: true }).focus();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement.getAttribute('aria-label') === 'Open Workbench 1');
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved);
    assert.equal(await gallery.evaluate(node => node.scrollTop), scroll);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('inspection supports touch details, one info panel and closing during the lift', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page); await seedPresentation(page);
    const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const trigger = page.getByRole('button', { name: 'Open Workbench 1', exact: true });
    await trigger.tap();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    await trigger.tap();
    await page.locator('.canvas-presentation-stage').tap();
    await page.getByRole('button', { name: 'Close canvas', exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Canvas details', exact: true }).tap();
    await dialog.getByRole('region', { name: 'Canvas details', exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Artwork info', exact: true }).tap();
    await dialog.getByRole('region', { name: 'Artwork info', exact: true }).waitFor();
    assert.equal(await dialog.locator('.canvas-presentation-popover[aria-hidden="false"]').count(), 1);
    await dialog.getByRole('combobox', { name: 'Artwork source' }).selectOption({ label: 'Mountain study (2 placements)' });
    await mkdir(output, { recursive: true }); await settlePreview(page);
    await page.screenshot({ path: path.join(output, 'canvas-touch-metadata.png') });
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Camera index', exact: true }).tap();
    await dialog.getByRole('navigation', { name: 'Saved camera views' }).getByRole('button', { name: /Detail 1/ }).tap();
    assert.equal(await dialog.getByRole('complementary', { name: 'Camera index' }).count(), 0, 'choosing a camera point clears the narrow drawer');
    await dialog.getByRole('button', { name: 'Expand canvas', exact: true }).tap();
    assert.equal(await dialog.getByRole('button', { name: 'View Detail 1', exact: true }).getAttribute('aria-pressed'), 'true');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true);
    }
    await dialog.getByRole('button', { name: 'Close canvas', exact: true }).tap(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('thumbnail crop supports drag, touch, cancel, failed save, reload and return to automatic fill', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: touch ? 390 : 1440, height: touch ? 844 : 1000 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await open(page); await seedPresentation(page);
      const original = await page.evaluate(() => window.guardedStore().readWorkbench(window.guardedStore().getWorkbenchId()));
      await menuAction(page, 'Grid');
      const startCrop = async () => {
        await revealCard(page, 'Workbench 1', touch);
        await page.getByRole('button', { name: 'Crop Workbench 1', exact: true }).click();
        await page.getByRole('button', { name: 'Reposition thumbnail', exact: true }).waitFor();
      };
      await startCrop();
      const zoom = page.getByRole('slider', { name: 'Thumbnail zoom' });
      await zoom.fill('2');
      const reposition = page.getByRole('button', { name: 'Reposition thumbnail', exact: true });
      await settlePreview(page);
      const box = await reposition.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (touch) {
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 45, y: y - 30, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
      } else {
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 45, y - 30, { steps: 5 }); await page.mouse.up();
      }
      await reposition.press('ArrowLeft');
      await settlePreview(page);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: path.join(output, touch ? 'thumbnail-crop-touch.png' : 'thumbnail-crop-desktop.png') });
      await failWrites(page, true); await page.getByRole('button', { name: 'Save crop', exact: true }).click();
      assert.match(await page.getByRole('alert').innerText(), /Could not save/);
      assert.equal(await page.evaluate(() => window.guardedStore().readWorkbench(window.guardedStore().getWorkbenchId()).thumbnailCrop), null);
      await failWrites(page, false); await page.getByRole('button', { name: 'Save crop', exact: true }).click();
      await page.getByRole('button', { name: 'Save crop', exact: true }).waitFor({ state: 'hidden' });
      const savedCrop = await page.evaluate(() => window.guardedStore().readWorkbench(window.guardedStore().getWorkbenchId()).thumbnailCrop);
      assert.equal(savedCrop.zoom, 2); assert.notEqual(savedCrop.x, .5); assert.notEqual(savedCrop.y, .5);
      await startCrop();
      await zoom.fill('3'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.guardedStore().readWorkbench(window.guardedStore().getWorkbenchId()).thumbnailCrop), savedCrop);
      await page.waitForFunction(() => document.activeElement.getAttribute('aria-label') === 'Open Workbench 1');
      await page.reload(); await page.getByRole('button', { name: 'Overview', exact: true }).click();
      await menuAction(page, 'Grid');
      assert.deepEqual(await page.evaluate(() => window.guardedStore().readWorkbench(window.guardedStore().getWorkbenchId()).thumbnailCrop), savedCrop);
      await settlePreview(page);
      await page.screenshot({ path: path.join(output, touch ? 'cropped-gallery-touch.png' : 'cropped-gallery-desktop.png') });
      await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor(); await settlePreview(page);
      assert.ok(await dialog.locator('.workbench-overview-canvas').evaluate(node => {
        const canvas = node.getBoundingClientRect(), stage = node.parentElement.getBoundingClientRect();
        return canvas.left >= stage.left - 1 && canvas.top >= stage.top - 1 && canvas.right <= stage.right + 1 && canvas.bottom <= stage.bottom + 1;
      }), 'opening ignores the thumbnail crop and fits the complete composition');
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      await startCrop(); await page.getByRole('button', { name: 'Auto fill', exact: true }).click();
      await page.getByRole('button', { name: 'Save crop', exact: true }).click();
      const final = await page.evaluate(() => window.guardedStore().readWorkbench(window.guardedStore().getWorkbenchId()));
      assert.equal(final.thumbnailCrop, null); assert.deepEqual(final.draft, original.draft);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('eight-canvas wrap preserves painted content at every frame and unloads distant compositions', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 913 }, deviceScaleFactor: 1.25 });
    await open(page); await seedGallery(page); await menuAction(page, 'Grid'); await settlePreview(page);
    const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const frames = await measureGalleryScroll(page);
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'wrap-eight-frames.json'), JSON.stringify(frames));
    assert.deepEqual(frames.filter(frame => frame.missing.length), [], 'No partial blank rows during a wrap');
    for (const direction of [1, -1]) assert.ok(frames.some((frame, i) => i && frame.direction === direction &&
      (frame.scroll - frames[i - 1].scroll) * direction < -200), `Both directions wrap: ${direction}`);
    await page.screenshot({ path: path.join(output, 'wrap-eight-1440.png') });
    await page.setViewportSize({ width: 390, height: 900 }); await settlePreview(page);
    assert.ok(await page.locator('.workbench-overview-card:not(:has(.workbench-overview-preview))').count() > 0, 'Distant compositions remain unloaded');
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved);
  } finally { await browser.close(); }
});

test('grid wraps both ways without writes, exposes one keyboard collection and remembers its view after opening', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page); await seedGallery(page);
    const saved = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    await menuAction(page, 'Grid');
    const gallery = page.getByRole('region', { name: 'Workbench gallery' });
    await gallery.waitFor();
    assert.equal(await gallery.getByRole('button', { name: /^Open / }).count(), 8);
    assert.equal(await page.locator('[data-gallery-cycle]').count(), 3);
    await menu(page);
    assert.equal(await page.getByRole('button', { name: 'New Workbench', exact: true }).isDisabled(), true);
    await menu(page, false);
    for (const offset of [123, -123, 41, -41]) {
      await gallery.evaluate((node, offset) => {
        const height = node.querySelector('[data-gallery-cycle="0"]').getBoundingClientRect().height;
        node.scrollTop = height * (offset > 0 ? 2 : 1) - node.clientHeight / 2 + offset;
      }, offset);
      await page.waitForFunction(offset => {
        const node = document.querySelector('.workbench-overview-gallery'), height = node.querySelector('[data-gallery-cycle="0"]').getBoundingClientRect().height;
        const expected = height - node.clientHeight / 2 + (offset > 0 ? offset : height + offset);
        return Math.abs(node.scrollTop - expected) < 2;
      }, offset);
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), saved, 'view changes and wrapping never persist or activate');
    assert.equal(await gallery.locator('iframe, [contenteditable="true"]').count(), 0);
    assert.ok(await gallery.locator('.workbench-overview-preview').count() <= 24, 'preview copies remain bounded to the visual cycles');
    await gallery.getByRole('button', { name: 'Open Workbench 1', exact: true }).focus();
    const tabOrder = [];
    for (let i = 0; i < 32; i++) {
      tabOrder.push(await page.evaluate(() => ({ name: document.activeElement.getAttribute('aria-label'), cycle: document.activeElement.closest('[data-gallery-cycle]')?.dataset.galleryCycle })));
      await page.keyboard.press('Tab');
    }
    assert.equal(new Set(tabOrder.map(item => item.name)).size, 32, JSON.stringify(tabOrder));
    assert.ok(tabOrder.every(item => item.cycle === '0'), 'duplicate visual tiles never enter the tab order');
    await revealCard(page, 'Study 3');
    await gallery.getByRole('button', { name: 'Information for Study 3', exact: true }).click();
    assert.equal(await page.locator('.workbench-overview-detail').count(), 0, 'information remains inside the tile');
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await page.getByLabel(/Introduction/).fill('An introduction for the gallery.');
    assert.equal(await page.getByRole('button', { name: 'Inscape menu', exact: true }).isDisabled(), true);
    assert.equal(await page.locator('.workbench-overview-grid-host[inert]').count(), 1);
    await failWrites(page, true); await page.getByRole('button', { name: 'Save details', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /Could not save/);
    await failWrites(page, false); await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await page.waitForFunction(() => document.activeElement.getAttribute('aria-label') === 'Open Study 3');
    await revealCard(page, 'Study 3');
    await page.getByRole('button', { name: 'Information for Study 3', exact: true }).click();
    assert.equal(await page.locator('[data-gallery-cycle="0"] .workbench-overview-card-information p').innerText(), 'An introduction for the gallery.');
    await menuAction(page, 'List');
    await page.getByRole('heading', { name: 'Study 3', exact: true }).waitFor();
    await menuAction(page, 'Grid');
    await gallery.waitFor();
    await mkdir(output, { recursive: true });
    for (const width of [2560, 1440, 800, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await gallery.getByRole('button', { name: 'Open Workbench 1', exact: true }).focus();
      await settlePreview(page);
      await page.screenshot({ path: path.join(output, `grid-${width}.png`) });
      assert.ok(await gallery.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      assert.ok(await gallery.locator('.workbench-overview-canvas').evaluateAll(nodes => nodes.every(node => {
        const canvas = node.getBoundingClientRect(), tile = node.closest('.workbench-overview-card').getBoundingClientRect();
        return canvas.left <= tile.left + 1 && canvas.top <= tile.top + 1 && canvas.right >= tile.right - 1 && canvas.bottom >= tile.bottom - 1;
      })), 'automatic crop fills every tile, including behind its floating caption');
      assert.ok(await page.locator('.workbench-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      assert.ok(await page.getByRole('button', { name: 'Inscape menu', exact: true }).evaluate(node => {
        const controls = node.getBoundingClientRect(), gallery = document.querySelector('.workbench-overview-gallery').getBoundingClientRect();
        return controls.width < 160 && gallery.bottom > controls.bottom && innerHeight - gallery.bottom <= 12 && gallery.top <= 12;
      }), 'One compact menu floats over the gallery without a reserved header or footer');
      assert.ok(await page.getByRole('button', { name: 'Inscape menu', exact: true }).evaluate(node => {
        const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }));
    }
    // A visible tile in the preceding visual cycle opens the same saved workbench.
    await gallery.evaluate(node => {
      node.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
      const height = node.querySelector('[data-gallery-cycle="0"]').getBoundingClientRect().height;
      node.scrollTop = height - 200;
    });
    const repeated = await gallery.evaluate(node => {
      const viewport = node.getBoundingClientRect();
      for (const button of node.querySelectorAll('[data-gallery-cycle="-1"] .workbench-overview-card-open')) {
        const box = button.getBoundingClientRect(), top = Math.max(viewport.top, box.top), bottom = Math.min(viewport.bottom, box.bottom);
        if (bottom - top > 60) return { x: box.left + 30, y: (top + bottom) / 2, name: button.getAttribute('aria-label').slice(5) };
      }
      throw Error('No repeated tile visible');
    });
    const beforeInspection = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const beforeInspectionScroll = await gallery.evaluate(node => node.scrollTop);
    await page.mouse.click(repeated.x, repeated.y);
    await page.getByRole('dialog', { name: `View ${repeated.name}`, exact: true }).waitFor();
    await revealPresentation(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Close canvas', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await gallery.evaluate(node => node.scrollTop), beforeInspectionScroll, 'closing a repeated tile retains the wrapped gallery position');
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), beforeInspection);
    await page.mouse.click(repeated.x, repeated.y);
    await revealPresentation(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Edit canvas', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Active Workbench' }).locator('option:checked').innerText(), repeated.name);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await gallery.waitFor();
    await menu(page);
    assert.equal(await page.getByRole('button', { name: 'Grid', exact: true }).getAttribute('aria-pressed'), 'true');
    await menuAction(page, 'Wrap around');
    assert.equal(await page.locator('[data-gallery-cycle]').count(), 1);
    await gallery.getByRole('button', { name: 'Open Study 8', exact: true }).press('Enter');
    await revealPresentation(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Edit canvas', exact: true }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await gallery.waitFor();
    await menu(page);
    assert.equal(await page.getByRole('button', { name: 'Wrap around', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('touch grid handles a single canvas, creation, details and opening without changing saved geometry', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await open(page);
    await page.getByRole('button', { name: 'Overview', exact: true }).tap();
    const before = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    await menuAction(page, 'Grid', true);
    const gallery = page.getByRole('region', { name: 'Workbench gallery' });
    await gallery.waitFor();
    await menu(page);
    assert.equal(await page.getByRole('button', { name: 'Wrap around', exact: true }).isDisabled(), true);
    await menu(page, false);
    assert.equal(await page.locator('[data-gallery-cycle]').count(), 1);
    await revealCard(page, 'Workbench 1', true);
    assert.equal(await page.getByRole('dialog').count(), 0, 'first tap reveals controls without opening');
    await page.getByRole('button', { name: 'Information for Workbench 1', exact: true }).tap();
    assert.equal(await page.locator('.workbench-overview-detail').count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), before);
    await menuAction(page, 'New Workbench', true);
    await page.getByLabel('Workbench name', { exact: true }).fill('An empty composition');
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).tap();
    await gallery.waitFor();
    assert.equal(await gallery.getByRole('button', { name: /^Open / }).count(), 2);
    await revealCard(page, 'An empty composition', true);
    assert.equal(await gallery.locator('.workbench-overview-empty').count(), 0, 'empty thumbnail has no placeholder competing with its reveal');
    await page.getByRole('button', { name: 'Information for An empty composition', exact: true }).tap();
    assert.equal(await page.getByRole('button', { name: 'Edit details', exact: true }).isVisible(), true);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'grid-touch-details.png') });
    await revealCard(page, 'Workbench 1', true);
    await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).tap({ position: { x: 20, y: 20 } });
    await revealPresentation(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Edit canvas', exact: true }).tap();
    await page.locator('.text-window').waitFor();
    const initial = JSON.parse(before).workbenches[0].content;
    assert.deepEqual(await page.evaluate(() => window.savedDraft().workbenches[0].content), initial);
  } finally { await browser.close(); }
});
test('overview browses without activation, saves optional details, and opens only the chosen canvas', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const assertWorkbenchFocus = async () => {
      const button = page.getByRole('navigation', { name: 'Named Workbenches' }).getByRole('button', { name: /Workbench 1/ });
      const target = await button.elementHandle();
      try {
        // Mount uses a passive effect; Canvases returns focus on the next frame.
        // Await that actual destination within open()'s existing 15-second limit.
        await page.waitForFunction(node => node === document.activeElement, target);
        assert.ok(await button.evaluate(node => node === document.activeElement));
      } finally { await target?.dispose(); }
    };
    await open(page);
    await page.getByRole('button', { name: 'Canvas size', exact: true }).click();
    await page.getByRole('button', { name: 'Fit canvas to content', exact: true }).click();
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('heading', { name: 'Canvases', exact: true }).waitFor();
    await assertWorkbenchFocus();
    await menu(page);
    assert.match(await page.locator('.workbench-overview-identity').innerText(), /Local storage verification/);
    assert.equal(await page.getByRole('button', { name: 'Canvases', exact: true }).getAttribute('aria-current'), 'page');
    await menuAction(page, 'Canvases');
    assert.equal(await page.locator('.application-interface').evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    assert.equal(await page.getByRole('button', { name: 'Edit details', exact: true }).evaluate(button => {
      const box = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), true, 'overview controls receive real pointer hits through the production shell');
    await assertWorkbenchFocus();
    assert.equal(await page.locator('.text-window, .workbench-navigator, iframe').count(), 0);
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await page.getByLabel('Workbench name', { exact: true }).fill('Lunar Desert');
    await page.getByLabel(/Introduction/).fill('An open landscape, collected in small studies.');
    assert.equal(await page.getByRole('button', { name: 'Inscape menu', exact: true }).isDisabled(), true);
    await failWrites(page, true);
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /Could not save/);
    assert.equal(await page.getByLabel(/Introduction/).inputValue(), 'An open landscape, collected in small studies.');
    await failWrites(page, false);
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await page.getByRole('heading', { name: 'Lunar Desert' }).waitFor();
    await menuAction(page, 'New Workbench');
    await page.getByLabel('Workbench name', { exact: true }).fill('Studies');
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).click();
    await page.getByRole('heading', { name: 'Studies', exact: true }).waitFor();
    assert.match(await page.locator('.workbench-overview-empty').innerText(), /Nothing on the canvas/);
    const secondId = await page.evaluate(() => window.savedDraft().activeId);
    const beforeSelection = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    const lunarRow = page.getByRole('navigation', { name: 'Named Workbenches' }).getByRole('button', { name: /Lunar Desert/ });
    await lunarRow.hover();
    await page.getByRole('heading', { name: 'Lunar Desert' }).waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), beforeSelection);
    assert.equal(await page.evaluate(() => window.savedDraft().activeId), secondId);
    assert.equal(await page.locator('.workbench-overview-introduction').innerText(), 'An open landscape, collected in small studies.');
    assert.equal(await page.locator('.workbench-overview-preview [contenteditable="true"], .workbench-overview-preview iframe').count(), 0);
    assert.ok(await page.locator('.workbench-overview-preview [inert]').count());
    await lunarRow.focus();
    await page.keyboard.press('Tab');
    await page.getByRole('img', { name: 'Preview of Studies' }).waitFor();
    await page.keyboard.press('Shift+Tab');
    await page.getByRole('img', { name: 'Preview of Lunar Desert' }).waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), beforeSelection, 'hover and keyboard browsing never write or activate a draft');
    await mkdir(output, { recursive: true });
    for (const width of [2560, 1440, 1024, 800, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await settlePreview(page);
      await page.screenshot({ path: path.join(output, `overview-${width}.png`) });
      assert.ok(await page.locator('.workbench-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      if (width >= 1024) assert.ok((await page.locator('.workbench-overview-preview').boundingBox()).width > 400);
    }
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.getByRole('button', { name: 'View canvas', exact: true }).scrollIntoViewIfNeeded();
    assert.ok((await page.locator('.workbench-overview-navigation').boundingBox()).y >= 0, 'profile navigation remains visible while browsing the right column');
    assert.ok((await page.locator('.workbench-overview-stage').boundingBox()).y >= 0, 'composition preview stays visible while details scroll');
    await failWrites(page, true);
    await lunarRow.press('Enter');
    await page.getByRole('dialog', { name: 'View Lunar Desert' }).waitFor();
    await revealPresentation(page);
    assert.equal(await page.evaluate(() => window.savedDraft().activeId), secondId, 'viewing does not activate the editor');
    await page.getByRole('dialog').getByRole('button', { name: 'Edit canvas', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /Could not save/);
    assert.equal(await page.evaluate(() => window.savedDraft().activeId), secondId);
    await failWrites(page, false);
    await page.getByRole('dialog').getByRole('button', { name: 'Edit canvas', exact: true }).click();
    await page.locator('.text-window').waitFor();
    assert.notEqual(await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue(), secondId);
    await page.reload(); await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('heading', { name: 'Lunar Desert' }).waitFor();
    assert.equal(await page.locator('.workbench-overview-introduction').innerText(), 'An open landscape, collected in small studies.');
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await page.getByLabel(/Introduction/).fill(''); await page.getByRole('button', { name: 'Save details', exact: true }).click();
    assert.equal(await page.locator('.workbench-overview-introduction').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Edit details', exact: true }).evaluate(node => node === document.activeElement), true);
    await page.getByRole('button', { name: 'Edit details', exact: true }).click();
    await page.getByLabel('Workbench name', { exact: true }).fill('Discard this name');
    await page.getByLabel('Workbench name', { exact: true }).press('Escape');
    await page.getByRole('heading', { name: 'Lunar Desert' }).waitFor();
    await menuAction(page, 'About');
    await page.getByText('Published view requested', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('touch opens a row directly and long names and details stay usable on a narrow screen', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await open(page);
    await page.getByRole('button', { name: 'Overview', exact: true }).tap();
    await menuAction(page, 'New Workbench', true);
    const name = 'A long composition title with enough room for one more study';
    await page.getByLabel('Workbench name', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).tap();
    await page.getByRole('button', { name: 'Edit details', exact: true }).tap();
    await page.getByLabel(/Introduction/).fill('A landscape in progress. '.repeat(11));
    await page.getByRole('button', { name: 'Save details', exact: true }).tap();
    assert.ok(await page.locator('.workbench-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await menu(page);
    assert.ok((await page.getByRole('button', { name: 'About', exact: true }).boundingBox()).y >= 0);
    await menu(page, false);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'overview-touch-details.png') });
    const before = await page.evaluate(() => JSON.stringify(window.savedDraft()));
    await menuAction(page, 'Canvases', true);
    assert.equal(await page.evaluate(() => JSON.stringify(window.savedDraft())), before);
    await page.getByRole('button', { name: 'Open Workbench 1', exact: true }).tap();
    await revealPresentation(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Edit canvas', exact: true }).tap();
    await page.locator('.text-window').waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Active Workbench' }).locator('option:checked').innerText(), 'Workbench 1');
  } finally { await browser.close(); }
});

test('failed departure keeps the live editor and mixed-content previews never start an HTML runtime', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await page.route('**/mountain_01.webp', route => route.fulfill({ path: 'public/assets/stage/mountains/mountain_01.webp', contentType: 'image/webp' }));
    await failWrites(page, true); await page.getByRole('button', { name: 'Overview', exact: true }).click();
    assert.equal(await page.locator('.workbench-overview').count(), 0); assert.equal(await page.locator('.text-window').count(), 1);
    await failWrites(page, false);
    await page.evaluate(async () => {
      const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[2].id);
      const store = window.guardedStore(), draft = store.getDraft();
      draft.workbench.area = { left: 0, top: 0, width: 1200, height: 800 };
      draft.texts[0].article.title = 'Field notes';
      draft.texts[0].article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: Array.from({ length: 120 }, (_, i) => `A study of light ${i}.`).join(' ') }] }] };
      draft.workbench.texts[0].window = { left: 50, top: 50, width: 340, height: 260 };
      draft.workbench.texts[0].frames = [{ id: 'text-frame:continuation', window: { left: 50, top: 350, width: 340, height: 350 } }];
      draft.shapes = [{ id: 'shape:preview', name: 'Sand', color: '#c7c1b5', opacity: 1, visibility: 'PRIVATE' }];
      draft.workbench.shapes = [{ id: 'shape:preview', open: true, window: { left: 430, top: 30, width: 710, height: 400 } }];
      draft.imageModules = [{ id: 'image:preview', name: 'Mountain study', width: 340, height: 340, visibility: 'PRIVATE', sides: [{ id: 'side:preview', asset, crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }];
      draft.workbench.imageModules = [{ id: 'image:preview', open: true, position: { left: 580, top: 40 } }];
      draft.miniApps = [{ id: 'miniapp:preview', name: 'Orbit study', url: 'https://example.com/never-run', visibility: 'PRIVATE', surface: 'artwork' }];
      draft.workbench.miniApps = [{ id: 'miniapp:preview', open: true, window: { left: 550, top: 470, width: 500, height: 250 } }];
      if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Fixture save failed');
    });
    await page.reload(); await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.locator('.workbench-overview').waitFor();
    assert.equal(await page.locator('.workbench-overview [data-navigator-object="shape:preview"]').count(), 1);
    assert.equal(await page.locator('.workbench-overview iframe').count(), 0);
    assert.match(await page.locator('.workbench-overview-interactive').innerText(), /Orbit study/);
    await page.waitForFunction(() => [...document.querySelectorAll('.workbench-overview .text-flow-visible .text-document-body')].every(node => node.textContent.length > 20));
    const frames = page.locator('.workbench-overview .text-flow-visible');
    assert.equal(await frames.count(), 2);
    assert.notEqual(await frames.nth(0).innerText(), await frames.nth(1).innerText());
    assert.equal(await frames.locator('.text-document-title').count(), 1);
    assert.equal(await page.locator('.workbench-overview [data-navigator-object="image:preview"] svg image').count(), 1);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'overview-mixed.png') });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
