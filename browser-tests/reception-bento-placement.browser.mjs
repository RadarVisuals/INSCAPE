import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorMenu, editorCommand, setEditorSidebarOpen } from './fixtures/editor-menu.mjs';
import { addBentoCell } from './fixtures/bento-layout.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-bento-placement';
const reception = page => page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception);
const frame = (value, id) => value.workbench.shapes.find(r => r.id === id).window;
const surface = (page, id) => page.locator(`[data-editor-cell-surface="${id}"]`);
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function closeTools(page) {
  const buttons = page.locator('.workbench-tool-dock').getByRole('button', { name: /^Close /u });
  while (await buttons.count()) await buttons.first().click();
}
async function dragCell(page, id, targetId, side, cancel = false, capture) {
  const before = await reception(page), target = await surface(page, targetId).boundingBox();
  const scale = target.width / frame(before, targetId).width, halfGap = before.bento.gap * scale / 2;
  const start = await surface(page, id).evaluate(node => {
    const r = node.getBoundingClientRect();
    for (const x of [.8, .5, .95, .2]) for (const y of [.5, .25, .75]) {
      const p = { x: r.left + r.width*x, y: r.top + r.height*y };
      if (document.elementFromPoint(p.x,p.y)?.closest('[data-editor-cell-surface]') === node) return p;
    }
    throw Error('No exposed cell drag point');
  });
  const x = side === 'left' ? target.x - halfGap : side === 'right' ? target.x + target.width + halfGap : target.x + target.width / 2;
  const y = side === 'above' ? target.y - halfGap : side === 'below' ? target.y + target.height + halfGap : target.y + target.height / 2;
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(x, y, { steps: 8 }); await settle(page);
  assert.equal(await page.locator('[data-bento-insertion]').count(), 1, 'the actual destination is visible before release');
  assert.deepEqual(await reception(page), before, 'drag preview does not write');
  if (capture) { await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/${capture}.png` }); }
  const previewBounds = await page.locator('[data-bento-insertion]').boundingBox();
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up(); await settle(page);
  assert.equal(await page.locator('[data-bento-insertion]').count(), 0);
  if (cancel) assert.deepEqual(await reception(page), before);
  else {
    assert.deepEqual((await reception(page)).workbench.area, before.workbench.area, 'moving a cell never resizes the Bento');
    const committed = await surface(page, id).boundingBox();
    for (const key of ['x','y','width','height']) assert.ok(Math.abs(committed[key] - previewBounds[key]) < .01, 'release matches the visible destination');
  }
}
for (const width of [1440, 800]) test(`Bento equal snap, free drag, cancel and direct cell insertion (${width})`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }), errors = [];
    page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ path: 'public/' + new URL(route.request().url()).pathname.split('/public/')[1] }));
    await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?session=${crypto.randomUUID()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    if (width === 800) {
      await editorCommand(page, 'Edit', 'Settings'); await page.getByRole('button', { name: 'LIGHT', exact: true }).click();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    await editorMenu(page, 'Bento').click();
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    await panel.getByRole('button', { name: 'New layout', exact: true }).click();
    assert.equal(await panel.getByLabel('Width (px)', { exact: true }).inputValue(), '1440');
    assert.equal(await panel.getByLabel('Height (px)', { exact: true }).inputValue(), '900');
    for (const [label, value] of [['Columns', '2'], ['Rows', '2'], ['Width (px)', '960'], ['Height (px)', '600']]) await panel.getByLabel(label, { exact: true }).fill(value);
    await panel.getByRole('button', { name: /^(Create Bento|Replace layout)$/u }).click();
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await setEditorSidebarOpen(page, false); await closeTools(page); await settle(page);
    for (const axis of ['x', 'y']) {
      const before = await reception(page), d = page.locator(`.reception-bento-divider[data-axis="${axis}"]`).first();
      const data = await page.evaluate(async axis => {
        const { receptionBentoDividers, receptionBentoEqualPosition } = await import('/src/reception/receptionBento.js');
        const value = window.nativeReceptionFixture.root.getDraft().reception;
        const d = receptionBentoDividers(value).find(d => d.axis === axis);
        return { ...d, equal: receptionBentoEqualPosition(value, d) };
      }, axis);
      assert.notEqual(data.equal, null);
      const bounds = await d.boundingBox(), cell = before.cells[0].id;
      const scale = (await surface(page, cell).boundingBox()).width / frame(before, cell).width;
      const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const point = offset => axis === 'x' ? { x: start.x + (data.equal - data.position) * scale + offset, y: start.y }
        : { x: start.x, y: start.y + (data.equal - data.position) * scale + offset };
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      let p = point(14); await page.mouse.move(p.x, p.y, { steps: 4 }); await settle(page);
      assert.equal(await page.locator('.reception-bento-divider[data-equal]').count(), 0, 'outside snap distance, resize remains free');
      p = point(3); await page.mouse.move(p.x, p.y); await settle(page);
      assert.equal(await d.getAttribute('data-equal'), 'true');
      assert.equal(Number(await d.getAttribute('aria-valuenow')), data.equal);
      assert.deepEqual(await reception(page), before, 'preview does not write');
      await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/snap-${axis}-${width}.png` });
      await page.keyboard.press('Escape'); await page.mouse.up();
      assert.deepEqual(await reception(page), before); assert.equal(await d.getAttribute('data-equal'), null);
      const b = await d.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      p = point(14); await page.mouse.move(p.x, p.y, { steps: 4 }); p = point(3); await page.mouse.move(p.x, p.y); await page.mouse.up();
      const saved = await reception(page), size = axis === 'x' ? 'width' : 'height';
      assert.ok(Math.abs(frame(saved, data.before[0])[size] - frame(saved, data.after[0])[size]) <= 1);
      assert.equal(await d.getAttribute('data-equal'), null);
      await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), before);
    }
    const initial = await reception(page), first = initial.cells[0].id;
    await surface(page, first).click(); await addBentoCell(page, 'Left of this row');
    assert.deepEqual((await reception(page)).workbench.area,initial.workbench.area);
    let value = await reception(page), added = value.cells.find(c => !initial.cells.some(old => old.id === c.id));
    assert.equal(frame(value, added.id).left, frame(initial, first).left);
    await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), initial);
    await closeTools(page); await surface(page, first).click(); await addBentoCell(page, 'Above Bento');
    value = await reception(page); const strip = value.cells.find(c => !initial.cells.some(old => old.id === c.id)).id;
    assert.deepEqual(value.workbench.area,initial.workbench.area);
    const stripFrame = frame(value, strip);
    assert.equal(stripFrame.top, value.bento.padding);
    // Make the upper strip genuinely thin, then move it between rows and to
    // both outer edges by dragging. Contents and dimensions travel together.
    const edge = page.getByRole('separator', { name: 'Resize adjacent rows', exact: true }).first();
    const minimum = Number(await edge.getAttribute('aria-valuemin'));
    const position = Number(await edge.getAttribute('aria-valuenow'));
    await edge.focus();
    for (let i = 0; i < Math.floor((position - minimum) / 10) - 2; i++) await edge.press('Shift+ArrowUp');
    value = await reception(page);
    const thin = frame(value, strip), other = value.cells.filter(c => c.id !== strip);
    const upper = other.reduce((a,b) => frame(value,a.id).top < frame(value,b.id).top ? a:b).id;
    const lower = other.reduce((a,b) => frame(value,a.id).top > frame(value,b.id).top ? a:b).id;
    assert.ok(thin.height < 60);
    await closeTools(page);
    await page.locator('main[data-reception-editor]').focus(); await page.keyboard.press('Escape'); await settle(page);
    await page.getByRole('slider',{name:'Workbench zoom',exact:true}).fill('50'); await settle(page);
    const initialBox = await surface(page,strip).boundingBox();
    if(initialBox.x < 320) {
      await page.locator('main[data-reception-editor]').dispatchEvent('wheel',{deltaX:initialBox.x-320,deltaY:0,bubbles:true,cancelable:true}); await settle(page);
    }
    const box = await surface(page, strip).boundingBox();
    await surface(page, strip).click({ position: { x: box.width * .9, y: box.height / 2 } });
    await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('MOVING STRIP CONTENT');
    await page.locator('main[data-reception-editor]').focus();
    await page.waitForFunction(() => JSON.stringify(window.nativeReceptionFixture.root.getDraft().reception.texts).includes('MOVING STRIP CONTENT'));
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click(); await closeTools(page);
    const authoredText = (await reception(page)).texts;
    await dragCell(page, strip, lower, 'above', true);
    await dragCell(page, strip, lower, 'above', false, `strip-middle-preview-${width}`);
    value = await reception(page);
    assert.ok(frame(value, strip).top > frame(value, upper).top && frame(value, strip).top < frame(value, lower).top);
    assert.equal(frame(value, strip).height, thin.height); assert.equal(frame(value, strip).width, thin.width);
    const middle = value;
    await editorCommand(page, 'Edit', 'Undo'); assert.equal(frame(await reception(page), strip).top, thin.top);
    await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), middle);
    await dragCell(page, strip, lower, 'below');
    await dragCell(page, strip, upper, 'above');
    value = await reception(page); assert.equal(frame(value, strip).top, value.bento.padding);
    assert.equal(frame(value, strip).height, thin.height);
    // Four unequal neighbours reproduce the reported growth of artwork in a
    // cell that is pushed aside repeatedly, rather than the cell being dragged.
    const rowTop = frame(value, upper).top;
    const anchor = value.cells.filter(c => frame(value,c.id).top === rowTop).sort((a,b)=>frame(value,a.id).left-frame(value,b.id).left)[0].id;
    const anchorBox = await surface(page, anchor).boundingBox();
    await surface(page, anchor).click({ position: { x: anchorBox.width * .8, y: anchorBox.height / 2 } });
    const addArea = (await reception(page)).workbench.area;
    await addBentoCell(page, 'Right of this row'); await addBentoCell(page, 'Right of this row');
    assert.deepEqual((await reception(page)).workbench.area,addArea);
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    const picker = page.locator('.reception-library-window');
    await picker.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).click();
    await picker.getByRole('button', { name: 'Use selected image', exact: true }).click();
    await page.getByRole('button', { name: 'Back to cells', exact: true }).click(); await closeTools(page);
    value = await reception(page);
    const originalCells = Object.fromEntries(value.cells.map(c => [c.id, frame(value,c.id)]));
    const imageId = value.cells.find(c => c.id === anchor).members.find(id => id.startsWith('image:'));
    const originalImage = value.imageModules.find(image => image.id === imageId);
    const imageCanvas = page.locator(`[data-image-module="${imageId}"] .image-module__canvas`);
    await imageCanvas.waitFor();
    // Workbench paint rounds both outer edges: translation can change the
    // painted extent by one physical pixel while authored dimensions stay exact.
    const paintedImage = await imageCanvas.boundingBox();
    for (let i = 0; i < 6; i++) {
      const before = await reception(page), row = before.cells.filter(c => frame(before,c.id).top === rowTop)
        .sort((a,b)=>frame(before,a.id).left-frame(before,b.id).left);
      assert.equal(row.length, 4);
      const index = row.findIndex(c => c.id === anchor), neighbour = row[index + 1] || row[index - 1];
      const side = index + 1 < row.length ? 'left' : 'right';
      await dragCell(page, neighbour.id, anchor, side, false, i === 0 ? `image-neighbour-before-release-${width}` : undefined);
      value = await reception(page);
      for (const cell of value.cells) {
        assert.equal(frame(value,cell.id).width, originalCells[cell.id].width, 'a pushed neighbour keeps its width');
        assert.equal(frame(value,cell.id).height, originalCells[cell.id].height);
      }
      assert.deepEqual(value.imageModules.find(image => image.id === imageId), originalImage, 'moving neighbours never resizes or rewrites the image');
      const painted = await imageCanvas.boundingBox();
      assert.ok(Math.abs(painted.width - paintedImage.width) <= 1.01 && Math.abs(painted.height - paintedImage.height) <= 1.01, `painted image stays the same size: original=${JSON.stringify(paintedImage)}, actual=${JSON.stringify(painted)}, iteration=${i}`);
      if (i === 0) {
        await editorCommand(page, 'Edit', 'Undo'); assert.deepEqual(await reception(page), before);
        await editorCommand(page, 'Edit', 'Redo'); assert.deepEqual(await reception(page), value);
      }
    }
    // Reproduce the supplied layout: header, three cells and a deep lower
    // band. Pull one of the three cells out as a strip above that lower band.
    const ids = await page.evaluate(anchor => {
      const { root } = window.nativeReceptionFixture, draft = root.getDraft(), value = draft.reception;
      const textCell = value.cells.find(c => c.members.some(id => id.startsWith('text:')));
      const rest = value.cells.filter(c => c.id !== textCell.id && c.id !== anchor);
      const order = [textCell, value.cells.find(c => c.id === anchor), ...rest];
      value.cells = order; value.workbench.area = { left:0, top:0, width:1440, height:900 };
      value.bento = { ...value.bento, gap:24, padding:24 };
      const boxes = [[24,24,1392,40],[24,88,300,160],[348,88,500,160],[872,88,544,160],
        [24,272,300,604],[348,272,500,604],[872,272,544,604]];
      order.forEach((cell,i) => {
        const [left,top,width,height] = boxes[i];
        value.workbench.shapes.find(r => r.id === cell.id).window = {left,top,width,height};
      });
      const image = value.imageModules.find(r => order[1].members.includes(r.id));
      image.width = 80; image.height = 100;
      value.workbench.imageModules.find(r => r.id === image.id).position = {left:34,top:100};
      if (!root.commitCompletedOperation(draft,{expectedGeneration:root.getGeneration()})) throw Error('Could not seed the reported row arrangement');
      return {source:anchor,body:order[4].id};
    },anchor);
    await settle(page); await page.getByRole('button', {name:'Fit canvas in view',exact:true}).click(); await settle(page);
    const sourceBox = await surface(page,ids.source).boundingBox();
    if (sourceBox.x < 320) {
      await page.locator('main[data-reception-editor]').dispatchEvent('wheel',{deltaX:sourceBox.x - 320,deltaY:0,bubbles:true,cancelable:true}); await settle(page);
    }
    await page.mouse.click(width-20,180); await settle(page);
    await page.screenshot({path:`${output}/fixed-frame-before-${width}.png`});
    const beforeStrip = await reception(page);
    await dragCell(page, ids.source, ids.body, 'above', true);
    await dragCell(page, ids.source, ids.body, 'above', false, `fixed-frame-strip-preview-${width}`);
    value = await reception(page);
    assert.deepEqual(value.workbench.area, beforeStrip.workbench.area);
    assert.equal(frame(value,ids.source).height,160);
    assert.equal(frame(value,ids.body).height,420);
    await editorCommand(page,'Edit','Undo'); assert.deepEqual(await reception(page),beforeStrip);
    await editorCommand(page,'Edit','Redo'); assert.deepEqual(await reception(page),value);
    const beforeAddition = value, addedBox = await surface(page,ids.source).boundingBox();
    await surface(page,ids.source).click({position:{x:addedBox.width*.9,y:addedBox.height/2}});
    await addBentoCell(page,'Below Bento');
    value = await reception(page);
    assert.deepEqual(value.workbench.area,beforeAddition.workbench.area, 'adding below also shares the fixed frame');
    assert.equal(value.cells.length,beforeAddition.cells.length+1);
    await editorCommand(page,'Edit','Undo'); assert.deepEqual(await reception(page),beforeAddition);
    await editorCommand(page,'Edit','Redo'); assert.deepEqual(await reception(page),value);

    await surface(page, strip).focus(); await page.keyboard.press('Shift+F10');
    assert.equal(await page.getByRole('menuitem', { name: 'Move cell', exact: true }).count(), 0, 'the obsolete move menu is removed');
    await page.keyboard.press('Escape');
    assert.deepEqual((await reception(page)).texts, authoredText, 'dragging never rewrites article contents');
    const saved = await reception(page); await page.reload(); await page.getByRole('toolbar', { name: 'Creation tools', exact: true }).waitFor();
    assert.deepEqual(await reception(page), saved, 'saved placement survives reload');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${output}/placement-${width}.png` });
  } finally { await browser.close(); }
});
