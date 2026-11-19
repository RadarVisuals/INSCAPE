import { editorDestination, receptionPreviewControls, editorCommand } from './fixtures/editor-menu.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://localhost:5173';
const output = '.verification/reception-tiling';
const snapshot = page => page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception);
const world = (value, id) => value.workbench.shapes.find(item => item.id === id).window;
const surface = (page, id) => page.locator('[data-editor-cell-surface="' + id + '"]');
async function setup(extra = '') {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
  try {
    await page.goto(origin + '/browser-tests/reception-native-editor-fixture.html?tiling=1&session=' + crypto.randomUUID() + extra);
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
  } catch (error) { await browser.close(); throw error; }
  return { browser, page, errors };
}
async function dragTo(page, id, point) {
  const box = await surface(page, id).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 25);
  await page.mouse.down(); await page.mouse.move(point.x, point.y, { steps: 14 });
}
test('native cell preview, free placement, cancellation, storage failure, Undo and reload agree', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    const before = await snapshot(page), id = before.cells[0].id;
    const box = await surface(page, id).boundingBox(), frame = world(before, id), scale = box.width / frame.width;
    const originX = box.x - (frame.left - before.workbench.area.left) * scale;
    const point = { x: originX + before.workbench.area.width * scale - 2, y: box.y + 90 };
    await dragTo(page, id, point);
    assert.deepEqual(await snapshot(page), before, 'preview never writes the draft');
    assert.notDeepEqual(await surface(page,id).boundingBox(),box,'the actual cell follows the pointer');
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + '/drag-right.png' });
    const preview = await surface(page, id).boundingBox();
    await page.mouse.up();
    const after = await snapshot(page), artwork = world(after, id), upper = world(after, 'shape:tiling-top'), lower = world(after, 'shape:tiling-bottom');
    assert.ok(artwork.left > frame.left); assert.equal(upper.left, lower.left); assert.ok(upper.top < lower.top);
    assert.equal(artwork.height, frame.height);
    assert.ok(after.workbench.area.width > before.workbench.area.width);
    for (const c of before.cells) {
      assert.equal(world(after,c.id).width,world(before,c.id).width);
      assert.equal(world(after,c.id).height,world(before,c.id).height);
    }
    const accepted = await surface(page, id).boundingBox();
    assert.ok(Math.abs(preview.x - accepted.x) < 1 && Math.abs(preview.height - accepted.height) < 1);
    assert.deepEqual(after.imageModules, before.imageModules);
    await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/whole-column.png' });
    await dragTo(page, id, { x: originX + 2, y: point.y }); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await snapshot(page), after);
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await dragTo(page, id, { x: originX + 2, y: point.y }); await page.mouse.up();
    await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.deepEqual(await snapshot(page), after);
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await editorCommand(page,'Edit','Undo'); assert.deepEqual(await snapshot(page), before);
    await editorCommand(page,'Edit','Redo'); assert.deepEqual(await snapshot(page), after);
    await page.reload(); await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    assert.deepEqual(await snapshot(page), after); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('preview resizes with automatic article padding settle without a React update loop or document writes', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup('&automaticPadding=1&longText=1');
  try {
    const before = await snapshot(page);
    await editorDestination(page, 'Preview');
    for (const width of [1080, 768, 641, 640, 390, 320, 768, 1080, 390]) {
      const field = (await receptionPreviewControls(page)).getByRole('spinbutton', { name: 'Preview width in pixels', exact: true });
      await field.fill(String(width)); await field.press('Tab');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByRole('region', { name: 'Reception layout', exact: true }).count(), 1);
      assert.deepEqual(await snapshot(page), before, 'preview resizing is a no-write projection');
    }
    const samples = await page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        values.push(document.querySelector('.reception-document-canvas').clientHeight);
      }
      return values;
    });
    assert.equal(new Set(samples.slice(-20)).size, 1, 'content height settles across successive frames');
    const sizes = await page.locator('.reception-document-layer[data-text]').evaluateAll(nodes => nodes.map(node => {
      const owner = document.querySelector('[data-cell-id="' + node.dataset.cellMember + '"]');
      return { cell: owner.getBoundingClientRect().height, text: node.getBoundingClientRect().height,
        bottom: node.getBoundingClientRect().bottom, cellBottom: owner.getBoundingClientRect().bottom };
    }));
    for (const size of sizes) {
      assert.ok(size.cell <= Math.max(240, size.text + 32) + 1, 'bottom-positioned text never multiplies cell height');
      assert.ok(size.bottom <= size.cellBottom - 15, 'automatic phone text retains its bottom margin');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('fluid quote type follows its text frame and restores authored size without document writes', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup('&fluidText=1');
  try {
    // Leave room for a genuine 1440px preview, including its surrounding controls.
    await page.setViewportSize({ width: 1800, height: 1000 });
    const before = await snapshot(page);
    await editorDestination(page, 'Preview');
    for (const [width, maximum] of [[1440,28],[1080,28],[390,17],[320,17],[1440,28]]) {
      const field = (await receptionPreviewControls(page)).getByRole('spinbutton', { name: 'Preview width in pixels', exact: true });
      await field.fill(String(width)); await field.press('Tab');
      await page.evaluate(() => document.fonts.ready);
      const size = await page.locator('.reception-document-layer[data-text] article').first().evaluate(node => {
        const span = node.querySelector('span') || node;
        return parseFloat(getComputedStyle(span).fontSize) * Number(getComputedStyle(node).zoom);
      });
      assert.ok(size >= 15.99 && size <= maximum + .01);
      if (width === 1440) assert.equal(size,28);
      assert.deepEqual(await snapshot(page),before);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('native Image crop preserves Fit, zooms out, cancels and restores through Undo and reload', { timeout: 90000 }, async () => {
  const { browser,page,errors }=await setup();
  try {
    await page.getByRole('button',{name:'Expand Artwork',exact:true}).click();
    await page.getByRole('button',{name:'Select Image',exact:true}).click();
    const before=await snapshot(page);
    const image=page.locator('.image-module__artwork image').first();
    const frame=()=>image.evaluate(n=>['x','y','width','height'].map(a=>n.getAttribute(a)));
    const fitted=await frame();
    await page.getByRole('button',{name:'Crop',exact:true}).first().click();
    assert.deepEqual(await frame(),fitted,'entering crop does not jump from Fit to Fill');
    await page.getByRole('button',{name:'Done',exact:true}).first().click();
    assert.deepEqual(await snapshot(page),before,'opening and closing Crop creates no authored edit');
    await page.getByRole('button',{name:'Crop',exact:true}).first().click();
    const zoom=page.getByRole('slider',{name:'Crop zoom',exact:true}).first();
    await zoom.press('Home');for(let i=0;i<3;i++)await zoom.press('ArrowRight');
    await page.getByRole('button',{name:'Done',exact:true}).first().click();
    const after=await snapshot(page);assert.equal(after.imageModules[0].artwork.crop.zoom,.25);
    await page.getByRole('button',{name:'Crop',exact:true}).first().click();
    await zoom.press('End');await page.getByRole('button',{name:'Cancel',exact:true}).first().click();
    assert.deepEqual(await snapshot(page),after);
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await snapshot(page),before);
    await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await snapshot(page),after);
    await page.reload();await page.getByRole('group',{name:'Artwork bento cell',exact:true}).waitFor();
    assert.deepEqual(await snapshot(page),after);assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('bottom text shrinks proportionally while preserving the minimum reading inset', { timeout: 90000 }, async () => {
  const {browser,page,errors}=await setup('&fluidText=1&positioning=1');
  try {
    const before=await snapshot(page);
    await page.getByRole('button',{name:'Preview',exact:true}).click();
    const sample=()=>page.locator('.reception-document-layer[data-text]').first().evaluate(n=>{
      const owner=document.querySelector('[data-cell-id="'+n.dataset.cellMember+'"]');
      const cell=owner.getBoundingClientRect(),text=n.getBoundingClientRect();
      return {height:text.height,gap:cell.bottom-text.bottom,offset:text.top-cell.top,
        width:document.querySelector('.reception-document-canvas').getBoundingClientRect().width};
    });
    const at=async width=>{
      const field=(await receptionPreviewControls(page)).getByRole('spinbutton',{name:'Preview width in pixels',exact:true});
      await field.fill(String(width));await field.press('Tab');
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      return sample();
    };
    const full=await at(1440);
    for(const width of [1080,768,672]) {
      const small=await at(width),factor=small.width/full.width;
      const gap=Math.max(24,full.gap*factor);
      assert.ok(Math.abs(small.height-((full.height+full.gap)*factor-gap))<2, 'the reading inset bounds the text frame');
      assert.ok(Math.abs(small.offset-full.offset*factor)<2, 'the authored top offset follows the actual canvas width');
      assert.ok(Math.abs(small.gap-gap)<2, 'bottom spacing never falls below the 24px reading inset');
    }
    assert.deepEqual(await at(1440),full);
    assert.deepEqual(await snapshot(page),before);assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
