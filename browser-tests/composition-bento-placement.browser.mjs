import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorCommand } from './fixtures/editor-menu.mjs';
import { addBentoCell } from './fixtures/bento-layout.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/composition-bento-placement';
const composition = page => page.evaluate(() => window.nativeCompositionFixture.root.getDraft().composition);
const frame = (value, id) => value.workbench.shapes.find(r => r.id === id).window;
const surface = (page, id) => page.locator(`[data-editor-cell-surface="${id}"]`);
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const sizes = value => Object.fromEntries(value.cells.map(c => [c.id, { width: frame(value,c.id).width, height: frame(value,c.id).height }]));
async function closeTools(page) {
  const buttons = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
  while (await buttons.count()) await buttons.first().click();
}
async function drag(page, handle, dx, dy) {
  const box = await handle.boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await settle(page);
}
for (const width of [1440, 900]) test(`Bento independent resize, push, free drag, insertion and history (${width})`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }), errors = [];
    page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
    await page.goto(`${origin}/browser-tests/composition-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    await page.locator('.text-module-scroll[data-text-excerpt]').first().waitFor();
    await closeTools(page); await page.getByRole('button', { name: 'Fit canvas in view', exact: true }).click(); await settle(page);
    const before = await composition(page), id = before.cells[0].id;
    await surface(page,id).click();
    const handle = page.getByRole('button', { name: 'Resize cell right', exact: true });
    await drag(page,handle,40,0);
    assert.deepEqual(await composition(page),before,'preview does not save');
    await page.keyboard.press('Escape'); await page.mouse.up(); await page.keyboard.up('Shift'); assert.deepEqual(await composition(page),before);
    await drag(page,handle,40,0);
    const preview = await Promise.all(before.cells.map(async c => [c.id,await surface(page,c.id).boundingBox()]));
    await page.mouse.up(); await page.keyboard.up('Shift'); await settle(page);
    const after = await composition(page);
    assert.ok(frame(after,id).width > frame(before,id).width);
    assert.ok(after.workbench.area.width > before.workbench.area.width);
    for (const cell of before.cells.filter(c=>c.id!==id)) {
      assert.deepEqual(sizes(after)[cell.id],sizes(before)[cell.id]);
      assert.ok(frame(after,cell.id).left > frame(before,cell.id).left);
    }
    assert.deepEqual(after.texts,before.texts,'pushed articles remain authored');
    for (const [cell,box] of preview) {
      const accepted = await surface(page,cell).boundingBox();
      for (const key of ['x','y','width','height']) assert.ok(Math.abs(box[key]-accepted[key]) < 1,'commit matches preview');
    }
    await mkdir(output,{recursive:true}); await page.screenshot({path:`${output}/push-${width}.png`});
    await editorCommand(page,'Edit','Undo'); assert.deepEqual(await composition(page),before);
    await editorCommand(page,'Edit','Redo'); assert.deepEqual(await composition(page),after);
    await surface(page,id).click(); await handle.press('Shift+ArrowLeft');
    const smaller = await composition(page);
    for (const cell of before.cells.filter(c=>c.id!==id)) assert.deepEqual(frame(smaller,cell.id),frame(after,cell.id),'shrinking never compacts');
    await editorCommand(page,'Edit','Undo'); assert.deepEqual(await composition(page),after);
    await surface(page,id).press('Alt+Shift+ArrowDown');
    const moved = await composition(page); assert.deepEqual(sizes(moved),sizes(after));
    assert.equal(frame(moved,id).top,frame(after,id).top+50);
    await editorCommand(page,'Edit','Undo'); assert.deepEqual(await composition(page),after);
    await surface(page,id).click(); await addBentoCell(page,'bottom',id);
    const added=await composition(page); assert.equal(added.cells.length,after.cells.length+1);
    for (const c of after.cells) assert.deepEqual(sizes(added)[c.id],sizes(after)[c.id]);
    await editorCommand(page,'Edit','Undo'); assert.deepEqual(await composition(page),after);
    await page.reload(); await page.getByRole('group',{name:'Artwork bento cell',exact:true}).waitFor();
    assert.deepEqual(await composition(page),after);
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
